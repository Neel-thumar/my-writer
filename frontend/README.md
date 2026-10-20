# Frontend — Personal Writing Workspace

React + TipTap + Tailwind frontend for the writing workspace.

## What's here

```
frontend/
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Main workspace: layout, editor, sidebar
│   ├── index.css                 # Global styles, Tailwind directives
│   ├── api/
│   │   └── client.ts             # Typed fetch wrapper for backend API
│   ├── editor/
│   │   ├── useWritingEditor.ts   # TipTap editor hook (StarterKit)
│   │   └── EditorToolbar.tsx     # Formatting toolbar (bold, italic, headings, lists)
│   ├── hooks/
│   │   ├── useDebouncedCallback.ts # Debounce for autosave
│   │   └── useKeyboardShortcut.ts # Global keyboard shortcut handler
│   ├── library/
│   │   └── LibrarySidebar.tsx     # Folder tree, document list, trash, search
│   ├── suggestions/
│   │   ├── SuggestionsProvider.tsx # Grammar check context + debounced checking
│   │   └── SuggestionPopup.tsx     # Popup for accept/ignore suggestions
│   ├── theme/
│   │   └── ThemeProvider.tsx     # Dark/light theme with localStorage
│   └── types/
│       └── index.ts             # TypeScript type definitions
├── index.html
├── Dockerfile                   # nginx serving built static files
├── package.json
├── vite.config.ts               # Vite + React + API proxy
├── tailwind.config.js           # Custom "ink" color palette
├── tsconfig.json
└── postcss.config.js
```

## Running

```bash
npm install
npm run dev
```

Open http://localhost:5173 — the dev server proxies `/api` requests to the backend on port 8000.

## Build for production

```bash
npm run build    # TypeScript compile + Vite build → dist/
npm run preview  # Preview the production build
```

## Key features (Phase 1)

- TipTap editor with headings, bold, italic, lists, code
- Debounced autosave (1.5s) with "Saving… / Saved ✓" indicator
- Focus mode (Ctrl+Shift+F) — hides sidebar and toolbar
- Dark/light theme toggle with localStorage persistence
- Keyboard shortcuts: Ctrl+K (search), Ctrl+Enter (accept suggestion), Alt+↓ (next suggestion)
- .docx export and import
- Grammar suggestions panel with color-coded categories (spelling, grammar, punctuation, style)

## Latest updates

- Phase 1 complete: editor, library sidebar, suggestions, theme, autosave, export/import all working
- Phase 2 in progress: tags UI, sort dropdown, version history view, personal dictionary, check category toggles needed
