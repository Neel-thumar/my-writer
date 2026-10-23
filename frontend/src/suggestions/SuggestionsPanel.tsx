import { useState } from "react";
import type { Suggestion } from "../types";
import { useSuggestions } from "./SuggestionsProvider";

interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  onSuggestionClick: (s: Suggestion) => void;
  autoCorrectMode: boolean;
  onToggleAutoCorrect: () => void;
}

export function SuggestionsPanel({
  suggestions,
  onSuggestionClick,
  autoCorrectMode,
  onToggleAutoCorrect,
}: SuggestionsPanelProps) {
  const { acceptSuggestion, acceptBatchSuggestions, dismissSuggestion, dismissAll } = useSuggestions();
  const [collapsed, setCollapsed] = useState(false);

  if (suggestions.length === 0) return null;

  const typeConfig: Record<string, { label: string; badge: string; border: string }> = {
    spelling: {
      label: "Spelling",
      badge: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400 border-red-200 dark:border-red-900",
      border: "border-l-red-500",
    },
    grammar: {
      label: "Grammar",
      badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900",
      border: "border-l-amber-500",
    },
    punctuation: {
      label: "Punctuation",
      badge: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-900",
      border: "border-l-purple-500",
    },
    style: {
      label: "Style",
      badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-900",
      border: "border-l-blue-500",
    },
  };

  // Group counts
  const counts = suggestions.reduce(
    (acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Filter obvious fixes (spelling, punctuation, or single replacement items)
  const obviousFixes = suggestions
    .filter((s) => s.replacements.length > 0 && (s.type === "spelling" || s.type === "punctuation"))
    .map((s) => ({ suggestion: s, replacement: s.replacements[0].value }));

  const handleAcceptAllObvious = () => {
    if (obviousFixes.length > 0) {
      acceptBatchSuggestions(obviousFixes);
    }
  };

  return (
    <div className="border-t border-ink-200 dark:border-ink-800 bg-white/95 dark:bg-ink-900/95 backdrop-blur-md shadow-lg transition-all duration-200">
      <div className="max-w-4xl mx-auto px-6 py-2.5">
        {/* Panel Header */}
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-ink-800 dark:text-ink-100 flex items-center gap-1.5">
              <span>💡</span>
              <span>Suggestions ({suggestions.length})</span>
            </span>

            {/* Category breakdown pills */}
            <div className="flex items-center gap-1.5">
              {Object.entries(counts).map(([type, count]) => {
                const cfg = typeConfig[type] || typeConfig.style;
                return (
                  <span
                    key={type}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${cfg.badge}`}
                  >
                    {count} {cfg.label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-correct Mode Toggle */}
            <button
              type="button"
              onClick={onToggleAutoCorrect}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                autoCorrectMode
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                  : "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700"
              }`}
              title="Toggle Auto-correct mode for obvious mistakes"
            >
              <span>⚡</span>
              <span>Auto-correct {autoCorrectMode ? "ON" : "OFF"}</span>
            </button>

            {/* Accept All Obvious Fixes */}
            {obviousFixes.length > 0 && (
              <button
                type="button"
                onClick={handleAcceptAllObvious}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent-600 hover:bg-accent-700 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
                title={`Accept all ${obviousFixes.length} obvious typo corrections at once`}
              >
                <span>✓</span>
                <span>Fix All ({obviousFixes.length})</span>
              </button>
            )}

            {/* Clear All / Dismiss All */}
            <button
              type="button"
              onClick={dismissAll}
              className="px-2 py-1 rounded text-ink-500 hover:text-ink-800 dark:hover:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 text-xs transition-colors cursor-pointer"
              title="Ignore all current suggestions — they won't come back"
            >
              Ignore all
            </button>

            {/* Collapse / Expand Toggle */}
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="p-1 rounded text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 text-xs cursor-pointer"
              title={collapsed ? "Expand suggestions" : "Collapse suggestions"}
            >
              {collapsed ? "▲ Expand" : "▼ Collapse"}
            </button>
          </div>
        </div>

        {/* Suggestion Cards List */}
        {!collapsed && (
          <div className="mt-2.5 max-h-48 overflow-y-auto space-y-2 pr-1">
            {suggestions.map((s) => {
              const cfg = typeConfig[s.type] || typeConfig.style;
              const errorText = s.error_text || "";
              const topReplacement = s.replacements[0]?.value;

              return (
                <div
                  key={s.id}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-ink-50/80 dark:bg-ink-800/60 border border-ink-200/80 dark:border-ink-700/80 border-l-4 ${cfg.border} hover:bg-ink-100/70 dark:hover:bg-ink-800 transition-all group`}
                >
                  {/* Left: Type badge & message / diff */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onSuggestionClick(s)}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${cfg.badge}`}
                      >
                        {cfg.label}
                      </span>

                      {/* Error -> Replacement preview */}
                      {errorText && topReplacement && (
                        <span className="text-xs font-mono">
                          <span className="line-through text-red-600 dark:text-red-400 bg-red-100/50 dark:bg-red-950/40 px-1 rounded">
                            {errorText}
                          </span>
                          <span className="text-ink-400 mx-1">→</span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/50 dark:bg-emerald-950/40 px-1 rounded">
                            {topReplacement}
                          </span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-ink-600 dark:text-ink-300 truncate">
                      {s.message}
                    </p>
                  </div>

                  {/* Right: Quick Action Buttons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Instant 1-click Fix Button */}
                    {s.replacements.length > 0 && (
                      <button
                        type="button"
                        onClick={() => acceptSuggestion(s, s.replacements[0].value)}
                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-ink-700 text-ink-800 dark:text-ink-100 border border-ink-200 dark:border-ink-600 hover:bg-accent-600 hover:text-white hover:border-accent-600 dark:hover:bg-accent-600 dark:hover:border-accent-600 shadow-2xs transition-colors cursor-pointer"
                        title={`Replace with "${s.replacements[0].value}"`}
                      >
                        ✓ {s.replacements[0].value || "Fix"}
                      </button>
                    )}

                    {/* Instant Dismiss '✕' Button (Vanish) */}
                    <button
                      type="button"
                      onClick={() => dismissSuggestion(s.id)}
                      className="p-1 rounded-md text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-ink-200/60 dark:hover:bg-ink-700 transition-colors text-sm leading-none cursor-pointer"
                      title="Ignore — won't be suggested again"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
