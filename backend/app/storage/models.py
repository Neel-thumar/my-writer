"""SQLAlchemy models for the Personal Writing Workspace."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    event,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Folder(Base):
    """A folder that can be nested inside another folder."""

    __tablename__ = "folders"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, default="New Folder")
    parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    # relationships
    parent = relationship(
        "Folder",
        remote_side="Folder.id",
        back_populates="children",
    )
    children = relationship(
        "Folder",
        back_populates="parent",
        cascade="all, delete-orphan",
    )
    documents = relationship(
        "Document",
        back_populates="folder",
        cascade="all, delete-orphan",
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class Document(Base):
    """A writing document. Content is stored as TipTap JSON string."""

    __tablename__ = "documents"

    id = Column(Integer, primary_key=True)
    title = Column(String(500), nullable=False, default="Untitled")
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    content = Column(Text, nullable=False, default="{}")
    word_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    # relationships
    folder = relationship("Folder", back_populates="documents")
    versions = relationship(
        "Version",
        back_populates="document",
        order_by="Version.saved_at.desc()",
        cascade="all, delete-orphan",
    )
    tags = relationship(
        "DocTag",
        back_populates="document",
        cascade="all, delete-orphan",
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def get_content(self) -> dict[str, Any]:
        """Parse content JSON safely."""
        if not self.content:
            return {}
        try:
            return json.loads(self.content)
        except (json.JSONDecodeError, TypeError):
            return {}

    def set_content(self, value: dict[str, Any]) -> None:
        self.content = json.dumps(value, ensure_ascii=False)

    def get_plain_text(self) -> str:
        """Extract plain text from TipTap JSON content for word counting and grammar checks."""
        return _extract_text(self.get_content())


class Tag(Base):
    """A tag for categorizing documents (e.g. essay, email, story)."""

    __tablename__ = "tags"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)

    documents = relationship(
        "DocTag",
        back_populates="tag",
        cascade="all, delete-orphan",
    )


class DocTag(Base):
    """Association table between documents and tags."""

    __tablename__ = "doc_tags"
    __table_args__ = (UniqueConstraint("document_id", "tag_id", name="uq_doc_tag"),)

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    tag_id = Column(Integer, ForeignKey("tags.id"), nullable=False)

    document = relationship("Document", back_populates="tags")
    tag = relationship("Tag", back_populates="documents")


class Version(Base):
    """A version snapshot of a document's content."""

    __tablename__ = "versions"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    content = Column(Text, nullable=False, default="{}")
    saved_at = Column(DateTime, default=_utcnow, nullable=False)

    document = relationship("Document", back_populates="versions")

    def get_content(self) -> dict[str, Any]:
        if not self.content:
            return {}
        try:
            return json.loads(self.content)
        except (json.JSONDecodeError, TypeError):
            return {}


class Setting(Base):
    """Key-value store for app settings (theme, font, check language, etc.)."""

    __tablename__ = "settings"

    id = Column(Integer, primary_key=True)
    key = Column(String(100), nullable=False, unique=True)
    value = Column(Text, nullable=False, default="")


class DictionaryWord(Base):
    """A word the user has accepted as correct — never flagged by grammar check."""

    __tablename__ = "dictionary_words"

    id = Column(Integer, primary_key=True)
    word = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_text(node: Any) -> str:
    """Recursively extract plain text from a TipTap/ProseMirror JSON node."""
    if not node or not isinstance(node, dict):
        return ""
    parts: list[str] = []
    # text node
    if node.get("type") == "text" and "text" in node:
        parts.append(node["text"])
    # recurse into children
    for child in node.get("content", []) or []:
        parts.append(_extract_text(child))
    return " ".join(parts) if not node.get("type") else " ".join(
        p for p in [s.strip() for s in parts] if p
    )


def count_words(text: str) -> int:
    """Count words in a plain-text string."""
    return len(text.split()) if text.strip() else 0


@event.listens_for(Document.content, "set", propagate=True)
def _on_content_set(target: Document, value: str, oldvalue: str, initiator: Any) -> str:
    """Auto-update word_count when content changes."""
    try:
        parsed = json.loads(value) if value else {}
    except (json.JSONDecodeError, TypeError):
        parsed = {}
    target.word_count = count_words(_extract_text(parsed))
    return value
