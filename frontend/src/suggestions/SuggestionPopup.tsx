import { useEffect, useRef } from "react";
import type { Suggestion } from "../types";
import { useSuggestions } from "./SuggestionsProvider";

/**
 * Enhanced popup that appears when a suggestion is active.
 * Shows error vs replacement diff, 1-click replacement buttons,
 * instant dismiss '×', and keyboard hints.
 */
interface SuggestionPopupProps {
  suggestion: Suggestion | null;
  anchorRect: DOMRect | null;
}

export function SuggestionPopup({ suggestion, anchorRect }: SuggestionPopupProps) {
  const { acceptSuggestion, dismissSuggestion, setActiveSuggestion } = useSuggestions();
  const popupRef = useRef<HTMLDivElement>(null);

  // Escape or clicking elsewhere just closes the popup — it doesn't ignore the suggestion
  useEffect(() => {
    if (!suggestion) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveSuggestion(null);
    }

    function onMouseDown(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setActiveSuggestion(null);
      }
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [suggestion, setActiveSuggestion]);

  if (!suggestion || !anchorRect) return null;

  // Position popup below the anchor, keeping it within viewport
  const top = Math.min(anchorRect.bottom + 8, window.innerHeight - 240);
  const left = Math.max(16, Math.min(anchorRect.left, window.innerWidth - 340));

  const typeConfig: Record<string, { label: string; badge: string; border: string }> = {
    spelling: {
      label: "Spelling Mistake",
      badge: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border-red-200 dark:border-red-900",
      border: "border-l-red-500",
    },
    grammar: {
      label: "Grammar Issue",
      badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900",
      border: "border-l-amber-500",
    },
    punctuation: {
      label: "Punctuation",
      badge: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-900",
      border: "border-l-purple-500",
    },
    style: {
      label: "Style & Clarity",
      badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-900",
      border: "border-l-blue-500",
    },
  };

  const currentType = typeConfig[suggestion.type] ?? typeConfig.style;
  const errorText = suggestion.error_text || "";

  return (
    <div
      ref={popupRef}
      className={`fixed z-50 w-84 bg-white dark:bg-ink-900 rounded-xl shadow-2xl border border-ink-200 dark:border-ink-700 p-4 border-l-4 ${currentType.border} animate-in fade-in zoom-in-95 duration-100`}
      style={{ top, left }}
    >
      {/* Header with Type & Dismiss '×' */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full border ${currentType.badge}`}
        >
          {currentType.label}
        </span>

        <button
          type="button"
          onClick={() => setActiveSuggestion(null)}
          className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 p-1 rounded-md text-base leading-none transition-colors cursor-pointer"
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Message */}
      <p className="text-xs text-ink-700 dark:text-ink-200 font-medium mb-2.5 leading-snug">
        {suggestion.message}
      </p>

      {/* Error vs Replacement Highlight Preview */}
      {errorText && (
        <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-ink-50 dark:bg-ink-950/50 border border-ink-100 dark:border-ink-800 mb-3 font-mono">
          <span className="line-through text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1 rounded">
            {errorText}
          </span>
          {suggestion.replacements.length > 0 && (
            <>
              <span className="text-ink-400">→</span>
              <span className="text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1 rounded">
                {suggestion.replacements[0].value || "(remove)"}
              </span>
            </>
          )}
        </div>
      )}

      {/* Replacement Options */}
      {suggestion.replacements.length > 0 ? (
        <div className="space-y-1.5 mb-3">
          <div className="text-[10px] uppercase font-semibold text-ink-400 tracking-wider">
            Click to replace:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestion.replacements.slice(0, 4).map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => acceptSuggestion(suggestion, r.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  i === 0
                    ? "bg-accent-600 hover:bg-accent-700 text-white shadow-xs cursor-pointer"
                    : "bg-ink-100 hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700 text-ink-800 dark:text-ink-200 cursor-pointer"
                }`}
              >
                {r.value || "(remove)"}
                {i === 0 && (
                  <span className="ml-1.5 text-[10px] opacity-75 font-normal">↵</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-ink-400 italic mb-3">No direct replacement suggestions</p>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-ink-100 dark:border-ink-800 text-[11px] text-ink-400">
        <button
          type="button"
          onClick={() => dismissSuggestion(suggestion.id)}
          className="text-ink-500 hover:text-ink-800 dark:hover:text-ink-200 underline cursor-pointer"
        >
          Ignore
        </button>
        <span>Ctrl+Enter fix · Esc close</span>
      </div>
    </div>
  );
}
