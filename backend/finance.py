from datetime import datetime, date, timedelta

from database import get_connection
from activity_logs import log_activity


def record_donation(member_id, amount, category="Tithe", payment_method="Cash", reference="", notes="", donation_date=None):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # donation_date defaults to DB CURRENT_TIMESTAMP unless provided (for
        # back-dating historical entries).
        if donation_date:
            cur.execute(
                "INSERT INTO donations (member_id, amount, category, payment_method, reference, notes, donation_date) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                (member_id, amount, category, payment_method, reference, notes, donation_date),
            )
        else:
            cur.execute(
                "INSERT INTO donations (member_id, amount, category, payment_method, reference, notes) VALUES (%s,%s,%s,%s,%s,%s)",
                (member_id, amount, category, payment_method, reference, notes),
            )
        result = cur.lastrowid
        conn.close()
        return result
    except Exception:
        return None


def get_donations(start_date=None, end_date=None, category=None, member_id=None):
    try:
        conn = get_connection()
        cur = conn.cursor()
        query = """
            SELECT d.*, COALESCE(u.full_name, 'All Members') as donor_name
            FROM donations d
            LEFT JOIN users u ON d.member_id = u.id
            WHERE 1=1
        """
        params = []
        # Each optional filter appends a parameterized clause; COALESCE names
        # anonymous (NULL member_id) donations "All Members".
        if start_date:
            query += " AND d.donation_date >= %s"
            params.append(start_date)
        if end_date:
            query += " AND d.donation_date <= %s"
            params.append(end_date)
        if category:
            query += " AND d.category = %s"
            params.append(category)
        if member_id is not None:
            query += " AND d.member_id = %s"
            params.append(member_id)
        query += " ORDER BY d.donation_date DESC"
        cur.execute(query, params)
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def record_expense(amount, category, description="", approved_by=None, receipt="", expense_date=None):
    try:
        conn = get_connection()
        cur = conn.cursor()
        if expense_date:
            cur.execute(
                "INSERT INTO expenses (amount, category, description, approved_by, receipt, expense_date) VALUES (%s,%s,%s,%s,%s,%s)",
                (amount, category, description, approved_by, receipt, expense_date),
            )
        else:
            cur.execute(
                "INSERT INTO expenses (amount, category, description, approved_by, receipt) VALUES (%s,%s,%s,%s,%s)",
                (amount, category, description, approved_by, receipt),
            )
        result = cur.lastrowid
        conn.close()
        return result
    except Exception:
        return None


def get_expenses(start_date=None, end_date=None, category=None):
    try:
        conn = get_connection()
        cur = conn.cursor()
        query = """
            SELECT e.*, u.full_name as approved_by_name
            FROM expenses e
            LEFT JOIN users u ON e.approved_by = u.id
            WHERE 1=1
        """
        params = []
        if start_date:
            query += " AND e.expense_date >= %s"
            params.append(start_date)
        if end_date:
            query += " AND e.expense_date <= %s"
            params.append(end_date)
        if category:
            query += " AND e.category = %s"
            params.append(category)
        query += " ORDER BY e.expense_date DESC"
        cur.execute(query, params)
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def update_expense(expense_id, **kwargs):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Whitelist so approved_by (an audit field) can't be altered here.
        allowed = {"amount", "category", "description", "expense_date", "receipt"}
        fields = {k: v for k, v in kwargs.items() if k in allowed}
        if not fields:
            return
        set_clause = ", ".join(f"{k} = %s" for k in fields)
        vals = list(fields.values()) + [expense_id]
        cur.execute(f"UPDATE expenses SET {set_clause} WHERE id = %s", vals)
        conn.close()
    except Exception:
        pass


def delete_expense(expense_id):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM expenses WHERE id = %s", (expense_id,))
        conn.close()
    except Exception:
        pass


