# API Routes

FastAPI route handlers for all backend endpoints.

## Files

| File | Purpose |
|------|---------|
| `routes_documents.py` | Document CRUD, duplicate, restore, version history & restore |
| `routes_folders.py` | Folder CRUD, restore, tree listing |
| `routes_tags.py` | Tag creation, listing, assigning tags to documents |
| `routes_check.py` | Grammar check endpoint (proxies to LanguageTool) |
| `routes_export.py` | .docx export and import endpoints |
| `routes_settings.py` | Key-value settings store (theme, font, language) |
| `schemas.py` | Pydantic v2 request/response models |

## Patterns

- All routes use `APIRouter` and are registered in `main.py`
- Database sessions via `Depends(get_db)` dependency injection
- Soft-delete: `deleted_at` set instead of row deletion
- Search: case-insensitive `ILIKE` on document title (content search planned for Phase 2)
- Sorting: `updated` (default), `title`, `word_count` supported

## Latest updates

- Phase 1: all routes implemented and tested
- Phase 2: full-text content search and personal dictionary endpoints needed
