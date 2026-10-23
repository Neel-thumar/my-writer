/**
 * The writing screen for one document (mounted per document id).
 *
 * Layers of help, from always-on to explicit:
 *  1. Local grammar check while typing → underlines + review panel
 *     (+ optional auto-correct of obvious typos)
 *  2. Fix (Ctrl+E): local one-click spelling & grammar fix, shown as inline changes
 *  3. Rewrite (Ctrl+Shift+E): the user's own cloud AI, only when asked
 */

import { BubbleMenu, EditorContent } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "../api/client";
import type { Route } from "../hooks/useHashRoute";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";
import { useKeyboardShortcut } from "../hooks/useKeyboardShortcut";
import { useLibrary } from "../library/LibraryProvider";
import { TagsPanel } from "../library/TagsPanel";
import { VersionHistoryModal } from "../library/VersionHistoryModal";
import { SuggestionPopup } from "../suggestions/SuggestionPopup";
import { SuggestionsPanel } from "../suggestions/SuggestionsPanel";
import { useSuggestions } from "../suggestions/SuggestionsProvider";
import type { Document, Suggestion } from "../types";
import {
  BoltIcon,
  ChevronDownIcon,
  DownloadIcon,
  FocusIcon,
  HistoryIcon,
  MoreIcon,
  PanelLeftIcon,
  PanelRightIcon,
  SaveIcon,
  SparkleIcon,
  WandIcon,
} from "../ui/icons";
import { Menu, MenuDivider, MenuItem } from "../ui/Menu";
import { useToast } from "../ui/Toast";
import { ChangeBar, ChangePopover } from "./ChangeReview";
import { EditorToolbar } from "./EditorToolbar";
import { getChanges, proposeReplacement, textForRange } from "./inlineChanges";
import { extractDocumentText, resolveSuggestionRange, type DocTextMapping } from "./positionMap";
import { RewriteOptions } from "./RewriteMenu";
import { findHighlightRange, setHighlights } from "./suggestionHighlights";
import { useWritingEditor } from "./useWritingEditor";

interface EditorScreenProps {
  docId: number;
  navigate: (to: Route) => void;
  focusMode: boolean;
  onToggleFocus: () => void;
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  onOpenSettings: (section?: "ai") => void;
  checkCategories: Record<string, boolean>;
  rewriteConfigured: boolean;
  autoCorrect: boolean;
  onToggleAutoCorrect: () => void;
}

type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";
const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

function countWords(doc: PMNode): number {
  return doc.textBetween(0, doc.content.size, " ", " ").split(/\s+/).filter(Boolean).length;
}

