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
      const pressed: Record<string, boolean> = {
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
      };

      // Check modifier keys
      const mods = keys.filter((k) => ["ctrl", "shift", "alt", "meta"].includes(k));
      const mainKey = keys.filter((k) => !["ctrl", "shift", "alt", "meta"].includes(k))[0];

      for (const mod of mods) {
        if (!pressed[mod]) return;
      }

      // If no ctrl/shift/alt/meta required, make sure none are pressed
      if (mods.length === 0 && (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) return;

      if (e.key.toLowerCase() === mainKey) {
        e.preventDefault();
        handler();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [combo, handler]);
}
