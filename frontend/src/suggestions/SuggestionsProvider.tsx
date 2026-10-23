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

type AcceptItem = { suggestion: Suggestion; replacement: string };

interface SuggestionsContextValue {
  suggestions: Suggestion[];
  checking: boolean;
  /**
   * Run grammar check (and optionally AI analysis) on plain text.
   * Grammar results show immediately; AI results merge in when ready.
   * Resolves with the grammar suggestions, or null if a newer check superseded this one.
   */
  checkAll: (text: string, categories?: string[], aiEnabled?: boolean) => Promise<Suggestion[] | null>;
  /** Drop all suggestions without ignoring them (e.g. when switching documents) */
  clear: () => void;
  /** Ignore every current suggestion — they won't come back on the next check */
  dismissAll: () => void;
  /** Ignore one suggestion — it (and identical ones) won't come back on the next check */
  dismissSuggestion: (id: string) => void;
  /** How many issues are currently ignored */
  ignoredCount: number;
  /** Forget all ignored issues so they can be suggested again */
  resetIgnored: () => void;
  /** Apply a suggestion's replacement (via the editor handler) and remove it */
  acceptSuggestion: (suggestion: Suggestion, replacement: string) => void;
  /** Apply several suggestions at once; returns how many were applied */
  acceptBatchSuggestions: (items: AcceptItem[]) => number;
  setAcceptHandler: (fn: (suggestion: Suggestion, replacement: string) => void) => void;
  setBatchAcceptHandler: (fn: (items: AcceptItem[]) => number) => void;
  /** Active suggestion (for popup display) */
  activeSuggestion: Suggestion | null;
  setActiveSuggestion: (s: Suggestion | null) => void;
}

const SuggestionsContext = createContext<SuggestionsContextValue | null>(null);

const IGNORED_STORAGE_KEY = "ignoredSuggestions";
const MAX_IGNORED = 500;

/** Identifies "the same issue" across checks, independent of position. */
function ignoreKey(s: Suggestion): string {
  return `${s.category_id ?? s.type}|${s.error_text ?? s.context}|${s.message}`;
}

function loadIgnored(): Set<string> {
  try {
    const raw = localStorage.getItem(IGNORED_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveIgnored(keys: Set<string>) {
  try {
    localStorage.setItem(IGNORED_STORAGE_KEY, JSON.stringify([...keys].slice(-MAX_IGNORED)));
  } catch {
    // storage unavailable — ignoring still works for this session
  }
}

export function SuggestionsProvider({ children }: { children: ReactNode }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [checking, setChecking] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState<Suggestion | null>(null);
  const acceptHandlerRef = useRef<((suggestion: Suggestion, replacement: string) => void) | null>(null);
  const batchAcceptHandlerRef = useRef<((items: AcceptItem[]) => number) | null>(null);
  const ignoredRef = useRef<Set<string>>(loadIgnored());
  const [ignoredCount, setIgnoredCount] = useState(() => ignoredRef.current.size);
  const checkSeqRef = useRef(0);

  const ignore = useCallback((items: Suggestion[]) => {
    for (const s of items) ignoredRef.current.add(ignoreKey(s));
    saveIgnored(ignoredRef.current);
    setIgnoredCount(ignoredRef.current.size);
  }, []);

  const resetIgnored = useCallback(() => {
    ignoredRef.current = new Set();
    saveIgnored(ignoredRef.current);
    setIgnoredCount(0);
  }, []);

  const checkAll = useCallback(
    async (text: string, categories?: string[], aiEnabled?: boolean): Promise<Suggestion[] | null> => {
      const seq = ++checkSeqRef.current;
      const isLatest = () => seq === checkSeqRef.current;
      // Prefix ids with the check number so ids never collide across checks
      const prepare = (list: Suggestion[]) =>
        list
          .filter((s) => !ignoredRef.current.has(ignoreKey(s)))
          .map((s) => ({ ...s, id: `${seq}:${s.id}` }));

      if (!text.trim()) {
        setSuggestions([]);
        setActiveSuggestion(null);
        return [];
      }

      setChecking(true);
      let grammar: Suggestion[] = [];
      try {
        grammar = prepare((await api.checkText(text, "en-US", categories)).suggestions);
      } catch (err) {
        console.warn("Grammar check failed:", err);
      }
      if (!isLatest()) return null;
      setSuggestions(grammar);
      setActiveSuggestion((cur) => (cur && grammar.some((s) => s.id === cur.id) ? cur : null));

      if (aiEnabled) {
        api
          .analyzeText(text)
          .then((resp) => {
            if (isLatest()) setSuggestions((prev) => [...prev, ...prepare(resp.suggestions)]);
          })
          .catch((err) => console.warn("AI analysis failed:", err))
          .finally(() => {
            if (isLatest()) setChecking(false);
          });
      } else {
        setChecking(false);
      }
      return grammar;
    },
    [],
  );

  const clear = useCallback(() => {
    checkSeqRef.current++; // discard any in-flight check
    setSuggestions([]);
    setActiveSuggestion(null);
    setChecking(false);
  }, []);

  const dismissAll = useCallback(() => {
    setSuggestions((prev) => {
      ignore(prev);
      return [];
    });
    setActiveSuggestion(null);
  }, [ignore]);

  const dismissSuggestion = useCallback(
    (id: string) => {
      setSuggestions((prev) => {
        const target = prev.find((s) => s.id === id);
        if (!target) return prev;
        ignore([target]);
        const key = ignoreKey(target);
        return prev.filter((s) => ignoreKey(s) !== key);
      });
      setActiveSuggestion(null);
    },
    [ignore],
  );

  const acceptSuggestion = useCallback((suggestion: Suggestion, replacement: string) => {
    acceptHandlerRef.current?.(suggestion, replacement);
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    setActiveSuggestion(null);
  }, []);

  const acceptBatchSuggestions = useCallback((items: AcceptItem[]) => {
    if (items.length === 0) return 0;
    const applied = batchAcceptHandlerRef.current?.(items) ?? 0;
    const appliedIds = new Set(items.map((it) => it.suggestion.id));
    setSuggestions((prev) => prev.filter((s) => !appliedIds.has(s.id)));
    setActiveSuggestion(null);
    return applied;
  }, []);

  const setAcceptHandler = useCallback(
    (fn: (suggestion: Suggestion, replacement: string) => void) => {
      acceptHandlerRef.current = fn;
    },
    [],
  );

  const setBatchAcceptHandler = useCallback((fn: (items: AcceptItem[]) => number) => {
    batchAcceptHandlerRef.current = fn;
  }, []);

  return (
    <SuggestionsContext.Provider
      value={{
        suggestions,
        checking,
        checkAll,
        clear,
        dismissAll,
        dismissSuggestion,
        ignoredCount,
        resetIgnored,
        acceptSuggestion,
        acceptBatchSuggestions,
        setAcceptHandler,
        setBatchAcceptHandler,
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
