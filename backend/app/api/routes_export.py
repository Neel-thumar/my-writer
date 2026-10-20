"""Export / import routes for .docx files."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.schemas import ImportResponse
from app.export.docx_service import export_to_docx, import_from_docx
from app.storage.database import get_db
from app.storage.models import Document

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/{doc_id}")
def export_document(doc_id: int, db: Session = Depends(get_db)):
    """Export a single document to a .docx file."""
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        docx_bytes = export_to_docx(doc.get_content())
    except Exception as exc:
        logger.error("Export failed for doc %d: %s", doc_id, exc)
        raise HTTPException(status_code=500, detail="Export failed") from exc

    safe_title = "".join(c if c.isalnum() or c in " -_" else "_" for c in doc.title)
    filename = f"{safe_title}.docx"

    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import", response_model=ImportResponse, status_code=201)
async def import_document(
    file: UploadFile = File(...),
    folder_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Import a .docx file as a new document in the library."""
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        content, title, word_count = import_from_docx(file_bytes)
    except Exception as exc:
        logger.error("Import failed: %s", exc)
        raise HTTPException(status_code=422, detail=f"Could not read .docx: {exc}") from exc

    # Use filename as fallback title
    if not title:
        title = file.filename.replace(".docx", "").replace("_", " ").replace("-", " ").strip()

    doc = Document(
        title=title,
        folder_id=folder_id,
    )
    doc.set_content(content)
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return ImportResponse(document_id=doc.id, title=doc.title, word_count=doc.word_count)
