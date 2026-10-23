/**
 * Settings modal — manage personal dictionary and check categories.
 * Also shows app preferences like theme and font.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { DictionaryWord } from "../types";
import { useSuggestions } from "../suggestions/SuggestionsProvider";

interface SettingsModalProps {
  onClose: () => void;
  checkCategories: Record<string, boolean>;
  onToggleCategory: (cat: string, enabled: boolean) => void;
  aiSuggestionsEnabled: boolean;
  onToggleAiSuggestions: (enabled: boolean) => void;
  backupPath: string;
  onSetBackupPath: (path: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  spelling: "Spelling",
  grammar: "Grammar",
  punctuation: "Punctuation",
  style: "Style",
};

const CATEGORY_COLORS: Record<string, string> = {
  spelling: "text-red-500",
  grammar: "text-blue-500",
  punctuation: "text-amber-500",
  style: "text-purple-500",
};

export function SettingsModal({
  onClose,
  checkCategories,
  onToggleCategory,
  aiSuggestionsEnabled,
  onToggleAiSuggestions,
  backupPath,
  onSetBackupPath,
}: SettingsModalProps) {
  const { ignoredCount, resetIgnored } = useSuggestions();
  const [words, setWords] = useState<DictionaryWord[]>([]);
  const [newWord, setNewWord] = useState("");
  const [backupInput, setBackupInput] = useState(backupPath);
  const [backupStatus, setBackupStatus] = useState<"idle" | "backing-up" | "done" | "error">("idle");
  const [backupResult, setBackupResult] = useState<string | null>(null);

  const loadWords = useCallback(async () => {
    try {
      const list = await api.listDictionaryWords();
      setWords(list);
    } catch (err) {
      console.error("Failed to load dictionary:", err);
    }
  }, []);

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  const handleAddWord = async () => {
    const w = newWord.trim();
    if (!w) return;
    try {
      await api.addDictionaryWord(w);
      setNewWord("");
      loadWords();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("409")) {
        // already exists — just clear input
      } else {
        alert("Failed to add word: " + msg);
      }
    }
    setNewWord("");
  };

  const handleDeleteWord = async (id: number) => {
    try {
      await api.deleteDictionaryWord(id);
      setWords(words.filter((w) => w.id !== id));
    } catch (err) {
      console.error("Failed to delete word:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-ink-900 rounded-lg shadow-xl max-w-md w-full max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center px-5 py-3 border-b border-ink-200 dark:border-ink-800">
          <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-200">Settings</h2>
          <button
            onClick={onClose}
            className="ml-auto text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 text-lg"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Check categories */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
              Check Categories
            </h3>
            <p className="text-xs text-ink-400 mb-3">
              Toggle which types of suggestions you want to see.
            </p>
            <div className="space-y-2">
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checkCategories[key] ?? true}
                    onChange={(e) => onToggleCategory(key, e.target.checked)}
                    className="rounded"
                  />
                  <span className={`text-sm font-medium ${CATEGORY_COLORS[key]}`}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* AI Style Suggestions */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
              AI Style Suggestions
            </h3>
            <p className="text-xs text-ink-400 mb-3">
              Uses the local AI model to suggest improvements for clarity, wordiness,
              and tone. Runs alongside grammar checks.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={aiSuggestionsEnabled}
                onChange={(e) => onToggleAiSuggestions(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-purple-500">
                Enable AI style analysis
              </span>
            </label>
          </div>

          {/* Ignored suggestions */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
              Ignored Suggestions
            </h3>
            <p className="text-xs text-ink-400 mb-3">
              Suggestions you ignore stay hidden. Reset to see them again on the next check.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-600 dark:text-ink-300">
                {ignoredCount} ignored
              </span>
              <button
                type="button"
                onClick={resetIgnored}
                disabled={ignoredCount === 0}
                className="px-3 py-1 text-xs rounded bg-ink-100 hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700 text-ink-700 dark:text-ink-300 font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset ignored suggestions
              </button>
            </div>
          </div>

          {/* Personal dictionary */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
              Personal Dictionary
            </h3>
            <p className="text-xs text-ink-400 mb-3">
              Words here are never flagged as spelling errors.
            </p>

            {/* Add word */}
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddWord();
                }}
                placeholder="Add a word…"
                className="flex-1 px-3 py-1.5 text-sm rounded bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 focus:outline-none focus:ring-1 focus:ring-ink-300"
              />
              <button
                onClick={handleAddWord}
                className="px-3 py-1.5 text-sm rounded bg-ink-200 dark:bg-ink-700 text-ink-700 dark:text-ink-200 hover:bg-ink-300 dark:hover:bg-ink-600"
              >
                Add
              </button>
            </div>

            {/* Word list */}
            <div className="flex flex-wrap gap-1.5">
              {words.length === 0 && (
                <p className="text-xs text-ink-400">No words added yet</p>
              )}
              {words.map((w) => (
                <span
                  key={w.id}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200"
                >
                  {w.word}
                  <button
                    onClick={() => handleDeleteWord(w.id)}
                    className="text-ink-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Folder Backup */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
              Folder Backup
            </h3>
            <p className="text-xs text-ink-400 mb-3">
              Export all documents as .docx files into a local folder. A timestamped
              subfolder is created for each backup.
            </p>

            {/* Backup path input */}
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={backupInput}
                onChange={(e) => setBackupInput(e.target.value)}
                placeholder="/home/user/backups/my-writer"
                className="flex-1 px-3 py-1.5 text-sm rounded bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 focus:outline-none focus:ring-1 focus:ring-ink-300"
              />
              <button
                onClick={() => onSetBackupPath(backupInput)}
                className="px-3 py-1.5 text-sm rounded bg-ink-200 dark:bg-ink-700 text-ink-700 dark:text-ink-200 hover:bg-ink-300 dark:hover:bg-ink-600"
              >
                Save Path
              </button>
            </div>

            {/* Backup button */}
            <button
              onClick={async () => {
                if (!backupInput.trim()) return;
                setBackupStatus("backing-up");
                setBackupResult(null);
                try {
                  onSetBackupPath(backupInput);
                  const result = await api.backupAll(backupInput);
                  setBackupStatus("done");
                  setBackupResult(
                    `Exported ${result.exported} document${result.exported !== 1 ? "s" : ""}${result.skipped > 0 ? `, ${result.skipped} skipped` : ""} → ${result.backup_dir}`,
                  );
                } catch (err) {
                  setBackupStatus("error");
                  setBackupResult((err as Error).message || "Backup failed");
                }
              }}
              disabled={!backupInput.trim() || backupStatus === "backing-up"}
              className="px-3 py-1.5 text-sm rounded bg-ink-700 text-white hover:bg-ink-600 dark:bg-ink-600 dark:hover:bg-ink-500 disabled:opacity-50"
            >
              {backupStatus === "backing-up" ? "Backing up…" : "Backup Now"}
            </button>

            {/* Status */}
            {backupResult && (
              <p
                className={`mt-2 text-xs ${backupStatus === "error" ? "text-red-500" : "text-green-500"}`}
              >
                {backupResult}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
