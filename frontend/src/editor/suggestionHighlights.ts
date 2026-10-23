/**
 * Underlines suggestions directly in the editor text.
 *
 * Highlights are ProseMirror decorations, so they move with the text as the
 * user types — which also makes them the most reliable source of a
 * suggestion's current position when applying a fix.
 */

import { Extension } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

export interface HighlightRange {
  id: string;
  type: string;
  from: number;
  to: number;
}

export const suggestionHighlightKey = new PluginKey<DecorationSet>("suggestionHighlights");

export interface SuggestionHighlightOptions {
  onClick: (id: string, rect: DOMRect) => void;
}

export const SuggestionHighlights = Extension.create<SuggestionHighlightOptions>({
  name: "suggestionHighlights",

  addOptions() {
    return { onClick: () => {} };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin<DecorationSet>({
        key: suggestionHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            // A transaction carrying ranges replaces every highlight; otherwise they follow edits
            const ranges = tr.getMeta(suggestionHighlightKey) as HighlightRange[] | undefined;
            if (!ranges) return set.map(tr.mapping, tr.doc);
            const decorations = ranges
              .filter((r) => r.from < r.to && r.to <= tr.doc.content.size)
              .map((r) =>
                Decoration.inline(
                  r.from,
                  r.to,
                  { class: `suggestion-mark suggestion-${r.type}`, "data-suggestion-id": r.id },
                  { id: r.id },
                ),
              );
            return DecorationSet.create(tr.doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return suggestionHighlightKey.getState(state);
          },
          handleClick(_view, _pos, event) {
            const el = (event.target as HTMLElement | null)?.closest?.("[data-suggestion-id]");
            if (el) {
              options.onClick(el.getAttribute("data-suggestion-id")!, el.getBoundingClientRect());
            }
            // Let the click still place the cursor normally
            return false;
          },
        },
      }),
    ];
  },
});

/** Current (edit-tracked) range of a highlighted suggestion, if still present. */
export function findHighlightRange(state: EditorState, id: string): { from: number; to: number } | null {
  const set = suggestionHighlightKey.getState(state);
  const found = set?.find(undefined, undefined, (spec) => spec.id === id)[0];
  return found ? { from: found.from, to: found.to } : null;
}

/** Replace all suggestion underlines (doesn't touch the document or undo history). */
export function setHighlights(view: EditorView, ranges: HighlightRange[]) {
  view.dispatch(view.state.tr.setMeta(suggestionHighlightKey, ranges).setMeta("addToHistory", false));
}
