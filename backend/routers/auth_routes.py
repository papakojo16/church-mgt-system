from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request

from auth import (
    authenticate_user,
    change_password,
    create_access_token,
    create_refresh_token,
    create_user,
    get_user,
    get_user_by_id,
    get_user_by_username,
    get_member,
    hash_password,
    update_user,
    rotate_refresh_token,
    revoke_refresh_token,
    revoke_user_refresh_tokens,
)
from config import MIN_PASSWORD_LENGTH
from deps import get_current_user, require
from ratelimit import login_limiter, register_limiter, client_ip
from utils import strip_sensitive, role_display_name
import activity_logs

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Human-friendly role names mapped to their canonical internal role,
# so clients can send e.g. "rev", "treasurer" or "finance officer".
ROLE_ALIASES = {
    "member": "member",
    "pastor": "pastor",
    "reverend": "pastor",
    "rev": "pastor",
    "finance": "finance",
    "finance_officer": "finance",
    "finance officer": "finance",
    "treasurer": "finance",
    "admin": "admin",
    "steward": "admin",
}
# Roles a visitor may grant themselves via self-registration (members only).
SELF_REGISTER_ROLES = ("member",)
# Roles allowed for accounts created by an admin via /create-staff.
STAFF_ROLES = ("pastor", "finance", "admin")


