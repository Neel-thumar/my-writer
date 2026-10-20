/**
 * Rewrite modal — lets the user rewrite selected text using a local LLM
 * with different tone options. Shows a diff view comparing original vs rewritten.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

const TONES = [
  { value: "simple", label: "Simple", desc: "Clear, easy to understand" },
  { value: "formal", label: "Formal", desc: "Professional tone" },
  { value: "friendly", label: "Friendly", desc: "Warm, conversational" },
  { value: "concise", label: "Concise", desc: "Remove unnecessary words" },
  { value: "academic", label: "Academic", desc: "Scholarly, precise" },
  { value: "creative", label: "Creative", desc: "Vivid, engaging" },
] as const;

interface RewriteModalProps {
  selectedText: string;
  onClose: () => void;
  onAccept: (rewrittenText: string) => void;
}

/** Simple word-level diff for highlighting changes */
function diffWords(original: string, rewritten: string) {
  const origWords = original.split(/(\s+)/);
  const newWords = rewritten.split(/(\s+)/);
  const result: { text: string; type: "same" | "added" | "removed" }[] = [];

  // Simple LCS-based diff
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

  // Backtrack
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

  // Merge consecutive same tokens
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

export function RewriteModal({ selectedText, onClose, onAccept }: RewriteModalProps) {
  const [tone, setTone] = useState<string>("formal");
  const [loading, setLoading] = useState(false);
  const [rewritten, setRewritten] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRewrite = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRewritten(null);
    try {
      const resp = await api.rewriteText(selectedText, tone);
      setRewritten(resp.rewritten);
    } catch (err) {
      setError((err as Error).message || "Rewrite failed");
    } finally {
      setLoading(false);
    }
  }, [selectedText, tone]);

  // Auto-run on mount with default tone
  useEffect(() => {
    handleRewrite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const diff = useMemo(() => {
    if (!rewritten) return null;
    return diffWords(selectedText, rewritten);
  }, [selectedText, rewritten]);

  const handleAccept = () => {
    if (rewritten) onAccept(rewritten);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-ink-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center px-5 py-3 border-b border-ink-200 dark:border-ink-800">
          <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-200">
            ✨ Rewrite
          </h2>
          <button
            onClick={onClose}
            className="ml-auto text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 text-lg"
          >
            ✕
          </button>
        </div>

        {/* Tone selector */}
        <div className="px-5 py-3 border-b border-ink-200 dark:border-ink-800">
          <div className="flex items-center gap-2 flex-wrap">
            {TONES.map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  setTone(t.value);
                  setRewritten(null);
                }}
                disabled={loading}
                title={t.desc}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors disabled:opacity-50 ${
                  tone === t.value
                    ? "bg-ink-700 text-white dark:bg-ink-600"
                    : "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-700"
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={handleRewrite}
              disabled={loading}
              className="ml-auto px-3 py-1 text-xs rounded bg-ink-200 dark:bg-ink-700 text-ink-700 dark:text-ink-200 hover:bg-ink-300 dark:hover:bg-ink-600 disabled:opacity-50"
            >
              {loading ? "Rewriting…" : "↻ Try again"}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-ink-400">
                Rewriting with local AI…
              </div>
            </div>
          )}

          {/* Diff view */}
          {!loading && diff && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">
                  Original
                </p>
                <p className="text-sm text-ink-700 dark:text-ink-200 px-3 py-2 rounded bg-ink-50 dark:bg-ink-800 border border-ink-200 dark:border-ink-700">
                  {selectedText}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">
                  Rewritten ({tone})
                </p>
                <p className="text-sm text-ink-700 dark:text-ink-200 px-3 py-2 rounded bg-ink-50 dark:bg-ink-800 border border-ink-200 dark:border-ink-700">
                  {rewritten}
                </p>
              </div>
              {/* Word-level diff */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">
                  Changes
                </p>
                <div className="text-sm px-3 py-2 rounded bg-ink-50 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 leading-relaxed">
                  {diff.map((part, i) => {
                    if (part.type === "same") {
                      return (
                        <span key={i} className="text-ink-500 dark:text-ink-400">
                          {part.text}
                        </span>
                      );
                    }
                    if (part.type === "removed") {
                      return (
                        <span
                          key={i}
                          className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 line-through rounded px-0.5"
                        >
                          {part.text}
                        </span>
                      );
                    }
                    return (
                      <span
                        key={i}
                        className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded px-0.5 font-medium"
                      >
                        {part.text}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-ink-200 dark:border-ink-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded text-ink-500 hover:text-ink-700 dark:hover:text-ink-300"
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            disabled={!rewritten || loading}
            className="ml-auto px-4 py-1.5 text-sm rounded bg-ink-700 text-white hover:bg-ink-600 dark:bg-ink-600 dark:hover:bg-ink-500 disabled:opacity-50"
          >
            ✓ Accept rewrite
          </button>
        </div>
      </div>
    </div>
  );
}
