import json

from database import get_connection

DEFAULT_ROLES = ["Member"]


def get_ministry_roles(ministry):
    # Decode the JSON role list stored on a ministry; falls back to the default
    # role when the column is missing, empty or corrupt.
    raw = ministry.get("roles") if isinstance(ministry, dict) else getattr(ministry, "get", lambda k, d=None: d)("roles")
    if raw:
        try:
            parsed = json.loads(raw)
            if parsed:
                return parsed
        except Exception:
            pass
    return ["Member"]


def get_all_ministries():
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Subquery counts members per ministry for the list view.
        cur.execute("""
            SELECT m.*, u.full_name as leader_name,
                   (SELECT COUNT(*) FROM ministry_members mm WHERE mm.ministry_id = m.id) as member_count
            FROM ministries m
            LEFT JOIN users u ON m.leader_id = u.id
            ORDER BY m.name
        """)
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def get_ministry(ministry_id):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT m.*, u.full_name as leader_name
            FROM ministries m
            LEFT JOIN users u ON m.leader_id = u.id
            WHERE m.id = %s
        """, (ministry_id,))
        result = cur.fetchone()
        conn.close()
        return result
    except Exception:
        return None


def get_ministry_members(ministry_id):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Members sorted by their role within the ministry, then by name.
        cur.execute("""
            SELECT mm.*, u.full_name, u.email, u.phone, mm.role as ministry_role
            FROM ministry_members mm
            JOIN users u ON mm.member_id = u.id
            WHERE mm.ministry_id = %s
            ORDER BY mm.role, u.full_name
        """, (ministry_id,))
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def create_ministry(name, description, leader_id=None, roles=None):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Roles are serialized to a JSON string before storage.
        roles_json = json.dumps(roles) if roles else "[]"
        try:
            cur.execute(
                "INSERT INTO ministries (name, description, leader_id, roles) VALUES (%s, %s, %s, %s)",
                (name, description, leader_id, roles_json),
            )
        except Exception:
            # Fallback for old DBs that lack the roles column.
            cur.execute(
                "INSERT INTO ministries (name, description, leader_id) VALUES (%s, %s, %s)",
                (name, description, leader_id),
            )
        result = cur.lastrowid
        conn.close()
        return result
    except Exception:
        return None


def update_ministry(ministry_id, name, description, leader_id=None, roles=None):
    try:
        conn = get_connection()
        cur = conn.cursor()
        roles_json = json.dumps(roles) if roles else None
        try:
            if roles_json:
                cur.execute(
                    "UPDATE ministries SET name=%s, description=%s, leader_id=%s, roles=%s WHERE id=%s",
                    (name, description, leader_id, roles_json, ministry_id),
                )
            else:
                cur.execute(
                    "UPDATE ministries SET name=%s, description=%s, leader_id=%s WHERE id=%s",
                    (name, description, leader_id, ministry_id),
                )
        except Exception:
            # Legacy schema without roles column.
            cur.execute(
                "UPDATE ministries SET name=%s, description=%s, leader_id=%s WHERE id=%s",
                (name, description, leader_id, ministry_id),
            )
        conn.close()
    except Exception:
        pass


def set_ministry_leader(ministry_id, leader_id):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE ministries SET leader_id=%s WHERE id=%s",
            (leader_id, ministry_id),
        )
        conn.close()
    except Exception:
        pass


def delete_ministry(ministry_id):
    # Cascades to ministry_members and ministry_pictures via FKs.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM ministries WHERE id=%s", (ministry_id,))
        conn.close()
    except Exception:
        pass


def add_member_to_ministry(ministry_id, member_id, role="Member"):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # INSERT IGNORE: re-adding an existing member is a no-op, not an error.
        cur.execute(
            "INSERT IGNORE INTO ministry_members (ministry_id, member_id, role) VALUES (%s, %s, %s)",
            (ministry_id, member_id, role),
        )
        if role == "Leader":
            # Promoting someone to Leader also makes them the ministry leader.
            cur.execute(
                "UPDATE ministries SET leader_id=%s WHERE id=%s",
                (member_id, ministry_id),
            )
        conn.close()
    except Exception:
        pass


def remove_member_from_ministry(ministry_id, member_id):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM ministry_members WHERE ministry_id=%s AND member_id=%s",
            (ministry_id, member_id),
        )
        # If the removed member was the leader, clear the leadership too.
        cur.execute(
            "UPDATE ministries SET leader_id=NULL WHERE id=%s AND leader_id=%s",
            (ministry_id, member_id),
        )
        conn.close()
    except Exception:
        pass


def update_member_role(ministry_id, member_id, role):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE ministry_members SET role=%s WHERE ministry_id=%s AND member_id=%s",
            (role, ministry_id, member_id),
        )
        conn.close()
    except Exception:
        pass


def get_user_ministries(user_id):
    # Ministries the user belongs to, including their role in each.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT m.*, mm.role as ministry_role
            FROM ministry_members mm
            JOIN ministries m ON mm.ministry_id = m.id
            WHERE mm.member_id = %s
            ORDER BY m.name
        """, (user_id,))
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def get_user_ministry_ids(user_id):
    # Set of ministry IDs the user belongs to, for quick membership checks.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT ministry_id FROM ministry_members WHERE member_id = %s", (user_id,))
        result = {row["ministry_id"] for row in cur.fetchall()}
        conn.close()
        return result
    except Exception:
        return set()


def get_user_ministry_role(user_id, ministry_id):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT role FROM ministry_members WHERE ministry_id = %s AND member_id = %s",
            (ministry_id, user_id),
        )
        row = cur.fetchone()
        conn.close()
        return (row or {}).get("role")
    except Exception:
        return None


def is_ministry_manager(user_id, ministry_id):
    # Business rule: only a member with the "secretary" role manages a ministry
    # (used to gate ministry-level admin actions).
    role = get_user_ministry_role(user_id, ministry_id)
    return bool(role and role.strip().lower() == "secretary")


def get_ministry_events(ministry_id):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT e.*, u.full_name as creator_name
            FROM events e
            JOIN users u ON e.created_by = u.id
            WHERE e.ministry_id = %s
            ORDER BY e.event_date DESC
        """, (ministry_id,))
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def create_ministry_event(ministry_id, title, description, event_date, location, created_by, end_date=None, image=None):
    # Delegates to the shared event creation, binding the event to this ministry.
    from events import create_event
    return create_event(
        title, description, event_date, location, created_by,
        end_date=end_date, ministry_id=ministry_id, image=image,
    )


def get_ministry_pictures(ministry_id):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT p.*, u.full_name as uploader_name
            FROM ministry_pictures p
            LEFT JOIN users u ON p.created_by = u.id
            WHERE p.ministry_id = %s
            ORDER BY p.id DESC
        """, (ministry_id,))
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def add_ministry_picture(ministry_id, image, caption, created_by):
    # image is stored as a base64 data string (LONGTEXT).
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO ministry_pictures (ministry_id, image, caption, created_by) VALUES (%s, %s, %s, %s)",
            (ministry_id, image, caption, created_by),
        )
        result = cur.lastrowid
        conn.close()
        return result
    except Exception:
        return None


def delete_ministry_picture(picture_id):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM ministry_pictures WHERE id = %s", (picture_id,))
        conn.close()
        return True
    except Exception:
        return False
