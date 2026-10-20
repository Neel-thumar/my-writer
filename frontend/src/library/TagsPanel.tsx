/**
 * Tags panel — shows and manages tags for the currently selected document.
 * Tags can be created, added, and removed.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Tag } from "../types";

interface TagsPanelProps {
  docId: number;
  onTagsChanged?: () => void;
}

export function TagsPanel({ docId, onTagsChanged }: TagsPanelProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [docTags, setDocTags] = useState<Tag[]>([]);
  const [newTag, setNewTag] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  const loadData = useCallback(async () => {
    const [tags, docTagList] = await Promise.all([
      api.listTags(),
      api.getDocumentTags(docId),
    ]);
    setAllTags(tags);
    setDocTags(docTagList);
  }, [docId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddTag = async (tagId: number) => {
    const currentIds = docTags.map((t) => t.id);
    if (currentIds.includes(tagId)) return;
    const updated = await api.setDocumentTags(docId, [...currentIds, tagId]);
    setDocTags(updated);
    onTagsChanged?.();
  };

  const handleRemoveTag = async (tagId: number) => {
    const currentIds = docTags.map((t) => t.id).filter((id) => id !== tagId);
    const updated = await api.setDocumentTags(docId, currentIds);
    setDocTags(updated);
    onTagsChanged?.();
  };

  const handleCreateTag = async () => {
    const name = newTag.trim();
    if (!name) return;
    try {
      await api.createTag(name);
      setNewTag("");
      await loadData();
      // auto-assign to this doc
      const created = (await api.listTags()).find((t) => t.name === name);
      if (created) await handleAddTag(created.id);
    } catch (err) {
      console.error("Failed to create tag:", err);
    }
  };

  const availableTags = allTags.filter(
    (t) => !docTags.some((dt) => dt.id === t.id),
  );

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-6 py-1.5 border-b border-ink-100 dark:border-ink-800">
      {/* Active tags */}
      {docTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-ink-200 dark:bg-ink-700 text-ink-700 dark:text-ink-200"
        >
          #{tag.name}
          <button
            onClick={() => handleRemoveTag(tag.id)}
            className="text-ink-400 hover:text-red-500"
          >
            ✕
          </button>
        </span>
      ))}

      {/* Add tag dropdown */}
      {showTagInput ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateTag();
              if (e.key === "Escape") { setShowTagInput(false); setNewTag(""); }
            }}
            placeholder="New tag name…"
            autoFocus
            className="w-28 px-2 py-0.5 text-xs rounded bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 focus:outline-none"
          />
          <button
            onClick={handleCreateTag}
            className="text-xs text-ink-500 hover:text-ink-700"
          >
            ✓
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowTagInput(true)}
          className="text-xs text-ink-400 hover:text-ink-600 dark:hover:text-ink-300"
        >
          + tag
        </button>
      )}

      {/* Available tags to add */}
      {showTagInput && availableTags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {availableTags.slice(0, 5).map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleAddTag(tag.id)}
              className="px-1.5 py-0.5 text-xs rounded-full text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800"
            >
              #{tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
