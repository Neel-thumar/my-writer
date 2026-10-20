# Personal Writing Workspace — Full Plan

This is the original design plan for the Personal Writing Workspace project.

## 1. What the program does

**Library:** You see all your documents in one place, organized in folders.
**Editor:** You open any document and write in a clean, distraction-free editor.
**Checks:** Grammar and sentence suggestions appear softly under your text. You accept or ignore each one.
**Save:** Everything saves automatically. Each document is stored safely in the app, and you can export any document to .docx at any time.

## 2. Tech choices

| Part | Tool | Why |
|------|------|-----|
| Screen (frontend) | React + TipTap + Tailwind | Clean editor, easy styling |
| Backend | FastAPI (Python) | Simple, fast, good for grammar and file work |
| Database | SQLite | One file, no server to run |
| Grammar | LanguageTool (Docker) | Mature and free |
| Export/import | python-docx | Reads and writes .docx |
| Local AI (Phase 3) | Ollama | Free, private rewriting |
| Desktop app (Phase 3) | Tauri | Light, wraps the web app |

## 3. Architecture

```
┌──────────────────────────────────────────────────────┐
│  Screen (React + TipTap)                               │
│  ┌──────────────┐  ┌────────────────────────────┐      │
│  │  Library     │  │  Editor                    │      │
│  │  - folders   │  │  - text, suggestions       │      │
│  │  - search    │  │  - word count, focus mode  │      │
│  │  - tags      │  │                            │      │
│  └──────────────┘  └────────────────────────────┘      │
└───────────────────────┬────────────────────────────────┘
                        │ (debounced save, check requests)
┌───────────────────────▼────────────────────────────────┐
│  Backend (FastAPI)                                     │
│  - Document service  (create, open, save, delete)      │
│  - Library service   (folders, tags, search)           │
│  - Check service     (sends text to grammar)           │
│  - Export service    (writes .docx)                    │
│  - Version service   (keeps history snapshots)         │
└───┬─────────────────┬──────────────────┬───────────────┘
    │                 │                  │
┌───▼────────┐  ┌─────▼────────┐  ┌──────▼─────────┐
│ SQLite     │  │ LanguageTool │  │ Export folder  │
│ documents, │  │ (grammar)    │  │ .docx files    │
│ folders,   │  │              │  │                │
│ versions   │  │              │  │                │
└────────────┘  └──────────────┘  └────────────────┘
```

### Key design ideas

- **SQLite is the main storage.** Every document lives in the database, so search, folders, and history are fast. .docx is an export you control.
- **Editor content is saved as structured data** (TipTap JSON), not plain text. This keeps bold, headings, and lists exactly as you wrote them.
- **Checks are separate from the editor.** The editor shows suggestions, but the grammar engine is a replaceable module.
- **Nothing changes your text without you.** Every fix is a suggestion you accept.

## 4. Data model

```
Folder     : id, name, parent_id, created_at, deleted_at
Document   : id, title, folder_id, content (JSON), word_count,
             created_at, updated_at, deleted_at
Tag        : id, name
DocTag     : document_id, tag_id
Version    : id, document_id, content (JSON), saved_at
Setting    : key, value  (theme, font, focus mode, check language)
```

## 5. Library features (managing many documents)

- Create documents, and create folders inside folders.
- Rename, move, duplicate, and delete. Deleted items go to a Trash first, so nothing is lost by accident. Trash is emptied after 30 days.
- Search across all titles and contents, with filters for folder and tag.
- Tags like "essay", "email", "story", or "work".
- Sort by last edited, title, or word count.
- Recent list on the home screen for quick return.
- Export one document, a folder, or everything as .docx.
- Import existing .docx files into the library.

## 6. Editor and clean environment

- **Typography:** Georgia or Source Serif for text, Inter for menus. Line height about 1.7, line width about 65 characters.
- **Minimal layout:** A quiet left sidebar for the library, and a centered page for writing.
- **Focus mode** hides everything except the page. Toggle with Ctrl+Shift+F.
- **Dark mode and light mode**, both easy on the eyes.
- **Soft suggestions:** Thin, colored underlines. Details appear on hover or click.
- **Shortcuts:** Ctrl+Enter accept suggestion, Alt+↓ next suggestion, Ctrl+K quick search and switch documents.

## 7. Checking and smart features

- Checks run on the current paragraph only, after you pause typing for about half a second. This keeps typing smooth.
- Checks run in a background worker, so the screen never freezes.
- Categories: spelling, grammar, punctuation, and style. You can turn each one on or off.
- Personal dictionary: words you accept as correct are never flagged again.
- **Later (Phase 3):** sentence rewrite with a local model, tone options (simple, formal, friendly), and a diff view showing exactly what changed.

## 8. Folder blueprint

```
my-writer/
├── frontend/
│   └── src/
│       ├── library/        # sidebar, folders, search, trash
│       ├── editor/         # TipTap setup, extensions
│       ├── suggestions/    # underlines, popup, shortcuts
│       ├── theme/          # colors, fonts, dark mode
│       └── App.tsx
├── backend/
│   ├── app/
│   │   ├── api/            # routes: documents, folders, check, export
│   │   ├── services/       # document, library, version logic
│   │   ├── checkers/       # grammar adapters (LanguageTool, later others)
│   │   ├── export/         # .docx writer and reader
│   │   └── storage/        # SQLite models and migrations
│   └── tests/
├── docker-compose.yml      # LanguageTool + backend
└── README.md
```

## 9. Build phases

### Phase 1: Core (about 4 to 5 weeks)

- Database and backend for documents and folders.
- Library screen: create, rename, delete, folders, trash.
- Editor with autosave and version snapshots.
- Grammar checks with LanguageTool, and accept/ignore.
- Export to .docx, and import from .docx.

### Phase 2: Productivity (about 3 weeks)

- Search, tags, sorting, and recent list.
- Focus mode, dark mode, shortcuts, word count.
- Personal dictionary and check categories.
- Version history view with restore.

### Phase 3: Smart and desktop (ongoing)

- Sentence rewriting with Ollama, with diff view.
- Tone and style suggestions.
- Wrap as a desktop app with Tauri.
- Optional: sync or backup to a folder you choose.

## 10. Risks and how to handle them

- **Grammar tools make mistakes.** You always decide. Nothing changes automatically.
- **Data loss.** Autosave, version snapshots, and Trash protect your work. Add a backup export early.
- **Complex .docx formatting.** Start with headings, bold, italics, and lists. Add more later.
- **Slow AI rewrites.** Use small local models, and run them only when you ask.
- **Privacy.** Everything stays on your computer by default. Cloud features would be opt-in.
