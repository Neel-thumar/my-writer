/** Lightweight toasts: short confirmations with an optional action (e.g. Undo). */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { XIcon } from "./icons";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  message: string;
  tone: "info" | "success" | "error";
  action?: ToastAction;
}

interface ToastContextValue {
  show: (message: string, opts?: { tone?: Toast["tone"]; action?: ToastAction; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastContextValue["show"]>(
    (message, opts = {}) => {
      const id = nextId.current++;
      // Keep at most 3 on screen
      setToasts((prev) => [...prev.slice(-2), { id, message, tone: opts.tone ?? "info", action: opts.action }]);
      setTimeout(() => dismiss(id), opts.duration ?? (opts.action ? 6000 : 3000));
    },
    [dismiss],
  );

  const toneDot: Record<Toast["tone"], string> = {
    info: "bg-accent-400",
    success: "bg-emerald-400",
    error: "bg-red-400",
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="animate-pop pointer-events-auto flex items-center gap-3 max-w-md px-4 py-2.5 rounded-xl shadow-lg bg-ink-900 text-ink-50 dark:bg-ink-100 dark:text-ink-900 text-sm"
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${toneDot[t.tone]}`} />
            <span className="flex-1 leading-snug">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className="font-semibold text-accent-300 dark:text-accent-700 hover:underline cursor-pointer"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="opacity-60 hover:opacity-100 cursor-pointer"
              aria-label="Dismiss"
            >
              <XIcon size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
