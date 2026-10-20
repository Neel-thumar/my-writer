# Changelog

All notable changes to the Personal Writing Workspace project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased] — Phase 2 in progress

### Added — Phase 2

#### Backend
- Full-text search: documents API now searches content (ILIKE) in addition to titles
- Personal dictionary: `DictionaryWord` model, `/api/dictionary` CRUD routes
- Dictionary integration: grammar checker filters spelling suggestions for dictionary words
- Migration v2: creates `dictionary_words` table
- Dictionary schemas added to Pydantic

#### Frontend
- Version history modal: `VersionHistoryModal.tsx` — list snapshots, restore any version
- Tags panel: `TagsPanel.tsx` — create, assign, remove tags per document
- Sort dropdown: sort documents by last edited, title (A–Z), or word count
- Recent documents: `RecentDocuments.tsx` — home screen shows top 8 recently edited docs
- Settings modal: `SettingsModal.tsx` — check category toggles + personal dictionary UI
- Check categories: enabled categories passed to grammar check API
- API client: dictionary methods (list, add, delete words)
- Types: `DictionaryWord` type added

### Infrastructure
- Docker Engine 29.9.1 installed on the system
- Docker Compose v5.6.0 installed
- Ollama v0.40.6 installed and running on localhost:11434
- GitHub CLI (gh v2.46.0) installed
- Git repository initialized with main branch

---

## [0.1.0] — 2026-10-20 — Phase 1 Complete

### Backend

#### Added
- FastAPI application factory with CORS middleware (`app/main.py`)
- SQLAlchemy data models: Folder, Document, Tag, DocTag, Version, Setting (`app/storage/models.py`)
- SQLite database with connection pooling (`app/storage/database.py`)
- Schema migration system (`app/storage/migrations.py`)
- Document API: create, read, update, soft-delete, restore, duplicate (`app/api/routes_documents.py`)
- Folder API: create, rename, move, soft-delete, restore (`app/api/routes_folders.py`)
- Tag API: create, list, assign tags to documents (`app/api/routes_tags.py`)
- Grammar check API with LanguageTool adapter (`app/api/routes_check.py`, `app/checkers/languagetool.py`)
- .docx export using python-docx (`app/export/docx_service.py`, `app/api/routes_export.py`)
- .docx import — extracts headings, bold, italic, lists into TipTap JSON
- Settings API: key-value store for theme, font, language preferences (`app/api/routes_settings.py`)
- Version history: automatic snapshots on content save, restore any version (`app/api/routes_documents.py`)
- Pydantic v2 schemas for request/response validation (`app/api/schemas.py`)
- Word count auto-calculated via SQLAlchemy event listener on content set
- Plain text extraction from TipTap JSON for grammar checks and word counting
- Pytest test suite (`tests/`)

#### Design decisions
- Content stored as TipTap JSON string (not plain text) to preserve formatting
- Soft-delete pattern: `deleted_at` timestamp instead of row deletion
- Trash: deleted items recoverable via restore endpoint
- Version snapshots taken automatically before each content overwrite
- Grammar engine is a replaceable adapter module (LanguageTool now, Ollama later)

### Frontend

#### Added
- React 18 + TipTap + Tailwind CSS application
- TipTap editor with StarterKit (headings, bold, italic, lists, code) (`editor/useWritingEditor.ts`)
- Editor toolbar with formatting buttons (`editor/EditorToolbar.tsx`)
- Library sidebar: folder tree, document list, trash view, search (`library/LibrarySidebar.tsx`)
- Debounced autosave (1.5s delay) with save status indicator (`hooks/useDebouncedCallback.ts`)
- Grammar suggestions provider with debounced checking (600ms) (`suggestions/SuggestionsProvider.tsx`)
- Suggestion popup with accept/ignore (`suggestions/SuggestionPopup.tsx`)
- Suggestions panel at bottom of editor showing all suggestions by category
- Dark/light theme provider with localStorage persistence (`theme/ThemeProvider.tsx`)
- Keyboard shortcuts: Ctrl+Shift+F (focus), Ctrl+K (search), Ctrl+Enter (accept), Alt+↓ (next) (`hooks/useKeyboardShortcut.ts`)
- Focus mode: hides sidebar and toolbar for distraction-free writing
- Word count display in status bar
- .docx export and import UI
- API client with typed fetch wrapper (`api/client.ts`)
- TypeScript types for all entities (`types/index.ts`)
- Vite dev server with API proxy to backend on port 8000

### Infrastructure

#### Added
- `docker-compose.yml`: LanguageTool, backend, frontend services
- Backend Dockerfile (Python 3.11-slim, uvicorn)
- Frontend Dockerfile (nginx serving built static files)
- Vite configuration with React plugin and API proxy
- Tailwind CSS configuration with custom "ink" color palette
- PostCSS configuration

### Documentation

#### Added
- `README.md` with project overview, architecture diagram, quick start, API reference, keyboard shortcuts, tech stack, and roadmap
