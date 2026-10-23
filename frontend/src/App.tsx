import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent } from "@tiptap/react";
import { ThemeProvider, useTheme } from "./theme/ThemeProvider";
import { SuggestionsProvider, useSuggestions } from "./suggestions/SuggestionsProvider";
import { SuggestionPopup } from "./suggestions/SuggestionPopup";
import { SuggestionsPanel } from "./suggestions/SuggestionsPanel";
import { LibrarySidebar } from "./library/LibrarySidebar";
import { EditorToolbar } from "./editor/EditorToolbar";
import { useWritingEditor } from "./editor/useWritingEditor";
import { useDebouncedCallback } from "./hooks/useDebouncedCallback";
import { useKeyboardShortcut } from "./hooks/useKeyboardShortcut";
import { api } from "./api/client";
import type { Document, Suggestion as SuggestionType } from "./types";
import { VersionHistoryModal } from "./library/VersionHistoryModal";
import { TagsPanel } from "./library/TagsPanel";
import { RecentDocuments } from "./library/RecentDocuments";
import { SettingsModal } from "./library/SettingsModal";
import { RewriteModal } from "./suggestions/RewriteModal";
import { AiCorrectModal } from "./suggestions/AiCorrectModal";
import {
  extractDocumentText,
  resolveSuggestionRange,
  type DocTextMapping,
} from "./editor/positionMap";
import { findHighlightRange, setHighlights } from "./editor/suggestionHighlights";

