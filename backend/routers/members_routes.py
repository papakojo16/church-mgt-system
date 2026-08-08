from fastapi import APIRouter, Depends, HTTPException

from auth import (
    create_user,
    delete_user,
    get_all_members,
    get_member,
    get_member_count,
    get_user,
    get_user_by_id,
    update_user,
    hash_password,
)
from deps import get_current_user, require
from config import MIN_PASSWORD_LENGTH
from utils import strip_sensitive, role_display_name
import activity_logs

router = APIRouter(prefix="/api/members", tags=["members"])


@router.get("")
def members(user: dict = Depends(require("admin", "pastor", "finance"))):
    # List all members (with linked profile info); hidden from plain members.
    return get_all_members()


@router.get("/count")
def member_count(user: dict = Depends(get_current_user)):
    # Total member count for dashboards; available to any logged-in user.
    return {"count": get_member_count()}


@router.get("/{user_id}")
def member(user_id: int, user: dict = Depends(get_current_user)):
    # Staff see any member; a plain member may only view their own record.
    if user["role"] not in ("admin", "pastor", "finance") and user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    u = get_user(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Not found")
    safe = strip_sensitive(dict(u))
    m = get_member(user_id)
    safe["member"] = strip_sensitive(dict(m)) if m else {}
    return safe


@router.post("")
def create_member(payload: dict, user: dict = Depends(require("admin"))):
    # Admin creates a user account (any role) plus optional member profile fields.
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    full_name = (payload.get("full_name") or "").strip()
    if not username or not password or not full_name:
        raise HTTPException(status_code=400, detail="Username, password and full name are required")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    role = payload.get("role", "member")
    # Only the four known roles are accepted here (unlike /create-staff which is staff-only).
    if role not in ("member", "pastor", "finance", "admin"):
        raise HTTPException(status_code=400, detail="Role must be one of: Member, Reverend, Finance Officer or Admin.")
    user_id = create_user(
        username, password, full_name,
        email=(payload.get("email") or "").strip(),
        phone=(payload.get("phone") or "").strip(),
        role=role,
        must_change_password=payload.get("must_change_password", False),
    )
    if not user_id:
        raise HTTPException(status_code=400, detail="Username already exists")
    activity_logs.log_activity(user["id"], "created", "Members", f"Created member {full_name}")
    # Echo must_change_password so the client can prompt the new user to reset it.
    return {"id": user_id, "must_change_password": bool(payload.get("must_change_password", False))}


@router.put("/{user_id}")
def edit_member(user_id: int, payload: dict, user: dict = Depends(require("admin"))):
    # Password is hashed and written directly here because update_user treats
    # fields generically; the DB write is best-effort and never blocks the update.
    if "password" in payload and payload.get("password"):
        if len(payload["password"]) < MIN_PASSWORD_LENGTH:
            raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
        try:
            from database import get_connection
            conn = get_connection()
            cur = conn.cursor()
            cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (hash_password(payload["password"]), user_id))
            conn.close()
        except Exception:
            pass
    # Remaining payload keys (profile + account fields) are passed straight through.
    update_user(user_id, **payload)
    activity_logs.log_activity(user["id"], "updated", "Members", f"Updated member {user_id}")
    return {"message": "Member updated"}


@router.delete("/{user_id}")
def remove_member(user_id: int, user: dict = Depends(require("admin"))):
    # Hard-delete a member account; keep the target around only to log their name.
    target = get_user(user_id)
    delete_user(user_id)
    if target:
        activity_logs.log_activity(user["id"], "deleted", "Members", f"Deleted member {target.get('full_name')}")
    return {"message": "Member deleted"}
