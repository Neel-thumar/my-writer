import { useEffect, useState } from "react";

/**
 * Global keyboard shortcut hook.
 *
 * Usage:
 *   useKeyboardShortcut("ctrl+shift+f", () => toggleFocusMode());
 *   useKeyboardShortcut("ctrl+k", () => openQuickSearch());
 */
export function useKeyboardShortcut(
  combo: string,
  handler: () => void,
) {
  useEffect(() => {
    const keys = combo.toLowerCase().split("+");

    function onKeyDown(e: KeyboardEvent) {
      const mainKey = keys.filter((k) => !["ctrl", "shift", "alt", "meta"].includes(k))[0];
      // Modifiers must match exactly, so "ctrl+e" doesn't also fire on Ctrl+Shift+E
      // (Cmd counts as Ctrl on macOS)
      const wantCtrl = keys.includes("ctrl") || keys.includes("meta");
      if ((e.ctrlKey || e.metaKey) !== wantCtrl) return;
      if (e.shiftKey !== keys.includes("shift")) return;
      if (e.altKey !== keys.includes("alt")) return;

      if (e.key.toLowerCase() === mainKey) {
        e.preventDefault();
        handler();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [combo, handler]);
}
