import { useRef } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { SuggestionHighlights } from "./suggestionHighlights";

/**
 * Creates a configured TipTap editor instance with StarterKit and
 * in-text suggestion underlines.
 */
export function useWritingEditor(
  content: Record<string, unknown> | null,
  onUpdate: () => void,
  onSuggestionClick: (id: string, rect: DOMRect) => void,
): Editor | null {
  // The editor is created once, so route callbacks through refs to keep them fresh
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const onSuggestionClickRef = useRef(onSuggestionClick);
  onSuggestionClickRef.current = onSuggestionClick;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      SuggestionHighlights.configure({
        onClick: (id, rect) => onSuggestionClickRef.current(id, rect),
      }),
    ],
    content: content ?? undefined,
    editorProps: {
      attributes: {
        class: "prose prose-lg max-w-prose mx-auto focus:outline-none",
        spellcheck: "false",
      },
    },
    onUpdate: () => {
      onUpdateRef.current();
    },
  });

  return editor;
}
