import type { Editor } from "@tiptap/react";
import type { ReactNode } from "react";
import { RedoIcon, UndoIcon } from "../ui/icons";

/** Compact formatting toolbar. AI actions live in the header and selection bubble. */
export function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const btn = (label: ReactNode, action: () => void, isActive: boolean, title: string, extra = "") => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault(); // keep the editor's selection
        action();
      }}
      className={`h-7 min-w-7 px-1.5 grid place-items-center rounded-md text-sm transition-colors cursor-pointer ${extra} ${
        isActive
          ? "bg-ink-200 dark:bg-ink-700 text-ink-900 dark:text-ink-50"
          : "text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-800 dark:hover:text-ink-100"
      }`}
    >
      {label}
    </button>
  );
  const sep = <div className="w-px h-4 bg-ink-200 dark:bg-ink-700 mx-1" />;
  const chain = () => editor.chain().focus();

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {btn(<UndoIcon size={15} />, () => chain().undo().run(), false, "Undo (Ctrl+Z)")}
      {btn(<RedoIcon size={15} />, () => chain().redo().run(), false, "Redo (Ctrl+Shift+Z)")}
      {sep}
      {btn("H1", () => chain().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 }), "Heading 1", "text-xs font-semibold")}
      {btn("H2", () => chain().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }), "Heading 2", "text-xs font-semibold")}
      {btn("H3", () => chain().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }), "Heading 3", "text-xs font-semibold")}
      {sep}
      {btn("B", () => chain().toggleBold().run(), editor.isActive("bold"), "Bold (Ctrl+B)", "font-bold")}
      {btn("I", () => chain().toggleItalic().run(), editor.isActive("italic"), "Italic (Ctrl+I)", "italic font-serif")}
      {btn("S", () => chain().toggleStrike().run(), editor.isActive("strike"), "Strikethrough", "line-through")}
      {sep}
      {btn("•", () => chain().toggleBulletList().run(), editor.isActive("bulletList"), "Bullet list")}
      {btn("1.", () => chain().toggleOrderedList().run(), editor.isActive("orderedList"), "Numbered list", "text-xs")}
      {btn("❝", () => chain().toggleBlockquote().run(), editor.isActive("blockquote"), "Quote")}
    </div>
  );
}
