/**
 * Inline tracked changes for Fix and Rewrite.
 *
 * A proposal is applied to the document immediately, word by word, and each
 * changed spot is remembered as a pending change: the new text is highlighted
 * and the removed text is shown struck through beside it. The user accepts
 * (keeps) or rejects (restores the exact original slice, formatting included)
 * each one, or all at once with Tab / Esc.
 */

import { Extension } from "@tiptap/core";
import type { Slice } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { diffHunks } from "./diff";

export interface PendingChange {
  id: string;
  /** Range of the new text in the current document (empty for a pure deletion) */
  from: number;
  to: number;
  /** What was there before — shown struck through, restored on reject */
  oldText: string;
  oldSlice: Slice;
}

interface ChangesState {
  changes: PendingChange[];
  decorations: DecorationSet;
}

type Meta = { add: PendingChange[] } | { remove: string[] } | { clear: true };

export const inlineChangesKey = new PluginKey<ChangesState>("inlineChanges");

// prosemirror-history marks undo/redo transactions with this meta key
const HISTORY_META = "history$";

let nextId = 1;

function buildDecorations(state: EditorState, changes: PendingChange[]): DecorationSet {
  const decos: Decoration[] = [];
  for (const c of changes) {
    if (c.oldText) {
      decos.push(
        Decoration.widget(
          c.from,
          () => {
            const el = document.createElement("span");
            el.className = "change-delete";
            el.textContent = c.oldText.replace(/\n/g, " ¶ ");
            el.setAttribute("data-change-id", c.id);
            el.contentEditable = "false";
            return el;
          },
          { side: -1, key: `del-${c.id}`, ignoreSelection: true },
        ),
      );
    }
    if (c.to > c.from) {
      decos.push(Decoration.inline(c.from, c.to, { class: "change-insert", "data-change-id": c.id }));
    }
  }
  return DecorationSet.create(state.doc, decos);
}

export interface InlineChangesOptions {
  onClick: (id: string, rect: DOMRect) => void;
}

