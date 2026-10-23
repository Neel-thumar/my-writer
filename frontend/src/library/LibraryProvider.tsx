/**
 * Shared library state (folders, documents, trash) so the sidebar and the
 * Home page always show the same thing, plus the actions that change it.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { Document, Folder } from "../types";
import { useToast } from "../ui/Toast";

interface LibraryContextValue {
  folders: Folder[];
  documents: Document[];
  trashDocs: Document[];
  trashFolders: Folder[];
  loaded: boolean;
  reload: () => Promise<void>;
  /** Reflect a just-saved document without refetching everything */
  upsertDocument: (doc: Document) => void;
  createFolder: (name: string, parentId?: number | null) => Promise<Folder | null>;
  renameFolder: (id: number, name: string) => Promise<void>;
  trashFolder: (folder: Folder) => Promise<void>;
  trashDocument: (doc: Document) => Promise<void>;
  moveDocument: (docId: number, folderId: number | null) => Promise<void>;
  duplicateDocument: (docId: number) => Promise<void>;
  restoreDocument: (id: number) => Promise<void>;
  restoreFolder: (id: number) => Promise<void>;
  deleteForever: (id: number) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [trashDocs, setTrashDocs] = useState<Document[]>([]);
  const [trashFolders, setTrashFolders] = useState<Folder[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [folderList, docList, allDocs, allFolders] = await Promise.all([
        api.listFolders(),
        api.listDocuments({ sort: "updated" }),
        api.listDocuments({ include_deleted: true }),
        api.listFolders(true),
      ]);
      setFolders(folderList);
      setDocuments(docList);
      setTrashDocs(allDocs.filter((d) => d.deleted_at !== null));
      setTrashFolders(allFolders.filter((f) => f.deleted_at !== null));
      setLoaded(true);
    } catch (err) {
      console.error("Failed to load library:", err);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const run = useCallback(
    async (action: () => Promise<unknown>, failMessage: string) => {
      try {
        await action();
      } catch (err) {
        console.error(err);
        toast.show(`${failMessage}: ${(err as Error).message}`, { tone: "error" });
      }
      await reload();
    },
    [reload, toast],
  );

  const value = useMemo<LibraryContextValue>(
    () => ({
      folders,
      documents,
      trashDocs,
      trashFolders,
      loaded,
      reload,
      upsertDocument: (doc) =>
        setDocuments((prev) => [doc, ...prev.filter((d) => d.id !== doc.id)]),
      createFolder: async (name, parentId = null) => {
        try {
          const f = await api.createFolder(name, parentId);
          await reload();
          return f;
        } catch (err) {
          toast.show(`Couldn't create folder: ${(err as Error).message}`, { tone: "error" });
          return null;
        }
      },
      renameFolder: (id, name) => run(() => api.updateFolder(id, { name }), "Couldn't rename folder"),
      trashFolder: async (folder) => {
        await run(() => api.deleteFolder(folder.id), "Couldn't delete folder");
        toast.show(`Moved “${folder.name}” to Trash`, {
          action: { label: "Undo", onClick: () => run(() => api.restoreFolder(folder.id), "Couldn't restore") },
        });
      },
      trashDocument: async (doc) => {
        await run(() => api.deleteDocument(doc.id), "Couldn't delete document");
        toast.show(`Moved “${doc.title || "Untitled"}” to Trash`, {
          action: { label: "Undo", onClick: () => run(() => api.restoreDocument(doc.id), "Couldn't restore") },
        });
      },
      moveDocument: (docId, folderId) =>
        run(() => api.updateDocument(docId, { folder_id: folderId }), "Couldn't move document"),
      duplicateDocument: (docId) => run(() => api.duplicateDocument(docId), "Couldn't duplicate"),
      restoreDocument: (id) => run(() => api.restoreDocument(id), "Couldn't restore"),
      restoreFolder: (id) => run(() => api.restoreFolder(id), "Couldn't restore"),
      deleteForever: (id) => run(() => api.deleteDocument(id, true), "Couldn't delete"),
    }),
    [folders, documents, trashDocs, trashFolders, loaded, reload, run, toast],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}

export function formatRelative(dateStr: string): string {
  // The API returns naive UTC timestamps; treat them as UTC
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(dateStr) ? dateStr : `${dateStr}Z`);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString();
}
