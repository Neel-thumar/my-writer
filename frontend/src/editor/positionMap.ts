/**
 * Utility for mapping plain-text offsets (e.g. from LanguageTool / AI)
 * to ProseMirror document positions, and safely applying single or batch
 * text replacements.
 */

import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import type { Suggestion } from "../types";

export interface DocTextMapping {
  text: string;
  charToPos: number[]; // charToPos[charIndex] = docPos
}

/**
 * Extract plain text and build a character-to-ProseMirror-position map.
 * Block boundaries insert a newline character '\n'.
 */
export function extractDocumentText(doc: PMNode): DocTextMapping {
  let text = "";
  const charToPos: number[] = [];

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        charToPos.push(pos + i);
      }
      text += node.text;
    } else if (node.isBlock && text.length > 0 && !text.endsWith("\n")) {
      charToPos.push(pos);
      text += "\n";
    }
  });

  return { text, charToPos };
}

/**
 * Resolve a suggestion to exact ProseMirror (from, to) positions.
 * Uses 2-tier matching:
 *  1. Exact position via mapping
 *  2. Search near the offset in current document text
 */
export function resolveSuggestionRange(
  doc: PMNode,
  suggestion: Suggestion,
  mapping?: DocTextMapping | null,
): { from: number; to: number } | null {
  const target = suggestion.error_text || (suggestion.length > 0 && mapping?.text
    ? mapping.text.substring(suggestion.offset, suggestion.offset + suggestion.length)
    : "");

  // 1. Try resolving using mapping
  if (mapping && suggestion.offset >= 0 && suggestion.offset <= mapping.charToPos.length) {
    const from = mapping.charToPos[suggestion.offset];
    let to = from;
    if (suggestion.length > 0) {
      const lastCharIdx = suggestion.offset + suggestion.length - 1;
      to = lastCharIdx < mapping.charToPos.length
        ? mapping.charToPos[lastCharIdx] + 1
        : from + suggestion.length;
    }

    if (from >= 0 && to <= doc.content.size && from <= to) {
      if (!target || doc.textBetween(from, to) === target) {
        return { from, to };
      }
    }
  }

  // If no target text is known, cannot safely search
  if (!target) return null;

  // 2. Re-extract current document text and find closest match to expected offset
  const current = extractDocumentText(doc);
  let bestCharIdx = -1;
  let bestDistance = Infinity;

  let searchFrom = 0;
  while (true) {
    const idx = current.text.indexOf(target, searchFrom);
    if (idx === -1) break;
    const distance = Math.abs(idx - suggestion.offset);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestCharIdx = idx;
    }
    searchFrom = idx + 1;
  }

  if (bestCharIdx !== -1 && bestCharIdx < current.charToPos.length) {
    const from = current.charToPos[bestCharIdx];
    const lastCharIdx = bestCharIdx + target.length - 1;
    const to = lastCharIdx < current.charToPos.length
      ? current.charToPos[lastCharIdx] + 1
      : from + target.length;
    if (doc.textBetween(from, to) === target) {
      return { from, to };
    }
  }

  // Not found near where it was reported — better to do nothing than to
  // replace some unrelated occurrence elsewhere in the document.
  return null;
}

/**
 * Apply a single suggestion replacement to the editor view.
 */
export function applySuggestionReplacement(
  view: EditorView,
  suggestion: Suggestion,
  replacement: string,
  mapping?: DocTextMapping | null,
): boolean {
  const range = resolveSuggestionRange(view.state.doc, suggestion, mapping);
  if (!range) return false;

  const tr = view.state.tr;
  tr.insertText(replacement, range.from, range.to);
  if (tr.docChanged) {
    view.dispatch(tr);
    return true;
  }
  return false;
}

/**
 * Apply multiple suggestions in one atomic transaction, sorted by offset descending
 * to avoid position shifting.
 */
export function applyBatchSuggestions(
  view: EditorView,
  suggestionsWithReplacements: Array<{ suggestion: Suggestion; replacement: string }>,
  mapping?: DocTextMapping | null,
): number {
  if (suggestionsWithReplacements.length === 0) return 0;

  // Sort descending by offset so earlier positions remain valid
  const sorted = [...suggestionsWithReplacements].sort(
    (a, b) => b.suggestion.offset - a.suggestion.offset,
  );

  let appliedCount = 0;
  const tr = view.state.tr;

  for (const item of sorted) {
    const range = resolveSuggestionRange(tr.doc, item.suggestion, mapping);
    if (range) {
      tr.insertText(item.replacement, range.from, range.to);
      appliedCount++;
    }
  }

  if (appliedCount > 0 && tr.docChanged) {
    view.dispatch(tr);
  }

  return appliedCount;
}
