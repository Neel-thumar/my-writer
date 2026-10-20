"""Rewrite route — uses Ollama to rewrite text in different tones."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.checkers.ollama import OllamaRewriter, Tone
from app.storage.database import get_db
from app.storage.models import Setting

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rewrite", tags=["rewrite"])

# Reuse a single rewriter instance
_rewriter: OllamaRewriter | None = None


def _get_rewriter(db: Session) -> OllamaRewriter:
    global _rewriter
    if _rewriter is None:
        url_setting = db.query(Setting).filter(Setting.key == "ollama_url").first()
        ollama_url = url_setting.value if url_setting else "http://localhost:11434"
        _rewriter = OllamaRewriter(base_url=ollama_url)
    return _rewriter


class RewriteRequest(BaseModel):
    text: str
    tone: str = "simple"  # simple, formal, friendly, concise, academic, creative
    model: str = "qwen2.5:0.5b"


class RewriteResponse(BaseModel):
    original: str
    rewritten: str
    tone: str


@router.post("", response_model=RewriteResponse)
def rewrite_text(payload: RewriteRequest, db: Session = Depends(get_db)):
    """Rewrite text using Ollama in the requested tone."""
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    # Validate tone
    valid_tones = {t.value for t in Tone}
    if payload.tone not in valid_tones:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tone. Choose from: {', '.join(sorted(valid_tones))}",
        )

    rewriter = _get_rewriter(db)
    try:
        rewritten = rewriter.rewrite(
            text=payload.text,
            tone=payload.tone,
            model=payload.model,
        )
        return RewriteResponse(
            original=payload.text,
            rewritten=rewritten,
            tone=payload.tone,
        )
    except Exception as exc:
        logger.error("Rewrite failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"Rewrite service error (is Ollama running?): {exc}",
        ) from exc


@router.get("/tones")
def list_tones() -> list[dict[str, str]]:
    """List available tones."""
    return [
        {"value": t.value, "label": t.value.capitalize()} for t in Tone
    ]
