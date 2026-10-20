"""Tag routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.schemas import DocTagUpdate, TagCreate, TagOut
from app.storage.database import get_db
from app.storage.models import Document, DocTag, Tag

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db)):
    return db.query(Tag).order_by(Tag.name.asc()).all()


@router.post("", response_model=TagOut, status_code=201)
def create_tag(payload: TagCreate, db: Session = Depends(get_db)):
    existing = db.query(Tag).filter(Tag.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Tag already exists")
    tag = Tag(name=payload.name)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.put("/{tag_id}", response_model=TagOut)
def rename_tag(tag_id: int, payload: TagCreate, db: Session = Depends(get_db)):
    tag = db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    tag.name = payload.name
    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    db.commit()


# ---------------------------------------------------------------------------
# Document-tag associations
# ---------------------------------------------------------------------------

@router.get("/documents/{doc_id}", response_model=list[TagOut])
def get_document_tags(doc_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return [dt.tag for dt in doc.tags]


@router.put("/documents/{doc_id}", response_model=list[TagOut])
def set_document_tags(doc_id: int, payload: DocTagUpdate, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # clear existing
    db.query(DocTag).filter(DocTag.document_id == doc_id).delete()
    # add new
    for tag_id in payload.tag_ids:
        tag = db.get(Tag, tag_id)
        if tag:
            db.add(DocTag(document_id=doc_id, tag_id=tag_id))
    db.commit()
    db.refresh(doc)
    return [dt.tag for dt in doc.tags]
