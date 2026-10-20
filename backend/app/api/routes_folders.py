"""Folder CRUD routes."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.schemas import FolderCreate, FolderOut, FolderUpdate
from app.storage.database import get_db
from app.storage.models import Folder

router = APIRouter(prefix="/folders", tags=["folders"])


@router.get("", response_model=list[FolderOut])
def list_folders(include_deleted: bool = False, db: Session = Depends(get_db)):
    q = db.query(Folder)
    if not include_deleted:
        q = q.filter(Folder.deleted_at.is_(None))
    return q.order_by(Folder.name.asc()).all()


@router.post("", response_model=FolderOut, status_code=201)
def create_folder(payload: FolderCreate, db: Session = Depends(get_db)):
    if payload.parent_id is not None:
        parent = db.get(Folder, payload.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found")
    folder = Folder(name=payload.name, parent_id=payload.parent_id)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


@router.put("/{folder_id}", response_model=FolderOut)
def update_folder(folder_id: int, payload: FolderUpdate, db: Session = Depends(get_db)):
    folder = db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    if payload.name is not None:
        folder.name = payload.name
    if payload.parent_id is not None:
        # prevent making folder its own descendant
        if payload.parent_id == folder_id:
            raise HTTPException(status_code=400, detail="Cannot move folder into itself")
        folder.parent_id = payload.parent_id
    db.commit()
    db.refresh(folder)
    return folder


@router.delete("/{folder_id}", status_code=204)
def delete_folder(folder_id: int, permanent: bool = False, db: Session = Depends(get_db)):
    folder = db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    if permanent:
        db.delete(folder)
    else:
        folder.deleted_at = datetime.now(timezone.utc)
        # soft-delete all documents in this folder
        for doc in folder.documents:
            doc.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/{folder_id}/restore", response_model=FolderOut)
def restore_folder(folder_id: int, db: Session = Depends(get_db)):
    folder = db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    folder.deleted_at = None
    db.commit()
    db.refresh(folder)
    return folder