export function EditorScreen({
  docId,
  navigate,
  focusMode,
  onToggleFocus,
  sidebarCollapsed,
  onExpandSidebar,
  onOpenSettings,
  checkCategories,
  rewriteConfigured,
  autoCorrect,
  onToggleAutoCorrect,
}: EditorScreenProps) {
  const toast = useToast();
  const lib = useLibrary();
  const {
    suggestions,
    checkAll,
    clear,
    setAcceptHandler,
    setBatchAcceptHandler,
    acceptSuggestion,
    acceptBatchSuggestions,
    activeSuggestion,
    setActiveSuggestion,
  } = useSuggestions();

  const [doc, setDoc] = useState<Document | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [showHistory, setShowHistory] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => localStorage.getItem("review-panel") !== "closed");
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [activeChange, setActiveChange] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [aiBusy, setAiBusy] = useState<null | "fix" | "rewrite">(null);
  const [changeSource, setChangeSource] = useState("");
  const [rewriteOpen, setRewriteOpen] = useState(false);

  const loadedRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const titleRef = useRef("");
  titleRef.current = title;
  const lastDocRef = useRef<PMNode | null>(null);
  const lastMappingRef = useRef<DocTextMapping | null>(null);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runCheckRef = useRef<() => void>(() => {});

  const scheduleCheck = useCallback(() => {
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    checkTimerRef.current = setTimeout(() => runCheckRef.current(), 600);
  }, []);

  const markDirty = () => {
    pendingSaveRef.current = true;
    setSaveStatus("unsaved");
    debouncedSave();
  };

  const editor = useWritingEditor(
    null,
    () => {
      if (!loadedRef.current || !editor) return;
      lastDocRef.current = editor.state.doc;
      markDirty();
      scheduleCheck();
    },
    (id, rect) => {
      const s = suggestions.find((x) => x.id === id);
      if (s) {
        setActiveSuggestion(s);
        setAnchorRect(rect);
      }
    },
    (id, rect) => setActiveChange({ id, rect }),
  );

  // ---------------------------------------------------------------- loading
  useEffect(() => {
    let cancelled = false;
    clear();
    api
      .getDocument(docId)
      .then((d) => {
        if (cancelled) return;
        if (d.deleted_at) {
          setLoadError("This document is in the Trash.");
          return;
        }
        setDoc(d);
        setTitle(d.title);
        localStorage.setItem("lastDocId", String(d.id));
      })
      .catch((err) => !cancelled && setLoadError(err instanceof ApiError && err.status === 404 ? "Document not found." : String(err.message)));
    return () => {
      cancelled = true;
    };
  }, [docId, clear]);

  // Put the content into the editor once both exist
  useEffect(() => {
    if (!editor || !doc || loadedRef.current) return;
    const content = doc.content && Object.keys(doc.content).length > 0 ? doc.content : EMPTY_DOC;
    editor.commands.setContent(content, false);
    lastDocRef.current = editor.state.doc;
    loadedRef.current = true;
    if (!doc.title || doc.title === "Untitled") {
      // Fresh document: start typing the title right away
      document.getElementById("doc-title")?.focus();
    } else {
      editor.commands.focus("end");
    }
    scheduleCheck(); // underline existing issues right away
  }, [editor, doc, scheduleCheck]);

  // ----------------------------------------------------------------- saving
  const saveNow = useCallback(
    async (createVersion = false) => {
      if (!editor || !loadedRef.current) return;
      pendingSaveRef.current = false;
      setSaveStatus("saving");
      try {
        const updated = await api.updateDocument(docId, {
          title: titleRef.current,
          content: editor.getJSON(),
          create_version: createVersion,
        });
        lib.upsertDocument(updated);
        setSaveStatus(pendingSaveRef.current ? "unsaved" : "saved");
        if (createVersion) toast.show("Saved a version to History", { tone: "success" });
      } catch (err) {
        pendingSaveRef.current = true;
        setSaveStatus("error");
        toast.show(`Couldn't save: ${(err as Error).message}`, { tone: "error" });
      }
    },
    [editor, docId, lib, toast],
  );

  const { debounced: debouncedSave, flush: cancelPendingSave } = useDebouncedCallback(() => saveNow(false), 1200);

  // Leaving the document (route change unmounts this screen) or closing the tab: save what's pending
  useEffect(() => {
    const flushOnExit = () => {
      if (!pendingSaveRef.current || !lastDocRef.current) return;
      pendingSaveRef.current = false;
      api.saveDocumentOnExit(docId, { title: titleRef.current, content: lastDocRef.current.toJSON() });
    };
    window.addEventListener("pagehide", flushOnExit);
    return () => {
      window.removeEventListener("pagehide", flushOnExit);
      flushOnExit();
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, [docId]);

  useKeyboardShortcut(
    "ctrl+s",
    useCallback(() => {
      cancelPendingSave();
      saveNow(true);
    }, [cancelPendingSave, saveNow]),
  );

  // ------------------------------------------------------ grammar & suggestions
  const rangeFor = useCallback(
    (s: Suggestion): { from: number; to: number } | null => {
      if (!editor) return null;
      const hl = findHighlightRange(editor.state, s.id);
      if (hl && (!s.error_text || editor.state.doc.textBetween(hl.from, hl.to) === s.error_text)) return hl;
      return resolveSuggestionRange(editor.state.doc, s, lastMappingRef.current);
    },
    [editor],
  );

  useEffect(() => {
    if (!editor) return;
    setAcceptHandler((s, replacement) => {
      const r = rangeFor(s);
      if (r) editor.view.dispatch(editor.state.tr.insertText(replacement, r.from, r.to));
    });
    setBatchAcceptHandler((items) => {
      const resolved = items
        .map((it) => ({ ...it, range: rangeFor(it.suggestion) }))
        .filter((it): it is typeof it & { range: { from: number; to: number } } => it.range !== null)
        .sort((a, b) => b.range.from - a.range.from);
      // One transaction (one undo step), applied back to front; skip overlaps
      const tr = editor.state.tr;
      let applied = 0;
      let lowest = Infinity;
      for (const it of resolved) {
        if (it.range.to > lowest) continue;
        tr.insertText(it.replacement, it.range.from, it.range.to);
        lowest = it.range.from;
        applied++;
      }
      if (applied) editor.view.dispatch(tr);
      return applied;
    });
  }, [editor, rangeFor, setAcceptHandler, setBatchAcceptHandler]);

  // Keep underlines in sync with the suggestion list
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    setHighlights(
      editor.view,
      suggestions.flatMap((s) => {
        const r = rangeFor(s);
        return r ? [{ id: s.id, type: s.type, ...r }] : [];
      }),
    );
  }, [editor, suggestions, rangeFor]);

  runCheckRef.current = async () => {
    if (!editor || editor.isDestroyed) return;
    const docAtCheck = editor.state.doc;
    const mapping = extractDocumentText(docAtCheck);
    lastMappingRef.current = mapping;
    const cats = Object.entries(checkCategories)
      .filter(([, on]) => on)
      .map(([c]) => c);
    const found = await checkAll(mapping.text, cats);
    // Superseded, or the user kept typing — another check is on its way
    if (!found || editor.isDestroyed || editor.state.doc !== docAtCheck) return;

    if (autoCorrect && found.length > 0 && getChanges(editor.state).length === 0) {
      const cursor = editor.state.selection.from;
      const fixes = found
        .filter((s) => s.replacements.length > 0 && (s.type === "spelling" || s.type === "punctuation"))
        // Leave names alone, and never touch the word being typed
        .filter((s) => !(s.type === "spelling" && /^[A-Z]/.test(s.error_text ?? "")))
        .filter((s) => {
          const r = resolveSuggestionRange(docAtCheck, s, mapping);
          return r !== null && (cursor < r.from || cursor > r.to);
        })
        .map((s) => ({ suggestion: s, replacement: s.replacements[0].value }));
      if (fixes.length) {
        const applied = acceptBatchSuggestions(fixes);
        if (applied) {
          const summary = fixes
            .slice(0, 2)
            .map((f) => `${f.suggestion.error_text} → ${f.replacement}`)
            .join(", ");
          toast.show(`Auto-corrected ${summary}${applied > 2 ? ` +${applied - 2}` : ""}`, {
            action: { label: "Undo", onClick: () => editor.commands.undo() },
          });
        }
      }
    }
  };

  const showSuggestion = useCallback(
    (s: Suggestion) => {
      setActiveSuggestion(s);
      if (!editor) return;
      const el = editor.view.dom.querySelector(`[data-suggestion-id="${CSS.escape(s.id)}"]`);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        // Measure after the scroll settles so the popup lands on the word
        setTimeout(() => setAnchorRect(el.getBoundingClientRect()), 250);
      }
    },
    [editor, setActiveSuggestion],
  );

  useKeyboardShortcut("alt+arrowdown", () => {
    if (!suggestions.length) return;
    const i = activeSuggestion ? suggestions.findIndex((s) => s.id === activeSuggestion.id) : -1;
    showSuggestion(suggestions[(i + 1) % suggestions.length]);
  });
  useKeyboardShortcut("ctrl+enter", () => {
    if (activeSuggestion?.replacements.length) acceptSuggestion(activeSuggestion, activeSuggestion.replacements[0].value);
  });

  // ------------------------------------------------------------ Fix & Rewrite
  /** Selection if any, else the paragraph the cursor is in. */
  const targetRange = useCallback(
    (whole = false): { from: number; to: number } | null => {
      if (!editor) return null;
      if (whole) return { from: 0, to: editor.state.doc.content.size };
      const { from, to, empty, $from } = editor.state.selection;
      if (!empty) return { from, to };
      return $from.parent.isTextblock ? { from: $from.start(), to: $from.end() } : null;
    },
    [editor],
  );

  const runAi = useCallback(
    async (kind: "fix" | "rewrite", opts: { whole?: boolean; tone?: string; instruction?: string } = {}) => {
      if (!editor || aiBusy) return;
      if (getChanges(editor.state).length) {
        toast.show("Review the current changes first — Tab accepts all, Esc rejects all");
        return;
      }
      const range = targetRange(opts.whole);
      const original = range ? textForRange(editor.state, range.from, range.to).text : "";
      if (!range || !original.trim()) {
        toast.show("Put the cursor in some text, or select what to " + (kind === "fix" ? "fix" : "rewrite"));
        return;
      }
      setAiBusy(kind);
      try {
        let result: string;
        if (kind === "fix") {
          result = (await api.fixText(original)).fixed;
        } else {
          result = (await api.rewriteText(original, opts.tone ?? "improve", opts.instruction)).rewritten;
          result = result.replace(/\n\s*\n/g, "\n"); // models often add blank lines between paragraphs
        }
        if (editor.isDestroyed) return;
        if (textForRange(editor.state, range.from, range.to).text !== original) {
          toast.show("The text changed while working on it — try again");
          return;
        }
        const n = proposeReplacement(editor.view, range.from, range.to, result);
        if (n === 0) {
          toast.show(kind === "fix" ? "No mistakes found" : "The AI suggested no changes", { tone: "success" });
        } else {
          setChangeSource(kind === "fix" ? "Fix" : "Rewrite");
          // Collapse the selection so the highlighted changes are visible
          // (and the selection bubble goes away) while reviewing
          editor.chain().setTextSelection(editor.state.selection.to).focus().run();
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          toast.show((err as Error).message, { action: { label: "Set up", onClick: () => onOpenSettings("ai") } });
        } else {
          toast.show((err as Error).message, { tone: "error" });
        }
      } finally {
        setAiBusy(null);
      }
    },
    [editor, aiBusy, targetRange, toast, onOpenSettings],
  );

  useKeyboardShortcut("ctrl+e", useCallback(() => runAi("fix"), [runAi]));
  useKeyboardShortcut("ctrl+shift+e", () => setRewriteOpen(true));

  const pickRewrite = (close: () => void) => (tone: string, instruction?: string) => {
    close();
    runAi("rewrite", { tone, instruction });
  };

  // ------------------------------------------------------------------ misc
  const handleExport = async () => {
    try {
      const blob = await api.exportDocument(docId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "Untitled"}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.show(`Export failed: ${(err as Error).message}`, { tone: "error" });
    }
  };

  const togglePanel = () =>
    setPanelOpen((v) => {
      localStorage.setItem("review-panel", v ? "closed" : "open");
      return !v;
    });

  const words = useMemo(() => (editor ? countWords(editor.state.doc) : 0), [editor, editor?.state.doc]);
  const folder = doc?.folder_id ? lib.folders.find((f) => f.id === doc.folder_id) : undefined;

  if (loadError) {
    return (
      <div className="flex-1 grid place-items-center">
        <div className="text-center space-y-3">
          <p className="text-ink-500">{loadError}</p>
          <button type="button" onClick={() => navigate({ page: "home" })} className="text-sm text-accent-600 hover:underline cursor-pointer">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const statusText: Record<SaveStatus, string> = {
    idle: "",
    unsaved: "Editing…",
    saving: "Saving…",
    saved: "Saved",
    error: "Not saved — retrying on next edit",
  };

  const aiButton =
    "flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-60";

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Header */}
      {/* relative z-40: backdrop-blur makes the header its own layer, so it needs a
          z-index or its dropdowns slide under the writing area (see index.css) */}
      <header className="relative z-40 flex items-center gap-2 h-12 px-3 sm:px-4 border-b border-ink-200/70 dark:border-ink-800 bg-ink-50/80 dark:bg-ink-950/80 backdrop-blur shrink-0">
        {(sidebarCollapsed || focusMode) && (
          <button
            type="button"
            onClick={focusMode ? onToggleFocus : onExpandSidebar}
            className="p-1.5 rounded-md text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 cursor-pointer"
            title={focusMode ? "Exit focus mode (Ctrl+Shift+F)" : "Show sidebar (Ctrl+\\)"}
          >
            <PanelLeftIcon size={16} />
          </button>
        )}
        <nav className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
          <button type="button" onClick={() => navigate({ page: "home" })} className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 cursor-pointer shrink-0">
            Home
          </button>
          {folder && (
            <>
              <span className="text-ink-300">/</span>
              <button
                type="button"
                onClick={() => navigate({ page: "folder", id: folder.id })}
                className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 cursor-pointer truncate max-w-[10rem]"
              >
                {folder.name}
              </button>
            </>
          )}
          <span className="text-ink-300">/</span>
          <span className="text-ink-700 dark:text-ink-200 truncate">{title || "Untitled"}</span>
          <span className={`ml-2 text-xs shrink-0 ${saveStatus === "error" ? "text-red-500" : "text-ink-400"}`}>
            {statusText[saveStatus]}
          </span>
        </nav>

        <button
          type="button"
          onClick={() => runAi("fix")}
          disabled={!!aiBusy}
          className={`${aiButton} bg-accent-600 hover:bg-accent-700 text-white shadow-sm`}
          title="Fix spelling & grammar in the selection or current paragraph — runs locally (Ctrl+E)"
        >
          <WandIcon size={15} className={aiBusy === "fix" ? "animate-spin" : ""} />
          <span className="hidden sm:inline">{aiBusy === "fix" ? "Fixing…" : "Fix"}</span>
        </button>

        <Menu
          open={rewriteOpen}
          onOpenChange={setRewriteOpen}
          width="w-64"
          title="Rewrite with AI (Ctrl+Shift+E)"
          trigger={() => (
            <span
              className={`${aiButton} border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 hover:bg-white dark:hover:bg-ink-800 ${aiBusy ? "opacity-60" : ""}`}
            >
              <SparkleIcon size={15} className={`text-accent-500 ${aiBusy === "rewrite" ? "animate-pulse" : ""}`} />
              <span className="hidden sm:inline">{aiBusy === "rewrite" ? "Rewriting…" : "Rewrite"}</span>
              <ChevronDownIcon size={13} className="text-ink-400" />
            </span>
          )}
        >
          {(close) => (
            <RewriteOptions
              configured={rewriteConfigured}
              onPick={pickRewrite(close)}
              onSetup={() => {
                close();
                onOpenSettings("ai");
              }}
            />
          )}
        </Menu>

        {!focusMode && (
          <button
            type="button"
            onClick={togglePanel}
            className={`relative p-2 rounded-lg cursor-pointer ${
              panelOpen ? "text-accent-600 bg-accent-50 dark:bg-accent-950/50" : "text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
            }`}
            title={panelOpen ? "Hide review panel" : "Show review panel"}
          >
            <PanelRightIcon size={16} />
            {suggestions.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center">
                {suggestions.length}
              </span>
            )}
          </button>
        )}

        <Menu
          title="More"
          trigger={() => (
            <span className="p-2 rounded-lg text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 inline-flex">
              <MoreIcon size={16} />
            </span>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={<SaveIcon size={14} />} label="Save version" hint="Ctrl S" onClick={() => (close(), cancelPendingSave(), saveNow(true))} />
              <MenuItem icon={<HistoryIcon size={14} />} label="Version history" onClick={() => (close(), setShowHistory(true))} />
              <MenuDivider />
              <MenuItem icon={<WandIcon size={14} />} label="Fix whole document" onClick={() => (close(), runAi("fix", { whole: true }))} />
              <MenuItem
                icon={<BoltIcon size={14} />}
                label={`Auto-correct typos: ${autoCorrect ? "on" : "off"}`}
                onClick={() => (close(), onToggleAutoCorrect())}
              />
              <MenuDivider />
              <MenuItem icon={<FocusIcon size={14} />} label={focusMode ? "Exit focus mode" : "Focus mode"} hint="Ctrl⇧F" onClick={() => (close(), onToggleFocus())} />
              <MenuItem icon={<DownloadIcon size={14} />} label="Export as .docx" onClick={() => (close(), handleExport())} />
            </>
          )}
        </Menu>
      </header>

      {!focusMode && (
        <div className="flex items-center h-10 px-3 sm:px-4 border-b border-ink-200/70 dark:border-ink-800 shrink-0 overflow-x-auto">
          <EditorToolbar editor={editor} />
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Writing area */}
        <div className="flex-1 min-w-0 relative">
          <div className="h-full overflow-y-auto">
            <div className={`mx-auto px-6 sm:px-10 pt-12 pb-40 ${focusMode ? "max-w-2xl" : "max-w-3xl"}`}>
              <input
                id="doc-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  markDirty();
                }}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === "ArrowDown") && editor) {
                    e.preventDefault();
                    // Move focus synchronously: commands.focus() waits a frame,
                    // and the next keystroke would still land in the title
                    editor.commands.setTextSelection(1);
                    editor.view.focus();
                  }
                }}
                placeholder="Untitled"
                className="w-full bg-transparent text-4xl font-serif font-semibold text-ink-900 dark:text-ink-50 placeholder-ink-300 dark:placeholder-ink-700 focus:outline-none mb-3"
              />
              {!focusMode && doc && (
                <div className="mb-8">
                  <TagsPanel docId={doc.id} />
                </div>
              )}
              <EditorContent editor={editor} />
            </div>
          </div>

          {editor && <ChangeBar editor={editor} source={changeSource} />}

          {/* BubbleMenu moves its element into a floating layer, so it needs a
              stable wrapper or React can't insert siblings next to it */}
          <div>
          {editor && (
            <BubbleMenu
              editor={editor}
              // tippy defaults to z-index 9999, which would float over Settings
              tippyOptions={{ duration: 120, placement: "top", zIndex: 30 }}
              shouldShow={({ state }) => !state.selection.empty && getChanges(state).length === 0}
            >
              <div className="flex items-center gap-0.5 p-1 rounded-xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 shadow-lg">
                <button
                  type="button"
                  onClick={() => runAi("fix")}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium text-accent-700 dark:text-accent-300 hover:bg-accent-50 dark:hover:bg-accent-950/50 cursor-pointer"
                >
                  <WandIcon size={14} /> Fix
                </button>
                <button
                  type="button"
                  onClick={() => setRewriteOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium text-ink-700 dark:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 cursor-pointer"
                >
                  <SparkleIcon size={14} className="text-accent-500" /> Rewrite
                </button>
                <div className="w-px h-4 bg-ink-200 dark:bg-ink-700 mx-0.5" />
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`w-7 h-7 rounded-lg font-bold text-sm cursor-pointer ${editor.isActive("bold") ? "bg-ink-200 dark:bg-ink-700" : "hover:bg-ink-100 dark:hover:bg-ink-800"}`}
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`w-7 h-7 rounded-lg italic font-serif text-sm cursor-pointer ${editor.isActive("italic") ? "bg-ink-200 dark:bg-ink-700" : "hover:bg-ink-100 dark:hover:bg-ink-800"}`}
                >
                  I
                </button>
              </div>
            </BubbleMenu>
          )}
          </div>
        </div>

        {panelOpen && !focusMode && <SuggestionsPanel onSuggestionClick={showSuggestion} onClose={togglePanel} />}
      </div>

      {/* Status bar */}
      <footer className="flex items-center gap-4 h-8 px-4 border-t border-ink-200/70 dark:border-ink-800 text-xs text-ink-400 shrink-0">
        <span>
          {words} word{words === 1 ? "" : "s"}
        </span>
        <span className="hidden sm:inline">{Math.max(1, Math.round(words / 230))} min read</span>
        <button
          type="button"
          onClick={onToggleAutoCorrect}
          className={`flex items-center gap-1 cursor-pointer ${autoCorrect ? "text-emerald-600 dark:text-emerald-400" : "hover:text-ink-600"}`}
          title="Automatically fix obvious typos when you pause"
        >
          <BoltIcon size={12} /> Auto-correct {autoCorrect ? "on" : "off"}
        </button>
        <span className="ml-auto hidden md:inline">
          <kbd className="font-sans">Ctrl E</kbd> fix · <kbd className="font-sans">Ctrl ⇧ E</kbd> rewrite · <kbd className="font-sans">Ctrl S</kbd> save version
        </span>
      </footer>

      <SuggestionPopup suggestion={activeSuggestion} anchorRect={anchorRect} />
      {editor && activeChange && (
        <ChangePopover editor={editor} changeId={activeChange.id} rect={activeChange.rect} onClose={() => setActiveChange(null)} />
      )}

      {showHistory && (
        <VersionHistoryModal
          docId={docId}
          onClose={() => setShowHistory(false)}
          onRestore={async () => {
            const updated = await api.getDocument(docId);
            if (editor) {
              editor.commands.setContent(
                updated.content && Object.keys(updated.content).length > 0 ? updated.content : EMPTY_DOC,
                false,
              );
              lastDocRef.current = editor.state.doc;
            }
            setTitle(updated.title);
            lib.upsertDocument(updated);
            scheduleCheck();
          }}
        />
      )}
    </div>
  );
}
