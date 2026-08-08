from fastapi import APIRouter, Depends, HTTPException

import activity_logs
from deps import require
from theme import ALL_COLORS, get_default_theme_name, set_default_theme

router = APIRouter(prefix="/api", tags=["admin"])


@router.get("/activity-logs")
def logs(limit: int = 100, category: str = None, user: dict = Depends(require("admin"))):
    # Admin-only audit trail of all recorded activity, filterable by category.
    return activity_logs.get_activity_logs(limit=limit, category=category)


@router.get("/activity-categories")
def log_categories(user: dict = Depends(require("admin"))):
    # Distinct categories used in the activity log, for filter dropdowns.
    return activity_logs.get_activity_categories()


@router.get("/theme/colors")
def theme_colors(user: dict = Depends(require("admin", "pastor", "finance", "member"))):
    # Theme palette + the current default, visible to every logged-in user.
    return {"colors": ALL_COLORS, "default": get_default_theme_name()}


@router.put("/theme/default")
def theme_default(payload: dict, user: dict = Depends(require("admin"))):
    # Change the site-wide default theme; name must be one of the known colors.
    name = payload.get("name")
    if not any(c["name"] == name for c in ALL_COLORS):
        raise HTTPException(status_code=400, detail="Unknown theme color")
    set_default_theme(name)
    activity_logs.log_activity(user["id"], "updated", "Theme", f"Set default theme to {name}")
    return {"message": "Default theme saved", "default": name}
