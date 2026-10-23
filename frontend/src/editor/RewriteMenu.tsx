/** Rewrite picker: tones plus a free-form instruction ("make it shorter"). */

import { useState } from "react";
import { SparkleIcon } from "../ui/icons";

const TONE_LABELS: Record<string, string> = {
  improve: "Improve writing",
  simple: "Simpler",
  concise: "Shorter",
  formal: "More formal",
  friendly: "Friendlier",
  academic: "Academic",
  creative: "More vivid",
};

export function RewriteOptions({
  onPick,
  configured,
  onSetup,
}: {
  onPick: (tone: string, instruction?: string) => void;
  configured: boolean;
  onSetup: () => void;
}) {
  const [instruction, setInstruction] = useState("");

  if (!configured) {
    return (
      <div className="p-2 text-sm">
        <p className="font-medium text-ink-800 dark:text-ink-100 mb-1">Rewrite uses a free cloud AI</p>
        <p className="text-ink-500 dark:text-ink-400 text-xs mb-3 leading-relaxed">
          Connect a free provider (Groq, Gemini or OpenRouter) with your own key. Text is only sent when you click Rewrite.
        </p>
        <button
          type="button"
          onClick={onSetup}
          className="w-full py-1.5 rounded-lg bg-accent-600 hover:bg-accent-700 text-white font-medium cursor-pointer"
        >
          Set up in Settings
        </button>
      </div>
    );
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (instruction.trim()) onPick("custom", instruction.trim());
        }}
        className="p-1"
      >
        <input
          autoFocus
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Tell AI what to do… (Enter)"
          className="w-full px-2.5 py-1.5 text-sm rounded-lg bg-ink-50 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 focus:outline-none focus:ring-2 focus:ring-accent-300"
        />
      </form>
      <div className="mt-1">
        {Object.entries(TONE_LABELS).map(([tone, label]) => (
          <button
            key={tone}
            type="button"
            onClick={() => onPick(tone)}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-left text-ink-700 dark:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 cursor-pointer"
          >
            <SparkleIcon size={14} className="text-accent-500" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
