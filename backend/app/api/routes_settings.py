"""Settings routes — key/value store for app preferences."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.schemas import SettingOut, SettingUpdate

# Never exposed through the generic settings API (see routes_ai)
_SECRET_KEYS = {"ai_api_key"}
from app.storage.database import get_db
from app.storage.models import Setting

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=list[SettingOut])
def list_settings(db: Session = Depends(get_db)):
    return db.query(Setting).filter(Setting.key.notin_(_SECRET_KEYS)).all()


@router.get("/{key}", response_model=SettingOut)
def get_setting(key: str, db: Session = Depends(get_db)):
    setting = db.query(Setting).filter(Setting.key == key).first()
    if not setting or key in _SECRET_KEYS:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting


@router.put("", response_model=SettingOut)
def upsert_setting(payload: SettingUpdate, db: Session = Depends(get_db)):
    setting = db.query(Setting).filter(Setting.key == payload.key).first()
    if setting:
        setting.value = payload.value
    else:
        setting = Setting(key=payload.key, value=payload.value)
        db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


@router.delete("/{key}", status_code=204)
def delete_setting(key: str, db: Session = Depends(get_db)):
    setting = db.query(Setting).filter(Setting.key == key).first()
    if setting:
        db.delete(setting)
        db.commit()