def get_financial_summary(start_date=None, end_date=None):
    # Dashboard numbers: totals, balance and breakdowns for income/expenses.
    # %% in MySQL DATE_FORMAT needs escaping for Python's % formatting.
    try:
        conn = get_connection()
        cur = conn.cursor()

        date_filter = ""
        params = []
        if start_date:
            date_filter += " AND donation_date >= %s"
            params.append(start_date)
        if end_date:
            date_filter += " AND donation_date <= %s"
            params.append(end_date)

        cur.execute(f"SELECT COALESCE(SUM(amount), 0) as total FROM donations WHERE 1=1{date_filter}", params)
        total_income = cur.fetchone()["total"]

        e_filter = ""
        e_params = []
        if start_date:
            e_filter += " AND expense_date >= %s"
            e_params.append(start_date)
        if end_date:
            e_filter += " AND expense_date <= %s"
            e_params.append(end_date)

        cur.execute(f"SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE 1=1{e_filter}", e_params)
        total_expenses = cur.fetchone()["total"]

        cur.execute(f"""
            SELECT category, SUM(amount) as total
            FROM donations WHERE 1=1{date_filter}
            GROUP BY category ORDER BY total DESC
        """, params)
        income_by_category = cur.fetchall()

        cur.execute(f"""
            SELECT category, SUM(amount) as total
            FROM expenses WHERE 1=1{e_filter}
            GROUP BY category ORDER BY total DESC
        """, e_params)
        expenses_by_category = cur.fetchall()

        # Monthly income series keyed by "YYYY-MM" for charts.
        cur.execute(f"""
            SELECT DATE_FORMAT(donation_date, '%%Y-%%m') as month, SUM(amount) as total
            FROM donations WHERE 1=1{date_filter}
            GROUP BY month ORDER BY month
        """, params)
        monthly_income = cur.fetchall()

        result = {
            "total_income": float(total_income),
            "total_expenses": float(total_expenses),
            "balance": float(total_income) - float(total_expenses),
            "income_by_category": income_by_category,
            "expenses_by_category": expenses_by_category,
            "monthly_income": monthly_income,
        }
        conn.close()
        return result
    except Exception:
        return {"total_income": 0, "total_expenses": 0, "balance": 0, "income_by_category": [], "expenses_by_category": [], "monthly_income": []}


def get_todays_offering():
    # Sum of all donations received today (any category).
    try:
        conn = get_connection()
        cur = conn.cursor()
        today = date.today()
        cur.execute(
            "SELECT COALESCE(SUM(amount), 0) as total FROM donations WHERE DATE(donation_date) = %s",
            (today,),
        )
        result = float(cur.fetchone()["total"])
        conn.close()
        return result
    except Exception:
        return 0


def get_monthly_tithe_total():
    # Tithe collected so far in the current calendar month.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT COALESCE(SUM(amount), 0) as total
            FROM donations
            WHERE category = 'Tithe'
            AND MONTH(donation_date) = MONTH(CURRENT_DATE())
            AND YEAR(donation_date) = YEAR(CURRENT_DATE())
        """)
        result = float(cur.fetchone()["total"])
        conn.close()
        return result
    except Exception:
        return 0


def get_monthly_expenses():
    # Total expenses per month, for the monthly chart.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT DATE_FORMAT(expense_date, '%Y-%m') as month, SUM(amount) as total
            FROM expenses
            GROUP BY month ORDER BY month
        """)
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def get_monthly_report(year=None):
    # Full-year financial report: monthly income/expense, category breakdowns
    # and the top 10 donors for the selected year.
    try:
        conn = get_connection()
        cur = conn.cursor()
        if not year:
            year = date.today().year

        cur.execute("""
            SELECT MONTH(donation_date) as m, COALESCE(SUM(amount), 0) as total
            FROM donations WHERE YEAR(donation_date) = %s
            GROUP BY m ORDER BY m
        """, (year,))
        monthly_income = cur.fetchall()

        cur.execute("""
            SELECT MONTH(expense_date) as m, COALESCE(SUM(amount), 0) as total
            FROM expenses WHERE YEAR(expense_date) = %s
            GROUP BY m ORDER BY m
        """, (year,))
        monthly_expenses = cur.fetchall()

        cur.execute("""
            SELECT category, SUM(amount) as total
            FROM donations WHERE YEAR(donation_date) = %s
            GROUP BY category ORDER BY total DESC
        """, (year,))
        income_by_category = cur.fetchall()

        cur.execute("""
            SELECT category, SUM(amount) as total
            FROM expenses WHERE YEAR(expense_date) = %s
            GROUP BY category ORDER BY total DESC
        """, (year,))
        expenses_by_category = cur.fetchall()

        cur.execute("""
            SELECT u.full_name, SUM(d.amount) as total
            FROM donations d
            JOIN users u ON d.member_id = u.id
            WHERE YEAR(d.donation_date) = %s
            GROUP BY d.member_id ORDER BY total DESC
            LIMIT 10
        """, (year,))
        top_donors = cur.fetchall()

        result = {
            "monthly_income": monthly_income,
            "monthly_expenses": monthly_expenses,
            "income_by_category": income_by_category,
            "expenses_by_category": expenses_by_category,
            "top_donors": top_donors,
        }
        conn.close()
        return result
    except Exception:
        return {"monthly_income": [], "monthly_expenses": [], "income_by_category": [], "expenses_by_category": [], "top_donors": []}


