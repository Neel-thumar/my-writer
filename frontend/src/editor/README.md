# Editor

TipTap editor setup and toolbar.

## Files

| File | Purpose |
|------|---------|
| `useWritingEditor.ts` | Hook that creates and configures the TipTap editor (StarterKit) |
| `EditorToolbar.tsx` | Formatting buttons: bold, italic, headings (H1-H3), bullet list, ordered list, code block |

## Features (Phase 1)

- TipTap with StarterKit extension (headings, bold, italic, lists, code, blockquote)
- Editable mode toggled when a document is selected
- onUpdate callback triggers debounced autosave
- Content loaded from document's TipTap JSON
- Toolbar shows active formatting state (buttons highlight when format is active)

## Phase 2 additions needed

- Character count extension for accurate word count
- Typography extension (smart quotes, dashes)
- Potential: custom decoration for suggestion underlines

## Latest updates

- Phase 1: editor and toolbar complete
- Phase 2: character count extension and typography improvements planned
