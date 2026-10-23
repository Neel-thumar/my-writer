"""Document CRUD routes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, or_
from sqlalchemy.orm import Session

from app.api.schemas import DocumentCreate, DocumentOut, DocumentUpdate, VersionOut
from app.storage.database import get_db
from app.storage.models import Document, Version

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentOut])
def list_documents(
    include_deleted: bool = False,
    folder_id: int | None = None,
    search: str | None = None,
    sort: str = "updated",
    db: Session = Depends(get_db),
):
    """List all documents, optionally filtered."""
    q = db.query(Document)
    if not include_deleted:
        q = q.filter(Document.deleted_at.is_(None))
    if folder_id is not None:
        q = q.filter(Document.folder_id == folder_id)
    if search:
        q = q.filter(
            or_(
                Document.title.ilike(f"%{search}%"),
                Document.content.ilike(f"%{search}%"),
            )
        )
    if sort == "title":
        q = q.order_by(Document.title.asc())
    elif sort == "word_count":
        q = q.order_by(desc(Document.word_count))
    else:  # default: updated
        q = q.order_by(desc(Document.updated_at))
    docs = q.all()
    return [DocumentOut(
        id=d.id,
        title=d.title,
        folder_id=d.folder_id,
        content=d.get_content(),
        word_count=d.word_count,
        created_at=d.created_at,
        updated_at=d.updated_at,
        deleted_at=d.deleted_at,
    ) for d in docs]


@router.get("/{doc_id}", response_model=DocumentOut)
def get_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentOut(
        id=doc.id,
        title=doc.title,
        folder_id=doc.folder_id,
        content=doc.get_content(),
        word_count=doc.word_count,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        deleted_at=doc.deleted_at,
    )


@router.post("", response_model=DocumentOut, status_code=201)
def create_document(payload: DocumentCreate, db: Session = Depends(get_db)):
    doc = Document(
        title=payload.title,
        folder_id=payload.folder_id,
    )
    doc.set_content(payload.content or {})
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return DocumentOut(
        id=doc.id,
        title=doc.title,
        folder_id=doc.folder_id,
        content=doc.get_content(),
        word_count=doc.word_count,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        deleted_at=doc.deleted_at,
    )


@router.put("/{doc_id}", response_model=DocumentOut)
def update_document(doc_id: int, payload: DocumentUpdate, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Cannot edit a deleted document")

    changed = False
    if payload.title is not None:
        doc.title = payload.title
        changed = True
    if payload.folder_id is not None:
        doc.folder_id = payload.folder_id
        changed = True
    if payload.content is not None:
        doc.set_content(payload.content)
        changed = True
    # Only manual saves (Ctrl+S) snapshot into version history; autosave never does.
    # The snapshot holds the content just saved, and identical consecutive
    # snapshots are skipped so repeated Ctrl+S doesn't clutter the history.
    if payload.create_version:
        latest = (
            db.query(Version)
            .filter(Version.document_id == doc.id)
            .order_by(desc(Version.saved_at), desc(Version.id))
            .first()
        )
        if latest is None or latest.content != doc.content:
            db.add(Version(document_id=doc.id, content=doc.content))
            changed = True
    if changed:
        doc.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(doc)
    return DocumentOut(
        id=doc.id,
        title=doc.title,
        folder_id=doc.folder_id,
        content=doc.get_content(),
        word_count=doc.word_count,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        deleted_at=doc.deleted_at,
    )


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: int, permanent: bool = False, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if permanent:
        db.delete(doc)
    else:
        doc.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/{doc_id}/restore", response_model=DocumentOut)
def restore_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.deleted_at = None
    db.commit()
    db.refresh(doc)
    return DocumentOut(
        id=doc.id,
        title=doc.title,
        folder_id=doc.folder_id,
        content=doc.get_content(),
        word_count=doc.word_count,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        deleted_at=doc.deleted_at,
    )


@router.post("/{doc_id}/duplicate", response_model=DocumentOut, status_code=201)
def duplicate_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    copy = Document(
        title=f"{doc.title} (copy)",
        folder_id=doc.folder_id,
    )
    copy.set_content(doc.get_content())
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return DocumentOut(
        id=copy.id,
        title=copy.title,
        folder_id=copy.folder_id,
        content=copy.get_content(),
        word_count=copy.word_count,
        created_at=copy.created_at,
        updated_at=copy.updated_at,
        deleted_at=copy.deleted_at,
    )


# ---------------------------------------------------------------------------
# Version history
# ---------------------------------------------------------------------------

@router.get("/{doc_id}/versions", response_model=list[VersionOut])
def list_versions(doc_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    versions = db.query(Version).filter(Version.document_id == doc_id).order_by(desc(Version.saved_at)).all()
    return versions


@router.post("/{doc_id}/versions", response_model=VersionOut)
def create_version_snapshot(doc_id: int, db: Session = Depends(get_db)):
    """Create a manual version snapshot (e.g. from Ctrl+S)."""
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    version = Version(document_id=doc.id, content=doc.content)
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


@router.get("/{doc_id}/versions/{version_id}")
def get_version(doc_id: int, version_id: int, db: Session = Depends(get_db)):
    version = db.get(Version, version_id)
    if not version or version.document_id != doc_id:
        raise HTTPException(status_code=404, detail="Version not found")
    return {"id": version.id, "document_id": version.document_id, "content": version.get_content(), "saved_at": version.saved_at}


@router.post("/{doc_id}/versions/{version_id}/restore", response_model=DocumentOut)
def restore_version(doc_id: int, version_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    version = db.get(Version, version_id)
    if not version or version.document_id != doc_id:
        raise HTTPException(status_code=404, detail="Version not found")
    # snapshot current before restoring
    snap = Version(document_id=doc.id, content=doc.content)
    db.add(snap)
    doc.set_content(version.get_content())
    doc.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(doc)
    return DocumentOut(
        id=doc.id,
        title=doc.title,
        folder_id=doc.folder_id,
        content=doc.get_content(),
        word_count=doc.word_count,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        deleted_at=doc.deleted_at,
    )
