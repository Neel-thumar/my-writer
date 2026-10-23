# Hooks

| File | Purpose |
|------|---------|
| `useDebouncedCallback.ts` | Debounce a function; returns `debounced()` and `flush()` — note `flush()` **cancels** the pending call |
| `useKeyboardShortcut.ts` | Global shortcuts like `"ctrl+shift+e"`; modifiers must match exactly (Cmd counts as Ctrl) |
| `useResizable.ts` | Drag-to-resize panel width, remembered in localStorage |
| `useHashRoute.ts` | Page routing via the URL hash, so Back/Forward and refresh work |
