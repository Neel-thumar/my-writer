# Project Progress Tracker

> Last updated: 2026-10-20

## Overall Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Core | ✅ Complete | All features implemented and tested |
| Phase 2: Productivity | 🔄 In Progress | Started — see details below |
| Phase 3: Smart & Desktop | ⬜ Not started | Ollama installed and running, prep only |

---

## Phase 1: Core — ✅ Complete

### Backend (FastAPI + SQLite)

| Feature | Status | Files |
|---------|--------|-------|
| Database models (Folder, Document, Tag, DocTag, Version, Setting) | ✅ | `backend/app/storage/models.py` |
| Database connection & session management | ✅ | `backend/app/storage/database.py` |
| Schema migrations | ✅ | `backend/app/storage/migrations.py` |
| Document CRUD (create, read, update, delete, restore, duplicate) | ✅ | `backend/app/api/routes_documents.py` |
| Folder CRUD (create, rename, delete, restore) | ✅ | `backend/app/api/routes_folders.py` |
| Tag management (create, list, assign to docs) | ✅ | `backend/app/api/routes_tags.py` |
| Grammar check (LanguageTool adapter) | ✅ | `backend/app/checkers/languagetool.py`, `backend/app/api/routes_check.py` |
| .docx export (python-docx) | ✅ | `backend/app/export/docx_service.py`, `backend/app/api/routes_export.py` |
| .docx import | ✅ | `backend/app/export/docx_service.py` |
| Settings store (key-value) | ✅ | `backend/app/api/routes_settings.py` |
| Version snapshots (auto on save, restore) | ✅ | `backend/app/api/routes_documents.py` |
| Soft-delete with trash (documents & folders) | ✅ | `backend/app/api/routes_documents.py`, `routes_folders.py` |
| Word count (auto-calculated on content set) | ✅ | `backend/app/storage/models.py` |
| FastAPI app factory with CORS | ✅ | `backend/app/main.py` |
| Pydantic schemas for all endpoints | ✅ | `backend/app/api/schemas.py` |

### Frontend (React + TipTap + Tailwind)

| Feature | Status | Files |
|---------|--------|-------|
| TipTap editor with StarterKit | ✅ | `frontend/src/editor/useWritingEditor.ts` |
| Editor toolbar (bold, italic, headings, lists) | ✅ | `frontend/src/editor/EditorToolbar.tsx` |
| Library sidebar (folders, documents, trash) | ✅ | `frontend/src/library/LibrarySidebar.tsx` |
| Document list with sort & search | ✅ | `frontend/src/library/LibrarySidebar.tsx` |
| Debounced autosave (1.5s delay) | ✅ | `frontend/src/hooks/useDebouncedCallback.ts`, `App.tsx` |
| Grammar suggestions provider | ✅ | `frontend/src/suggestions/SuggestionsProvider.tsx` |
| Suggestion popup | ✅ | `frontend/src/suggestions/SuggestionPopup.tsx` |
| Suggestions panel (bottom of editor) | ✅ | `frontend/src/App.tsx` |
| Dark/light theme toggle | ✅ | `frontend/src/theme/ThemeProvider.tsx` |
| Keyboard shortcuts (focus, search, suggestions) | ✅ | `frontend/src/hooks/useKeyboardShortcut.ts`, `App.tsx` |
| API client (fetch wrapper) | ✅ | `frontend/src/api/client.ts` |
| TypeScript types | ✅ | `frontend/src/types/index.ts` |
| .docx export & import UI | ✅ | `frontend/src/App.tsx` |

### Infrastructure

| Feature | Status | Files |
|---------|--------|-------|
| Docker Compose (LanguageTool + backend + frontend) | ✅ | `docker-compose.yml` |
| Backend Dockerfile | ✅ | `backend/Dockerfile` |
| Frontend Dockerfile (nginx serve) | ✅ | `frontend/Dockerfile` |
| Vite dev proxy to backend | ✅ | `frontend/vite.config.ts` |

### Tests

| Feature | Status | Files |
|---------|--------|-------|
| Backend pytest suite | ✅ | `backend/tests/` |

---

## Phase 2: Productivity — 🔄 In Progress

| Feature | Status | Notes |
|---------|--------|-------|
| Search across titles and content | ✅ API now searches both title and content via ILIKE |
| Tags UI in sidebar | ✅ TagsPanel component — create, assign, remove tags per document |
| Sorting (updated, title, word count) | ✅ Sort dropdown in sidebar; API already supported it |
| Recent list on home screen | ✅ RecentDocuments component on home screen (top 8 by updated) |
| Focus mode | ✅ Working (Ctrl+Shift+F) |
| Dark mode | ✅ Working (toggle button) |
| Keyboard shortcuts | ✅ Working (Ctrl+Shift+F, Ctrl+K, Ctrl+Enter, Alt+↓) |
| Word count display | ✅ Working (status bar) |
| Personal dictionary | ✅ DictionaryWord model, API routes, settings modal UI, checker integration |
| Check categories (spelling, grammar, punctuation, style toggles) | ✅ Settings modal with toggles; categories passed to check API |
| Version history view with restore | ✅ VersionHistoryModal with restore |

---

## Phase 3: Smart & Desktop — 🔄 In Progress

| Feature | Status | Notes |
|---------|--------|-------|
| Local LLM runtime | ✅ llama-cpp-python installed, Qwen2.5-0.5B-Instruct GGUF model (397MB) in backend/data/ |
| Rewrite API endpoint | ✅ POST /api/rewrite with 6 tone options (simple, formal, friendly, concise, academic, creative) |
| Rewrite modal with diff view | ✅ RewriteModal component with word-level diff (green=added, red=removed) |
| Tone selector | ✅ 6 tones as pill buttons in the modal |
| Toolbar integration | ✅ ✨ Rewrite button in top bar + Ctrl+R shortcut |
| Selection-based rewrite | ✅ Rewrite now uses selected text (or current paragraph if no selection); replaces only that range on accept |
| AI style suggestions | ✅ POST /api/analyze endpoint using LLM; SuggestionsProvider runs grammar + AI in parallel; toggle in Settings |
| Folder backup | ✅ POST /api/backup exports all docs as .docx into timestamped subfolder; GET/PUT /api/backup/path for config; Settings UI |
| Tauri desktop wrapper | ⬜ Deferred (skipped per user request) |

---

## Infrastructure Setup Log

| Date | Action | Status |
|------|--------|--------|
| 2026-10-20 | Docker Engine 29.9.1 + Compose v5.6.0 installed | ✅ |
| 2026-10-20 | Ollama v0.40.6 installed, server running on :11434 | ✅ |
| 2026-10-20 | GitHub CLI (gh) installed | ✅ |
| 2026-10-20 | Git repo initialized, .gitignore created | ✅ |
| 2026-10-20 | Backend running on :8000 (manual, no Docker) | ✅ |
| 2026-10-20 | Frontend running on :5173 (Vite dev server) | ✅ |