export const InlineChanges = Extension.create<InlineChangesOptions>({
  name: "inlineChanges",

  addOptions() {
    return { onClick: () => {} };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin<ChangesState>({
        key: inlineChangesKey,
        state: {
          init: () => ({ changes: [], decorations: DecorationSet.empty }),
          apply(tr, prev, _old, newState) {
            const meta = tr.getMeta(inlineChangesKey) as Meta | undefined;
            // Undo/redo makes the recorded positions meaningless — drop them
            if (tr.getMeta(HISTORY_META) || (meta && "clear" in meta)) {
              return prev.changes.length ? { changes: [], decorations: DecorationSet.empty } : prev;
            }
            if (!tr.docChanged && !meta) return prev;

            let changes = prev.changes;
            if (tr.docChanged) {
              changes = changes.flatMap((c) => {
                const start = tr.mapping.mapResult(c.from, 1);
                const end = tr.mapping.mapResult(c.to, -1);
                // The user deleted the changed text entirely: nothing left to review
                if (start.deleted && end.deleted && c.to > c.from) return [];
                return [{ ...c, from: start.pos, to: Math.max(start.pos, end.pos) }];
              });
            }
            if (meta && "remove" in meta) {
              const gone = new Set(meta.remove);
              changes = changes.filter((c) => !gone.has(c.id));
            }
            if (meta && "add" in meta) changes = [...changes, ...meta.add];
            return { changes, decorations: buildDecorations(newState, changes) };
          },
        },
        props: {
          decorations(state) {
            return inlineChangesKey.getState(state)?.decorations;
          },
          handleClick(_view, _pos, event) {
            const el = (event.target as HTMLElement | null)?.closest?.("[data-change-id]");
            if (el) options.onClick(el.getAttribute("data-change-id")!, el.getBoundingClientRect());
            return false;
          },
          handleKeyDown(view, event) {
            if (!getChanges(view.state).length || event.ctrlKey || event.metaKey || event.altKey) return false;
            if (event.key === "Tab" && !event.shiftKey) {
              acceptAllChanges(view);
              return true;
            }
            if (event.key === "Escape") {
              rejectAllChanges(view);
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});

export function getChanges(state: EditorState): PendingChange[] {
  return inlineChangesKey.getState(state)?.changes ?? [];
}

interface TextBlockRange {
  start: number;
  end: number;
  text: string;
}

/**
 * Plain text of a range, one line per paragraph, with exactly one character per
 * document position inside each paragraph (hard breaks read as a space). The
 * same function produces the text sent to the server and reads it back.
 */
export function textForRange(state: EditorState, from: number, to: number): { text: string; blocks: TextBlockRange[] } {
  const blocks: TextBlockRange[] = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    const start = Math.max(from, pos + 1);
    const end = Math.min(to, pos + node.nodeSize - 1);
    if (start <= end) blocks.push({ start, end, text: state.doc.textBetween(start, end, undefined, " ") });
    return false;
  });
  return { text: blocks.map((b) => b.text).join("\n"), blocks };
}

/**
 * Apply `newText` over [from, to] as reviewable changes.
 * Returns how many changes were made (0 if nothing differs).
 */
export function proposeReplacement(view: EditorView, from: number, to: number, newText: string): number {
  const { state } = view;
  const { blocks } = textForRange(state, from, to);
  if (blocks.length === 0) return 0;
  const lines = newText.split("\n");
  // Inserted text takes its formatting from the text it replaces, never from
  // pending "next character" marks (e.g. a toggled bold or code)
  const tr = state.tr.setStoredMarks(null);
  const added: PendingChange[] = [];

  if (lines.length === blocks.length) {
    // Same paragraph structure: word-level changes within each paragraph
    blocks.forEach((block, i) => {
      for (const h of diffHunks(block.text, lines[i])) {
        const origFrom = block.start + h.start;
        const origTo = block.start + h.end;
        const f = tr.mapping.map(origFrom);
        const t = origTo === origFrom ? f : tr.mapping.map(origTo, -1);
        if (h.insert) tr.insertText(h.insert, f, t);
        else tr.delete(f, t);
        added.push({
          id: `chg-${nextId++}`,
          from: f,
          to: f + h.insert.length,
          oldText: block.text.slice(h.start, h.end),
          oldSlice: state.doc.slice(origFrom, origTo),
        });
      }
    });
  } else {
    // Paragraphs were merged or split: one change covering the whole range
    const start = blocks[0].start;
    const end = blocks[blocks.length - 1].end;
    const { schema } = state;
    const paragraphs = lines.map((l) => schema.nodes.paragraph.create(null, l ? schema.text(l) : null));
    tr.replaceWith(start, end, paragraphs);
    added.push({
      id: `chg-${nextId++}`,
      from: tr.mapping.map(start, -1),
      to: tr.mapping.map(end, 1),
      oldText: blocks.map((b) => b.text).join("\n"),
      oldSlice: state.doc.slice(start, end),
    });
  }

  if (!tr.docChanged) return 0;
  view.dispatch(tr.setMeta(inlineChangesKey, { add: added }));
  return added.length;
}

export function acceptChange(view: EditorView, id: string) {
  view.dispatch(view.state.tr.setMeta(inlineChangesKey, { remove: [id] }));
}

export function rejectChange(view: EditorView, id: string) {
  const change = getChanges(view.state).find((c) => c.id === id);
  if (!change) return;
  const tr = view.state.tr.replace(change.from, change.to, change.oldSlice);
  view.dispatch(tr.setMeta(inlineChangesKey, { remove: [id] }));
}

export function acceptAllChanges(view: EditorView) {
  view.dispatch(view.state.tr.setMeta(inlineChangesKey, { clear: true }));
}

export function rejectAllChanges(view: EditorView) {
  const changes = [...getChanges(view.state)].sort((a, b) => b.from - a.from);
  if (!changes.length) return;
  // Back to front, so earlier positions stay valid
  const tr = view.state.tr;
  for (const c of changes) tr.replace(c.from, c.to, c.oldSlice);
  view.dispatch(tr.setMeta(inlineChangesKey, { clear: true }));
}
