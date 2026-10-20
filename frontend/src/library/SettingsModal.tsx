/**
 * Settings modal — manage personal dictionary and check categories.
 * Also shows app preferences like theme and font.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { DictionaryWord } from "../types";

interface SettingsModalProps {
  onClose: () => void;
  checkCategories: Record<string, boolean>;
  onToggleCategory: (cat: string, enabled: boolean) => void;
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
}: SettingsModalProps) {
  const [words, setWords] = useState<DictionaryWord[]>([]);
  const [newWord, setNewWord] = useState("");

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
        </div>
      </div>
    </div>
  );
}
