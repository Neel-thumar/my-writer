/**
 * AI Multi-Version Correction Modal — offers 2-3 distinct corrected versions
 * of selected lines/paragraph (Standard, Polished & Fluent, Crisp & Concise).
 * Shows interactive diffs and lets the user choose and apply with one click.
 */

import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { CorrectVersion } from "../types";

interface AiCorrectModalProps {
  selectedText: string;
  onClose: () => void;
  onAccept: (correctedText: string) => void;
}

/** Word-level diff calculation */
function diffWords(original: string, rewritten: string) {
  const origWords = original.split(/(\s+)/);
  const newWords = rewritten.split(/(\s+)/);

  const m = origWords.length;
  const n = newWords.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m;
  let j = n;
  const temp: { text: string; type: "same" | "added" | "removed" }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i - 1] === newWords[j - 1]) {
      temp.unshift({ text: origWords[i - 1], type: "same" });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.unshift({ text: newWords[j - 1], type: "added" });
      j--;
    } else {
      temp.unshift({ text: origWords[i - 1], type: "removed" });
      i--;
    }
  }

  const result: { text: string; type: "same" | "added" | "removed" }[] = [];
  for (const item of temp) {
    const last = result[result.length - 1];
    if (last && last.type === item.type) {
      last.text += item.text;
    } else {
      result.push({ ...item });
    }
  }

  return result;
}

export function AiCorrectModal({ selectedText, onClose, onAccept }: AiCorrectModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<CorrectVersion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [showDiff, setShowDiff] = useState<boolean>(true);

  const fetchCorrections = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.correctText(selectedText, 3);
      setVersions(resp.versions);
      setSelectedIndex(0);
    } catch (err) {
      setError((err as Error).message || "Failed to generate AI corrections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedText]);

  // Keyboard navigation: 1, 2, 3 to select; Enter to accept; Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "1" && versions.length >= 1) {
        setSelectedIndex(0);
      } else if (e.key === "2" && versions.length >= 2) {
        setSelectedIndex(1);
      } else if (e.key === "3" && versions.length >= 3) {
        setSelectedIndex(2);
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        if (versions[selectedIndex]) {
          onAccept(versions[selectedIndex].text);
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [versions, selectedIndex, onAccept, onClose]);

  const diffs = useMemo(() => {
    return versions.map((v) => diffWords(selectedText, v.text));
  }, [selectedText, versions]);

  const handleApply = (text: string) => {
    onAccept(text);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-ink-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[88vh] flex flex-col border border-ink-200 dark:border-ink-800 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center px-6 py-4 border-b border-ink-100 dark:border-ink-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300 text-sm">
              ✨
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink-800 dark:text-ink-100">
                AI Bulk Correction
              </h2>
              <p className="text-xs text-ink-400">
                Choose from multiple polished versions or review word diffs
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setShowDiff((v) => !v)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                showDiff
                  ? "border-accent-400 bg-accent-50 dark:bg-accent-950/40 text-accent-700 dark:text-accent-300"
                  : "border-ink-200 dark:border-ink-700 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800"
              }`}
              title="Toggle diff highlights"
            >
              {showDiff ? "Diff On" : "Diff Off"}
            </button>
            <button
              onClick={onClose}
              className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 p-1 rounded-md text-lg leading-none"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Original Text Preview */}
        <div className="px-6 py-3 bg-ink-50 dark:bg-ink-950/50 border-b border-ink-100 dark:border-ink-800 text-xs text-ink-600 dark:text-ink-400">
          <span className="font-semibold uppercase tracking-wider text-ink-400 mr-2">Original:</span>
          <span className="italic line-clamp-2">{selectedText}</span>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-ink-700 dark:text-ink-200">
                AI is analyzing and rewriting your text...
              </p>
              <p className="text-xs text-ink-400">
                Generating 3 distinct versions (Standard, Polished, and Concise)
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 space-y-2">
              <p className="text-sm font-medium">Correction failed</p>
              <p className="text-xs">{error}</p>
              <button
                onClick={fetchCorrections}
                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
              >
                ↻ Try Again
              </button>
            </div>
          )}

          {!loading && !error && versions.length === 0 && (
            <div className="py-12 text-center text-ink-400 text-sm">
              No corrections generated. Your text may already be error-free!
            </div>
          )}

          {!loading && !error && versions.length > 0 && (
            <div className="space-y-4">
              {versions.map((version, index) => {
                const isSelected = selectedIndex === index;
                const diff = diffs[index];

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedIndex(index)}
                    className={`relative rounded-xl border p-4 transition-all cursor-pointer ${
                      isSelected
                        ? "border-accent-500 bg-accent-50/30 dark:bg-accent-950/20 ring-1 ring-accent-500 shadow-sm"
                        : "border-ink-200 dark:border-ink-800 hover:border-ink-300 dark:hover:border-ink-700 bg-white dark:bg-ink-900"
                    }`}
                  >
                    {/* Version Badge & Title */}
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`w-5 h-5 flex items-center justify-center text-xs font-bold rounded-full ${
                          isSelected
                            ? "bg-accent-600 text-white"
                            : "bg-ink-200 dark:bg-ink-700 text-ink-600 dark:text-ink-300"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                        {version.title}
                      </span>
                      <span className="text-xs text-ink-400 dark:text-ink-500">
                        — {version.description}
                      </span>

                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApply(version.text);
                          }}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            isSelected
                              ? "bg-accent-600 hover:bg-accent-700 text-white shadow-xs"
                              : "bg-ink-100 hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700 text-ink-700 dark:text-ink-200"
                          }`}
                        >
                          ✓ Apply Version {index + 1}
                        </button>
                      </div>
                    </div>

                    {/* Text Body / Diff */}
                    <div className="text-sm text-ink-700 dark:text-ink-200 leading-relaxed font-sans pl-7">
                      {showDiff && diff ? (
                        <div>
                          {diff.map((part, pIdx) => {
                            if (part.type === "same") {
                              return <span key={pIdx}>{part.text}</span>;
                            }
                            if (part.type === "removed") {
                              return (
                                <span
                                  key={pIdx}
                                  className="bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 line-through rounded px-0.5 mx-0.5"
                                >
                                  {part.text}
                                </span>
                              );
                            }
                            return (
                              <span
                                key={pIdx}
                                className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium rounded px-0.5 mx-0.5"
                              >
                                {part.text}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p>{version.text}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-3.5 border-t border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-950">
          <span className="text-xs text-ink-400">
            Press keys <kbd className="px-1 py-0.5 bg-ink-200 dark:bg-ink-800 rounded text-ink-600 dark:text-ink-300">1</kbd> <kbd className="px-1 py-0.5 bg-ink-200 dark:bg-ink-800 rounded text-ink-600 dark:text-ink-300">2</kbd> <kbd className="px-1 py-0.5 bg-ink-200 dark:bg-ink-800 rounded text-ink-600 dark:text-ink-300">3</kbd> to pick, <kbd className="px-1 py-0.5 bg-ink-200 dark:bg-ink-800 rounded text-ink-600 dark:text-ink-300">Ctrl+Enter</kbd> to apply
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-md text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || versions.length === 0}
              onClick={() => {
                if (versions[selectedIndex]) {
                  handleApply(versions[selectedIndex].text);
                }
              }}
              className="px-4 py-1.5 text-xs font-medium rounded-md bg-accent-600 hover:bg-accent-700 text-white shadow-xs disabled:opacity-50 transition-colors"
            >
              ✓ Apply Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
