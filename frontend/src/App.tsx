import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api/client";
import { EditorScreen } from "./editor/EditorScreen";
import { useHashRoute } from "./hooks/useHashRoute";
import { useKeyboardShortcut } from "./hooks/useKeyboardShortcut";
import { HomePage } from "./library/HomePage";
import { LibraryProvider, useLibrary } from "./library/LibraryProvider";
import { SettingsModal, type SettingsSection } from "./library/SettingsModal";
import { Sidebar } from "./library/Sidebar";
import { SuggestionsProvider } from "./suggestions/SuggestionsProvider";
import { ThemeProvider } from "./theme/ThemeProvider";
import type { AiConfig } from "./types";
import { ToastProvider, useToast } from "./ui/Toast";

const DEFAULT_CATEGORIES = { spelling: true, grammar: true, punctuation: true, style: true };

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function Shell() {
  const { route, navigate } = useHashRoute();
  const lib = useLibrary();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "1");
  const [focusMode, setFocusMode] = useState(false);
  const [settings, setSettings] = useState<SettingsSection | null>(null);
  const [checkCategories, setCheckCategories] = useState<Record<string, boolean>>(() =>
    loadJSON("check-categories", DEFAULT_CATEGORIES),
  );
  const [autoCorrect, setAutoCorrect] = useState(() => localStorage.getItem("autoCorrectMode") === "true");
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
  const [backupPath, setBackupPath] = useState("");

  useEffect(() => {
    api.getAiConfig().then(setAiConfig).catch(console.error);
    api
      .getBackupPath()
      .then((r) => r.path && setBackupPath(r.path))
      .catch(() => {});
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((v) => {
      localStorage.setItem("sidebar-collapsed", v ? "0" : "1");
      return !v;
    });
  }, []);

  const toggleAutoCorrect = useCallback(() => {
    setAutoCorrect((v) => {
      localStorage.setItem("autoCorrectMode", String(!v));
      return !v;
    });
  }, []);

  const newDocument = useCallback(
    async (folderId: number | null) => {
      try {
        const doc = await api.createDocument({ title: "", folder_id: folderId });
        await lib.reload();
        navigate({ page: "doc", id: doc.id });
      } catch (err) {
        toast.show(`Couldn't create a document: ${(err as Error).message}`, { tone: "error" });
      }
    },
    [lib, navigate, toast],
  );

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const imported = await api.importDocument(file);
      await lib.reload();
      navigate({ page: "doc", id: imported.document_id });
      toast.show(`Imported “${imported.title}”`, { tone: "success" });
    } catch (err) {
      toast.show(`Import failed: ${(err as Error).message}`, { tone: "error" });
    }
  };

  useKeyboardShortcut("ctrl+\\", toggleSidebar);
  useKeyboardShortcut("ctrl+shift+f", () => setFocusMode((v) => !v));
  useKeyboardShortcut("alt+n", () => newDocument(null));
  useKeyboardShortcut("ctrl+k", () => {
    if (sidebarCollapsed) toggleSidebar();
    setFocusMode(false);
    setTimeout(() => document.getElementById("sidebar-search")?.focus(), 0);
  });

  const showSidebar = !sidebarCollapsed && !focusMode;

  return (
    <div className="h-screen flex overflow-hidden bg-ink-50 dark:bg-ink-950">
      {showSidebar && (
        <Sidebar
          route={route}
          navigate={navigate}
          onNewDocument={newDocument}
          onOpenSettings={() => setSettings("writing")}
          onCollapse={toggleSidebar}
        />
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        {route.page === "doc" ? (
          <EditorScreen
            key={route.id}
            docId={route.id}
            navigate={navigate}
            focusMode={focusMode}
            onToggleFocus={() => setFocusMode((v) => !v)}
            sidebarCollapsed={sidebarCollapsed}
            onExpandSidebar={toggleSidebar}
            onOpenSettings={(section) => setSettings(section ?? "writing")}
            checkCategories={checkCategories}
            rewriteConfigured={!!(aiConfig?.has_api_key && aiConfig.model)}
            autoCorrect={autoCorrect}
            onToggleAutoCorrect={toggleAutoCorrect}
          />
        ) : (
          <>
            {sidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="absolute top-3 left-3 z-10 px-2.5 py-1.5 rounded-lg text-xs text-ink-500 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 shadow-sm cursor-pointer"
              >
                Show sidebar
              </button>
            )}
            <HomePage
              route={route}
              navigate={navigate}
              onNewDocument={newDocument}
              onImport={() => fileInputRef.current?.click()}
            />
          </>
        )}
      </main>

      <input ref={fileInputRef} type="file" accept=".docx" onChange={onFileSelected} className="hidden" />

      {settings && (
        <SettingsModal
          initialSection={settings}
          onClose={() => setSettings(null)}
          checkCategories={checkCategories}
          onToggleCategory={(cat, enabled) =>
            setCheckCategories((prev) => {
              const next = { ...prev, [cat]: enabled };
              localStorage.setItem("check-categories", JSON.stringify(next));
              return next;
            })
          }
          autoCorrect={autoCorrect}
          onToggleAutoCorrect={toggleAutoCorrect}
          aiConfig={aiConfig}
          onAiConfigChange={setAiConfig}
          backupPath={backupPath}
          onSetBackupPath={(path) => {
            setBackupPath(path);
            api.setBackupPath(path).catch(console.error);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <LibraryProvider>
          <SuggestionsProvider>
            <Shell />
          </SuggestionsProvider>
        </LibraryProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
