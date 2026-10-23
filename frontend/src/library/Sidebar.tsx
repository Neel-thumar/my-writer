/**
 * Left navigation: Home, search, folders (with their documents), unfiled
 * documents, Trash and Settings. Resizable by dragging its edge; collapsible.
 */

import { useMemo, useState } from "react";
import type { Route } from "../hooks/useHashRoute";
import { useResizable } from "../hooks/useResizable";
import { useTheme } from "../theme/ThemeProvider";
import type { Document, Folder } from "../types";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DocIcon,
  FolderIcon,
  HomeIcon,
  MoonIcon,
  PanelLeftIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  TrashIcon,
  XIcon,
} from "../ui/icons";
import { useLibrary } from "./LibraryProvider";

interface SidebarProps {
  route: Route;
  navigate: (to: Route) => void;
  onNewDocument: (folderId: number | null) => void;
  onOpenSettings: () => void;
  onCollapse: () => void;
}

const EXPANDED_KEY = "sidebar-expanded-folders";

export function Sidebar({ route, navigate, onNewDocument, onOpenSettings, onCollapse }: SidebarProps) {
  const { folders, documents, trashDocs, trashFolders, createFolder, renameFolder, trashFolder, trashDocument } =
    useLibrary();
  const { theme, toggleTheme } = useTheme();
  const { width, handleProps } = useResizable("sidebar-width", 256, 200, 420, "left");
  const [search, setSearch] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]));
      return next;
    });

  const query = search.trim().toLowerCase();
  const matching = useMemo(
    () => (query ? documents.filter((d) => (d.title || "Untitled").toLowerCase().includes(query)) : documents),
    [documents, query],
  );
  const topFolders = folders.filter((f) => f.parent_id === null);
  const childFolders = (id: number) => folders.filter((f) => f.parent_id === id);
  const docsIn = (folderId: number | null) => matching.filter((d) => d.folder_id === folderId);
  const activeDocId = route.page === "doc" ? route.id : null;
  const trashCount = trashDocs.length + trashFolders.length;

  const navItem = (active: boolean) =>
    `w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
      active
        ? "bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-50 shadow-sm"
        : "text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800/60"
    }`;

  const renderDoc = (doc: Document, depth: number) => (
    <div
      key={doc.id}
      className={`group ${navItem(activeDocId === doc.id)}`}
      style={{ paddingLeft: 10 + depth * 14 }}
      onClick={() => navigate({ page: "doc", id: doc.id })}
      title={doc.title || "Untitled"}
    >
      <DocIcon size={14} className="shrink-0 text-ink-400" />
      <span className="flex-1 truncate">{doc.title || "Untitled"}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          trashDocument(doc);
        }}
        className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-500 cursor-pointer"
        title="Move to Trash"
      >
        <TrashIcon size={13} />
      </button>
    </div>
  );

  const renderFolder = (folder: Folder, depth: number) => {
    const isOpen = expanded.has(folder.id) || !!query;
    const docs = docsIn(folder.id);
    const children = childFolders(folder.id);
    if (query && docs.length === 0 && children.length === 0) return null;
    return (
      <div key={folder.id}>
        <div
          className={`group ${navItem(route.page === "folder" && route.id === folder.id)}`}
          style={{ paddingLeft: 6 + depth * 14 }}
          onClick={() => navigate({ page: "folder", id: folder.id })}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggle(folder.id);
            }}
            className="text-ink-400 hover:text-ink-700 cursor-pointer"
            aria-label={isOpen ? "Collapse" : "Expand"}
          >
            {isOpen ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
          </button>
          <FolderIcon size={14} className="shrink-0 text-amber-500" />
          {renamingId === folder.id ? (
            <InlineInput
              initial={folder.name}
              onSubmit={(name) => {
                setRenamingId(null);
                if (name && name !== folder.name) renameFolder(folder.id, name);
              }}
              onCancel={() => setRenamingId(null)}
            />
          ) : (
            <span
              className="flex-1 truncate"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setRenamingId(folder.id);
              }}
              title="Double-click to rename"
            >
              {folder.name}
            </span>
          )}
          <span className="text-xs text-ink-400 group-hover:hidden">{docs.length || ""}</span>
          <span className="hidden group-hover:flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNewDocument(folder.id);
              }}
              className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-100 cursor-pointer"
              title="New document in this folder"
            >
              <PlusIcon size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                trashFolder(folder);
              }}
              className="text-ink-400 hover:text-red-500 cursor-pointer"
              title="Move folder to Trash"
            >
              <TrashIcon size={13} />
            </button>
          </span>
        </div>
        {isOpen && (
          <div>
            {children.map((c) => renderFolder(c, depth + 1))}
            {docs.map((d) => renderDoc(d, depth + 1))}
            {docs.length === 0 && children.length === 0 && (
              <p className="text-xs text-ink-400 py-1" style={{ paddingLeft: 34 + depth * 14 }}>
                Empty
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const unfiled = docsIn(null);

  return (
    <div className="flex h-full shrink-0" style={{ width }}>
      <aside className="flex-1 min-w-0 flex flex-col bg-ink-100/60 dark:bg-ink-900 border-r border-ink-200/70 dark:border-ink-800">
        {/* Brand + collapse */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <div className="w-6 h-6 rounded-md bg-accent-600 text-white grid place-items-center text-xs font-bold font-serif">
            W
          </div>
          <span className="font-semibold text-sm text-ink-800 dark:text-ink-100 flex-1">Writer</span>
          <button
            type="button"
            onClick={onCollapse}
            className="p-1 rounded-md text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-ink-200/60 dark:hover:bg-ink-800 cursor-pointer"
            title="Hide sidebar (Ctrl+\)"
          >
            <PanelLeftIcon size={15} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 focus-within:ring-2 focus-within:ring-accent-300 dark:focus-within:ring-accent-700">
            <SearchIcon size={14} className="text-ink-400 shrink-0" />
            <input
              id="sidebar-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setSearch("")}
              placeholder="Search…"
              className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none placeholder-ink-400"
            />
            {search ? (
              <button type="button" onClick={() => setSearch("")} className="text-ink-400 cursor-pointer">
                <XIcon size={13} />
              </button>
            ) : (
              <kbd className="text-[10px] text-ink-400 font-sans">Ctrl K</kbd>
            )}
          </div>
        </div>

        <div className="px-3 pb-2 space-y-0.5">
          <button type="button" className={navItem(route.page === "home")} onClick={() => navigate({ page: "home" })}>
            <HomeIcon size={15} className="text-ink-400" /> Home
          </button>
          <button type="button" className={navItem(false)} onClick={() => onNewDocument(null)}>
            <PlusIcon size={15} className="text-ink-400" /> New document
          </button>
        </div>

        {/* Library tree */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="flex items-center justify-between px-2.5 pt-3 pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Folders</span>
            <button
              type="button"
              onClick={() => setCreatingFolder(true)}
              className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 cursor-pointer"
              title="New folder"
            >
              <PlusIcon size={14} />
            </button>
          </div>
          {creatingFolder && (
            <div className={navItem(false)}>
              <FolderIcon size={14} className="text-amber-500" />
              <InlineInput
                initial=""
                placeholder="Folder name"
                onSubmit={(name) => {
                  setCreatingFolder(false);
                  if (name) createFolder(name);
                }}
                onCancel={() => setCreatingFolder(false)}
              />
            </div>
          )}
          {topFolders.map((f) => renderFolder(f, 0))}
          {topFolders.length === 0 && !creatingFolder && (
            <p className="px-2.5 py-1 text-xs text-ink-400">No folders yet</p>
          )}

          <div className="px-2.5 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Documents
          </div>
          {unfiled.map((d) => renderDoc(d, 0))}
          {unfiled.length === 0 && (
            <p className="px-2.5 py-1 text-xs text-ink-400">{query ? "No matches" : "Nothing here yet"}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-ink-200/70 dark:border-ink-800 flex items-center gap-1">
          <button
            type="button"
            className={`${navItem(route.page === "trash")} flex-1`}
            onClick={() => navigate({ page: "trash" })}
          >
            <TrashIcon size={15} className="text-ink-400" /> Trash
            {trashCount > 0 && <span className="ml-auto text-xs text-ink-400">{trashCount}</span>}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg text-ink-500 hover:bg-ink-200/60 dark:hover:bg-ink-800 cursor-pointer"
            title={theme === "light" ? "Dark mode" : "Light mode"}
          >
            {theme === "light" ? <MoonIcon size={15} /> : <SunIcon size={15} />}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded-lg text-ink-500 hover:bg-ink-200/60 dark:hover:bg-ink-800 cursor-pointer"
            title="Settings"
          >
            <SettingsIcon size={15} />
          </button>
        </div>
      </aside>
      <div {...handleProps} title="Drag to resize" />
    </div>
  );
}

/** Text input that commits on Enter/blur and cancels on Escape. */
export function InlineInput({
  initial,
  placeholder,
  onSubmit,
  onCancel,
}: {
  initial: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <input
      autoFocus
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit(value.trim());
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => onSubmit(value.trim())}
      className="flex-1 min-w-0 bg-white dark:bg-ink-800 rounded px-1.5 py-0.5 text-sm border border-accent-300 focus:outline-none"
    />
  );
}
