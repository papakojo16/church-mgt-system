from datetime import datetime, date, timedelta

from fastapi import APIRouter, Depends, HTTPException

import announcements
import events
import finance
import stats
import ministries
import service_details
import receipts
import activity_logs
from .church_routes import invalidate_public_cache
from auth import create_user, hash_password, update_user, delete_user
from config import MIN_PASSWORD_LENGTH
from deps import require

router = APIRouter(prefix="/api", tags=["sync"])


def _to_date(value):
    # Normalise a date-ish value (string or date) to a date object, leniently.
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except Exception:
        return None


def _replay(op, user):
    # Replay one offline-sync operation against the server, mirroring what the
    # equivalent REST endpoint would do. Returns the created id/True on success,
    # or None for an unsupported/inapplicable operation.
    entity = op.get("entity")
    operation = op.get("op")
    p = op.get("payload", {}) or {}
    role = user["role"]
    user_id = user["id"]

    # Role guard mirrors the per-endpoint guards: content/account ops need admin,
    # finance ops need admin or finance. Any other role is rejected (None).
    if entity in ("announcement", "event", "ministry", "member", "weekly_attendance", "service_detail"):
        if role != "admin":
            return None
    elif entity in ("donation", "expense"):
        if role not in ("admin", "finance"):
            return None

    if entity == "announcement":
        if operation == "create":
            return announcements.create_announcement(
                p.get("title", ""), p.get("content", ""), p.get("author_id", user_id),
                priority=p.get("priority", "Normal"), date_expires=p.get("date_expires"),
                bible_reading=p.get("bible_reading"), preacher=p.get("preacher"),
            )
        if operation == "update":
            # Exclude "id" from the update so it is not written as a field.
            announcements.update_announcement(p["id"], **{k: v for k, v in p.items() if k != "id"})
            return True
        if operation == "delete":
            announcements.delete_announcement(p["id"])
            return True

    elif entity == "service_detail":
        if operation == "create":
            return service_details.create_service_detail(
                p.get("service_date"), p.get("preacher"),
                p.get("bible_reading"), p.get("created_by", user_id),
            )
        if operation == "update":
            service_details.update_service_detail(p["id"], **{k: v for k, v in p.items() if k != "id"})
            return True
        if operation == "delete":
            service_details.delete_service_detail(p["id"])
            return True

    elif entity == "event":
        if operation == "create":
            if p.get("is_recurring"):
                return events.create_recurring_event(
                    p.get("title", ""), p.get("description", ""),
                    p.get("day_of_week", "Sunday"), p.get("location", ""),
                    p.get("created_by", user_id),
                    start_time=p.get("start_time"), end_time=p.get("end_time"),
                )
            return events.create_event(
                p.get("title", ""), p.get("description", ""),
                p.get("event_date"), p.get("location", ""), p.get("created_by", user_id),
                end_date=p.get("end_date"),
            )
        if operation == "update":
            events.update_event(p["id"], **{k: v for k, v in p.items() if k != "id"})
            return True
        if operation == "delete":
            events.delete_event(p["id"])
            return True

    elif entity == "donation":
        if operation == "create":
            return finance.record_donation(
                p.get("member_id"), p.get("amount"),
                category=p.get("category", "Tithe"),
                payment_method=p.get("payment_method", "Cash"),
                reference=p.get("reference", ""),
                notes=p.get("notes", ""),
                donation_date=p.get("donation_date"),
            )
        if operation == "delete":
            # Soft delete like the receipts endpoint (keeps an audit trail).
            receipts.delete_donation(p["donation_id"], user_id)
            return True

    elif entity == "expense":
        if operation == "create":
            return finance.record_expense(
                p.get("amount"), p.get("category"),
                description=p.get("description", ""),
                approved_by=p.get("approved_by", user_id),
                receipt=p.get("receipt", ""),
                expense_date=p.get("expense_date"),
            )
        if operation == "update":
            finance.update_expense(p["id"], **{k: v for k, v in p.items() if k != "id"})
            return True
        if operation == "delete":
            finance.delete_expense(p["id"])
            return True

    elif entity == "weekly_attendance":
        if operation == "upsert":
            stats.upsert_weekly_attendance(
                p.get("service_date"), int(p.get("adult_male", 0) or 0),
                int(p.get("adult_female", 0) or 0), int(p.get("child_male", 0) or 0),
                int(p.get("child_female", 0) or 0), p.get("note", ""),
                p.get("recorded_by", user_id),
            )
            return True
        if operation == "delete":
            stats.delete_weekly_attendance(p["record_id"])
            return True

    elif entity == "ministry":
        if operation == "create":
            return ministries.create_ministry(
                p.get("name", ""), p.get("description", ""),
                leader_id=p.get("leader_id"), roles=p.get("roles") or ["Member"],
            )
        if operation == "update":
            ministries.update_ministry(p["id"], p.get("name", ""), p.get("description", ""),
                                       leader_id=p.get("leader_id"), roles=p.get("roles"))
            return True
        if operation == "delete":
            ministries.delete_ministry(p["id"])
            return True
        if operation == "add_member":
            ministries.add_member_to_ministry(p["ministry_id"], p["member_id"], role=p.get("role", "Member"))
            return True
        if operation == "remove_member":
            ministries.remove_member_from_ministry(p["ministry_id"], p["member_id"])
            return True
        if operation == "update_member":
            ministries.update_member_role(p["ministry_id"], p["member_id"], role=p.get("role", "Member"))
            return True

    elif entity == "member":
        if operation == "create":
            # Member creation reuses the same password rules as the REST endpoint.
            if not p.get("password") or len(p.get("password", "")) < MIN_PASSWORD_LENGTH:
                raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
            return create_user(
                p.get("username"), p.get("password"),
                p.get("full_name", ""), email=p.get("email", ""),
                phone=p.get("phone", ""), role=p.get("role", "member"),
                must_change_password=p.get("must_change_password", False),
            )
        if operation == "update":
            # Password (if present) is hashed and written directly, mirroring the
            # member edit endpoint; it is stripped out of the generic update.
            if p.get("password"):
                if len(p["password"]) < MIN_PASSWORD_LENGTH:
                    raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
                from database import get_connection
                conn = get_connection()
                cur = conn.cursor()
                cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (hash_password(p["password"]), p["id"]))
                conn.close()
            update_user(p["id"], **{k: v for k, v in p.items() if k not in ("id", "password")})
            return True
        if operation == "delete":
            delete_user(p["id"])
            return True

    elif entity == "activity":
        if operation == "log":
            # Replay locally-logged activity so offline actions appear in the audit trail.
            activity_logs.log_activity(p.get("user_id", user_id), p.get("action", ""),
                                       p.get("category", ""), p.get("details", ""))
            return True

    return None


