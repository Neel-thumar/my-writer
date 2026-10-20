"""Backup route — exports all documents as .docx files into a local folder.

Preserves the folder structure. Non-deleted documents only.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.export.docx_service import export_to_docx
from app.storage.database import get_db
from app.storage.models import Document, Folder, Setting

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/backup", tags=["backup"])


def _safe_filename(name: str) -> str:
    """Make a string safe for use as a filename."""
    # Replace problematic characters, keep alphanumerics, spaces, dashes, underscores
    safe = re.sub(r'[^\w \-]', "_", name).strip()
    return safe or "Untitled"


def _build_folder_path(folders: dict[int, Folder], folder_id: int | None, base: Path) -> Path:
    """Walk the folder tree to build the full path for a document."""
    if folder_id is None:
        return base
    parts: list[str] = []
    current_id: int | None = folder_id
    seen: set[int] = set()
    while current_id is not None and current_id not in seen:
        seen.add(current_id)
        folder = folders.get(current_id)
        if not folder:
            break
        parts.insert(0, _safe_filename(folder.name))
        current_id = folder.parent_id
    return base.joinpath(*parts)


class BackupRequest(BaseModel):
    folder_path: str


class BackupResponse(BaseModel):
    exported: int
    skipped: int
    backup_dir: str
    timestamp: str


@router.post("", response_model=BackupResponse)
def backup_all(payload: BackupRequest, db: Session = Depends(get_db)):
    """Export all non-deleted documents as .docx files into the given folder.

    The folder structure is preserved. Each document becomes a .docx file.
    A timestamped subfolder is created to avoid overwriting previous backups.
    """
    if not payload.folder_path or not payload.folder_path.strip():
        raise HTTPException(status_code=400, detail="Folder path is required")

    base_path = Path(payload.folder_path).expanduser().resolve()

    # Create the base directory if it doesn't exist
    try:
        base_path.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot create backup directory: {exc}",
        ) from exc

    # Create a timestamped subfolder for this backup
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_dir = base_path / timestamp
    backup_dir.mkdir(parents=True, exist_ok=True)

    # Load all non-deleted folders
    folders = {
        f.id: f
        for f in db.query(Folder).filter(Folder.deleted_at.is_(None)).all()
    }

    # Load all non-deleted documents
    docs = (
        db.query(Document)
        .filter(Document.deleted_at.is_(None))
        .order_by(Document.title)
        .all()
    )

    exported = 0
    skipped = 0

    for doc in docs:
        try:
            # Build the target folder path
            target_dir = _build_folder_path(folders, doc.folder_id, backup_dir)
            target_dir.mkdir(parents=True, exist_ok=True)

            # Generate a unique filename
            filename = f"{_safe_filename(doc.title)}.docx"
            filepath = target_dir / filename

            # If file already exists (duplicate titles), append the doc ID
            if filepath.exists():
                filepath = target_dir / f"{_safe_filename(doc.title)}_{doc.id}.docx"

            # Export to .docx
            docx_bytes = export_to_docx(doc.get_content())
            filepath.write_bytes(docx_bytes)
            exported += 1
        except Exception as exc:
            logger.warning("Failed to export doc %d (%s): %s", doc.id, doc.title, exc)
            skipped += 1

    logger.info("Backup complete: %d exported, %d skipped → %s", exported, skipped, backup_dir)
    return BackupResponse(
        exported=exported,
        skipped=skipped,
        backup_dir=str(backup_dir),
        timestamp=timestamp,
    )


@router.get("/path")
def get_backup_path(db: Session = Depends(get_db)) -> dict[str, str | None]:
    """Get the configured backup folder path."""
    setting = db.query(Setting).filter(Setting.key == "backup_folder").first()
    return {"path": setting.value if setting else None}


class SetPathRequest(BaseModel):
    path: str


@router.put("/path")
def set_backup_path(payload: SetPathRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    """Set the backup folder path."""
    setting = db.query(Setting).filter(Setting.key == "backup_folder").first()
    if setting:
        setting.value = payload.path
    else:
        setting = Setting(key="backup_folder", value=payload.path)
        db.add(setting)
    db.commit()
    return {"path": payload.path}
