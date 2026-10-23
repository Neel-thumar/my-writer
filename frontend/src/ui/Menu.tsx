/** Click-to-open dropdown menu that closes on outside click or Escape. */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface MenuProps {
  trigger: (open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  width?: string;
  title?: string;
  /** Optional controlled mode (e.g. to open from a keyboard shortcut) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Menu({ trigger, children, align = "right", width = "w-56", title, open: openProp, onOpenChange }: MenuProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean | ((v: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(open) : next;
    setOpenState(value);
    onOpenChange?.(value);
  };
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [dropUp, setDropUp] = useState(false);

  // Open upward when there isn't room below (e.g. the last row of a list).
  // Measured before paint, so the menu never flashes in the wrong place.
  useLayoutEffect(() => {
    if (!open) {
      setDropUp(false);
      return;
    }
    const trigger = ref.current?.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    if (!trigger || !panel) return;
    const spaceBelow = window.innerHeight - trigger.bottom;
    setDropUp(spaceBelow < panel.height + 12 && trigger.top > spaceBelow);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={title}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer"
      >
        {trigger(open)}
      </button>
      {open && (
        <div
          ref={panelRef}
          className={`animate-pop absolute z-50 ${dropUp ? "bottom-full mb-1.5" : "mt-1.5"} ${width} ${align === "right" ? "right-0" : "left-0"} rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 shadow-xl p-1.5`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon,
  label,
  hint,
  onClick,
  danger,
}: {
  icon?: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-left cursor-pointer ${
        danger
          ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
          : "text-ink-700 dark:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800"
      }`}
    >
      <span className="w-4 shrink-0 text-ink-400">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-ink-400">{hint}</span>}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-ink-100 dark:bg-ink-800" />;
}
