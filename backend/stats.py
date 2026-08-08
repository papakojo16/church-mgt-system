from database import get_connection


def upsert_weekly_attendance(service_date, adult_male, adult_female, child_male, child_female, note, recorded_by):
    # One aggregate attendance row per service date. The unique key on
    # service_date turns re-recording the same week into an update.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO weekly_attendance (service_date, adult_male, adult_female, child_male, child_female, note, recorded_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE adult_male=%s, adult_female=%s, child_male=%s, child_female=%s, note=%s, recorded_by=%s
        """, (service_date, adult_male, adult_female, child_male, child_female, note, recorded_by,
              adult_male, adult_female, child_male, child_female, note, recorded_by))
        conn.close()
    except Exception:
        pass


def get_all_weekly_attendance():
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Most recent service dates first, with who recorded each row.
        cur.execute("""
            SELECT w.*, u.full_name as recorded_by_name
            FROM weekly_attendance w
            LEFT JOIN users u ON w.recorded_by = u.id
            ORDER BY w.service_date DESC
        """)
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def get_attendance_chart_data():
    # Up to a year (52 weeks) of attendance in date order for the trend chart.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT service_date, adult_male, adult_female, child_male, child_female
            FROM weekly_attendance
            ORDER BY service_date ASC
            LIMIT 52
        """)
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def delete_weekly_attendance(record_id):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM weekly_attendance WHERE id=%s", (record_id,))
        conn.close()
    except Exception:
        pass
