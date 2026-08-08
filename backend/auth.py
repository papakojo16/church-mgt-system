import bcrypt
import jwt
from datetime import datetime, timedelta

from database import get_connection
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_MINUTES


def hash_password(password: str) -> str:
    # bcrypt hashes are salted automatically by gensalt(); stored as UTF-8 text.
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    if not password or not hashed:
        return False
    try:
        # checkpw compares and returns False on mismatch without raising.
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        # Corrupt/foreign hash (e.g. legacy data) must never crash auth.
        return False


def create_token(user):
    # Stateless JWT: the server trusts the signed claims (id, username, role)
    # until expiry, so no server-side session storage is needed.
    payload = {
        "sub": str(user["id"]),
        "username": user["username"],
        "role": user["role"],
        "exp": datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token):
    # Returns None on invalid signature or expiry; callers treat None as 401.
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        return None


def create_user(username, password, full_name, email="", phone="", role="member", must_change_password=False):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Password is hashed before storage; the plaintext is never persisted.
        cur.execute(
            "INSERT INTO users (username, password_hash, full_name, email, phone, role, must_change_password) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (username, hash_password(password), full_name, email, phone, role, bool(must_change_password)),
        )
        user_id = cur.lastrowid
        # Every user also gets a matching row in the members profile table;
        # gender is defaulted since it is required there but optional at signup.
        cur.execute(
            "INSERT INTO members (user_id, gender) VALUES (%s, %s)",
            (user_id, "Male"),
        )
        conn.close()
        return user_id
    except Exception:
        return None


def authenticate_user(username: str, password: str):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Inactive accounts (is_active = FALSE) are blocked at login.
        cur.execute("SELECT * FROM users WHERE username = %s AND is_active = TRUE", (username,))
        user = cur.fetchone()
        conn.close()
        if user and verify_password(password, user["password_hash"]):
            return user
        return None
    except Exception:
        return None


def get_user_by_id(user_id: int):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        conn.close()
        return user
    except Exception:
        return None


def get_user_by_username(username: str):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE username = %s", (username,))
        user = cur.fetchone()
        conn.close()
        return user
    except Exception:
        return None


def get_all_members():
    try:
        conn = get_connection()
        cur = conn.cursor()
        # LEFT JOIN keeps users that have no members-profile row.
        cur.execute("""
            SELECT u.id, u.username, u.full_name, u.email, u.phone, u.role, u.date_joined, u.is_active,
                   m.gender, m.date_of_birth, m.address, m.family_name, m.baptism_date, m.membership_date
            FROM users u
            LEFT JOIN members m ON u.id = m.user_id
            ORDER BY u.full_name
        """)
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def get_member_count():
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Only active users count as current members.
        cur.execute("SELECT COUNT(*) as cnt FROM users WHERE is_active = TRUE")
        result = cur.fetchone()["cnt"]
        conn.close()
        return result
    except Exception:
        return 0


def update_user(user_id, **kwargs):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Whitelist columns to prevent arbitrary field injection via kwargs.
        allowed = {"full_name", "email", "phone", "username", "role", "is_active"}
        fields = {k: v for k, v in kwargs.items() if k in allowed}
        if fields:
            set_clause = ", ".join(f"{k} = %s" for k in fields)
            vals = list(fields.values()) + [user_id]
            cur.execute(f"UPDATE users SET {set_clause} WHERE id = %s", vals)

        # Profile columns live in the members table; update those too.
        member_fields = {"address", "date_of_birth", "gender", "family_name", "baptism_date", "membership_date"}
        m_fields = {k: v for k, v in kwargs.items() if k in member_fields}
        if m_fields:
            m_set = ", ".join(f"{k} = %s" for k in m_fields)
            m_vals = list(m_fields.values()) + [user_id]
            cur.execute(f"UPDATE members SET {m_set} WHERE user_id = %s", m_vals)
        conn.close()
    except Exception:
        pass


def delete_user(user_id):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Hard delete; child rows cascade (members etc. use ON DELETE CASCADE).
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.close()
    except Exception:
        pass


def deactivate_user(user_id):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Soft-disable instead of deleting, preserving financial/history links.
        cur.execute("UPDATE users SET is_active = FALSE WHERE id = %s", (user_id,))
        conn.close()
    except Exception:
        pass


def get_user(user_id):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        conn.close()
        return user
    except Exception:
        return None


def get_member(user_id):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM members WHERE user_id = %s", (user_id,))
        result = cur.fetchone()
        conn.close()
        return result
    except Exception:
        return None


def update_member_profile(user_id, **kwargs):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Whitelist keeps callers from overwriting arbitrary member columns.
        allowed = {"address", "date_of_birth", "gender", "family_name", "baptism_date", "membership_date", "profile_photo"}
        fields = {k: v for k, v in kwargs.items() if k in allowed}
        if fields:
            set_clause = ", ".join(f"{k} = %s" for k in fields)
            vals = list(fields.values()) + [user_id]
            cur.execute(f"UPDATE members SET {set_clause} WHERE user_id = %s", vals)
        conn.close()
    except Exception:
        pass


def change_password(user_id, current_password, new_password):
    # Requires the current password to be verified before allowing the change;
    # also clears the must_change_password flag set for first-login flows.
    user = get_user(user_id)
    if not user:
        return False, "User not found"
    if not verify_password(current_password, user["password_hash"]):
        return False, "Current password is incorrect"
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET password_hash = %s, must_change_password = FALSE WHERE id = %s",
            (hash_password(new_password), user_id),
        )
        conn.close()
        return True, "Password changed successfully"
    except Exception:
        return False, "Failed to change password"