@router.post("/sync")
def sync(payload: dict, user: dict = Depends(require("admin", "pastor", "finance", "member"))):
    # Bulk offline-sync endpoint: replays a list of queued operations from a
    # device. Each op is handled independently so one failure does not abort
    # the rest; per-op results let the client drop/re-queue what failed.
    operations = payload.get("operations") or []
    if not isinstance(operations, list):
        raise HTTPException(status_code=400, detail="operations must be a list")
    results = []
    success = 0
    failed = 0
    # Entities whose replay changes the public landing/about payload, so the
    # cached /api/public bundle must be rebuilt.
    public_entities = {"announcement", "event", "ministry"}
    public_touched = False
    for op in operations:
        try:
            result = _replay(op, user)
            if result is None:
                # Unsupported entity/op or insufficient role — treated as a failure.
                failed += 1
                results.append({"op": op.get("op"), "entity": op.get("entity"), "success": False, "error": "Unsupported operation"})
            else:
                success += 1
                if op.get("entity") in public_entities:
                    public_touched = True
                results.append({"op": op.get("op"), "entity": op.get("entity"), "success": True, "id": result})
        except Exception as e:
            failed += 1
            results.append({"op": op.get("op"), "entity": op.get("entity"), "success": False, "error": str(e)})
    if public_touched:
        invalidate_public_cache()
    return {"success": success, "failed": failed, "results": results}
