import type { Editor } from "@tiptap/react";

interface ToolbarProps {
  editor: Editor | null;
  onAiCorrect?: () => void;
  autoCorrectMode?: boolean;
  onToggleAutoCorrect?: () => void;
}

/**
 * Minimal editor toolbar — bold, italic, headings, lists, undo/redo,
 * plus Quick AI Correct and Auto-correct toggle.
 */
export function EditorToolbar({
  editor,
  onAiCorrect,
  autoCorrectMode,
  onToggleAutoCorrect,
}: ToolbarProps) {
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
      className={`px-2 py-1 rounded text-sm transition-colors cursor-pointer ${
        isActive
          ? "bg-ink-200 dark:bg-ink-700 text-ink-800 dark:text-ink-100 font-semibold"
          : "text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-ink-100 dark:border-ink-800 flex-wrap">
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

      {/* AI Correct & Auto-correct buttons on the right side */}
      <div className="ml-auto flex items-center gap-2">
        {onToggleAutoCorrect && (
          <button
            type="button"
            onClick={onToggleAutoCorrect}
            title={
              autoCorrectMode
                ? "Auto-correct is ON: obvious typos are fixed automatically. Click to turn OFF."
                : "Auto-correct is OFF: click to turn ON to automatically fix obvious typos as you pause."
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full font-medium transition-all cursor-pointer ${
              autoCorrectMode
                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-xs"
                : "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 border border-transparent hover:border-ink-300"
            }`}
          >
            <span className={autoCorrectMode ? "animate-pulse" : ""}>⚡</span>
            <span>Auto-correct {autoCorrectMode ? "ON" : "OFF"}</span>
          </button>
        )}

        {onAiCorrect && (
          <button
            type="button"
            onClick={onAiCorrect}
            title="Bulk AI Correction: select text or paragraph to get 2-3 corrected versions (Ctrl+Shift+C)"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-accent-100 hover:bg-accent-200 dark:bg-accent-950/50 dark:hover:bg-accent-900/60 text-accent-800 dark:text-accent-200 font-medium transition-colors cursor-pointer"
          >
            <span>✨</span>
            <span>AI Correct</span>
          </button>
        )}
      </div>
    </div>
  );
}
