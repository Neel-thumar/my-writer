import type { Editor } from "@tiptap/react";

interface ToolbarProps {
  editor: Editor | null;
}

/**
 * Minimal editor toolbar — bold, italic, headings, lists, etc.
 * Stays quiet and unobtrusive.
 */
export function EditorToolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  const btn = (
    label: string,
    action: () => void,
    isActive = false,
    title: string,
  ) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        action();
      }}
      className={`px-2 py-1 rounded text-sm transition-colors ${
        isActive
          ? "bg-ink-200 dark:bg-ink-700 text-ink-800 dark:text-ink-100"
          : "text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-ink-100 dark:border-ink-800">
      {btn("B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), "Bold (Ctrl+B)")}
      {btn("I", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), "Italic (Ctrl+I)")}
      <div className="w-px h-5 bg-ink-200 dark:bg-ink-700 mx-1" />
      {btn("H1", () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 }), "Heading 1")}
      {btn("H2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }), "Heading 2")}
      {btn("H3", () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }), "Heading 3")}
      <div className="w-px h-5 bg-ink-200 dark:bg-ink-700 mx-1" />
      {btn("•", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"), "Bullet list")}
      {btn("1.", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"), "Numbered list")}
      {btn("❝", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"), "Quote")}
      {btn("</>", () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive("codeBlock"), "Code block")}
      <div className="w-px h-5 bg-ink-200 dark:bg-ink-700 mx-1" />
      {btn("↶", () => editor.chain().focus().undo().run(), false, "Undo (Ctrl+Z)")}
      {btn("↷", () => editor.chain().focus().redo().run(), false, "Redo (Ctrl+Y)")}
    </div>
  );
}
