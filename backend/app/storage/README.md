# Storage

SQLAlchemy models, database connection, and migrations.

## Files

| File | Purpose |
|------|---------|
| `models.py` | SQLAlchemy models: Folder, Document, Tag, DocTag, Version, Setting |
| `database.py` | Engine, session factory, `get_db` dependency |
| `migrations.py` | Schema migration runner (versioned, idempotent) |

## Models

```
Folder     — id, name, parent_id (self-ref), created_at, deleted_at
Document   — id, title, folder_id, content (JSON), word_count, created_at, updated_at, deleted_at
Tag        — id, name (unique)
DocTag     — document_id, tag_id (association table)
Version    — id, document_id, content (JSON), saved_at
Setting    — id, key (unique), value
```

## Key behaviors

- **Word count** auto-updates via SQLAlchemy `event.listens_for` on `Document.content` set
- **Plain text extraction** from TipTap JSON for grammar checks and word counting (`_extract_text`)
- **Soft-delete** via `deleted_at` column; `is_deleted` property for convenience
- **Content** stored as JSON string; `get_content()` / `set_content()` helpers for safe parse/serialize

## Latest updates

- Phase 1: all models, database, and migrations complete
- Phase 2: may need a `DictionaryWord` model for personal dictionary feature