def get_all_donors_summary(period="all", year=None, month=None, week_start=None):
    # Per-donor aggregates for reporting; `period` picks the time window
    # (yearly/monthly/weekly/all) by building the matching WHERE clause.
    try:
        conn = get_connection()
        cur = conn.cursor()
        if not year:
            year = date.today().year

        date_filter = ""
        params = []

        if period == "yearly":
            date_filter = " AND YEAR(d.donation_date) = %s"
            params.append(year)
        elif period == "monthly" and month:
            date_filter = " AND YEAR(d.donation_date) = %s AND MONTH(d.donation_date) = %s"
            params.extend([year, month])
        elif period == "weekly" and week_start:
            # A week is treated as the 7 days starting at week_start.
            week_end = week_start + timedelta(days=6)
            date_filter = " AND d.donation_date >= %s AND d.donation_date <= %s"
            params.extend([week_start, week_end])

        cur.execute(f"""
            SELECT u.full_name, u.id as member_id,
                   COUNT(d.id) as donation_count,
                   COALESCE(SUM(d.amount), 0) as total_amount,
                   MIN(d.donation_date) as first_donation,
                   MAX(d.donation_date) as last_donation
            FROM donations d
            JOIN users u ON d.member_id = u.id
            WHERE 1=1{date_filter}
            GROUP BY d.member_id, u.full_name
            ORDER BY total_amount DESC
        """, params)
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def delete_donations_by_period(period="all", year=None, month=None, week_start=None):
    # Bulk-delete donations within the chosen window (used for clearing data).
    try:
        conn = get_connection()
        cur = conn.cursor()
        if not year:
            year = datetime.now().year

        date_filter = ""
        params = []

        if period == "yearly":
            date_filter = " AND YEAR(donation_date) = %s"
            params.append(year)
        elif period == "monthly" and month:
            date_filter = " AND YEAR(donation_date) = %s AND MONTH(donation_date) = %s"
            params.extend([year, month])
        elif period == "weekly" and week_start:
            week_end = week_start + timedelta(days=6)
            date_filter = " AND donation_date >= %s AND donation_date <= %s"
            params.extend([week_start, week_end])
        else:
            # Unsupported period: refuse to wipe everything by accident.
            return 0

        cur.execute(f"DELETE FROM donations WHERE 1=1{date_filter}", params)
        result = cur.rowcount
        conn.close()
        return result
    except Exception:
        return 0


def get_donations_by_period(period="all", year=None, month=None, week_start=None):
    # Donation rows within the chosen window; COALESCE again labels anonymous
    # donations as "All Members".
    try:
        conn = get_connection()
        cur = conn.cursor()
        if not year:
            year = date.today().year

        date_filter = ""
        params = []

        if period == "yearly":
            date_filter = " AND YEAR(d.donation_date) = %s"
            params.append(year)
        elif period == "monthly" and month:
            date_filter = " AND YEAR(d.donation_date) = %s AND MONTH(d.donation_date) = %s"
            params.extend([year, month])
        elif period == "weekly" and week_start:
            week_end = week_start + timedelta(days=6)
            date_filter = " AND d.donation_date >= %s AND d.donation_date <= %s"
            params.extend([week_start, week_end])

        cur.execute(f"""
            SELECT d.id, COALESCE(u.full_name, 'All Members') as donor_name, d.amount, d.category,
                   d.payment_method, d.reference, d.donation_date
            FROM donations d
            LEFT JOIN users u ON d.member_id = u.id
            WHERE 1=1{date_filter}
            ORDER BY d.donation_date DESC
        """, params)
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []
