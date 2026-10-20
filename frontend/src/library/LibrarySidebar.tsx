import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Document, Folder } from "../types";

interface LibrarySidebarProps {
  selectedDocId: number | null;
  onSelectDocument: (doc: Document) => void;
  onCreateDocument: (folderId: number | null) => void;
  onImportDocx: () => void;
  refreshKey: number;
}

export function LibrarySidebar({
  selectedDocId,
  onSelectDocument,
  onCreateDocument,
  onImportDocx,
  refreshKey,
}: LibrarySidebarProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [trashDocs, setTrashDocs] = useState<Document[]>([]);
  const [trashFolders, setTrashFolders] = useState<Folder[]>([]);
  const [search, setSearch] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [activeFolder, setActiveFolder] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"updated" | "title" | "word_count">("updated");

  const loadData = useCallback(async () => {
    const [folderList, docList, trashDocList, trashFolderList] = await Promise.all([
      api.listFolders(),
      api.listDocuments({ sort: sortBy }),
      api.listDocuments({ include_deleted: true }),
      api.listFolders(true),
    ]);
    setFolders(folderList);
    setDocuments(docList);
    setTrashDocs(trashDocList.filter((d) => d.deleted_at !== null));
    setTrashFolders(trashFolderList.filter((f) => f.deleted_at !== null));
  }, [sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  // Filter documents by search
  const filteredDocs = search
    ? documents.filter((d) =>
        d.title.toLowerCase().includes(search.toLowerCase()),
      )
    : documents;

  // Documents in root (no folder)
  const rootDocs = filteredDocs.filter((d) => d.folder_id === null);
  // Documents in active folder
  const folderDocs = activeFolder !== null
    ? filteredDocs.filter((d) => d.folder_id === activeFolder)
    : [];

  const toggleFolder = (id: number) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateFolder = async () => {
    const name = prompt("Folder name:", "New Folder");
    if (!name) return;
    await api.createFolder(name, activeFolder);
    loadData();
  };

  const handleRenameFolder = async (folder: Folder) => {
    const name = prompt("Rename folder:", folder.name);
    if (!name) return;
    await api.updateFolder(folder.id, { name });
    loadData();
  };

  const handleDeleteFolder = async (folder: Folder) => {
    if (!confirm(`Move "${folder.name}" to trash?`)) return;
    await api.deleteFolder(folder.id);
    if (activeFolder === folder.id) setActiveFolder(null);
    loadData();
  };

  const handleDeleteDoc = async (doc: Document) => {
    if (!confirm(`Move "${doc.title}" to trash?`)) return;
    await api.deleteDocument(doc.id);
    loadData();
  };

  const handleRestoreDoc = async (doc: Document) => {
    await api.restoreDocument(doc.id);
    loadData();
  };

  const handleRestoreFolder = async (folder: Folder) => {
    await api.restoreFolder(folder.id);
    loadData();
  };

  const handlePermanentDelete = async (doc: Document) => {
    if (!confirm(`Permanently delete "${doc.title}"? This cannot be undone.`)) return;
    await api.deleteDocument(doc.id, true);
    loadData();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="library-sidebar w-72 h-full flex flex-col bg-ink-50 dark:bg-ink-900 border-r border-ink-200 dark:border-ink-800 transition-all duration-300 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2">
        <h1 className="text-sm font-semibold text-ink-700 dark:text-ink-200">Library</h1>
        <button
          type="button"
          onClick={() => onCreateDocument(activeFolder)}
          className="ml-auto px-2 py-1 text-xs rounded-md bg-ink-200 dark:bg-ink-700 text-ink-700 dark:text-ink-200 hover:bg-ink-300 dark:hover:bg-ink-600"
          title="New document"
        >
          + New
        </button>
        <button
          type="button"
          onClick={onImportDocx}
          className="px-2 py-1 text-xs rounded-md text-ink-500 hover:text-ink-700 dark:hover:text-ink-300"
          title="Import .docx"
        >
          ⬆ Import
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-2 space-y-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents…"
          className="w-full px-3 py-1.5 text-sm rounded-md bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 placeholder-ink-400 focus:outline-none focus:ring-1 focus:ring-ink-300"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-400">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "updated" | "title" | "word_count")}
            className="text-xs px-1.5 py-1 rounded bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 focus:outline-none"
          >
            <option value="updated">Last edited</option>
            <option value="title">Title (A–Z)</option>
            <option value="word_count">Word count</option>
          </select>
        </div>
      </div>

      {/* Navigation: All / Trash */}
      <div className="px-4 pb-2 flex gap-2">
        <button
          type="button"
          onClick={() => { setShowTrash(false); setActiveFolder(null); }}
          className={`px-2 py-1 text-xs rounded ${!showTrash ? "bg-ink-200 dark:bg-ink-700 text-ink-700 dark:text-ink-200" : "text-ink-500 hover:text-ink-700"}`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setShowTrash(true)}
          className={`px-2 py-1 text-xs rounded ${showTrash ? "bg-ink-200 dark:bg-ink-700 text-ink-700 dark:text-ink-200" : "text-ink-500 hover:text-ink-700"}`}
        >
          🗑 Trash
          {trashDocs.length + trashFolders.length > 0 && (
            <span className="ml-1 text-ink-400">({trashDocs.length + trashFolders.length})</span>
          )}
        </button>
        <button
          type="button"
          onClick={handleCreateFolder}
          className="ml-auto px-2 py-1 text-xs rounded text-ink-500 hover:text-ink-700"
          title="New folder"
        >
          📁+
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {showTrash ? (
          /* Trash view */
          <div className="space-y-1">
            {trashFolders.length === 0 && trashDocs.length === 0 && (
              <p className="text-xs text-ink-400 px-2 py-4 text-center">Trash is empty</p>
            )}
            {trashFolders.map((f) => (
              <div key={f.id} className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-ink-100 dark:hover:bg-ink-800">
                <span className="text-sm text-ink-500 flex-1">📁 {f.name}</span>
                <button onClick={() => handleRestoreFolder(f)} className="text-xs text-ink-500 hover:text-ink-700" title="Restore">↩</button>
              </div>
            ))}
            {trashDocs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-ink-100 dark:hover:bg-ink-800">
                <span className="text-sm text-ink-500 flex-1 truncate">{doc.title}</span>
                <button onClick={() => handleRestoreDoc(doc)} className="text-xs text-ink-500 hover:text-ink-700" title="Restore">↩</button>
                <button onClick={() => handlePermanentDelete(doc)} className="text-xs text-ink-500 hover:text-red-500" title="Delete forever">✕</button>
              </div>
            ))}
          </div>
        ) : (
          /* Library view */
          <div className="space-y-0.5">
            {/* Root documents */}
            {activeFolder === null && rootDocs.map((doc) => (
              <div
                key={doc.id}
                className={`group flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                  selectedDocId === doc.id
                    ? "bg-ink-200 dark:bg-ink-700"
                    : "hover:bg-ink-100 dark:hover:bg-ink-800"
                }`}
                onClick={() => onSelectDocument(doc)}
              >
                <span className="text-sm flex-1 truncate text-ink-700 dark:text-ink-200">{doc.title}</span>
                <span className="text-xs text-ink-400 opacity-0 group-hover:opacity-100">{formatDate(doc.updated_at)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc); }}
                  className="text-xs text-ink-400 opacity-0 group-hover:opacity-100 hover:text-red-500"
                  title="Move to trash"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Folders */}
            {folders.map((folder) => {
              const isExpanded = expandedFolders.has(folder.id);
              const isActive = activeFolder === folder.id;
              const folderDocsCount = documents.filter((d) => d.folder_id === folder.id).length;
              return (
                <div key={folder.id}>
                  <div
                    className={`group flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                      isActive ? "bg-ink-200 dark:bg-ink-700" : "hover:bg-ink-100 dark:hover:bg-ink-800"
                    }`}
                    onClick={() => { toggleFolder(folder.id); setActiveFolder(isActive ? null : folder.id); }}
                  >
                    <span className="text-xs text-ink-400">{isExpanded ? "▾" : "▸"}</span>
                    <span className="text-sm flex-1 truncate text-ink-700 dark:text-ink-200">📁 {folder.name}</span>
                    <span className="text-xs text-ink-400">{folderDocsCount}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder); }}
                      className="text-xs text-ink-400 opacity-0 group-hover:opacity-100"
                      title="Rename"
                    >
                      ✎
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                      className="text-xs text-ink-400 opacity-0 group-hover:opacity-100 hover:text-red-500"
                      title="Move to trash"
                    >
                      ✕
                    </button>
                  </div>
                  {/* Documents inside this folder */}
                  {isExpanded && filteredDocs
                    .filter((d) => d.folder_id === folder.id)
                    .map((doc) => (
                      <div
                        key={doc.id}
                        className={`group flex items-center gap-1 pl-8 pr-2 py-1.5 rounded cursor-pointer transition-colors ${
                          selectedDocId === doc.id
                            ? "bg-ink-200 dark:bg-ink-700"
                            : "hover:bg-ink-100 dark:hover:bg-ink-800"
                        }`}
                        onClick={() => onSelectDocument(doc)}
                      >
                        <span className="text-sm flex-1 truncate text-ink-700 dark:text-ink-200">{doc.title}</span>
                        <span className="text-xs text-ink-400 opacity-0 group-hover:opacity-100">{formatDate(doc.updated_at)}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc); }}
                          className="text-xs text-ink-400 opacity-0 group-hover:opacity-100 hover:text-red-500"
                          title="Move to trash"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                </div>
              );
            })}

            {/* Documents in active folder (flat view) */}
            {activeFolder !== null && folderDocs.length > 0 && (
              <div className="mt-2 pt-2 border-t border-ink-200 dark:border-ink-800">
                <p className="text-xs text-ink-400 px-2 mb-1">
                  In: {folders.find((f) => f.id === activeFolder)?.name}
                </p>
                {folderDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className={`group flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                      selectedDocId === doc.id
                        ? "bg-ink-200 dark:bg-ink-700"
                        : "hover:bg-ink-100 dark:hover:bg-ink-800"
                    }`}
                    onClick={() => onSelectDocument(doc)}
                  >
                    <span className="text-sm flex-1 truncate text-ink-700 dark:text-ink-200">{doc.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc); }}
                      className="text-xs text-ink-400 opacity-0 group-hover:opacity-100 hover:text-red-500"
                      title="Move to trash"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {documents.length === 0 && !search && (
              <div className="text-center py-8">
                <p className="text-sm text-ink-400 mb-2">No documents yet</p>
                <button
                  onClick={() => onCreateDocument(null)}
                  className="px-3 py-1.5 text-sm rounded-md bg-ink-200 dark:bg-ink-700 text-ink-700 dark:text-ink-200 hover:bg-ink-300 dark:hover:bg-ink-600"
                >
                  Create your first document
                </button>
              </div>
            )}

            {search && filteredDocs.length === 0 && (
              <p className="text-sm text-ink-400 text-center py-4">No results for "{search}"</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
