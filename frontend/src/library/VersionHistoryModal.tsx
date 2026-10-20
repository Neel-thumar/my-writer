/**
 * Version history modal — shows all saved snapshots for a document
 * with the ability to restore any version.
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
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-ink-900 rounded-lg shadow-xl max-w-lg w-full max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center px-5 py-3 border-b border-ink-200 dark:border-ink-800">
          <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-200">Version History</h2>
          <button
            onClick={onClose}
            className="ml-auto text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 text-lg"
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && (
            <p className="text-sm text-ink-400 text-center py-4">Loading…</p>
          )}
          {!loading && versions.length === 0 && (
            <p className="text-sm text-ink-400 text-center py-4">No saved versions yet</p>
          )}
          {!loading && versions.length > 0 && (
            <div className="space-y-1">
              {versions.map((v, i) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 px-3 py-2 rounded hover:bg-ink-100 dark:hover:bg-ink-800"
                >
                  <span className="text-xs text-ink-400 w-6 text-center">
                    {i === 0 ? "📋" : `v${versions.length - i}`}
                  </span>
                  <span className="text-sm text-ink-700 dark:text-ink-200 flex-1">
                    {formatDate(v.saved_at)}
                  </span>
                  <button
                    onClick={() => handleRestore(v.id)}
                    disabled={restoring === v.id}
                    className="px-2 py-1 text-xs rounded text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 disabled:opacity-50"
                  >
                    {restoring === v.id ? "Restoring…" : "↩ Restore"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-ink-200 dark:border-ink-800">
          <p className="text-xs text-ink-400">
            Versions are saved automatically when you edit. Restoring creates a snapshot of the current content first.
          </p>
        </div>
      </div>
    </div>
  );
}
