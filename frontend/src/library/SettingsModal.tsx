/**
 * Settings: writing checks, AI (local Fix + free cloud Rewrite), personal
 * dictionary, ignored suggestions and folder backup.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { useSuggestions } from "../suggestions/SuggestionsProvider";
import type { AiConfig, DictionaryWord } from "../types";
import { XIcon } from "../ui/icons";

export type SettingsSection = "writing" | "ai" | "dictionary" | "backup";

interface SettingsModalProps {
  onClose: () => void;
  initialSection?: SettingsSection;
  checkCategories: Record<string, boolean>;
  onToggleCategory: (cat: string, enabled: boolean) => void;
  autoCorrect: boolean;
  onToggleAutoCorrect: () => void;
  aiConfig: AiConfig | null;
  onAiConfigChange: (cfg: AiConfig) => void;
  backupPath: string;
  onSetBackupPath: (path: string) => void;
}

const SECTIONS: Array<[SettingsSection, string]> = [
  ["writing", "Writing checks"],
  ["ai", "AI"],
  ["dictionary", "Dictionary"],
  ["backup", "Backup"],
];

const CATEGORY_LABELS: Record<string, [string, string]> = {
  spelling: ["Spelling", "bg-red-500"],
  grammar: ["Grammar", "bg-amber-500"],
  punctuation: ["Punctuation", "bg-purple-500"],
  style: ["Style", "bg-blue-500"],
};

export function SettingsModal(props: SettingsModalProps) {
  const [section, setSection] = useState<SettingsSection>(props.initialSection ?? "writing");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[2px] grid place-items-center p-4" onClick={props.onClose}>
      <div
        className="animate-pop w-full max-w-3xl h-[min(640px,90vh)] flex flex-col sm:flex-row rounded-2xl bg-white dark:bg-ink-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <nav className="sm:w-48 shrink-0 bg-ink-50 dark:bg-ink-950/50 border-b sm:border-b-0 sm:border-r border-ink-200 dark:border-ink-800 p-3 flex sm:flex-col gap-1 overflow-x-auto">
          <h2 className="hidden sm:block px-2.5 pb-2 text-sm font-semibold text-ink-800 dark:text-ink-100">Settings</h2>
          {SECTIONS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`px-2.5 py-1.5 rounded-lg text-sm text-left whitespace-nowrap cursor-pointer ${
                section === key
                  ? "bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-50 shadow-sm font-medium"
                  : "text-ink-600 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800/60"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex justify-end p-2">
            <button
              type="button"
              onClick={props.onClose}
              className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800 cursor-pointer"
              aria-label="Close"
            >
              <XIcon size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-8 space-y-8">
            {section === "writing" && <WritingSection {...props} />}
            {section === "ai" && <AiSection config={props.aiConfig} onChange={props.onAiConfigChange} />}
            {section === "dictionary" && <DictionarySection />}
            {section === "backup" && <BackupSection path={props.backupPath} onSetPath={props.onSetBackupPath} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-base font-semibold text-ink-900 dark:text-ink-50">{title}</h3>
      {description && <p className="text-sm text-ink-500 dark:text-ink-400 mt-1 mb-4 leading-relaxed">{description}</p>}
      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 py-2 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="block w-9 h-5 rounded-full bg-ink-200 dark:bg-ink-700 peer-checked:bg-accent-600 transition-colors" />
        <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
      <span>
        <span className="block text-sm text-ink-800 dark:text-ink-100">{label}</span>
        {hint && <span className="block text-xs text-ink-400 mt-0.5 leading-relaxed">{hint}</span>}
      </span>
    </label>
  );
}

function WritingSection({ checkCategories, onToggleCategory, autoCorrect, onToggleAutoCorrect }: SettingsModalProps) {
  const { ignoredCount, resetIgnored } = useSuggestions();
  return (
    <>
      <Section title="What to check" description="Checks run locally as you write. Turn off anything you don't want flagged.">
        {Object.entries(CATEGORY_LABELS).map(([key, [label, dot]]) => (
          <Toggle
            key={key}
            checked={checkCategories[key] ?? true}
            onChange={(v) => onToggleCategory(key, v)}
            label={
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                {label}
              </span>
            }
          />
        ))}
      </Section>
      <Section title="Auto-correct">
        <Toggle
          checked={autoCorrect}
          onChange={onToggleAutoCorrect}
          label="Fix obvious typos automatically"
          hint="When you pause, clear spelling and punctuation slips are corrected for you (never the word you're typing, never names). Undo from the notice."
        />
      </Section>
      <Section title="Ignored suggestions" description="Suggestions you ignore stay hidden. Reset to see them again on the next check.">
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-600 dark:text-ink-300">{ignoredCount} ignored</span>
          <button
            type="button"
            onClick={resetIgnored}
            disabled={ignoredCount === 0}
            className="px-3 py-1.5 text-sm rounded-lg border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            Reset ignored suggestions
          </button>
        </div>
      </Section>
    </>
  );
}

function AiSection({ config, onChange }: { config: AiConfig | null; onChange: (cfg: AiConfig) => void }) {
  const [keyInput, setKeyInput] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelsStatus, setModelsStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const update = useCallback(
    async (data: Parameters<typeof api.updateAiConfig>[0]) => {
      try {
        const cfg = await api.updateAiConfig(data);
        onChange(cfg);
        return cfg;
      } catch (err) {
        setMessage((err as Error).message);
        return null;
      }
    },
    [onChange],
  );

  const loadModels = useCallback(async () => {
    setModelsStatus("loading");
    setMessage(null);
    try {
      const list = await api.listAiModels();
      setModels(list);
      setModelsStatus("idle");
      if (list.length === 0) setMessage("This key has no models available.");
    } catch (err) {
      setModels([]);
      setModelsStatus("error");
      setMessage((err as Error).message);
    }
  }, []);

  // Fetch the model list whenever a provider + key are set
  useEffect(() => {
    if (config?.has_api_key && config.base_url) loadModels();
  }, [config?.has_api_key, config?.base_url, loadModels]);

  if (!config) return <p className="text-sm text-ink-400">Loading…</p>;
  const provider = config.providers[config.provider];

  return (
    <>
      <Section
        title="Fix — local and private"
        description="Fix (Ctrl+E) corrects spelling and grammar on this computer. Nothing is sent anywhere, and it's instant."
      >
        <Toggle
          checked={config.local_fix_ai}
          disabled={!config.local_model_available}
          onChange={(v) => update({ local_fix_ai: v })}
          label="Deeper grammar check with the small local AI"
          hint={
            config.local_model_available
              ? "Catches a few more grammar mistakes, but adds a few seconds per paragraph and uses ~400 MB of memory. Every change is still shown for you to accept or reject."
              : "The local model file isn't installed (backend/data/qwen2.5-0.5b-instruct.gguf)."
          }
        />
      </Section>

      <Section
        title="Rewrite — free cloud AI"
        description="Rewrite (Ctrl+Shift+E) uses a bigger AI model from a free provider, with your own free key. Text is sent only when you click Rewrite, and only the part you're rewriting."
      >
        <div className="space-y-4">
          <label className="block">
            <span className="block text-xs font-medium text-ink-500 mb-1.5">Provider</span>
            <select
              value={config.provider}
              onChange={(e) => {
                setModels([]);
                update({ provider: e.target.value });
              }}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 focus:outline-none focus:ring-2 focus:ring-accent-300 cursor-pointer"
            >
              <option value="">Choose a provider…</option>
              {Object.entries(config.providers).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label}
                </option>
              ))}
            </select>
            {provider?.signup && (
              <span className="block text-xs text-ink-500 mt-1.5">
                Get a free key at{" "}
                <a href={provider.signup} target="_blank" rel="noreferrer" className="text-accent-600 hover:underline">
                  {provider.signup.replace(/^https:\/\//, "")}
                </a>{" "}
                (sign in, create a key, paste it below).
              </span>
            )}
          </label>

          {config.provider === "custom" && (
            <label className="block">
              <span className="block text-xs font-medium text-ink-500 mb-1.5">API base URL (OpenAI-compatible)</span>
              <input
                defaultValue={config.base_url}
                onBlur={(e) => e.target.value !== config.base_url && update({ base_url: e.target.value })}
                placeholder="http://localhost:11434/v1"
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 focus:outline-none focus:ring-2 focus:ring-accent-300"
              />
            </label>
          )}

          {config.provider && (
            <div>
              <span className="block text-xs font-medium text-ink-500 mb-1.5">API key</span>
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!keyInput.trim()) return;
                  const cfg = await update({ api_key: keyInput.trim() });
                  if (cfg) setKeyInput("");
                }}
              >
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={config.has_api_key ? "•••••••• saved — paste a new one to replace" : "Paste your key"}
                  autoComplete="off"
                  className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 focus:outline-none focus:ring-2 focus:ring-accent-300"
                />
                <button
                  type="submit"
                  disabled={!keyInput.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-600 hover:bg-accent-700 text-white disabled:opacity-40 cursor-pointer disabled:cursor-default"
                >
                  Save
                </button>
                {config.has_api_key && (
                  <button
                    type="button"
                    onClick={() => {
                      setModels([]);
                      update({ api_key: "" });
                    }}
                    className="px-3 py-2 text-sm rounded-lg border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800 cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </form>
              <p className="text-xs text-ink-400 mt-1.5">Stored only in this app's local database. It's never shown again.</p>
            </div>
          )}

          {config.has_api_key && (
            <label className="block">
              <span className="flex items-center gap-2 text-xs font-medium text-ink-500 mb-1.5">
                Model
                <button type="button" onClick={loadModels} className="text-accent-600 hover:underline cursor-pointer font-normal">
                  {modelsStatus === "loading" ? "loading…" : "refresh"}
                </button>
              </span>
              {models.length > 0 ? (
                <select
                  value={config.model}
                  onChange={(e) => update({ model: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 focus:outline-none focus:ring-2 focus:ring-accent-300 cursor-pointer"
                >
                  <option value="">Choose a model…</option>
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  defaultValue={config.model}
                  onBlur={(e) => e.target.value !== config.model && update({ model: e.target.value })}
                  placeholder="Model name"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 focus:outline-none focus:ring-2 focus:ring-accent-300"
                />
              )}
              <span className="block text-xs text-ink-400 mt-1.5">
                Pick a large instruction-tuned model (names often include "70b", "pro", "flash" or "instruct").
              </span>
            </label>
          )}

          {message && <p className="text-sm text-red-600 dark:text-red-400">{message}</p>}
          {config.has_api_key && config.model && !message && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">✓ Rewrite is ready to use.</p>
          )}
        </div>
      </Section>
    </>
  );
}

function DictionarySection() {
  const [words, setWords] = useState<DictionaryWord[]>([]);
  const [newWord, setNewWord] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.listDictionaryWords().then(setWords).catch(console.error);
  }, []);
  useEffect(load, [load]);

  const add = async () => {
    const w = newWord.trim();
    setNewWord("");
    if (!w || words.some((x) => x.word.toLowerCase() === w.toLowerCase())) return;
    try {
      await api.addDictionaryWord(w);
      setError(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Section title="Personal dictionary" description="Names and words added here are never flagged as spelling mistakes, and Fix leaves them alone.">
      <div className="flex gap-2 mb-4">
        <input
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a word…"
          className="flex-1 px-3 py-2 text-sm rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 focus:outline-none focus:ring-2 focus:ring-accent-300"
        />
        <button type="button" onClick={add} className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-600 hover:bg-accent-700 text-white cursor-pointer">
          Add
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="flex flex-wrap gap-1.5">
        {words.length === 0 && <p className="text-sm text-ink-400">No words yet.</p>}
        {words.map((w) => (
          <span key={w.id} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 text-sm rounded-full bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200">
            {w.word}
            <button
              type="button"
              onClick={() => api.deleteDictionaryWord(w.id).then(load)}
              className="p-0.5 rounded-full text-ink-400 hover:text-red-500 cursor-pointer"
              aria-label={`Remove ${w.word}`}
            >
              <XIcon size={12} />
            </button>
          </span>
        ))}
      </div>
    </Section>
  );
}

function BackupSection({ path, onSetPath }: { path: string; onSetPath: (p: string) => void }) {
  const [input, setInput] = useState(path);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [result, setResult] = useState<string | null>(null);

  const backup = async () => {
    if (!input.trim()) return;
    setStatus("working");
    setResult(null);
    try {
      onSetPath(input);
      const r = await api.backupAll(input);
      setStatus("done");
      setResult(`Exported ${r.exported} document${r.exported !== 1 ? "s" : ""}${r.skipped ? `, ${r.skipped} skipped` : ""} → ${r.backup_dir}`);
    } catch (err) {
      setStatus("error");
      setResult((err as Error).message || "Backup failed");
    }
  };

  return (
    <Section title="Folder backup" description="Export every document as a .docx file into a folder on this computer. Each backup goes into its own timestamped subfolder.">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={() => input !== path && onSetPath(input)}
          placeholder="/home/you/Documents/writer-backups"
          className="flex-1 px-3 py-2 text-sm rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 focus:outline-none focus:ring-2 focus:ring-accent-300"
        />
        <button
          type="button"
          onClick={backup}
          disabled={!input.trim() || status === "working"}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-600 hover:bg-accent-700 text-white disabled:opacity-40 cursor-pointer disabled:cursor-default"
        >
          {status === "working" ? "Backing up…" : "Back up now"}
        </button>
      </div>
      {result && <p className={`mt-3 text-sm ${status === "error" ? "text-red-600" : "text-emerald-600"}`}>{result}</p>}
    </Section>
  );
}
