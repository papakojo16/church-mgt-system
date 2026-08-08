from fastapi import APIRouter, Depends, HTTPException

import stats
import activity_logs
from deps import get_current_user, require

router = APIRouter(prefix="/api", tags=["stats"])

# Only admins may record/delete attendance; any logged-in user may read it.
WRITERS = ("admin",)


@router.get("/attendance")
def attendance(user: dict = Depends(get_current_user)):
    # All recorded weekly attendance, for charts and dashboards.
    return stats.get_all_weekly_attendance()


@router.post("/attendance")
def upsert_attendance(payload: dict, user: dict = Depends(require(*WRITERS))):
    service_date = payload.get("service_date")
    if not service_date:
        raise HTTPException(status_code=400, detail="service_date is required")
    # Upsert (not create): re-submitting the same service date overwrites the
    # existing record instead of creating a duplicate week.
    stats.upsert_weekly_attendance(
        service_date,
        int(payload.get("adult_male", 0) or 0),
        int(payload.get("adult_female", 0) or 0),
        int(payload.get("child_male", 0) or 0),
        int(payload.get("child_female", 0) or 0),
        payload.get("note", ""),
        user["id"],
    )
    activity_logs.log_activity(user["id"], "updated", "Statistics", f"Attendance for {service_date}")
    return {"message": "Attendance saved"}


@router.delete("/attendance/{record_id}")
def delete_attendance(record_id: int, user: dict = Depends(require(*WRITERS))):
    stats.delete_weekly_attendance(record_id)
    activity_logs.log_activity(user["id"], "deleted", "Statistics", f"Attendance record {record_id}")
    return {"message": "Attendance record deleted"}


@router.get("/attendance/chart")
def attendance_chart(user: dict = Depends(get_current_user)):
    # Pre-aggregated attendance series for the trend chart on the dashboard.
    return stats.get_attendance_chart_data()
