import { useCallback, useRef, useState } from "react";

/**
 * Drag-to-resize width for a side panel, remembered in localStorage.
 *
 * `side` is where the panel sits: dragging its inner edge toward the middle of
 * the screen grows it.
 */
export function useResizable(storageKey: string, initial: number, min: number, max: number, side: "left" | "right") {
  const [width, setWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(storageKey));
    return saved >= min && saved <= max ? saved : initial;
  });
  const widthRef = useRef(width);
  widthRef.current = width;

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = widthRef.current;
      const onMove = (ev: MouseEvent) => {
        const delta = side === "left" ? ev.clientX - startX : startX - ev.clientX;
        setWidth(Math.min(max, Math.max(min, startWidth + delta)));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem(storageKey, String(widthRef.current));
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [storageKey, min, max, side],
  );

  return { width, handleProps: { onMouseDown, className: "resize-handle", role: "separator" as const } };
}
