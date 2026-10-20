# Personal Writing Workspace

A self-hosted writing environment with a clean editor, grammar checks, document library, and .docx export. Everything runs on your machine.

## Features

- **Document Library** — organize writing in folders, search across all documents, soft-delete with trash
- **Clean Editor** — TipTap-based distraction-free editor with autosave, word count, and focus mode
- **Grammar Checks** — LanguageTool integration with soft underlines; accept or ignore each suggestion
- **Export & Import** — export any document to .docx; import existing .docx files into the library
- **Dark Mode** — easy on the eyes, toggle with one click
- **Version History** — automatic snapshots when you save, with restore
- **Keyboard Shortcuts** — Ctrl+Shift+F (focus mode), Ctrl+K (search), Ctrl+Enter (accept suggestion)

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Frontend (React + TipTap + Tailwind)                │
│  ┌──────────────┐  ┌────────────────────────────┐    │
│  │  Library     │  │  Editor                    │    │
│  │  - folders   │  │  - text, suggestions       │    │
│  │  - search    │  │  - word count, focus mode  │    │
│  │  - trash     │  │                            │    │
│  └──────────────┘  └────────────────────────────┘    │
└───────────────────────┬──────────────────────────────┘
                        │ REST API
┌───────────────────────▼──────────────────────────────┐
│  Backend (FastAPI + SQLite)                           │
│  - Document CRUD  - Folder management                 │
│  - Grammar check  - .docx export/import                │
│  - Version history - Tags - Settings                  │
└───┬───────────────────────────────────┬───────────────┘
    │                                   │
┌───▼────────┐                   ┌──────▼─────────┐
│ SQLite     │                   │ LanguageTool   │
│ (data file)│                   │ (Docker)       │
└────────────┘                   └────────────────┘
```

## Quick Start (Docker)

The easiest way to run everything:

```bash
docker compose up --build
```

Then open:
- **App**: http://localhost:5173
- **API docs**: http://localhost:8000/docs
- **LanguageTool**: http://localhost:8081

## Manual Setup (Development)

### Prerequisites

- Python 3.10+
- Node.js 20+
- Docker (for LanguageTool)

### 1. Start LanguageTool

```bash
docker run -p 8081:8081 erikvl87/languagetool:latest
```

### 2. Start the Backend

```bash
cd backend
pip install -r requirements.txt
python3 -m uvicorn run:app --reload --port 8000
```

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Project Structure

```
my-writer/
├── frontend/
│   ├── src/
│   │   ├── library/        # sidebar: folders, documents, trash, search
│   │   ├── editor/         # TipTap editor setup and toolbar
│   │   ├── suggestions/    # grammar suggestions provider and popup
│   │   ├── theme/          # dark/light mode provider
│   │   ├── hooks/          # useDebouncedCallback, useKeyboardShortcut
│   │   ├── api/            # API client
│   │   ├── types/          # TypeScript types
│   │   ├── App.tsx         # main app
│   │   └── main.tsx        # entry point
│   ├── Dockerfile
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── api/            # routes: documents, folders, check, export, tags, settings
│   │   ├── checkers/       # LanguageTool adapter
│   │   ├── export/         # .docx export/import service
│   │   ├── storage/        # SQLAlchemy models, database, migrations
│   │   └── main.py         # FastAPI app factory
│   ├── tests/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── run.py
├── docker-compose.yml
└── README.md
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/documents` | List documents (filter by folder, search, sort) |
| POST | `/api/documents` | Create a document |
| GET | `/api/documents/{id}` | Get a document |
| PUT | `/api/documents/{id}` | Update a document (title, content, folder) |
| DELETE | `/api/documents/{id}` | Soft-delete (move to trash) |
| POST | `/api/documents/{id}/restore` | Restore from trash |
| POST | `/api/documents/{id}/duplicate` | Duplicate a document |
| GET | `/api/documents/{id}/versions` | List version history |
| POST | `/api/documents/{id}/versions/{vid}/restore` | Restore a version |
| GET | `/api/folders` | List folders |
| POST | `/api/folders` | Create a folder |
| PUT | `/api/folders/{id}` | Rename/move a folder |
| DELETE | `/api/folders/{id}` | Soft-delete a folder |
| POST | `/api/folders/{id}/restore` | Restore from trash |
| GET | `/api/tags` | List tags |
| POST | `/api/tags` | Create a tag |
| PUT | `/api/tags/documents/{doc_id}` | Set tags for a document |
| POST | `/api/check` | Run grammar check |
| GET | `/api/export/{doc_id}` | Export document as .docx |
| POST | `/api/export/import` | Import .docx as new document |
| GET | `/api/settings` | List settings |
| PUT | `/api/settings` | Upsert a setting |
| GET | `/health` | Health check |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+F | Toggle focus mode |
| Ctrl+K | Focus search |
| Ctrl+Enter | Accept suggestion |
| Alt+↓ | Next suggestion |
| Esc | Dismiss suggestion popup |

## Tech Stack

| Part | Technology | Why |
|------|-----------|-----|
| Frontend | React + TipTap + Tailwind | Clean editor, easy styling |
| Backend | FastAPI (Python) | Simple, fast, good for grammar and file work |
| Database | SQLite | One file, no server to run |
| Grammar | LanguageTool (Docker) | Mature and free |
| Export | python-docx | Reads and writes .docx |

## Roadmap

**Phase 1 (current)**: Library, editor, grammar checks, autosave, .docx export/import

**Phase 2**: Search, tags, sorting, recent list, focus mode, dark mode, personal dictionary, version history view

**Phase 3**: Sentence rewriting with Ollama (local AI), tone/style suggestions, diff view, Tauri desktop app

## License

Personal use.
