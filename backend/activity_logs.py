from database import get_connection


def log_activity(user_id, action, category, details=""):
    # Best-effort audit log: never raises, so a logging failure cannot break
    # the main operation being recorded.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO activity_logs (user_id, action, category, details) VALUES (%s, %s, %s, %s)",
            (user_id, action, category, details),
        )
        conn.close()
    except Exception:
        pass


def get_activity_logs(limit=100, category=None):
    try:
        conn = get_connection()
        cur = conn.cursor()
        query = """
            SELECT al.*, u.full_name as user_name
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
        """
        params = []
        # Optional filter by category; "All" is treated as no filter.
        if category and category != "All":
            query += " WHERE al.category = %s"
            params.append(category)
        query += " ORDER BY al.created_at DESC LIMIT %s"
        params.append(limit)
        cur.execute(query, params)
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def get_activity_categories():
    # Distinct categories used to populate the admin log-filter dropdown.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT category FROM activity_logs ORDER BY category")
        result = [r["category"] for r in cur.fetchall()]
        conn.close()
        return result
    except Exception:
        return []


def clear_old_logs(days=90):
    # Housekeeping: purge logs older than `days` to keep the table small.
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL %s DAY)",
            (days,),
        )
        return cur.rowcount
    finally:
        conn.close()
