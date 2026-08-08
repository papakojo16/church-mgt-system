from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException

import finance
from deps import require
import activity_logs

router = APIRouter(prefix="/api", tags=["finance"])

# Roles that may write finance records vs roles that may only read them.
FIN_ROLES = ("admin", "finance")
FIN_ROLES_READ = ("admin", "finance", "pastor")

# Donation categories tied to an individual member (require member_id on create).
INDIVIDUAL_CATEGORIES = ("Tithe", "Donations", "Pledge")


@router.get("/donations")
def donations(start_date: str = None, end_date: str = None, category: str = None, member_id: int = None,
              user: dict = Depends(require(*FIN_ROLES_READ))):
    # Filtered donation list (by date range, category and/or member) for finance views.
    return finance.get_donations(start_date=start_date, end_date=end_date, category=category, member_id=member_id)


@router.post("/donations")
def create_donation(payload: dict, user: dict = Depends(require(*FIN_ROLES))):
    member_id = payload.get("member_id")
    amount = payload.get("amount")
    category = payload.get("category", "Tithe")
    # Per-member categories (tithe/pledge/donation) cannot be recorded without a member.
    if category in INDIVIDUAL_CATEGORIES and not member_id:
        raise HTTPException(status_code=400, detail="member_id is required for this category")
    if amount is None:
        raise HTTPException(status_code=400, detail="amount is required")
    donation_id = finance.record_donation(
        member_id, float(amount),
        category=category,
        payment_method=payload.get("payment_method", "Cash"),
        reference=payload.get("reference", ""),
        notes=payload.get("notes", ""),
        donation_date=payload.get("donation_date"),
    )
    activity_logs.log_activity(user["id"], "created", "Finances", f"Recorded donation {donation_id}")
    return {"id": donation_id}


@router.get("/donations/period")
def donations_by_period(period: str = "all", year: int = None, month: int = None, week_start: date = None,
                        user: dict = Depends(require(*FIN_ROLES_READ))):
    # Aggregates donations by named period ("all"/"year"/"month"/"week") for reports.
    return finance.get_donations_by_period(period=period, year=year, month=month, week_start=week_start)


@router.delete("/donations/period")
def delete_donations_period(period: str = "all", year: int = None, month: int = None, week_start: date = None,
                            user: dict = Depends(require("admin"))):
    # Admin-only bulk delete of a whole donation period (e.g. erroneous batch entry).
    count = finance.delete_donations_by_period(period=period, year=year, month=month, week_start=week_start)
    activity_logs.log_activity(user["id"], "deleted", "Finances", f"Deleted {count} donations ({period})")
    return {"deleted": count}


@router.get("/expenses")
def expenses(start_date: str = None, end_date: str = None, category: str = None,
             user: dict = Depends(require(*FIN_ROLES_READ))):
    # Filtered expense list for finance views.
    return finance.get_expenses(start_date=start_date, end_date=end_date, category=category)


@router.post("/expenses")
def create_expense(payload: dict, user: dict = Depends(require(*FIN_ROLES))):
    amount = payload.get("amount")
    category = payload.get("category")
    if amount is None or not category:
        raise HTTPException(status_code=400, detail="amount and category are required")
    expense_id = finance.record_expense(
        float(amount), category,
        description=payload.get("description", ""),
        approved_by=user["id"],
        receipt=payload.get("receipt", ""),
        expense_date=payload.get("expense_date"),
    )
    activity_logs.log_activity(user["id"], "created", "Finances", f"Recorded expense {expense_id}")
    return {"id": expense_id}


@router.put("/expenses/{expense_id}")
def edit_expense(expense_id: int, payload: dict, user: dict = Depends(require(*FIN_ROLES))):
    # Update an expense's fields (amount, category, description, receipt, date...).
    finance.update_expense(expense_id, **payload)
    activity_logs.log_activity(user["id"], "updated", "Finances", f"Updated expense {expense_id}")
    return {"message": "Expense updated"}


@router.delete("/expenses/{expense_id}")
def remove_expense(expense_id: int, user: dict = Depends(require("admin", "finance"))):
    # Hard-delete an expense record.
    finance.delete_expense(expense_id)
    activity_logs.log_activity(user["id"], "deleted", "Finances", f"Deleted expense {expense_id}")
    return {"message": "Expense deleted"}


@router.get("/financial-summary")
def financial_summary(start_date: str = None, end_date: str = None,
                      user: dict = Depends(require(*FIN_ROLES_READ))):
    # Income vs expense totals over a date range, used for the dashboard overview.
    return finance.get_financial_summary(start_date=start_date, end_date=end_date)


@router.get("/todays-offering")
def todays_offering(user: dict = Depends(require(*FIN_ROLES_READ))):
    return {"total": finance.get_todays_offering()}


@router.get("/monthly-tithe")
def monthly_tithe(user: dict = Depends(require(*FIN_ROLES_READ))):
    return {"total": finance.get_monthly_tithe_total()}


@router.get("/monthly-report")
def monthly_report(year: int = None, user: dict = Depends(require(*FIN_ROLES_READ))):
    # Month-by-month financial report for a given year (defaults to current).
    return finance.get_monthly_report(year)


@router.get("/donors-summary")
def donors_summary(period: str = "all", year: int = None, month: int = None,
                   user: dict = Depends(require(*FIN_ROLES_READ))):
    # Per-member giving totals grouped by period for donor/giving reports.
    return finance.get_all_donors_summary(period=period, year=year, month=month)
