/**
 * Version history modal — shows manually saved snapshots (created via Ctrl+S)
 * for a document with the ability to restore any version.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Version } from "../types";

interface VersionHistoryModalProps {
  docId: number;
  onClose: () => void;
  onRestore: () => void; // callback to reload the document after restore
}

export function VersionHistoryModal({
  docId,
  onClose,
  onRestore,
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listVersions(docId);
      setVersions(list);
    } catch (err) {
      console.error("Failed to load versions:", err);
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleCreateSnapshot = async () => {
    setSavingSnapshot(true);
    try {
      await api.createVersion(docId);
      await loadVersions();
    } catch (err) {
      console.error("Failed to create snapshot:", err);
    } finally {
      setSavingSnapshot(false);
    }
  };

  const handleRestore = async (versionId: number) => {
    if (!confirm("Restore this version? A snapshot of the current content will be saved first.")) return;
    setRestoring(versionId);
    try {
      await api.restoreVersion(docId, versionId);
      onRestore();
      onClose();
    } catch (err) {
      console.error("Restore failed:", err);
      alert("Failed to restore version");
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-[70] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-ink-900 rounded-xl shadow-2xl max-w-lg w-full max-h-[75vh] flex flex-col border border-ink-200 dark:border-ink-800 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-200 dark:border-ink-800">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h2 className="text-sm font-semibold text-ink-800 dark:text-ink-100">Version History</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateSnapshot}
              disabled={savingSnapshot}
              className="px-2.5 py-1 text-xs rounded-md bg-ink-100 hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700 text-ink-700 dark:text-ink-200 font-medium transition-colors cursor-pointer"
              title="Create snapshot now"
            >
              {savingSnapshot ? "Saving…" : "📸 Save Snapshot"}
            </button>
            <button
              onClick={onClose}
              className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 p-1 rounded-md text-base leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && (
            <p className="text-xs text-ink-400 text-center py-6">Loading versions…</p>
          )}
          {!loading && versions.length === 0 && (
            <div className="text-center py-8 space-y-1">
              <p className="text-sm text-ink-600 dark:text-ink-300 font-medium">No saved snapshots yet</p>
              <p className="text-xs text-ink-400">Press <kbd className="px-1.5 py-0.5 rounded bg-ink-100 dark:bg-ink-800 font-mono">Ctrl+S</kbd> while writing to save a version milestone.</p>
            </div>
          )}
          {!loading && versions.length > 0 && (
            <div className="space-y-1.5">
              {versions.map((v, i) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-ink-50 dark:bg-ink-800/60 border border-ink-100 dark:border-ink-700/60 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
                >
                  <span className="text-xs font-mono font-semibold text-accent-600 dark:text-accent-400">
                    {i === 0 ? "Latest" : `v${versions.length - i}`}
                  </span>
                  <span className="text-xs text-ink-700 dark:text-ink-200 flex-1">
                    {formatDate(v.saved_at)}
                  </span>
                  <button
                    onClick={() => handleRestore(v.id)}
                    disabled={restoring === v.id}
                    className="px-2.5 py-1 text-xs font-medium rounded bg-white dark:bg-ink-700 text-ink-700 dark:text-ink-200 border border-ink-200 dark:border-ink-600 hover:bg-accent-600 hover:text-white dark:hover:bg-accent-600 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {restoring === v.id ? "Restoring…" : "↩ Restore"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-950 text-xs text-ink-400 flex items-center justify-between">
          <span>Autosave quietly protects your work. Press <kbd className="font-mono text-ink-600 dark:text-ink-300">Ctrl+S</kbd> to save a version snapshot.</span>
        </div>
      </div>
    </div>
  );
}
