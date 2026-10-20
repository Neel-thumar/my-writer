"""Pydantic request/response schemas for the API."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Folder schemas
# ---------------------------------------------------------------------------

class FolderBase(BaseModel):
    name: str = "New Folder"
    parent_id: int | None = None


class FolderCreate(FolderBase):
    pass


class FolderUpdate(BaseModel):
    name: str | None = None
    parent_id: int | None = None


class FolderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    parent_id: int | None
    created_at: datetime
    deleted_at: datetime | None


# ---------------------------------------------------------------------------
# Document schemas
# ---------------------------------------------------------------------------

class DocumentBase(BaseModel):
    title: str = "Untitled"
    folder_id: int | None = None


class DocumentCreate(DocumentBase):
    content: dict[str, Any] | None = None


class DocumentUpdate(BaseModel):
    title: str | None = None
    content: dict[str, Any] | None = None
    folder_id: int | None = None


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    folder_id: int | None
    content: dict[str, Any]
    word_count: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


# ---------------------------------------------------------------------------
# Tag schemas
# ---------------------------------------------------------------------------

class TagCreate(BaseModel):
    name: str


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class DocTagUpdate(BaseModel):
    tag_ids: list[int]


# ---------------------------------------------------------------------------
# Version schemas
# ---------------------------------------------------------------------------

class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    saved_at: datetime


# ---------------------------------------------------------------------------
# Check schemas
# ---------------------------------------------------------------------------

class CheckRequest(BaseModel):
    text: str
    language: str = "en-US"
    categories: list[str] | None = None  # None = all


class SuggestionReplacement(BaseModel):
    value: str
    message: str | None = None


class Suggestion(BaseModel):
    id: str
    type: str  # spelling, grammar, punctuation, style
    message: str
    offset: int
    length: int
    context: str
    replacements: list[SuggestionReplacement] = []
    category_id: str | None = None


class CheckResponse(BaseModel):
    suggestions: list[Suggestion]
    language: str


# ---------------------------------------------------------------------------
# Export / import schemas
# ---------------------------------------------------------------------------

class ExportRequest(BaseModel):
    document_id: int


class ImportResponse(BaseModel):
    document_id: int
    title: str
    word_count: int


# ---------------------------------------------------------------------------
# Setting schemas
# ---------------------------------------------------------------------------

class SettingUpdate(BaseModel):
    key: str
    value: str


class SettingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    value: str


# ---------------------------------------------------------------------------
# Dictionary schemas
# ---------------------------------------------------------------------------

class DictionaryWordCreate(BaseModel):
    word: str


class DictionaryWordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    word: str
