/**
 * Right-hand review panel: every current issue, one-click fixes, ignore.
 * Resizable by dragging its left edge.
 */

import { useResizable } from "../hooks/useResizable";
import type { Suggestion } from "../types";
import { CheckIcon, PanelRightIcon, XIcon } from "../ui/icons";
import { useSuggestions } from "./SuggestionsProvider";

export const TYPE_STYLE: Record<string, { label: string; dot: string; bar: string }> = {
  spelling: { label: "Spelling", dot: "bg-red-500", bar: "border-l-red-400" },
  grammar: { label: "Grammar", dot: "bg-amber-500", bar: "border-l-amber-400" },
  punctuation: { label: "Punctuation", dot: "bg-purple-500", bar: "border-l-purple-400" },
  style: { label: "Style", dot: "bg-blue-500", bar: "border-l-blue-400" },
};

interface SuggestionsPanelProps {
  onSuggestionClick: (s: Suggestion) => void;
  onClose: () => void;
}

export function SuggestionsPanel({ onSuggestionClick, onClose }: SuggestionsPanelProps) {
  const { suggestions, checking, acceptSuggestion, acceptBatchSuggestions, dismissSuggestion, dismissAll, activeSuggestion } =
    useSuggestions();
  const { width, handleProps } = useResizable("suggestions-width", 300, 240, 480, "right");

  const counts = suggestions.reduce<Record<string, number>>((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {});
  const quickFixes = suggestions
    .filter((s) => s.replacements.length > 0 && (s.type === "spelling" || s.type === "punctuation"))
    .map((s) => ({ suggestion: s, replacement: s.replacements[0].value }));

  return (
    <div className="flex h-full shrink-0" style={{ width }}>
      <div {...handleProps} title="Drag to resize" />
      <aside className="flex-1 min-w-0 flex flex-col border-l border-ink-200/70 dark:border-ink-800 bg-white/60 dark:bg-ink-900/60">
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <h2 className="text-sm font-semibold text-ink-800 dark:text-ink-100 flex-1">
            Review {suggestions.length > 0 && <span className="text-ink-400 font-normal">· {suggestions.length}</span>}
          </h2>
          {checking && <span className="text-xs text-ink-400 animate-pulse">checking…</span>}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 cursor-pointer"
            title="Hide panel"
          >
            <PanelRightIcon size={15} />
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="px-4 pb-3 space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(counts).map(([type, n]) => (
                <span key={type} className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                  <span className={`w-1.5 h-1.5 rounded-full ${TYPE_STYLE[type]?.dot ?? "bg-ink-400"}`} />
                  {n} {TYPE_STYLE[type]?.label ?? type}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              {quickFixes.length > 0 && (
                <button
                  type="button"
                  onClick={() => acceptBatchSuggestions(quickFixes)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-accent-600 hover:bg-accent-700 text-white text-xs font-medium cursor-pointer"
                  title="Apply every spelling & punctuation fix"
                >
                  <CheckIcon size={13} /> Fix {quickFixes.length} typo{quickFixes.length === 1 ? "" : "s"}
                </button>
              )}
              <button
                type="button"
                onClick={dismissAll}
                className="flex-1 py-1.5 rounded-lg border border-ink-200 dark:border-ink-700 text-xs text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 cursor-pointer"
                title="Hide all current issues — they won't come back"
              >
                Ignore all
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
          {suggestions.length === 0 ? (
            <div className="text-center pt-12 px-4">
              <div className="w-10 h-10 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 grid place-items-center text-emerald-500 mb-3">
                <CheckIcon size={18} />
              </div>
              <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{checking ? "Checking…" : "Looking good"}</p>
              <p className="text-xs text-ink-400 mt-1 leading-relaxed">
                Issues appear here as you write. Press <kbd className="font-sans font-semibold">Ctrl E</kbd> to fix a
                paragraph in one go.
              </p>
            </div>
          ) : (
            suggestions.map((s) => {
              const style = TYPE_STYLE[s.type] ?? TYPE_STYLE.style;
              const top = s.replacements[0]?.value;
              const active = activeSuggestion?.id === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => onSuggestionClick(s)}
                  className={`group rounded-lg border border-l-4 ${style.bar} px-3 py-2.5 cursor-pointer transition-colors ${
                    active
                      ? "bg-accent-50 dark:bg-accent-950/40 border-accent-200 dark:border-accent-800"
                      : "bg-white dark:bg-ink-900 border-ink-200 dark:border-ink-800 hover:border-ink-300 dark:hover:border-ink-700"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {s.error_text && (
                        <p className="text-sm mb-0.5 break-words">
                          <span className="line-through decoration-red-400 text-ink-500">{s.error_text}</span>
                          {top !== undefined && (
                            <>
                              <span className="text-ink-300 mx-1">→</span>
                              <span className="font-medium text-emerald-700 dark:text-emerald-400">{top || "(remove)"}</span>
                            </>
                          )}
                        </p>
                      )}
                      <p className="text-xs text-ink-500 dark:text-ink-400 leading-snug">{s.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissSuggestion(s.id);
                      }}
                      className="p-0.5 rounded text-ink-300 hover:text-ink-600 dark:hover:text-ink-200 opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Ignore — won't be suggested again"
                    >
                      <XIcon size={13} />
                    </button>
                  </div>
                  {s.replacements.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {s.replacements.slice(0, 3).map((r, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            acceptSuggestion(s, r.value);
                          }}
                          className={`px-2 py-0.5 rounded-md text-xs font-medium cursor-pointer ${
                            i === 0
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300"
                          }`}
                        >
                          {r.value || "(remove)"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
