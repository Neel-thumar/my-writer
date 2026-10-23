"""Analyze route — uses the local LLM to provide AI style suggestions and multi-option correction."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.schemas import (
    CheckResponse,
    CorrectResponse,
    CorrectVersion,
    Suggestion,
    SuggestionReplacement,
)
from app.checkers.ollama import OllamaRewriter
from app.storage.database import get_db
from app.storage.models import Setting

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analyze", tags=["analyze"])

# Reuse the same rewriter instance as the rewrite route
_rewriter: OllamaRewriter | None = None


def _get_rewriter(db: Session) -> OllamaRewriter:
    global _rewriter
    if _rewriter is None:
        url_setting = db.query(Setting).filter(Setting.key == "ollama_url").first()
        ollama_url = url_setting.value if url_setting else "http://localhost:11434"
        _rewriter = OllamaRewriter(base_url=ollama_url)
    return _rewriter


class AnalyzeRequest(BaseModel):
    text: str


class CorrectRequest(BaseModel):
    text: str
    num_versions: int = 3


@router.post("", response_model=CheckResponse)
def analyze_text(payload: AnalyzeRequest, db: Session = Depends(get_db)):
    """Analyze text and return AI-powered style suggestions."""
    if not payload.text or not payload.text.strip():
        return CheckResponse(suggestions=[], language="en-US")

    rewriter = _get_rewriter(db)

    if not rewriter.is_available():
        return CheckResponse(suggestions=[], language="en-US")

    try:
        raw_suggestions = rewriter.analyze(payload.text)
    except Exception as exc:
        logger.error("AI analysis failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"AI analysis error (is the model loaded?): {exc}",
        ) from exc

    suggestions: list[Suggestion] = []
    for i, item in enumerate(raw_suggestions):
        suggestion_type = item.get("type", "style")
        # Clamp to known types
        if suggestion_type not in ("spelling", "grammar", "punctuation", "style"):
            suggestion_type = "style"

        context = item.get("context", "")
        replacement_text = item.get("suggestion", "")

        replacements: list[SuggestionReplacement] = []
        if replacement_text:
            replacements.append(
                SuggestionReplacement(value=replacement_text, message=None)
            )

        suggestions.append(
            Suggestion(
                id=f"ai-{i}",
                type=suggestion_type,
                message=item.get("message", "Style suggestion"),
                offset=0,
                length=len(context),
                context=context,
                error_text=context,
                replacements=replacements,
                category_id="AI",
            )
        )

    return CheckResponse(suggestions=suggestions, language="en-US")


@router.post("/correct", response_model=CorrectResponse)
def correct_text(payload: CorrectRequest, db: Session = Depends(get_db)):
    """Generate multiple corrected versions of the text using the local LLM."""
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    rewriter = _get_rewriter(db)

    if not rewriter.is_available():
        raise HTTPException(status_code=503, detail="AI model not available")

    try:
        raw_versions = rewriter.correct(payload.text, num_versions=payload.num_versions)
    except Exception as exc:
        logger.error("AI correction failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"AI correction error: {exc}",
        ) from exc

    versions = [
        CorrectVersion(
            title=v.get("title", f"Version {i + 1}"),
            description=v.get("description", "Corrected version"),
            text=v.get("text", ""),
        )
        for i, v in enumerate(raw_versions)
    ]

    return CorrectResponse(original=payload.text, versions=versions)
