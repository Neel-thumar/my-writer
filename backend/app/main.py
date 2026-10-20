"""FastAPI application factory and startup."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.storage.migrations import run_migrations

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Personal Writing Workspace API",
        version="0.1.0",
        description="Backend for the Personal Writing Workspace — documents, folders, grammar checks, and .docx export.",
    )

    # CORS — allow the frontend dev server
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routes
    from app.api.routes_documents import router as documents_router
    from app.api.routes_folders import router as folders_router
    from app.api.routes_check import router as check_router
    from app.api.routes_export import router as export_router
    from app.api.routes_tags import router as tags_router
    from app.api.routes_settings import router as settings_router
    from app.api.routes_dictionary import router as dictionary_router

    api_prefix = "/api"
    app.include_router(documents_router, prefix=api_prefix)
    app.include_router(folders_router, prefix=api_prefix)
    app.include_router(check_router, prefix=api_prefix)
    app.include_router(export_router, prefix=api_prefix)
    app.include_router(tags_router, prefix=api_prefix)
    app.include_router(settings_router, prefix=api_prefix)
    app.include_router(dictionary_router, prefix=api_prefix)

    @app.on_event("startup")
    def _startup() -> None:
        logger.info("Starting up — running migrations…")
        run_migrations()
        logger.info("Ready.")

    @app.get("/")
    def root() -> dict:
        return {
            "app": "Personal Writing Workspace",
            "version": "0.1.0",
            "docs": "/docs",
        }

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