function Workspace() {
  const { theme, toggleTheme } = useTheme();
  const {
    suggestions,
    checking,
    checkAll,
    clear,
    setAcceptHandler,
    setBatchAcceptHandler,
    acceptSuggestion,
    acceptBatchSuggestions,
    activeSuggestion,
    setActiveSuggestion,
  } = useSuggestions();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarKey, setSidebarKey] = useState(0);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Track which document ID is currently loaded into the editor
  const loadedDocIdRef = useRef<number | null>(null);

  // Rewrite Modal state
  const [showRewrite, setShowRewrite] = useState(false);
  const [rewriteText, setRewriteText] = useState("");
  const [rewriteRange, setRewriteRange] = useState<{ from: number; to: number } | null>(null);

  // AI Bulk Correction Modal state
  const [showAiCorrect, setShowAiCorrect] = useState(false);
  const [aiCorrectText, setAiCorrectText] = useState("");
  const [aiCorrectRange, setAiCorrectRange] = useState<{ from: number; to: number } | null>(null);

  // Auto-correct mode state (persisted in localStorage)
  const [autoCorrectMode, setAutoCorrectMode] = useState<boolean>(() => {
    return localStorage.getItem("autoCorrectMode") === "true";
  });
  const [autoCorrectToast, setAutoCorrectToast] = useState<string | null>(null);

  const [checkCategories, setCheckCategories] = useState<Record<string, boolean>>({
    spelling: true,
    grammar: true,
    punctuation: true,
    style: true,
  });
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(false);
  const [backupPath, setBackupPath] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cache document text mapping from last check
  const lastDocMappingRef = useRef<DocTextMapping | null>(null);

  // Toggle Auto-correct mode and persist
  const handleToggleAutoCorrect = useCallback(() => {
    setAutoCorrectMode((prev) => {
      const next = !prev;
      localStorage.setItem("autoCorrectMode", String(next));
      return next;
    });
  }, []);

  // True while there are edits the server hasn't received yet
  const pendingSaveRef = useRef(false);

  // Create the editor
  const editor = useWritingEditor(
    selectedDoc?.content ?? null,
    () => {
      pendingSaveRef.current = true;
      setSaveStatus("saving");
      debouncedSave();
    },
    // Clicking an underlined word opens its suggestion
    (id, rect) => {
      const s = suggestions.find((x) => x.id === id);
      if (s) {
        setActiveSuggestion(s);
        setAnchorRect(rect);
      }
    },
  );

  // Ensure editor content synchronizes whenever selectedDoc changes
  useEffect(() => {
    if (!editor || !selectedDoc) return;
    if (loadedDocIdRef.current !== selectedDoc.id) {
      loadedDocIdRef.current = selectedDoc.id;
      localStorage.setItem("selectedDocId", String(selectedDoc.id));
      const content =
        selectedDoc.content && Object.keys(selectedDoc.content).length > 0
          ? selectedDoc.content
          : { type: "doc", content: [{ type: "paragraph" }] };
      editor.commands.setContent(content, false);
    }
  }, [editor, selectedDoc]);

  /** Get the text for AI rewrite or bulk correction: selected text, or cursor's paragraph. */
  const getRewriteSelection = useCallback((): { text: string; from: number; to: number } | null => {
    if (!editor) return null;
    const { from, to, empty } = editor.state.selection;

    if (!empty && from !== to) {
      const text = editor.state.doc.textBetween(from, to, "\n");
      if (text.trim()) return { text, from, to };
    }

    // No selection — use the text content of the current paragraph
    const $from = editor.state.selection.$from;
    const paraStart = $from.start();
    const paraEnd = $from.end();
    const paraText = editor.state.doc.textBetween(paraStart, paraEnd, "\n");
    if (paraText.trim()) return { text: paraText, from: paraStart, to: paraEnd };

    return null;
  }, [editor]);

  /** Replace a text range in the editor with new text, keeping line breaks as paragraphs. */
  const applyRewrite = useCallback((range: { from: number; to: number }, newText: string) => {
    if (!editor) return;
    const lines = newText.split(/\n+/);
    if (lines.length <= 1) {
      editor.view.dispatch(editor.state.tr.insertText(newText, range.from, range.to));
      return;
    }
    editor
      .chain()
      .insertContentAt(
        range,
        lines.map((line) => ({
          type: "paragraph",
          content: line ? [{ type: "text", text: line }] : [],
        })),
      )
      .run();
  }, [editor]);

  // Debounced autosave — saves document quietly to DB without spamming version history
  const { debounced: debouncedSave, flush: cancelPendingSave } = useDebouncedCallback(async () => {
    if (!editor || !selectedDoc) return;
    // Safety check: ensure editor currently has this document loaded
    if (loadedDocIdRef.current !== selectedDoc.id) return;
    try {
      const json = editor.getJSON();
      // create_version: false prevents creating an entry in version history on autosave
      await api.updateDocument(selectedDoc.id, {
        title: selectedDoc.title,
        content: json,
        create_version: false,
      });
      pendingSaveRef.current = false;
      setSaveStatus("saved");
      setSidebarKey((k) => k + 1);
    } catch (err) {
      console.error("Autosave failed:", err);
      setSaveStatus("idle");
    }
  }, 1500);

  // If the tab closes before autosave fires, push the latest edits out anyway
  useEffect(() => {
    const onExit = () => {
      if (!pendingSaveRef.current || !editor || !selectedDoc) return;
      if (loadedDocIdRef.current !== selectedDoc.id) return;
      api.saveDocumentOnExit(selectedDoc.id, { title: selectedDoc.title, content: editor.getJSON() });
      pendingSaveRef.current = false;
    };
    window.addEventListener("pagehide", onExit);
    return () => window.removeEventListener("pagehide", onExit);
  }, [editor, selectedDoc]);

  // Manual save handler (Ctrl+S) — saves document AND creates a Version History snapshot
  const handleManualSave = useCallback(async () => {
    if (!editor || !selectedDoc) return;
    if (loadedDocIdRef.current !== selectedDoc.id) return;
    cancelPendingSave();
    setSaveStatus("saving");
    try {
      const json = editor.getJSON();
      // create_version: true records a milestone version in history
      const updated = await api.updateDocument(selectedDoc.id, {
        title: selectedDoc.title,
        content: json,
        create_version: true,
      });
      pendingSaveRef.current = false;
      // Keep the local title in case the user kept typing in it meanwhile
      setSelectedDoc((prev) => (prev && prev.id === updated.id ? { ...updated, title: prev.title } : prev));
      setSaveStatus("saved");
      setSidebarKey((k) => k + 1);
      setAutoCorrectToast("📸 Saved to Version History (Ctrl+S)");
      setTimeout(() => setAutoCorrectToast(null), 3000);
    } catch (err) {
      console.error("Manual save failed:", err);
      setSaveStatus("idle");
    }
  }, [editor, selectedDoc]);

  // Shortcut for Ctrl+S: Save Version History snapshot
  useKeyboardShortcut("ctrl+s", handleManualSave);

  /**
   * Where a suggestion currently sits in the document. The in-text underline
   * follows edits, so prefer it; fall back to the offsets from the last check.
   */
  const rangeFor = useCallback(
    (s: SuggestionType): { from: number; to: number } | null => {
      if (!editor) return null;
      const { doc } = editor.state;
      const hl = findHighlightRange(editor.state, s.id);
      if (hl && (!s.error_text || doc.textBetween(hl.from, hl.to) === s.error_text)) return hl;
      return resolveSuggestionRange(doc, s, lastDocMappingRef.current);
    },
    [editor],
  );

  // Register single suggestion accept handler
  useEffect(() => {
    if (!editor) return;
    setAcceptHandler((suggestion: SuggestionType, replacement: string) => {
      const range = rangeFor(suggestion);
      if (range) editor.view.dispatch(editor.state.tr.insertText(replacement, range.from, range.to));
    });
  }, [editor, setAcceptHandler, rangeFor]);

  // Register batch suggestion accept handler — one transaction, so a single undo reverts it
  useEffect(() => {
    if (!editor) return;
    setBatchAcceptHandler((items) => {
      const resolved = items
        .map((it) => ({ ...it, range: rangeFor(it.suggestion) }))
        .filter((it): it is typeof it & { range: { from: number; to: number } } => it.range !== null)
        .sort((a, b) => b.range.from - a.range.from);
      // Apply from the end backwards so earlier positions stay valid; skip overlaps
      const tr = editor.state.tr;
      let applied = 0;
      let lowestFrom = Infinity;
      for (const it of resolved) {
        if (it.range.to > lowestFrom) continue;
        tr.insertText(it.replacement, it.range.from, it.range.to);
        lowestFrom = it.range.from;
        applied++;
      }
      if (applied > 0) editor.view.dispatch(tr);
      return applied;
    });
  }, [editor, setBatchAcceptHandler, rangeFor]);

  // Keep the in-text underlines in sync with the suggestion list
  useEffect(() => {
    if (!editor) return;
    const ranges = suggestions.flatMap((s) => {
      const r = rangeFor(s);
      return r ? [{ id: s.id, type: s.type, ...r }] : [];
    });
    setHighlights(editor.view, ranges);
  }, [editor, suggestions, rangeFor]);

  /** Open the popup for a suggestion, scrolling its word into view. */
  const showSuggestion = useCallback(
    (s: SuggestionType) => {
      setActiveSuggestion(s);
      if (!editor) return;
      const el = editor.view.dom.querySelector(`[data-suggestion-id="${CSS.escape(s.id)}"]`);
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        setAnchorRect(el.getBoundingClientRect());
        return;
      }
      const range = rangeFor(s);
      if (range) {
        const a = editor.view.coordsAtPos(range.from);
        const b = editor.view.coordsAtPos(range.to);
        setAnchorRect(new DOMRect(a.left, a.top, Math.max(1, b.right - a.left), a.bottom - a.top));
      }
    },
    [editor, rangeFor, setActiveSuggestion],
  );

  // Grammar check: runs when user pauses typing (debounced)
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!editor || !selectedDoc) return;

    const handleUpdate = () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
      checkTimeoutRef.current = setTimeout(async () => {
        const docAtCheck = editor.state.doc;
        const mapping = extractDocumentText(docAtCheck);
        lastDocMappingRef.current = mapping;

        const enabledCats = Object.entries(checkCategories)
          .filter(([, enabled]) => enabled)
          .map(([cat]) => cat);

        const newSuggestions = await checkAll(mapping.text, enabledCats, aiSuggestionsEnabled);
        // Superseded, or the user kept typing — a fresh check is already on its way
        if (!newSuggestions || editor.state.doc !== docAtCheck) return;

        // If Auto-Correct mode is ON: automatically apply obvious spelling & punctuation fixes
        if (autoCorrectMode && newSuggestions.length > 0) {
          const cursor = editor.state.selection.from;
          const obviousFixes = newSuggestions
            .filter((s) => s.replacements.length > 0 && (s.type === "spelling" || s.type === "punctuation"))
            // Never touch the word the cursor is on — the user may still be typing it
            .filter((s) => {
              const r = resolveSuggestionRange(docAtCheck, s, mapping);
              return r !== null && (cursor < r.from || cursor > r.to);
            })
            .map((s) => ({ suggestion: s, replacement: s.replacements[0].value }));

          if (obviousFixes.length > 0) {
            const applied = acceptBatchSuggestions(obviousFixes);
            if (applied > 0) {
              const summary = obviousFixes
                .slice(0, 3)
                .map((f) => `"${f.suggestion.error_text || f.suggestion.context.slice(0, 10)}" → "${f.replacement}"`)
                .join(", ");

              setAutoCorrectToast(`⚡ Auto-corrected ${applied} mistake${applied > 1 ? "s" : ""}: ${summary}`);
              setTimeout(() => setAutoCorrectToast(null), 3500);
            }
          }
        }
      }, 600);
    };

    editor.on("update", handleUpdate);
    return () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
      editor.off("update", handleUpdate);
    };
  }, [editor, selectedDoc, checkAll, checkCategories, aiSuggestionsEnabled, autoCorrectMode, acceptBatchSuggestions]);

  // Open AI Bulk Correction modal
  const handleOpenAiCorrect = useCallback(() => {
    const sel = getRewriteSelection();
    if (sel) {
      setAiCorrectText(sel.text);
      setAiCorrectRange({ from: sel.from, to: sel.to });
      setShowAiCorrect(true);
    }
  }, [getRewriteSelection]);

  // Keyboard shortcuts
  useKeyboardShortcut("ctrl+shift+f", () => setFocusMode((v) => !v));
  useKeyboardShortcut("ctrl+k", () => {
    const searchInput = document.querySelector('input[placeholder="Search documents…"]') as HTMLInputElement;
    searchInput?.focus();
  });
  useKeyboardShortcut("ctrl+r", () => {
    const sel = getRewriteSelection();
    if (sel) {
      setRewriteText(sel.text);
      setRewriteRange({ from: sel.from, to: sel.to });
      setShowRewrite(true);
    }
  });

  // Shortcut for Bulk AI Correction: Ctrl+Shift+C
  useKeyboardShortcut("ctrl+shift+c", handleOpenAiCorrect);

  // Shortcut to accept suggestion with keyboard (Alt+C or Ctrl+Enter)
  useKeyboardShortcut("alt+c", () => {
    if (activeSuggestion && activeSuggestion.replacements.length > 0) {
      acceptSuggestion(activeSuggestion, activeSuggestion.replacements[0].value);
    } else if (suggestions.length > 0 && suggestions[0].replacements.length > 0) {
      acceptSuggestion(suggestions[0], suggestions[0].replacements[0].value);
    }
  });

  useKeyboardShortcut("ctrl+enter", () => {
    if (activeSuggestion && activeSuggestion.replacements.length > 0) {
      acceptSuggestion(activeSuggestion, activeSuggestion.replacements[0].value);
    }
  });

  // Navigate suggestions with Alt+ArrowDown
  useKeyboardShortcut("alt+arrowdown", () => {
    if (suggestions.length === 0) return;
    const currentIdx = activeSuggestion
      ? suggestions.findIndex((s) => s.id === activeSuggestion.id)
      : -1;
    const next = suggestions[(currentIdx + 1) % suggestions.length];
    showSuggestion(next);
  });

  // Load documents list on mount and automatically reopen last viewed document
  useEffect(() => {
    loadDocumentList();
  }, []);

  // Load backup path from settings on mount
  useEffect(() => {
    api.getBackupPath().then((resp) => {
      if (resp.path) setBackupPath(resp.path);
    }).catch(() => {});
  }, []);

  const loadDocumentList = async () => {
    try {
      const docs = await api.listDocuments({ sort: "updated" });
      setDocuments(docs);

      // Auto-restore last selected document so progress is never lost on restart
      const lastDocIdStr = localStorage.getItem("selectedDocId");
      const lastDocId = lastDocIdStr ? parseInt(lastDocIdStr, 10) : null;
      const toOpen = docs.find((d) => d.id === lastDocId) || (docs.length > 0 ? docs[0] : null);

      // Don't touch loadedDocIdRef here: the sync effect above sees the id
      // mismatch and loads this document's content into the editor.
      if (toOpen) setSelectedDoc(toOpen);
    } catch (err) {
      console.error("Failed to load documents:", err);
    }
  };

  /** Save the open document right away (before switching away from it). */
  const saveCurrentNow = useCallback(async () => {
    cancelPendingSave();
    if (!editor || !selectedDoc || loadedDocIdRef.current !== selectedDoc.id) return;
    // Block autosave until the next document is loaded into the editor
    loadedDocIdRef.current = null;
    pendingSaveRef.current = false;
    try {
      await api.updateDocument(selectedDoc.id, { title: selectedDoc.title, content: editor.getJSON() });
    } catch (err) {
      console.error("Failed to save before switching:", err);
    }
  }, [editor, selectedDoc, cancelPendingSave]);

  // Select a document cleanly
  const handleSelectDocument = useCallback(
    async (doc: Document) => {
      await saveCurrentNow();
      loadedDocIdRef.current = null;
      clear();
      setSaveStatus("idle");
      // The sidebar's copy may be older than what's on the server, so fetch fresh
      let fresh = doc;
      try {
        fresh = await api.getDocument(doc.id);
      } catch (err) {
        console.warn("Could not refresh document, using cached copy:", err);
      }
      setSelectedDoc(fresh); // the sync effect loads it into the editor
    },
    [saveCurrentNow, clear],
  );

  // Create new document
  const handleCreateDocument = useCallback(async (folderId: number | null) => {
    try {
      await saveCurrentNow();
      const doc = await api.createDocument({ title: "Untitled", folder_id: folderId });
      loadedDocIdRef.current = null;
      clear();
      setSaveStatus("idle");
      setSelectedDoc(doc);
      setSidebarKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to create document:", err);
    }
  }, [saveCurrentNow, clear]);

  // Import .docx
  const handleImportDocx = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await api.importDocument(file);
      const fullDoc = await api.getDocument(imported.document_id);
      handleSelectDocument(fullDoc);
      setSidebarKey((k) => k + 1);
    } catch (err) {
      console.error("Import failed:", err);
      alert("Import failed: " + (err as Error).message);
    }
    e.target.value = "";
  };

  // Export current document
  const handleExport = async () => {
    if (!selectedDoc) return;
    try {
      const blob = await api.exportDocument(selectedDoc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedDoc.title}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed");
    }
  };

  // Update title
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedDoc) return;
    const newTitle = e.target.value;
    setSelectedDoc({ ...selectedDoc, title: newTitle });
    pendingSaveRef.current = true;
    setSaveStatus("saving");
    debouncedSave();
  };

  const wordCount = editor
    ? editor.state.doc.textBetween(0, editor.state.doc.content.size, " ").split(/\s+/).filter(Boolean).length
    : (selectedDoc?.word_count ?? 0);

  return (
    <div className={`h-screen flex bg-ink-50 dark:bg-ink-950 ${focusMode ? "focus-mode" : ""}`}>
      {/* Sidebar */}
      <div className={`${focusMode ? "hidden" : ""} flex-shrink-0`}>
        <LibrarySidebar
          selectedDocId={selectedDoc?.id ?? null}
          onSelectDocument={handleSelectDocument}
          onCreateDocument={handleCreateDocument}
          onImportDocx={handleImportDocx}
          refreshKey={sidebarKey}
        />
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Main editor area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {selectedDoc ? (
          <>
            {/* Top bar */}
            <div className="flex items-center gap-2.5 px-6 py-2.5 border-b border-ink-100 dark:border-ink-800 bg-white/50 dark:bg-ink-900/50 backdrop-blur-xs">
              <input
                type="text"
                value={selectedDoc.title}
                onChange={handleTitleChange}
                className="flex-1 bg-transparent text-lg font-serif font-semibold text-ink-800 dark:text-ink-100 focus:outline-none"
                placeholder="Untitled"
              />
              <span className="text-xs text-ink-400 mr-2">
                {saveStatus === "saving" && "Saving…"}
                {saveStatus === "saved" && "Saved ✓"}
                {saveStatus === "idle" && ""}
              </span>

              {/* Auto-correct Toggle in Header */}
              <button
                type="button"
                onClick={handleToggleAutoCorrect}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full font-medium transition-colors cursor-pointer ${
                  autoCorrectMode
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                    : "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 hover:bg-ink-200"
                }`}
                title="Toggle Auto-correct mode"
              >
                <span>⚡</span>
                <span>Auto-correct {autoCorrectMode ? "ON" : "OFF"}</span>
              </button>

              {/* AI Bulk Correction */}
              <button
                type="button"
                onClick={handleOpenAiCorrect}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-accent-100 hover:bg-accent-200 dark:bg-accent-950/50 dark:hover:bg-accent-900/60 text-accent-800 dark:text-accent-200 font-medium transition-colors cursor-pointer"
                title="AI Bulk Correction for selection or paragraph (Ctrl+Shift+C)"
              >
                <span>✨</span>
                <span>AI Correct</span>
              </button>

              <button
                onClick={() => {
                  const sel = getRewriteSelection();
                  if (sel) {
                    setRewriteText(sel.text);
                    setRewriteRange({ from: sel.from, to: sel.to });
                    setShowRewrite(true);
                  }
                }}
                className="px-2 py-1 text-xs rounded text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 cursor-pointer"
                title="Rewrite text with tone options (Ctrl+R)"
              >
                Rewrite
              </button>

              <div className="w-px h-4 bg-ink-200 dark:bg-ink-700 mx-1" />

              <button
                onClick={handleManualSave}
                className="px-2.5 py-1 text-xs rounded bg-ink-100 hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700 text-ink-700 dark:text-ink-300 font-medium cursor-pointer"
                title="Save Version Snapshot (Ctrl+S)"
              >
                💾 Save (Ctrl+S)
              </button>

              <button
                onClick={() => setFocusMode((v) => !v)}
                className="px-2 py-1 text-xs rounded text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 cursor-pointer"
                title="Focus mode (Ctrl+Shift+F)"
              >
                {focusMode ? "◀ Exit" : "🔍 Focus"}
              </button>
              <button
                onClick={toggleTheme}
                className="px-2 py-1 text-xs rounded text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 cursor-pointer"
                title="Toggle theme"
              >
                {theme === "light" ? "🌙" : "☀"}
              </button>
              <button
                onClick={handleExport}
                className="px-2 py-1 text-xs rounded text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 cursor-pointer"
                title="Export as .docx"
              >
                ⬇ Export
              </button>
              <button
                onClick={() => setShowVersionHistory(true)}
                className="px-2 py-1 text-xs rounded text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 cursor-pointer"
                title="Version history"
              >
                📋 History
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="px-2 py-1 text-xs rounded text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 cursor-pointer"
                title="Settings"
              >
                ⚙ Settings
              </button>
            </div>

            {/* Toolbar */}
            {!focusMode && (
              <EditorToolbar
                editor={editor}
                onAiCorrect={handleOpenAiCorrect}
                autoCorrectMode={autoCorrectMode}
                onToggleAutoCorrect={handleToggleAutoCorrect}
              />
            )}

            {/* Tags */}
            {!focusMode && <TagsPanel docId={selectedDoc.id} onTagsChanged={() => setSidebarKey((k) => k + 1)} />}

            {/* Editor */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-prose mx-auto px-8 py-12">
                <EditorContent editor={editor} />
              </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center gap-4 px-6 py-2 border-t border-ink-100 dark:border-ink-800 text-xs text-ink-400">
              <span>{wordCount} words</span>
              {checking && <span className="text-ink-400">Checking text…</span>}
              {suggestions.length > 0 && (
                <button
                  onClick={() => showSuggestion(suggestions[0])}
                  className="text-accent-600 hover:underline font-medium cursor-pointer"
                >
                  {suggestions.length} suggestion{suggestions.length > 1 ? "s" : ""}
                </button>
              )}
              <span className="ml-auto">
                Ctrl+S save version · Alt+C fix next · Ctrl+Shift+C AI correct · ⚡ Auto-correct {autoCorrectMode ? "ON" : "OFF"}
              </span>
            </div>

            {/* Suggestions panel (docked at bottom) */}
            {suggestions.length > 0 && !focusMode && (
              <SuggestionsPanel
                suggestions={suggestions}
                onSuggestionClick={showSuggestion}
                autoCorrectMode={autoCorrectMode}
                onToggleAutoCorrect={handleToggleAutoCorrect}
              />
            )}

            {/* Suggestion popup */}
            <SuggestionPopup suggestion={activeSuggestion} anchorRect={anchorRect} />

            {/* Auto-correct & Save notification toast */}
            {autoCorrectToast && (
              <div className="absolute bottom-16 right-8 max-w-md bg-ink-900 text-white dark:bg-white dark:text-ink-900 px-4 py-2.5 rounded-xl shadow-2xl text-xs flex items-center gap-3 z-40 border border-ink-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
                <span className="text-emerald-400 dark:text-emerald-600 text-sm">✓</span>
                <span className="flex-1 leading-snug">{autoCorrectToast}</span>
                <button
                  onClick={() => setAutoCorrectToast(null)}
                  className="text-ink-400 hover:text-white dark:hover:text-ink-900 text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </>
        ) : (
          /* No document selected — show recent documents */
          <RecentDocuments
            onOpenDocument={handleSelectDocument}
            onNewDocument={() => handleCreateDocument(null)}
          />
        )}

        {/* Modals */}
        {showVersionHistory && selectedDoc && (
          <VersionHistoryModal
            docId={selectedDoc.id}
            onClose={() => setShowVersionHistory(false)}
            onRestore={async () => {
              const updated = await api.getDocument(selectedDoc.id);
              setSelectedDoc(updated);
              loadedDocIdRef.current = updated.id;
              if (editor) {
                editor.commands.setContent(
                  updated.content && Object.keys(updated.content).length > 0
                    ? updated.content
                    : { type: "doc", content: [{ type: "paragraph" }] },
                  false,
                );
              }
              setSidebarKey((k) => k + 1);
            }}
          />
        )}

        {showSettings && (
          <SettingsModal
            onClose={() => setShowSettings(false)}
            checkCategories={checkCategories}
            onToggleCategory={(cat, enabled) =>
              setCheckCategories((prev) => ({ ...prev, [cat]: enabled }))
            }
            aiSuggestionsEnabled={aiSuggestionsEnabled}
            onToggleAiSuggestions={setAiSuggestionsEnabled}
            backupPath={backupPath}
            onSetBackupPath={(path) => {
              setBackupPath(path);
              api.setBackupPath(path).catch(console.error);
            }}
          />
        )}

        {showRewrite && (
          <RewriteModal
            selectedText={rewriteText}
            onClose={() => {
              setShowRewrite(false);
              setRewriteRange(null);
            }}
            onAccept={(newText) => {
              if (editor && rewriteRange) {
                applyRewrite(rewriteRange, newText);
              }
            }}
          />
        )}

        {showAiCorrect && (
          <AiCorrectModal
            selectedText={aiCorrectText}
            onClose={() => {
              setShowAiCorrect(false);
              setAiCorrectRange(null);
            }}
            onAccept={(correctedText) => {
              if (editor && aiCorrectRange) {
                applyRewrite(aiCorrectRange, correctedText);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SuggestionsProvider>
        <Workspace />
      </SuggestionsProvider>
    </ThemeProvider>
  );
}
