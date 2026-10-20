"""Personal dictionary routes — words the user accepts as correct."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.storage.database import get_db
from app.storage.models import DictionaryWord

router = APIRouter(prefix="/dictionary", tags=["dictionary"])


class DictionaryWordCreate(BaseModel):
    word: str


class DictionaryWordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    word: str


@router.get("", response_model=list[DictionaryWordOut])
def list_words(db: Session = Depends(get_db)):
    """List all words in the personal dictionary."""
    return db.query(DictionaryWord).order_by(DictionaryWord.word.asc()).all()


@router.post("", response_model=DictionaryWordOut, status_code=201)
def add_word(payload: DictionaryWordCreate, db: Session = Depends(get_db)):
    """Add a word to the personal dictionary."""
    word = payload.word.strip()
    if not word:
        raise HTTPException(status_code=400, detail="Word cannot be empty")
    existing = db.query(DictionaryWord).filter(DictionaryWord.word == word).first()
    if existing:
        raise HTTPException(status_code=409, detail="Word already in dictionary")
    entry = DictionaryWord(word=word)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{word_id}", status_code=204)
def delete_word(word_id: int, db: Session = Depends(get_db)):
    """Remove a word from the personal dictionary."""
    entry = db.get(DictionaryWord, word_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Word not found")
    db.delete(entry)
    db.commit()
