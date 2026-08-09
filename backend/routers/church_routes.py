import threading
import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

import church_content
import activity_logs
from deps import require

router = APIRouter(prefix="/api", tags=["church"])

# TTL cache for the unauthenticated /public page; prevents DB load on every hit.
_public_cache = {"at": 0.0, "data": None}
_public_lock = threading.Lock()
PUBLIC_CACHE_TTL = 60.0


def _build_public_content():
    # Assemble the public homepage bundle: church basics plus the latest events
    # and active announcements (imports are local to avoid circular imports).
    from events import get_upcoming_events
    from announcements import get_announcements
    data = church_content.get_public_content()
    data["upcoming_events"] = get_upcoming_events(5)
    data["announcements"] = get_announcements(active_only=True)
    return data


def _warm_public_cache():
    # Pre-fill the cache at startup so the first visitor does not trigger a build.
    try:
        _public_cache["data"] = _build_public_content()
        _public_cache["at"] = time.time()
    except Exception:
        pass


@router.get("/public")
def public_content():
    # Public (no auth) church homepage content, cached for PUBLIC_CACHE_TTL.
    # The lock + double-check avoids stampede when the cache expires concurrently.
    now = time.time()
    if _public_cache["data"] is None or now - _public_cache["at"] > PUBLIC_CACHE_TTL:
        with _public_lock:
            now = time.time()
            if _public_cache["data"] is None or now - _public_cache["at"] > PUBLIC_CACHE_TTL:
                _public_cache["data"] = _build_public_content()
                _public_cache["at"] = time.time()
    # max-age matches PUBLIC_CACHE_TTL so browsers reuse the copy on repeat
    # navigations (About page) instead of re-downloading it every visit.
    return JSONResponse(
        content=_public_cache["data"],
        headers={"Cache-Control": f"public, max-age={int(PUBLIC_CACHE_TTL)}"},
    )


_warm_public_cache()


@router.get("/church-content")
def get_content(user: dict = Depends(require("admin"))):
    # Admin-only read of every editable church content section in one payload.
    return {
        "church_name": church_content.get_church_name(),
        "tagline": church_content.get_church_tagline(),
        "basics": church_content.get_basics(),
        "organisations": church_content.get_organisations(),
        "activities": church_content.get_activities(),
        "logo": church_content.get_church_logo(),
        "social": church_content.get_social(),
    }


@router.put("/church-content/name")
def save_name(payload: dict, user: dict = Depends(require("admin"))):
    # Each church content section is saved through its own PUT endpoint.
    name = (payload.get("value") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    church_content.save_church_name(name)
    activity_logs.log_activity(user["id"], "updated", "Church", "Updated church name")
    return {"message": "Saved"}


@router.put("/church-content/tagline")
def save_tagline(payload: dict, user: dict = Depends(require("admin"))):
    church_content.save_church_tagline(payload.get("value", ""))
    activity_logs.log_activity(user["id"], "updated", "Church", "Updated tagline")
    return {"message": "Saved"}


@router.put("/church-content/basics")
def save_basics(payload: dict, user: dict = Depends(require("admin"))):
    # Bulk-save the ordered about/mission/vision/values list; must be an array.
    items = payload.get("items")
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="items is required")
    church_content.save_basics(items)
    activity_logs.log_activity(user["id"], "updated", "Church", "Updated about/mission/vision/values")
    return {"message": "Saved"}


@router.put("/church-content/organisations")
def save_organisations(payload: dict, user: dict = Depends(require("admin"))):
    items = payload.get("items")
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="items is required")
    church_content.save_organisations(items)
    activity_logs.log_activity(user["id"], "updated", "Church", "Updated organisations")
    return {"message": "Saved"}


@router.put("/church-content/activities")
def save_activities(payload: dict, user: dict = Depends(require("admin"))):
    items = payload.get("items")
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="items is required")
    church_content.save_activities(items)
    activity_logs.log_activity(user["id"], "updated", "Church", "Updated activities")
    return {"message": "Saved"}


@router.put("/church-content/logo")
def save_logo(payload: dict, user: dict = Depends(require("admin"))):
    # Logo stored as a base64 data URI string.
    church_content.save_church_logo(payload.get("value", ""))
    activity_logs.log_activity(user["id"], "updated", "Church", "Updated logo")
    return {"message": "Saved"}


@router.put("/church-content/social")
def save_social(payload: dict, user: dict = Depends(require("admin"))):
    # Social links stored as a key/value dict (e.g. facebook, twitter, youtube).
    church_content.save_social(payload.get("value", {}))
    activity_logs.log_activity(user["id"], "updated", "Church", "Updated social media links")
    return {"message": "Saved"}
