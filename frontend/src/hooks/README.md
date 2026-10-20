# Hooks

Custom React hooks for the workspace.

## Files

| File | Purpose |
|------|---------|
| `useDebouncedCallback.ts` | Debounce an async function; returns `debounced()` and `flush()` (for immediate execution) |
| `useKeyboardShortcut.ts` | Register global keyboard shortcuts with modifier key support (ctrl, shift, alt, meta) |

## Usage

### useDebouncedCallback

```ts
const { debounced, flush } = useDebouncedCallback(async () => {
  await api.updateDocument(doc.id, { content: editor.getJSON() });
}, 1500); // 1.5s debounce
```

### useKeyboardShortcut

```ts
useKeyboardShortcut("ctrl+shift+f", () => setFocusMode(v => !v));
useKeyboardShortcut("ctrl+k", () => searchInput.focus());
```

## Latest updates

- Phase 1: both hooks implemented and used throughout the app
