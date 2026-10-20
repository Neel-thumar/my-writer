"""Database migrations module.

Phase 1 uses SQLAlchemy ``create_all`` for simplicity.
When schema changes are needed, manually bump ``SCHEMA_VERSION``
and add a migration function to the ``_migrations`` list.
"""

from __future__ import annotations

import logging

from app.storage.database import engine, init_db
from app.storage.models import Base

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 2


def run_migrations() -> None:
    """Run any pending database migrations."""
    logger.info("Running migrations (schema version %s)…", SCHEMA_VERSION)
    init_db()
    logger.info("Migrations complete.")
