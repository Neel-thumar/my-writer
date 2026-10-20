import { useCallback, useEffect, useRef } from "react";

/**
 * Debounced autosave hook.
 *
 * Calls `saveFn` after `delay` ms of no changes to `data`.
 * Returns a function to manually flush the save.
 */
export function useDebouncedCallback<T = void>(
  callback: (data: T) => void,
  delay: number = 2000,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const debounced = useCallback(
    (data?: T) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(data as T);
      }, delay);
    },
    [delay],
  );

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => flush, [flush]);

  return { debounced, flush };
}
