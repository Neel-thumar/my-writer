# Editor

The writing screen and everything that edits text.

## Files

| File | Purpose |
|------|---------|
| `EditorScreen.tsx` | One document's screen (mounted per doc id): loading, autosave, grammar check, Fix/Rewrite, header, status bar |
| `useWritingEditor.ts` | Creates the TipTap editor: StarterKit, suggestion underlines, inline changes (Ctrl+E is Fix, so Code has no shortcut) |
| `EditorToolbar.tsx` | Compact formatting row (undo/redo, headings, B/I/S, lists, quote) |
| `inlineChanges.ts` | Tracked changes for Fix/Rewrite: apply a proposal word-by-word, accept/reject one or all (Tab / Esc) |
| `diff.ts` | Word-level diff → replace hunks used by `inlineChanges` |
| `ChangeReview.tsx` | Floating "N changes · Accept all · Reject all" bar and the per-change popover |
| `RewriteMenu.tsx` | Rewrite picker: tones and a free-form instruction |
| `suggestionHighlights.ts` | Wavy underlines for grammar suggestions; they follow edits and are clickable |
| `positionMap.ts` | Map plain-text offsets from the checker to editor positions |

## Layers of help

1. **While typing** (local): LanguageTool underlines issues; optional auto-correct of obvious typos.
2. **Fix** (Ctrl+E, local): selection or current paragraph → `POST /api/fix` → inline changes.
3. **Rewrite** (Ctrl+Shift+E, cloud, explicit only): `POST /api/rewrite` with the user's free provider → inline changes.
