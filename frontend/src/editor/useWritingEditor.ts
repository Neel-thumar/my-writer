import { useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

/**
 * Creates a configured TipTap editor instance with StarterKit.
 * Extensions can be added later for suggestions, collab, etc.
 */
export function useWritingEditor(
  content: Record<string, unknown> | null,
  onUpdate: () => void,
): Editor | null {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
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
      onUpdate();
    },
  });

  return editor;
}