@router.post("/login")
def login(payload: dict, request: Request):
    # Rate-limit login attempts per IP; reset the counter on success so a
    # legitimate user is not penalised for an earlier typo.
    login_limiter.check(client_ip(request))
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required")
    user = authenticate_user(username, password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    login_limiter.reset(client_ip(request))
    # Return short-lived access token + long-lived (rotating) refresh token,
    # plus the safe (sensitive fields stripped) user record.
    safe = strip_sensitive(dict(user))
    safe["role_display"] = role_display_name(user["role"])
    return {
        "token": create_access_token(user),
        "refresh_token": create_refresh_token(user),
        "user": safe,
    }


@router.post("/register")
def register(payload: dict, request: Request):
    # Public self-registration endpoint; rate-limited per IP to prevent spam.
    register_limiter.check(client_ip(request))
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    full_name = (payload.get("full_name") or "").strip()
    email = (payload.get("email") or "").strip()
    phone = (payload.get("phone") or "").strip()
    if not username or not password or not full_name:
        raise HTTPException(status_code=400, detail="Username, password and full name are required")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    role = ROLE_ALIASES.get((payload.get("role") or "member").strip().lower())
    # Security guard: a visitor can never register as staff/admin, even if they
    # request a higher role in the payload — force them to "member".
    if role not in SELF_REGISTER_ROLES:
        raise HTTPException(status_code=403, detail="Self-registration is limited to Member accounts.")
    # Consent to the privacy policy is mandatory to create an account.
    if not bool(payload.get("consent")):
        raise HTTPException(status_code=400, detail="You must accept the Privacy Policy to register.")
    user_id = create_user(
        username, password, full_name, email=email, phone=phone, role=role,
        consent_given=True, consent_date=datetime.utcnow(),
    )
    if not user_id:
        raise HTTPException(status_code=400, detail="Username already exists")
    activity_logs.log_activity(user_id, "registered", "Auth", f"Created new {role} account")
    user = get_user(user_id)
    safe = strip_sensitive(dict(user))
    safe["role_display"] = role_display_name(user["role"])
    # Auto-login after registration: sign the token immediately and return it.
    return {
        "token": create_access_token(user),
        "refresh_token": create_refresh_token(user),
        "user": safe,
    }


@router.post("/create-staff")
def create_staff(payload: dict, user: dict = Depends(require("admin"))):
    # Admin-only: creates a staff (Reverend/Finance/Admin) account. Unlike the
    # member list, this is scoped to privileged roles only.
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    full_name = (payload.get("full_name") or "").strip()
    email = (payload.get("email") or "").strip()
    phone = (payload.get("phone") or "").strip()
    if not username or not password or not full_name:
        raise HTTPException(status_code=400, detail="Username, password and full name are required")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    role = ROLE_ALIASES.get((payload.get("role") or "").strip().lower())
    # Reject any role outside the staff set so an admin cannot make a member here.
    if role not in STAFF_ROLES:
        raise HTTPException(
            status_code=400,
            detail="Role must be one of: Reverend, Finance Officer or Admin.",
        )
    user_id = create_user(
        username, password, full_name,
        email=email, phone=phone, role=role,
        must_change_password=payload.get("must_change_password", False),
    )
    if not user_id:
        raise HTTPException(status_code=400, detail="Username already exists")
    activity_logs.log_activity(user["id"], "created", "Auth", f"Created {role} account for {full_name}")
    # Echo the must_change_password flag so the client knows to prompt for a reset.
    return {"id": user_id, "must_change_password": bool(payload.get("must_change_password", False))}


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    # Return the authenticated user's own profile plus linked member record.
    safe = strip_sensitive(dict(user))
    safe["role_display"] = role_display_name(user["role"])
    m = get_member(user["id"])
    safe["member"] = strip_sensitive(dict(m)) if m else {}
    return safe


@router.put("/me")
def update_own_profile(payload: dict, user: dict = Depends(get_current_user)):
    # Users edit only their own safe account fields (allowed) and member profile
    # fields; everything else in the payload is silently ignored.
    allowed = {"full_name", "username", "email", "phone"}
    account_fields = {k: v for k, v in payload.items() if k in allowed}
    member_fields = {"address", "date_of_birth", "gender", "family_name", "baptism_date", "membership_date"}
    profile_fields = {k: v for k, v in payload.items() if k in member_fields}

    # Privilege escalation guard: role/status changes require admin, never here.
    if "role" in payload or "is_active" in payload:
        raise HTTPException(status_code=400, detail="Role and account status cannot be changed here")

    # Username is unique; if changing it, ensure no other user already owns it.
    if "username" in account_fields and account_fields["username"]:
        if account_fields["username"].strip() != (user.get("username") or ""):
            other = get_user_by_username(account_fields["username"].strip())
            if other and other["id"] != user["id"]:
                raise HTTPException(status_code=400, detail="Username already exists")
        account_fields["username"] = account_fields["username"].strip()

    update_user(user["id"], **{**account_fields, **profile_fields})
    activity_logs.log_activity(user["id"], "updated", "Auth", "Updated own profile")
    return {"message": "Profile updated"}


@router.post("/change-password")
def change_password_route(payload: dict, user: dict = Depends(get_current_user)):
    # Verify the user's current password before allowing the change (no token resets here).
    current_password = payload.get("current_password") or ""
    new_password = payload.get("new_password") or ""
    if len(new_password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    ok, msg = change_password(user["id"], current_password, new_password)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    # Invalidate every session for this user so a stolen token can't linger.
    revoke_user_refresh_tokens(user["id"])
    activity_logs.log_activity(user["id"], "updated", "Auth", "Changed password")
    return {"message": msg}


@router.post("/refresh")
def refresh(payload: dict):
    # Exchange a valid refresh token for a fresh access+refresh pair (rotation).
    # No auth dependency: the caller only has a refresh token at this point.
    refresh_token = payload.get("refresh_token") or ""
    if not refresh_token:
        raise HTTPException(status_code=400, detail="refresh_token is required")
    result = rotate_refresh_token(refresh_token)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    return result


@router.post("/logout")
def logout(payload: dict = None, user: dict = Depends(get_current_user)):
    # Revoke the presented refresh token so the session can't be resumed. The
    # access token is stateless and simply expires; clearing it is client-side.
    if payload:
        refresh_token = payload.get("refresh_token")
        if refresh_token:
            revoke_refresh_token(refresh_token)
    return {"message": "Logged out"}
