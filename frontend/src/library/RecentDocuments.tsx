/**
 * Recent documents — shows on the home screen when no document is selected.
 * Displays the most recently edited documents for quick access.
 */

import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Document } from "../types";

interface RecentDocumentsProps {
  onOpenDocument: (doc: Document) => void;
  onNewDocument: () => void;
}

export function RecentDocuments({
  onOpenDocument,
  onNewDocument,
}: RecentDocumentsProps) {
  const [recent, setRecent] = useState<Document[]>([]);

  useEffect(() => {
    api
      .listDocuments({ sort: "updated" })
      .then((docs) => setRecent(docs.slice(0, 8)))
      .catch(console.error);
  }, []);

  const formatRelative = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="flex-1 flex items-center justify-center overflow-y-auto">
      <div className="w-full max-w-2xl px-8 py-12">
        <h2 className="text-2xl font-serif text-ink-700 dark:text-ink-200 mb-1">
          Your Writing Workspace
        </h2>
        <p className="text-sm text-ink-400 mb-8">
          Select a document or create a new one to begin.
        </p>

        <button
          onClick={onNewDocument}
          className="px-4 py-2.5 rounded-lg bg-ink-700 text-white hover:bg-ink-600 dark:bg-ink-600 dark:hover:bg-ink-500 mb-8 text-sm font-medium"
        >
          ✍️ New Document
        </button>

        {recent.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
              Recent
            </h3>
            <div className="space-y-1">
              {recent.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => onOpenDocument(doc)}
                  className="group flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-700 dark:text-ink-200 truncate">
                      {doc.title || "Untitled"}
                    </p>
                    <p className="text-xs text-ink-400">
                      {doc.word_count} words · {formatRelative(doc.updated_at)}
                    </p>
                  </div>
                  <span className="text-xs text-ink-300 group-hover:text-ink-500">
                    →
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
