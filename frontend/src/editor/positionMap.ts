/**
 * Utility for mapping plain-text offsets (e.g. from LanguageTool / AI)
 * to ProseMirror document positions.
 */

import type { Node as PMNode } from "@tiptap/pm/model";
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
