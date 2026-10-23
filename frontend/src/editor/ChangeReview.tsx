/**
 * Review UI for inline changes: a floating bar (accept/reject all) and a small
 * popover for the single change the user clicked.
 */

import type { Editor } from "@tiptap/react";
import { useEffect, useRef } from "react";
import { CheckIcon, XIcon } from "../ui/icons";
import { acceptAllChanges, acceptChange, getChanges, rejectAllChanges, rejectChange } from "./inlineChanges";

export function ChangeBar({ editor, source }: { editor: Editor; source: string }) {
  const count = getChanges(editor.state).length;
  if (count === 0) return null;
  return (
    <div className="animate-pop absolute bottom-5 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap flex items-center gap-1 pl-4 pr-1.5 py-1.5 rounded-full bg-ink-900 text-ink-50 dark:bg-ink-100 dark:text-ink-900 shadow-xl text-sm">
      <span className="mr-2">
        <span className="font-semibold">{count}</span> change{count === 1 ? "" : "s"}
        {source && <span className="opacity-60"> · {source}</span>}
      </span>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => acceptAllChanges(editor.view)}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium cursor-pointer"
        title="Keep all changes (Tab)"
      >
        <CheckIcon size={14} /> Accept all <kbd className="text-[10px] opacity-75 font-sans">Tab</kbd>
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => rejectAllChanges(editor.view)}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-white/10 dark:hover:bg-black/10 cursor-pointer"
        title="Undo all changes (Esc)"
      >
        <XIcon size={14} /> Reject all <kbd className="text-[10px] opacity-60 font-sans">Esc</kbd>
      </button>
    </div>
  );
}

export function ChangePopover({
  editor,
  changeId,
  rect,
  onClose,
}: {
  editor: Editor;
  changeId: string;
  rect: DOMRect;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const change = getChanges(editor.state).find((c) => c.id === changeId);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    // Capture phase, so Escape closes this popover instead of rejecting every change
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  useEffect(() => {
    if (!change) onClose(); // accepted/rejected elsewhere
  }, [change, onClose]);
  if (!change) return null;

  const newText = editor.state.doc.textBetween(change.from, change.to, "\n", " ");
  const top = Math.min(rect.bottom + 8, window.innerHeight - 140);
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - 300));

  return (
    <div
      ref={ref}
      className="animate-pop fixed z-50 w-72 p-3 rounded-xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 shadow-xl"
      style={{ top, left }}
    >
      <div className="text-sm leading-relaxed mb-3 max-h-28 overflow-y-auto">
        {change.oldText && <span className="change-delete">{change.oldText}</span>}
        {change.oldText && newText && <span className="text-ink-400 mx-1">→</span>}
        {newText ? <span className="change-insert">{newText}</span> : <span className="text-ink-400 italic">removed</span>}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            acceptChange(editor.view, change.id);
            onClose();
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium cursor-pointer"
        >
          <CheckIcon size={14} /> Keep
        </button>
        <button
          type="button"
          onClick={() => {
            rejectChange(editor.view, change.id);
            onClose();
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-ink-100 hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700 text-ink-700 dark:text-ink-200 text-sm font-medium cursor-pointer"
        >
          <XIcon size={14} /> Undo
        </button>
      </div>
    </div>
  );
}
