from datetime import datetime

from database import get_connection


def _parse_time(value):
    # "HH:MM" -> a datetime on the 2099 placeholder date, carrying only the time.
    if not value:
        return None
    try:
        parts = str(value).split(":")
        return datetime(2099, 1, 1, int(parts[0]), int(parts[1]))
    except (ValueError, IndexError):
        return None


def create_event(title, description, event_date, location, created_by, end_date=None, ministry_id=None, image=None):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Build the INSERT from which optional columns are present so NULLs
        # aren't written where the caller didn't intend them.
        if ministry_id:
            cur.execute(
                "INSERT INTO events (title, description, event_date, end_date, location, image, created_by, ministry_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (title, description, event_date, end_date, location, image, created_by, ministry_id),
            )
        elif end_date:
            cur.execute(
                "INSERT INTO events (title, description, event_date, end_date, location, image, created_by) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                (title, description, event_date, end_date, location, image, created_by),
            )
        else:
            cur.execute(
                "INSERT INTO events (title, description, event_date, location, image, created_by) VALUES (%s,%s,%s,%s,%s,%s)",
                (title, description, event_date, location, image, created_by),
            )
        result = cur.lastrowid
        conn.close()
        return result
    except Exception:
        return None


def create_recurring_event(title, description, day_of_week, location, created_by, start_time=None, end_time=None, image=None):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Recurring events get a far-future placeholder date (2099-01-01) so the
        # normal upcoming-event queries include them; the real schedule is in
        # recurrence_rule (e.g. the weekday name) plus the start/end times on the
        # placeholder datetimes.
        event_date = _parse_time(start_time) or datetime(2099, 1, 1)
        end_date = _parse_time(end_time)
        cur.execute(
            "INSERT INTO events (title, description, event_date, end_date, location, image, created_by, is_recurring, recurrence_rule) VALUES (%s,%s,%s,%s,%s,%s,%s,TRUE,%s)",
            (title, description, event_date, end_date, location, image, created_by, day_of_week),
        )
        result = cur.lastrowid
        conn.close()
        return result
    except Exception:
        return None


def create_multi_day_event(title, description, start_date, end_date, location, created_by, image=None):
    # One event spanning several days; end_date marks the final day.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO events (title, description, event_date, end_date, location, image, created_by) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (title, description, start_date, end_date, location, image, created_by),
        )
        result = cur.lastrowid
        conn.close()
        return result
    except Exception:
        return None


def get_upcoming_events(limit=10):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Only events that have not started yet, nearest first.
        cur.execute("""
            SELECT e.*, u.full_name as creator_name
            FROM events e
            JOIN users u ON e.created_by = u.id
            WHERE e.event_date >= NOW()
            ORDER BY e.event_date ASC
            LIMIT %s
        """, (limit,))
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def get_all_events():
    # Full list (past and future) for the calendar/management view.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT e.*, u.full_name as creator_name
            FROM events e
            JOIN users u ON e.created_by = u.id
            ORDER BY e.event_date DESC
        """)
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def update_event(event_id, **kwargs):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Whitelist columns so callers can't rewrite created_by/ministry_id.
        allowed = {"title", "description", "event_date", "end_date", "location", "image", "is_recurring", "recurrence_rule"}
        fields = {k: v for k, v in kwargs.items() if k in allowed}
        # The recurring edit form sends day_of_week + start/end times; map them
        # onto the stored recurrence_rule and placeholder datetimes.
        if "day_of_week" in kwargs:
            fields["recurrence_rule"] = kwargs["day_of_week"]
        if "start_time" in kwargs:
            fields["event_date"] = _parse_time(kwargs["start_time"]) or datetime(2099, 1, 1)
        if "end_time" in kwargs:
            fields["end_date"] = _parse_time(kwargs["end_time"])
        if not fields:
            return
        set_clause = ", ".join(f"{k} = %s" for k in fields)
        vals = list(fields.values()) + [event_id]
        cur.execute(f"UPDATE events SET {set_clause} WHERE id = %s", vals)
        conn.close()
    except Exception:
        pass


def record_attendance(member_id, event_id, service_date, status="Present"):
    # One attendance row per member per event/service; status defaults to Present.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO attendance (member_id, event_id, service_date, status) VALUES (%s,%s,%s,%s)",
            (member_id, event_id, service_date, status),
        )
        result = cur.lastrowid
        conn.close()
        return result
    except Exception:
        return None


def get_attendance_summary(event_id=None, start_date=None, end_date=None):
    # Counts attendance rows grouped by status (Present/Absent/...), optionally
    # scoped to a single event or a date range.
    try:
        conn = get_connection()
        cur = conn.cursor()
        query = """
            SELECT a.status, COUNT(*) as count
            FROM attendance a
            WHERE 1=1
        """
        params = []
        if event_id:
            query += " AND a.event_id = %s"
            params.append(event_id)
        if start_date:
            query += " AND a.service_date >= %s"
            params.append(start_date)
        if end_date:
            query += " AND a.service_date <= %s"
            params.append(end_date)
        query += " GROUP BY a.status"
        cur.execute(query, params)
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def delete_event(event_id):
    # Deleting an event cascades to its attendance rows via the FK.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM events WHERE id = %s", (event_id,))
        conn.close()
    except Exception:
        pass
