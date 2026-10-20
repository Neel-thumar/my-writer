import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent } from "@tiptap/react";
import { ThemeProvider, useTheme } from "./theme/ThemeProvider";
import { SuggestionsProvider, useSuggestions } from "./suggestions/SuggestionsProvider";
import { SuggestionPopup } from "./suggestions/SuggestionPopup";
import { LibrarySidebar } from "./library/LibrarySidebar";
import { EditorToolbar } from "./editor/EditorToolbar";
import { useWritingEditor } from "./editor/useWritingEditor";
import { useDebouncedCallback } from "./hooks/useDebouncedCallback";
import { useKeyboardShortcut } from "./hooks/useKeyboardShortcut";
import { api } from "./api/client";
import type { Document, Suggestion as SuggestionType } from "./types";

function Workspace() {
  const { theme, toggleTheme } = useTheme();
  const { suggestions, checking, checkText, clear, setAcceptHandler, acceptSuggestion, activeSuggestion, setActiveSuggestion } = useSuggestions();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarKey, setSidebarKey] = useState(0);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create the editor
  const editor = useWritingEditor(selectedDoc?.content ?? null, () => {
    setSaveStatus("saving");
    debouncedSave();
  });

  // Debounced autosave
  const { debounced: debouncedSave, flush: flushSave } = useDebouncedCallback(async () => {
    if (!editor || !selectedDoc) return;
    try {
      const json = editor.getJSON();
      await api.updateDocument(selectedDoc.id, { content: json });
      setSaveStatus("saved");
      setSidebarKey((k) => k + 1);
    } catch (err) {
      console.error("Save failed:", err);
      setSaveStatus("idle");
    }
  }, 1500);

  // Accept suggestion handler — replaces text in editor
  useEffect(() => {
    if (!editor) return;
    setAcceptHandler((suggestion: SuggestionType, replacement: string) => {
      // The suggestion offset/length are relative to the plain text we sent for checking.
      // For Phase 1, we use the editor's search API to find and replace the context text.
      // This is a simplified approach — a more robust version would track text positions.
      const searchText = suggestion.context;
      if (searchText) {
        // Use browser's execCommand as fallback for simple replacement
        const tr = editor.state.tr;
        const doc = editor.state.doc;
        doc.descendants((node, pos) => {
          if (node.isText && node.text && node.text.includes(suggestion.context.trim())) {
            const text = node.text;
            const start = pos + text.indexOf(suggestion.context.trim());
            const end = start + suggestion.context.trim().length;
            tr.insertText(replacement, start, end);
            return false;
          }
          return true;
        });
        if (tr.docChanged) {
          editor.view.dispatch(tr);
        }
      }
    });
  }, [editor, setAcceptHandler]);

  // Grammar check: run when user pauses typing (debounced via editor onUpdate -> checkText)
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!editor || !selectedDoc) return;

    editor.on("update", () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
      checkTimeoutRef.current = setTimeout(() => {
        const text = editor.getText();
        checkText(text);
      }, 600);
    });

    return () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, [editor, selectedDoc, checkText]);

  // Apply suggestion underlines — Phase 1 uses a decoration-free approach
  // (The suggestions are listed in a panel, and clicking opens the popup)

  // Keyboard shortcuts
  useKeyboardShortcut("ctrl+shift+f", () => setFocusMode((v) => !v));
  useKeyboardShortcut("ctrl+k", () => {
    // Focus search in sidebar
    const searchInput = document.querySelector('input[placeholder="Search documents…"]') as HTMLInputElement;
    searchInput?.focus();
  });

  // Handle suggestion navigation
  useKeyboardShortcut("alt+arrowdown", () => {
    if (suggestions.length === 0) return;
    const currentIdx = activeSuggestion
      ? suggestions.findIndex((s) => s.id === activeSuggestion.id)
      : -1;
    const next = suggestions[(currentIdx + 1) % suggestions.length];
    setActiveSuggestion(next);
  });

  // Accept suggestion with Ctrl+Enter when popup is open
  useKeyboardShortcut("ctrl+enter", () => {
    if (activeSuggestion && activeSuggestion.replacements.length > 0) {
      acceptSuggestion(activeSuggestion, activeSuggestion.replacements[0].value);
    }
  });

  // Load documents list on mount
  useEffect(() => {
    loadDocumentList();
  }, []);

  const loadDocumentList = async () => {
    try {
      const docs = await api.listDocuments({ sort: "updated" });
      setDocuments(docs);
    } catch (err) {
      console.error("Failed to load documents:", err);
    }
  };

  // Select a document
  const handleSelectDocument = useCallback((doc: Document) => {
    if (editor && selectedDoc) {
      // Save current before switching
      const json = editor.getJSON();
      api.updateDocument(selectedDoc.id, { content: json }).catch(console.error);
    }
    setSelectedDoc(doc);
    clear();
    setSaveStatus("idle");
  }, [editor, selectedDoc, clear]);

  // Create new document
  const handleCreateDocument = useCallback(async (folderId: number | null) => {
    try {
      const doc = await api.createDocument({ title: "Untitled", folder_id: folderId });
      setSelectedDoc(doc);
      setSidebarKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to create document:", err);
    }
  }, []);

  // Import .docx
  const handleImportDocx = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await api.importDocument(file);
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
    debouncedSave();
  };

  // Word count
  const wordCount = editor ? editor.storage.characterCount?.words?.() ?? (selectedDoc?.word_count ?? 0) : (selectedDoc?.word_count ?? 0);

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
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedDoc ? (
          <>
            {/* Top bar */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-ink-100 dark:border-ink-800">
              <input
                type="text"
                value={selectedDoc.title}
                onChange={handleTitleChange}
                className="flex-1 bg-transparent text-lg font-serif font-semibold text-ink-800 dark:text-ink-100 focus:outline-none"
                placeholder="Untitled"
              />
              <span className="text-xs text-ink-400">
                {saveStatus === "saving" && "Saving…"}
                {saveStatus === "saved" && "Saved ✓"}
                {saveStatus === "idle" && ""}
              </span>
              <button
                onClick={() => setFocusMode((v) => !v)}
                className="px-2 py-1 text-xs rounded text-ink-500 hover:text-ink-700 dark:hover:text-ink-300"
                title="Focus mode (Ctrl+Shift+F)"
              >
                {focusMode ? "◀ Exit" : "🔍 Focus"}
              </button>
              <button
                onClick={toggleTheme}
                className="px-2 py-1 text-xs rounded text-ink-500 hover:text-ink-700 dark:hover:text-ink-300"
                title="Toggle theme"
              >
                {theme === "light" ? "🌙" : "☀"}
              </button>
              <button
                onClick={handleExport}
                className="px-2 py-1 text-xs rounded text-ink-500 hover:text-ink-700 dark:hover:text-ink-300"
                title="Export as .docx"
              >
                ⬇ Export
              </button>
            </div>

            {/* Toolbar */}
            {!focusMode && <EditorToolbar editor={editor} />}

            {/* Editor */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-prose mx-auto px-8 py-12">
                <EditorContent editor={editor} />
              </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center gap-4 px-6 py-2 border-t border-ink-100 dark:border-ink-800 text-xs text-ink-400">
              <span>{wordCount} words</span>
              {checking && <span className="text-ink-400">Checking grammar…</span>}
              {suggestions.length > 0 && (
                <button
                  onClick={() => setActiveSuggestion(suggestions[0])}
                  className="text-suggestion-grammar hover:underline"
                >
                  {suggestions.length} suggestion{suggestions.length > 1 ? "s" : ""}
                </button>
              )}
              <span className="ml-auto">
                Ctrl+Shift+F focus · Ctrl+K search
              </span>
            </div>

            {/* Suggestions panel (bottom) */}
            {suggestions.length > 0 && !focusMode && (
              <SuggestionsPanel suggestions={suggestions} onSuggestionClick={(s, rect) => { setActiveSuggestion(s); setAnchorRect(rect); }} />
            )}

            {/* Suggestion popup */}
            <SuggestionPopup suggestion={activeSuggestion} anchorRect={anchorRect} />
          </>
        ) : (
          /* No document selected */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-serif text-ink-400 mb-2">Your Writing Workspace</h2>
              <p className="text-sm text-ink-400 mb-6">Select a document or create a new one to begin.</p>
              <button
                onClick={() => handleCreateDocument(null)}
                className="px-4 py-2 rounded-lg bg-ink-200 dark:bg-ink-700 text-ink-700 dark:text-ink-200 hover:bg-ink-300 dark:hover:bg-ink-600"
              >
                ✍️ New Document
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Suggestions list panel at the bottom of the editor */
function SuggestionsPanel({
  suggestions,
  onSuggestionClick,
}: {
  suggestions: SuggestionType[];
  onSuggestionClick: (s: SuggestionType, rect: DOMRect) => void;
}) {
  const typeColors: Record<string, string> = {
    spelling: "text-suggestion-spelling border-suggestion-spelling",
    grammar: "text-suggestion-grammar border-suggestion-grammar",
    punctuation: "text-suggestion-punctuation border-suggestion-punctuation",
    style: "text-suggestion-style border-suggestion-style",
  };

  return (
    <div className="max-h-32 overflow-y-auto border-t border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-900">
      <div className="max-w-prose mx-auto px-8 py-2 space-y-1">
        {suggestions.slice(0, 8).map((s) => (
          <button
            key={s.id}
            onClick={(e) => onSuggestionClick(s, e.currentTarget.getBoundingClientRect())}
            className={`flex items-center gap-2 w-full text-left px-3 py-1.5 rounded text-xs border-l-2 ${typeColors[s.type]} hover:bg-ink-100 dark:hover:bg-ink-800`}
          >
            <span className="font-semibold uppercase">{s.type}</span>
            <span className="flex-1 text-ink-600 dark:text-ink-300 truncate">{s.message}</span>
            {s.replacements.length > 0 && (
              <span className="text-ink-400">→ {s.replacements[0].value}</span>
            )}
          </button>
        ))}
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
