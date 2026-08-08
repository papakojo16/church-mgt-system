from database import get_connection


def create_announcement(title, content, author_id, priority="Normal", date_expires=None, bible_reading=None, preacher=None):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # bible_reading/preacher are optional extras shown on the announcement.
        cur.execute(
            "INSERT INTO announcements (title, content, author_id, priority, date_expires, bible_reading, preacher) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (title, content, author_id, priority, date_expires, bible_reading, preacher),
        )
        result = cur.lastrowid
        conn.close()
        return result
    except Exception:
        return None


def get_announcements(active_only=True):
    try:
        conn = get_connection()
        cur = conn.cursor()
        query = """
            SELECT a.*, u.full_name as author_name
            FROM announcements a
            JOIN users u ON a.author_id = u.id
        """
        params = []
        if active_only:
            # Hide expired announcements; NULL expiry means it never expires.
            query += " WHERE a.is_active = TRUE AND (a.date_expires IS NULL OR a.date_expires >= CURDATE())"
        # FIELD() sorts by priority weight: Urgent first, then High, Normal, Low.
        query += " ORDER BY FIELD(a.priority, 'Urgent','High','Normal','Low'), a.date_created DESC"
        cur.execute(query, params)
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def get_all_announcements():
    # Admin view: includes inactive and expired announcements.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT a.*, u.full_name as author_name
            FROM announcements a
            JOIN users u ON a.author_id = u.id
            ORDER BY a.date_created DESC
        """)
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def update_announcement(announcement_id, **kwargs):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Whitelist columns so callers can't touch e.g. author_id.
        allowed = {"title", "content", "priority", "is_active", "date_expires", "bible_reading", "preacher"}
        fields = {k: v for k, v in kwargs.items() if k in allowed}
        if not fields:
            return
        set_clause = ", ".join(f"{k} = %s" for k in fields)
        vals = list(fields.values()) + [announcement_id]
        cur.execute(f"UPDATE announcements SET {set_clause} WHERE id = %s", vals)
        conn.close()
    except Exception:
        pass


def delete_announcement(announcement_id):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM announcements WHERE id = %s", (announcement_id,))
        conn.close()
    except Exception:
        pass
