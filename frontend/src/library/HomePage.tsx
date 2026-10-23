/**
 * Home, folder and Trash pages: an overview of everything you've written.
 */

import { useMemo, useState } from "react";
import type { Route } from "../hooks/useHashRoute";
import type { Document, Folder } from "../types";
import {
  CopyIcon,
  DocIcon,
  FolderIcon,
  MoreIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UploadIcon,
} from "../ui/icons";
import { Menu, MenuDivider, MenuItem } from "../ui/Menu";
import { formatRelative, useLibrary } from "./LibraryProvider";
import { InlineInput } from "./Sidebar";

interface HomePageProps {
  route: Route;
  navigate: (to: Route) => void;
  onNewDocument: (folderId: number | null) => void;
  onImport: () => void;
}

type Sort = "updated" | "title" | "words";

/** Plain-text preview of a document's TipTap JSON. */
export function docText(content: unknown, limit = 600): string {
  let out = "";
  const walk = (node: unknown) => {
    if (out.length >= limit || !node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === "text" && n.text) out += n.text;
    n.content?.forEach((c) => {
      walk(c);
      if ((c as { type?: string }).type === "paragraph" || (c as { type?: string }).type === "heading") out += " ";
    });
  };
  walk(content);
  return out.trim().slice(0, limit);
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function HomePage({ route, navigate, onNewDocument, onImport }: HomePageProps) {
  const lib = useLibrary();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(() => (localStorage.getItem("home-sort") as Sort) || "updated");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const folderId = route.page === "folder" ? route.id : null;
  const folder = folderId !== null ? lib.folders.find((f) => f.id === folderId) : undefined;
  const subfolders = lib.folders.filter((f) => f.parent_id === folderId);

  const docs = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = folderId === null ? lib.documents : lib.documents.filter((d) => d.folder_id === folderId);
    if (q) {
      list = list.filter((d) => (d.title || "Untitled").toLowerCase().includes(q) || docText(d.content, 5000).toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sort === "title") sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    else if (sort === "words") sorted.sort((a, b) => b.word_count - a.word_count);
    return sorted; // API already returns most recently edited first
  }, [lib.documents, folderId, query, sort]);

  if (route.page === "trash") return <TrashPage />;

  if (folderId !== null && lib.loaded && !folder) {
    return (
      <div className="flex-1 grid place-items-center text-ink-400 text-sm">
        <div className="text-center space-y-3">
          <p>This folder doesn't exist anymore.</p>
          <button type="button" onClick={() => navigate({ page: "home" })} className="text-accent-600 hover:underline cursor-pointer">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const recent = folderId === null && !query ? lib.documents[0] : undefined;
  const folderName = (id: number | null) => lib.folders.find((f) => f.id === id)?.name;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10">
        {/* Header */}
        <div className="flex flex-wrap items-end gap-4 mb-8">
          <div className="flex-1 min-w-[240px]">
            {folder ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate(folder.parent_id ? { page: "folder", id: folder.parent_id } : { page: "home" })}
                  className="text-sm text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 cursor-pointer"
                >
                  ← {folder.parent_id ? folderName(folder.parent_id) : "Home"}
                </button>
                <div className="flex items-center gap-3 mt-1">
                  <FolderIcon size={26} className="text-amber-500" />
                  {renaming ? (
                    <InlineInput
                      initial={folder.name}
                      onSubmit={(name) => {
                        setRenaming(false);
                        if (name && name !== folder.name) lib.renameFolder(folder.id, name);
                      }}
                      onCancel={() => setRenaming(false)}
                    />
                  ) : (
                    <h1
                      className="text-3xl font-serif font-semibold text-ink-900 dark:text-ink-50 cursor-text"
                      onDoubleClick={() => setRenaming(true)}
                      title="Double-click to rename"
                    >
                      {folder.name}
                    </h1>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-400">
                  {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </p>
                <h1 className="text-3xl font-serif font-semibold text-ink-900 dark:text-ink-50 mt-1">{greeting()}</h1>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!folder && (
              <button
                type="button"
                onClick={onImport}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-ink-600 dark:text-ink-300 border border-ink-200 dark:border-ink-700 hover:bg-white dark:hover:bg-ink-800 cursor-pointer"
              >
                <UploadIcon size={15} /> Import .docx
              </button>
            )}
            <button
              type="button"
              onClick={() => onNewDocument(folderId)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-accent-600 hover:bg-accent-700 text-white shadow-sm cursor-pointer"
            >
              <PlusIcon size={15} /> New document
            </button>
          </div>
        </div>

        {/* Continue writing */}
        {recent && (
          <button
            type="button"
            onClick={() => navigate({ page: "doc", id: recent.id })}
            className="w-full text-left mb-10 p-5 rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 hover:border-accent-300 dark:hover:border-accent-700 hover:shadow-md transition-all group cursor-pointer"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-600 mb-2">Continue writing</p>
            <p className="text-lg font-serif font-semibold text-ink-900 dark:text-ink-50">{recent.title || "Untitled"}</p>
            <p className="text-sm text-ink-500 dark:text-ink-400 mt-1 line-clamp-2">
              {docText(recent.content, 220) || "Empty document"}
            </p>
            <p className="text-xs text-ink-400 mt-3">
              {recent.word_count} words · edited {formatRelative(recent.updated_at)}
              <span className="ml-2 text-accent-600 opacity-0 group-hover:opacity-100 transition-opacity">Open →</span>
            </p>
          </button>
        )}

        {/* Folders */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
            {folder ? "Subfolders" : "Folders"}
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
            {subfolders.map((f) => (
              <FolderCard
                key={f.id}
                folder={f}
                count={lib.documents.filter((d) => d.folder_id === f.id).length}
                onOpen={() => navigate({ page: "folder", id: f.id })}
                onTrash={() => lib.trashFolder(f)}
              />
            ))}
            {creatingFolder ? (
              <div className="p-4 rounded-xl border-2 border-dashed border-accent-300 flex items-center gap-2">
                <FolderIcon size={18} className="text-amber-500 shrink-0" />
                <InlineInput
                  initial=""
                  placeholder="Folder name"
                  onSubmit={(name) => {
                    setCreatingFolder(false);
                    if (name) lib.createFolder(name, folderId);
                  }}
                  onCancel={() => setCreatingFolder(false)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreatingFolder(true)}
                className="p-4 rounded-xl border-2 border-dashed border-ink-200 dark:border-ink-700 text-sm text-ink-400 hover:text-ink-700 hover:border-ink-300 dark:hover:text-ink-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <PlusIcon size={15} /> New folder
              </button>
            )}
          </div>
        </section>

        {/* Documents */}
        <section>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400 flex-1">
              {folder ? "Documents" : "All documents"} <span className="text-ink-300">· {docs.length}</span>
            </h2>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 w-full sm:w-64 focus-within:ring-2 focus-within:ring-accent-300">
              <SearchIcon size={14} className="text-ink-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search titles and text…"
                className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none placeholder-ink-400"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as Sort);
                localStorage.setItem("home-sort", e.target.value);
              }}
              className="text-sm px-2.5 py-1.5 rounded-lg bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 focus:outline-none cursor-pointer"
            >
              <option value="updated">Last edited</option>
              <option value="title">Title A–Z</option>
              <option value="words">Longest</option>
            </select>
          </div>

          <div className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 divide-y divide-ink-100 dark:divide-ink-800 overflow-hidden">
            {docs.map((d) => (
              <DocRow
                key={d.id}
                doc={d}
                folders={lib.folders}
                folderName={folderId === null ? folderName(d.folder_id) : undefined}
                onOpen={() => navigate({ page: "doc", id: d.id })}
              />
            ))}
            {docs.length === 0 && (
              <div className="py-14 text-center">
                <DocIcon size={28} className="mx-auto text-ink-300 mb-3" />
                <p className="text-sm text-ink-500">{query ? `Nothing matches “${query}”` : "No documents here yet"}</p>
                {!query && (
                  <button
                    type="button"
                    onClick={() => onNewDocument(folderId)}
                    className="mt-3 text-sm font-medium text-accent-600 hover:underline cursor-pointer"
                  >
                    Start writing
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function FolderCard({
  folder,
  count,
  onOpen,
  onTrash,
}: {
  folder: Folder;
  count: number;
  onOpen: () => void;
  onTrash: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="group relative p-4 rounded-xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-sm transition-all cursor-pointer"
    >
      <FolderIcon size={22} className="text-amber-500 mb-3" />
      <p className="text-sm font-medium text-ink-800 dark:text-ink-100 truncate">{folder.name}</p>
      <p className="text-xs text-ink-400">
        {count} document{count === 1 ? "" : "s"}
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTrash();
        }}
        className="absolute top-3 right-3 p-1 rounded-md text-ink-400 hover:text-red-500 opacity-0 group-hover:opacity-100 cursor-pointer"
        title="Move to Trash"
      >
        <TrashIcon size={14} />
      </button>
    </div>
  );
}

function DocRow({
  doc,
  folders,
  folderName,
  onOpen,
}: {
  doc: Document;
  folders: Folder[];
  folderName?: string;
  onOpen: () => void;
}) {
  const lib = useLibrary();
  const preview = docText(doc.content, 160);
  return (
    <div onClick={onOpen} className="group flex items-center gap-4 px-5 py-3.5 hover:bg-ink-50 dark:hover:bg-ink-800/50 cursor-pointer">
      <DocIcon size={18} className="text-ink-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-ink-800 dark:text-ink-100 truncate">{doc.title || "Untitled"}</p>
          {folderName && (
            <span className="shrink-0 text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              {folderName}
            </span>
          )}
        </div>
        <p className="text-xs text-ink-400 truncate mt-0.5">{preview || "Empty document"}</p>
      </div>
      <div className="hidden sm:block text-right shrink-0">
        <p className="text-xs text-ink-500 dark:text-ink-400">{formatRelative(doc.updated_at)}</p>
        <p className="text-xs text-ink-400">{doc.word_count} words</p>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <Menu
          title="More"
          trigger={() => (
            <span className="p-1.5 rounded-md text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 opacity-60 group-hover:opacity-100 inline-flex">
              <MoreIcon size={16} />
            </span>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={<PencilIcon size={14} />} label="Open" onClick={() => (close(), onOpen())} />
              <MenuItem
                icon={<CopyIcon size={14} />}
                label="Duplicate"
                onClick={() => (close(), lib.duplicateDocument(doc.id))}
              />
              <MenuDivider />
              <p className="px-2.5 pt-1 pb-0.5 text-[11px] uppercase tracking-wider text-ink-400">Move to</p>
              <div className="max-h-48 overflow-y-auto">
                {doc.folder_id !== null && (
                  <MenuItem label="Top level (no folder)" onClick={() => (close(), lib.moveDocument(doc.id, null))} />
                )}
                {folders
                  .filter((f) => f.id !== doc.folder_id)
                  .map((f) => (
                    <MenuItem
                      key={f.id}
                      icon={<FolderIcon size={14} />}
                      label={f.name}
                      onClick={() => (close(), lib.moveDocument(doc.id, f.id))}
                    />
                  ))}
              </div>
              <MenuDivider />
              <MenuItem
                icon={<TrashIcon size={14} />}
                label="Move to Trash"
                danger
                onClick={() => (close(), lib.trashDocument(doc))}
              />
            </>
          )}
        </Menu>
      </div>
    </div>
  );
}

function TrashPage() {
  const lib = useLibrary();
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const empty = lib.trashDocs.length === 0 && lib.trashFolders.length === 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">
        <h1 className="text-3xl font-serif font-semibold text-ink-900 dark:text-ink-50 mb-1">Trash</h1>
        <p className="text-sm text-ink-400 mb-8">Restore anything you deleted, or remove it for good.</p>
        {empty ? (
          <div className="py-16 text-center text-sm text-ink-400 rounded-2xl border border-dashed border-ink-200 dark:border-ink-800">
            Trash is empty
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 divide-y divide-ink-100 dark:divide-ink-800">
            {lib.trashFolders.map((f) => (
              <div key={`f${f.id}`} className="flex items-center gap-3 px-5 py-3">
                <FolderIcon size={17} className="text-amber-500" />
                <span className="flex-1 text-sm text-ink-700 dark:text-ink-200 truncate">{f.name}</span>
                <button type="button" onClick={() => lib.restoreFolder(f.id)} className="text-sm text-accent-600 hover:underline cursor-pointer">
                  Restore
                </button>
              </div>
            ))}
            {lib.trashDocs.map((d) => (
              <div key={`d${d.id}`} className="flex items-center gap-3 px-5 py-3">
                <DocIcon size={17} className="text-ink-300" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-700 dark:text-ink-200 truncate">{d.title || "Untitled"}</p>
                  <p className="text-xs text-ink-400">{d.word_count} words</p>
                </div>
                <button type="button" onClick={() => lib.restoreDocument(d.id)} className="text-sm text-accent-600 hover:underline cursor-pointer">
                  Restore
                </button>
                {confirmId === d.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmId(null);
                      lib.deleteForever(d.id);
                    }}
                    onBlur={() => setConfirmId(null)}
                    autoFocus
                    className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-md cursor-pointer"
                  >
                    Really delete?
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirmId(d.id)} className="text-sm text-ink-400 hover:text-red-600 cursor-pointer">
                    Delete forever
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
