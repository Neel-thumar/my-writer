"""AI routes, in layers.

- POST /fix      — local, free: LanguageTool + small local model (one-click Fix)
- POST /rewrite  — cloud, only on explicit request: the user's own free-tier provider
- /ai/config     — provider settings (the API key is write-only)
"""

from __future__ import annotations

import logging
import threading

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.routes_check import _get_checker, dictionary_words
from app.checkers import cloud_ai
from app.checkers.fixer import fix_text
from app.checkers.local_llm import LocalGrammarModel
from app.storage.database import SessionLocal, get_db
from app.storage.models import Setting

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ai"])

_local_model = LocalGrammarModel()

# Settings keys. The key is a secret: never returned by any endpoint.
K_PROVIDER, K_BASE_URL, K_API_KEY, K_MODEL, K_LOCAL_AI = (
    "ai_provider",
    "ai_base_url",
    "ai_api_key",
    "ai_model",
    "ai_local_fix",
)
SECRET_SETTING_KEYS = {K_API_KEY}


def _warm_up_in_background() -> None:
    threading.Thread(target=_local_model.warm_up, daemon=True).start()


def preload_local_model_if_enabled() -> None:
    """At startup: load the local model only if the user turned it on (it costs ~400 MB RAM)."""
    db = SessionLocal()
    try:
        if _get(db, K_LOCAL_AI, "false") == "true":
            _warm_up_in_background()
    finally:
        db.close()


def _get(db: Session, key: str, default: str = "") -> str:
    row = db.query(Setting).filter(Setting.key == key).first()
    return row.value if row else default


def _set(db: Session, key: str, value: str) -> None:
    row = db.query(Setting).filter(Setting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))


# ---------------------------------------------------------------------------
# Layer 1 — local Fix
# ---------------------------------------------------------------------------


class FixRequest(BaseModel):
    text: str
    language: str = "en-US"


class FixResponse(BaseModel):
    original: str
    fixed: str
    languagetool_fixes: int
    local_ai_fixes: int


@router.post("/fix", response_model=FixResponse)
def fix(payload: FixRequest, db: Session = Depends(get_db)):
    """Fix spelling and grammar locally. Nothing leaves this machine."""
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    use_local_ai = _get(db, K_LOCAL_AI, "false") == "true"
    try:
        fixed, lt_count, ai_count = fix_text(
            payload.text,
            _get_checker(db),
            _local_model if use_local_ai else None,
            dictionary_words(db),
            payload.language,
        )
    except Exception as exc:
        logger.error("Fix failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Grammar checker unavailable: {exc}") from exc
    return FixResponse(original=payload.text, fixed=fixed, languagetool_fixes=lt_count, local_ai_fixes=ai_count)


# ---------------------------------------------------------------------------
# Layer 2 — cloud Rewrite (explicit only)
# ---------------------------------------------------------------------------


class RewriteRequest(BaseModel):
    text: str
    tone: str = "improve"
    instruction: str = ""


class RewriteResponse(BaseModel):
    original: str
    rewritten: str


@router.post("/rewrite", response_model=RewriteResponse)
def rewrite(payload: RewriteRequest, db: Session = Depends(get_db)):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    try:
        rewritten = cloud_ai.rewrite(
            payload.text,
            base_url=_get(db, K_BASE_URL),
            api_key=_get(db, K_API_KEY),
            model=_get(db, K_MODEL),
            tone=payload.tone,
            instruction=payload.instruction,
        )
    except cloud_ai.CloudNotConfigured as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except cloud_ai.CloudError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return RewriteResponse(original=payload.text, rewritten=rewritten)


# ---------------------------------------------------------------------------
# Provider configuration
# ---------------------------------------------------------------------------


class AiConfigOut(BaseModel):
    provider: str
    base_url: str
    model: str
    has_api_key: bool
    local_fix_ai: bool
    local_model_available: bool
    providers: dict[str, dict[str, str]]
    tones: dict[str, str]


class AiConfigUpdate(BaseModel):
    provider: str | None = None
    base_url: str | None = None
    api_key: str | None = None  # "" clears it
    model: str | None = None
    local_fix_ai: bool | None = None


def _config(db: Session) -> AiConfigOut:
    return AiConfigOut(
        provider=_get(db, K_PROVIDER),
        base_url=_get(db, K_BASE_URL),
        model=_get(db, K_MODEL),
        has_api_key=bool(_get(db, K_API_KEY)),
        local_fix_ai=_get(db, K_LOCAL_AI, "false") == "true",
        local_model_available=_local_model.is_available(),
        providers=cloud_ai.PROVIDERS,
        tones=cloud_ai.TONES,
    )


@router.get("/ai/config", response_model=AiConfigOut)
def get_ai_config(db: Session = Depends(get_db)):
    return _config(db)


@router.put("/ai/config", response_model=AiConfigOut)
def update_ai_config(payload: AiConfigUpdate, db: Session = Depends(get_db)):
    if payload.provider is not None:
        if payload.provider and payload.provider not in cloud_ai.PROVIDERS:
            raise HTTPException(status_code=400, detail="Unknown provider")
        if payload.provider != _get(db, K_PROVIDER):
            # Switching provider: its models differ, so forget the old choice
            _set(db, K_MODEL, "")
        _set(db, K_PROVIDER, payload.provider)
        preset = cloud_ai.PROVIDERS.get(payload.provider, {}).get("base_url", "")
        if preset:
            _set(db, K_BASE_URL, preset)
    if payload.base_url is not None:
        _set(db, K_BASE_URL, payload.base_url.strip())
    if payload.api_key is not None:
        _set(db, K_API_KEY, payload.api_key.strip())
    if payload.model is not None:
        _set(db, K_MODEL, payload.model.strip())
    if payload.local_fix_ai is not None:
        _set(db, K_LOCAL_AI, "true" if payload.local_fix_ai else "false")
    db.commit()
    if payload.local_fix_ai:
        _warm_up_in_background()  # so the first deeper Fix doesn't wait for loading
    return _config(db)


@router.get("/ai/models", response_model=list[str])
def get_ai_models(db: Session = Depends(get_db)):
    """Models available to the saved key (also verifies the key works)."""
    try:
        return cloud_ai.list_models(_get(db, K_BASE_URL), _get(db, K_API_KEY))
    except cloud_ai.CloudNotConfigured as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except cloud_ai.CloudError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
