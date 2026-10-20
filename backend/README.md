# Backend — Personal Writing Workspace

FastAPI + SQLite backend for the writing workspace.

## What's here

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app factory, CORS, startup (runs migrations)
│   ├── api/                 # API routes and Pydantic schemas
│   ├── checkers/            # Grammar check adapters (LanguageTool)
│   ├── export/              # .docx export/import service
│   ├── services/            # (reserved for service layer)
│   └── storage/             # SQLAlchemy models, database, migrations
├── data/                    # SQLite database file (gitignored)
├── tests/                   # Pytest suite
├── .venv/                   # Python virtual environment (gitignored)
├── requirements.txt
├── Dockerfile
└── run.py                   # Entry point: uvicorn run:app
```

## Running

```bash
# Install deps (if not using Docker)
pip install -r requirements.txt

# Start the server
python3 -m uvicorn run:app --reload --port 8000
```

Or via Docker Compose from project root:
```bash
docker compose up --build
```

## Key design notes

- **Content stored as TipTap JSON** — preserves rich text formatting (bold, headings, lists)
- **Soft-delete** — `deleted_at` timestamp, items recoverable from trash
- **Version snapshots** — automatic before each content save, restorable
- **Word count** — auto-calculated via SQLAlchemy event listener when content is set
- **Grammar engine** — replaceable adapter pattern (LanguageTool now, Ollama later)
- **SQLite** — single file at `data/writer.db`, no external database server needed

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `sqlite:///data/writer.db` | Database connection string |
| `LANGUAGETOOL_URL` | `http://localhost:8081` | LanguageTool server URL |

## API endpoints

See the main README for the full API table, or visit `http://localhost:8000/docs` when the server is running for interactive Swagger docs.

## Latest updates

- Phase 1 complete: all core features (CRUD, folders, tags, grammar, export/import, versions, settings) implemented and tested
- Phase 2: in progress — see `../PROGRESS.md` for what's next
