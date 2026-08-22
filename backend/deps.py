from fastapi import Depends, Header, HTTPException

from auth import decode_token, get_user_by_id
from config import JWT_SECRET


def get_current_user(authorization: str = Header(default="")):
    # FastAPI dependency: resolves the authenticated user from the
    # Authorization header on every protected endpoint.
    token = ""
    if authorization.lower().startswith("bearer "):
        # Strip the "Bearer " prefix (case-insensitive) to get the raw JWT.
        token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token, expected_type="access")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = get_user_by_id(payload.get("sub"))
    # Re-check the DB on each request so deactivated users lose access
    # immediately rather than waiting for their token to expire.
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require(*roles):
    # Returns a dependency that enforces role-based access: the current user's
    # role must be in the allowed set or a 403 is raised.
    def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker
