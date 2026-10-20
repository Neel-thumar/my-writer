import { useEffect, useRef } from "react";
import type { Suggestion } from "../types";
import { useSuggestions } from "./SuggestionsProvider";

/**
 * Popup that appears when a suggestion is active (clicked or hovered).
 * Shows the message, replacement options, and accept/dismiss buttons.
 *
 * Positioned near the underlined text via a passed-in anchor element.
 */
interface SuggestionPopupProps {
  suggestion: Suggestion | null;
  anchorRect: DOMRect | null;
}

export function SuggestionPopup({ suggestion, anchorRect }: SuggestionPopupProps) {
  const { acceptSuggestion, dismissSuggestion } = useSuggestions();
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!suggestion) return;
    const sId = suggestion.id;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismissSuggestion(sId);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [suggestion, dismissSuggestion]);

  if (!suggestion || !anchorRect) return null;

  // Position popup below the anchor
  const top = anchorRect.bottom + 8;
  const left = Math.min(anchorRect.left, window.innerWidth - 320);

  const typeColors: Record<string, string> = {
    spelling: "text-suggestion-spelling",
    grammar: "text-suggestion-grammar",
    punctuation: "text-suggestion-punctuation",
    style: "text-suggestion-style",
  };

  return (
    <div
      ref={popupRef}
      className="fixed z-50 w-80 bg-white dark:bg-ink-800 rounded-lg shadow-xl border border-ink-200 dark:border-ink-700 p-4"
      style={{ top, left }}
    >
      {/* Type badge */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-semibold uppercase ${typeColors[suggestion.type]}`}>
          {suggestion.type}
        </span>
      </div>

      {/* Message */}
      <p className="text-sm text-ink-600 dark:text-ink-300 mb-3">
        {suggestion.message}
      </p>

      {/* Context */}
      {suggestion.context && (
        <p className="text-xs text-ink-400 dark:text-ink-500 mb-3 font-mono">
          {suggestion.context}
        </p>
      )}

      {/* Replacement buttons */}
      {suggestion.replacements.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-3">
          {suggestion.replacements.slice(0, 5).map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => acceptSuggestion(suggestion, r.value)}
              className="px-3 py-1.5 text-sm rounded-md bg-ink-100 dark:bg-ink-700 text-ink-700 dark:text-ink-200 hover:bg-ink-200 dark:hover:bg-ink-600 transition-colors"
            >
              {r.value || "(remove)"}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-ink-400 mb-3">No suggestions</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => dismissSuggestion(suggestion.id)}
          className="px-3 py-1 text-xs rounded-md text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 transition-colors"
        >
          Ignore
        </button>
        <span className="ml-auto text-xs text-ink-400">
          Ctrl+Enter to accept · Esc to dismiss
        </span>
      </div>
    </div>
  );
}
