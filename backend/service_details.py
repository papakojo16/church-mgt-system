from database import get_connection


def create_service_detail(service_date, preacher, bible_reading, created_by):
    # Records the preacher + bible reading planned for a given service date.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO service_details (service_date, preacher, bible_reading, created_by) VALUES (%s,%s,%s,%s)",
            (service_date, preacher, bible_reading, created_by),
        )
        result = cur.lastrowid
        conn.close()
        return result
    except Exception:
        return None


def get_service_details():
    # Full history, newest service date first (tie-broken by newest record).
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT s.*, u.full_name as created_by_name
            FROM service_details s
            JOIN users u ON s.created_by = u.id
            ORDER BY s.service_date DESC, s.id DESC
        """)
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def update_service_detail(service_detail_id, **kwargs):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Whitelist so the author (created_by) cannot be rewritten.
        allowed = {"service_date", "preacher", "bible_reading"}
        fields = {k: v for k, v in kwargs.items() if k in allowed}
        if not fields:
            return
        set_clause = ", ".join(f"{k} = %s" for k in fields)
        vals = list(fields.values()) + [service_detail_id]
        cur.execute(f"UPDATE service_details SET {set_clause} WHERE id = %s", vals)
        conn.close()
    except Exception:
        pass


def delete_service_detail(service_detail_id):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM service_details WHERE id = %s", (service_detail_id,))
        conn.close()
    except Exception:
        pass
