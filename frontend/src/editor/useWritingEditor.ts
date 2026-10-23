import { useRef } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import Code from "@tiptap/extension-code";
import StarterKit from "@tiptap/starter-kit";
import { InlineChanges } from "./inlineChanges";
import { SuggestionHighlights } from "./suggestionHighlights";

/**
 * Creates a configured TipTap editor instance with StarterKit, in-text
 * suggestion underlines, and inline tracked changes for Fix / Rewrite.
 */
export function useWritingEditor(
  content: Record<string, unknown> | null,
  onUpdate: () => void,
  onSuggestionClick: (id: string, rect: DOMRect) => void,
  onChangeClick: (id: string, rect: DOMRect) => void,
): Editor | null {
  // The editor is created once, so route callbacks through refs to keep them fresh
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const onSuggestionClickRef = useRef(onSuggestionClick);
  onSuggestionClickRef.current = onSuggestionClick;
  const onChangeClickRef = useRef(onChangeClick);
  onChangeClickRef.current = onChangeClick;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: false,
      }),
      // Inline code without its Ctrl+E shortcut — Ctrl+E is Fix in this app
      Code.extend({ addKeyboardShortcuts: () => ({}) }),
      SuggestionHighlights.configure({
        onClick: (id, rect) => onSuggestionClickRef.current(id, rect),
      }),
      InlineChanges.configure({
        onClick: (id, rect) => onChangeClickRef.current(id, rect),
      }),
    ],
    content: content ?? undefined,
    editorProps: {
      attributes: {
        class: "prose prose-lg max-w-none focus:outline-none",
        spellcheck: "false",
      },
    },
    onUpdate: () => {
      onUpdateRef.current();
    },
  });

  return editor;
}
