import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Suggestion } from "../types";
import { api } from "../api/client";

interface SuggestionsContextValue {
  suggestions: Suggestion[];
  checking: boolean;
  /** Run a grammar check on the given plain text */
  checkText: (text: string, categories?: string[]) => Promise<void>;
  /** Run AI style analysis and merge results with existing suggestions */
  analyzeText: (text: string) => Promise<void>;
  /** Run both grammar check and AI analysis */
  checkAll: (text: string, categories?: string[], aiEnabled?: boolean) => Promise<void>;
  /** Clear all suggestions */
  clear: () => void;
  /** Accept a suggestion — replaces text (handled by editor) */
  acceptSuggestion: (suggestion: Suggestion, replacement: string) => void;
  /** Dismiss a suggestion */
  dismissSuggestion: (id: string) => void;
  /** Register a handler for when a suggestion is accepted */
  setAcceptHandler: (fn: (suggestion: Suggestion, replacement: string) => void) => void;
  /** Active suggestion (for popup display) */
  activeSuggestion: Suggestion | null;
  setActiveSuggestion: (s: Suggestion | null) => void;
}

const SuggestionsContext = createContext<SuggestionsContextValue | null>(null);

export function SuggestionsProvider({ children }: { children: ReactNode }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [checking, setChecking] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState<Suggestion | null>(null);
  const acceptHandlerRef = useRef<
    ((suggestion: Suggestion, replacement: string) => void) | null
  >(null);
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkText = useCallback(async (text: string, categories?: string[]) => {
    if (!text || !text.trim()) {
      setSuggestions([]);
      return;
    }
    setChecking(true);
    try {
      const resp = await api.checkText(text, "en-US", categories);
      setSuggestions(resp.suggestions);
    } catch (err) {
      // If LanguageTool is not running, silently clear suggestions
      console.warn("Grammar check failed:", err);
      setSuggestions([]);
    } finally {
      setChecking(false);
    }
  }, []);

  const analyzeText = useCallback(async (text: string) => {
    if (!text || !text.trim()) return;
    setChecking(true);
    try {
      const aiResp = await api.analyzeText(text);
      // Merge AI suggestions with existing grammar suggestions (avoid dupes by id)
      setSuggestions((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const aiOnly = aiResp.suggestions.filter((s) => !existingIds.has(s.id));
        return [...prev, ...aiOnly];
      });
    } catch (err) {
      console.warn("AI analysis failed:", err);
    } finally {
      setChecking(false);
    }
  }, []);

  const checkAll = useCallback(async (text: string, categories?: string[], aiEnabled?: boolean) => {
    if (!text || !text.trim()) {
      setSuggestions([]);
      return;
    }
    setChecking(true);
    const tasks: Promise<void>[] = [];

    // Grammar check
    tasks.push(
      (async () => {
        try {
          const resp = await api.checkText(text, "en-US", categories);
          setSuggestions((prev) => {
            // Remove old non-AI suggestions, keep AI ones
            const ai = prev.filter((s) => s.id.startsWith("ai-"));
            return [...resp.suggestions, ...ai];
          });
        } catch (err) {
          console.warn("Grammar check failed:", err);
        }
      })(),
    );

    // AI analysis (if enabled)
    if (aiEnabled) {
      tasks.push(
        (async () => {
          try {
            const aiResp = await api.analyzeText(text);
            setSuggestions((prev) => {
              // Remove old AI suggestions, keep grammar ones
              const grammar = prev.filter((s) => !s.id.startsWith("ai-"));
              return [...grammar, ...aiResp.suggestions];
            });
          } catch (err) {
            console.warn("AI analysis failed:", err);
          }
        })(),
      );
    } else {
      // Remove any existing AI suggestions
      setSuggestions((prev) => prev.filter((s) => !s.id.startsWith("ai-")));
    }

    await Promise.allSettled(tasks);
    setChecking(false);
  }, []);

  const clear = useCallback(() => setSuggestions([]), []);

  const acceptSuggestion = useCallback(
    (suggestion: Suggestion, replacement: string) => {
      if (acceptHandlerRef.current) {
        acceptHandlerRef.current(suggestion, replacement);
      }
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      setActiveSuggestion(null);
    },
    [],
  );

  const dismissSuggestion = useCallback((id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    setActiveSuggestion(null);
  }, []);

  const setAcceptHandler = useCallback(
    (fn: (suggestion: Suggestion, replacement: string) => void) => {
      acceptHandlerRef.current = fn;
    },
    [],
  );

  return (
    <SuggestionsContext.Provider
      value={{
        suggestions,
        checking,
        checkText,
        analyzeText,
        checkAll,
        clear,
        acceptSuggestion,
        dismissSuggestion,
        setAcceptHandler,
        activeSuggestion,
        setActiveSuggestion,
      }}
    >
      {children}
    </SuggestionsContext.Provider>
  );
}

export function useSuggestions() {
  const ctx = useContext(SuggestionsContext);
  if (!ctx) throw new Error("useSuggestions must be used within SuggestionsProvider");
  return ctx;
}
