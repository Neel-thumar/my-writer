"""Grammar check route — proxies text to LanguageTool via the checker adapter."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.schemas import CheckRequest, CheckResponse
from app.checkers.languagetool import LanguageToolChecker
from app.storage.database import get_db
from app.storage.models import Setting

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/check", tags=["check"])

# Reuse a single checker instance
_checker: LanguageToolChecker | None = None


def _get_checker(db: Session) -> LanguageToolChecker:
    global _checker
    if _checker is None:
        url_setting = db.query(Setting).filter(Setting.key == "languagetool_url").first()
        lt_url = url_setting.value if url_setting else "http://localhost:8081"
        _checker = LanguageToolChecker(base_url=lt_url)
    return _checker


@router.post("", response_model=CheckResponse)
def check_text(payload: CheckRequest, db: Session = Depends(get_db)):
    """Run grammar check on the provided text."""
    checker = _get_checker(db)
    try:
        suggestions = checker.check(
            text=payload.text,
            language=payload.language,
            categories=payload.categories,
        )
        return CheckResponse(suggestions=suggestions, language=payload.language)
    except Exception as exc:
        logger.error("Grammar check failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Grammar check service error: {exc}") from exc
