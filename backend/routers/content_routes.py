from fastapi import APIRouter, Depends, HTTPException
import base64
import os
import re

import announcements
import events
import ministries
import service_details
import activity_logs
import church_content
from .church_routes import invalidate_public_cache
from deps import get_current_user, require

router = APIRouter(prefix="/api", tags=["content"])

# WRITERS are the only roles that may create/edit content; ALL_LOGGED may read it.
WRITERS = ("admin",)
ALL_LOGGED = ("admin", "pastor", "finance", "member")

MAX_IMAGE_BYTES = 2 * 1024 * 1024  # 2 MB
# Declared MIME type -> expected magic bytes, used to verify the real content.
ALLOWED_IMAGE_MIMES = {
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/jpeg": b"\xff\xd8\xff",
    "image/gif": b"GIF8",
    "image/webp": b"RIFF",
}


def _validate_image(image):
    # Validate a data-URI base64 image: whitelist the MIME type, cap the decoded
    # size, and compare the magic bytes so the file is what it claims to be.
    if not isinstance(image, str) or not image.startswith("data:"):
        raise HTTPException(status_code=400, detail="Invalid image data")
    mime = image[5:].split(";", 1)[0].lower()
    magic = ALLOWED_IMAGE_MIMES.get(mime)
    if not magic:
        raise HTTPException(status_code=400, detail="Image type must be PNG, JPEG, GIF or WebP")
    if ";base64," not in image:
        raise HTTPException(status_code=400, detail="Image must be base64 encoded")
    try:
        raw = base64.b64decode(image.split(";base64,", 1)[1])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image is too large (max 2 MB)")
    if not raw[: len(magic)] == magic:
        raise HTTPException(status_code=400, detail="File content does not match the declared image type")
    return image


# ---- Announcements ----

@router.get("/announcements")
def announcements_list(active: str = "true", user: dict = Depends(require(*ALL_LOGGED))):
    # Public announcements feed; "active" filters out expired/hidden ones.
    return announcements.get_announcements(active_only=active.lower() == "true")


@router.get("/announcements/all")
def all_announcements(user: dict = Depends(require("admin", "pastor", "finance"))):
    # Staff view including inactive/expired announcements for management.
    return announcements.get_all_announcements()


@router.post("/announcements")
def create_announcement(payload: dict, user: dict = Depends(require(*WRITERS))):
    title = (payload.get("title") or "").strip()
    content = (payload.get("content") or "").strip()
    if not title or not content:
        raise HTTPException(status_code=400, detail="Title and content are required")
    ann_id = announcements.create_announcement(
        title, content, user["id"],
        priority=payload.get("priority", "Normal"),
        date_expires=payload.get("date_expires"),
        bible_reading=payload.get("bible_reading"),
        preacher=payload.get("preacher"),
    )
    activity_logs.log_activity(user["id"], "created", "Announcements", title)
    invalidate_public_cache()
    return {"id": ann_id}


@router.put("/announcements/{announcement_id}")
def edit_announcement(announcement_id: int, payload: dict, user: dict = Depends(require(*WRITERS))):
    announcements.update_announcement(announcement_id, **payload)
    activity_logs.log_activity(user["id"], "updated", "Announcements", f"Announcement {announcement_id}")
    invalidate_public_cache()
    return {"message": "Announcement updated"}


@router.delete("/announcements/{announcement_id}")
def remove_announcement(announcement_id: int, user: dict = Depends(require(*WRITERS))):
    announcements.delete_announcement(announcement_id)
    activity_logs.log_activity(user["id"], "deleted", "Announcements", f"Announcement {announcement_id}")
    invalidate_public_cache()
    return {"message": "Announcement deleted"}


# ---- Service details (bible reading & preacher) ----

@router.get("/service-details")
def service_details_list(user: dict = Depends(require(*ALL_LOGGED))):
    # Per-service bible reading and preacher assignments.
    return service_details.get_service_details()


@router.post("/service-details")
def create_service_detail(payload: dict, user: dict = Depends(require(*WRITERS))):
    service_date = payload.get("service_date")
    if not service_date:
        raise HTTPException(status_code=400, detail="Service date is required")
    preacher = (payload.get("preacher") or "").strip()
    bible_reading = (payload.get("bible_reading") or "").strip()
    # At least one of preacher/reading is needed; empty values stored as NULL.
    if not preacher and not bible_reading:
        raise HTTPException(status_code=400, detail="Preacher or bible reading is required")
    result = service_details.create_service_detail(
        service_date, preacher or None, bible_reading or None, user["id"],
    )
    activity_logs.log_activity(user["id"], "created", "Service", f"Service on {service_date}")
    return {"id": result}


@router.put("/service-details/{service_detail_id}")
def edit_service_detail(service_detail_id: int, payload: dict, user: dict = Depends(require(*WRITERS))):
    service_details.update_service_detail(service_detail_id, **payload)
    activity_logs.log_activity(user["id"], "updated", "Service", f"Service detail {service_detail_id}")
    return {"message": "Service detail updated"}


@router.delete("/service-details/{service_detail_id}")
def remove_service_detail(service_detail_id: int, user: dict = Depends(require(*WRITERS))):
    service_details.delete_service_detail(service_detail_id)
    activity_logs.log_activity(user["id"], "deleted", "Service", f"Service detail {service_detail_id}")
    return {"message": "Service detail deleted"}


# ---- Events ----

@router.get("/events")
def events_list(user: dict = Depends(require(*ALL_LOGGED))):
    return events.get_all_events()


@router.get("/events/upcoming")
def upcoming_events(limit: int = 10, user: dict = Depends(require(*ALL_LOGGED))):
    # Next N future events for homepage/dashboard.
    return events.get_upcoming_events(limit)


@router.post("/events")
def create_event(payload: dict, user: dict = Depends(require(*WRITERS))):
    title = (payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    if not payload.get("is_recurring") and not payload.get("event_date"):
        raise HTTPException(status_code=400, detail="Event date is required for non-recurring events")
    # Optional event flier: validated as an image (type, size, magic bytes).
    image = _validate_image(payload["image"]) if payload.get("image") else None
    # Route to the matching event model: recurring, multi-day, or single event.
    if payload.get("is_recurring"):
        event_id = events.create_recurring_event(
            title, payload.get("description", ""),
            payload.get("day_of_week", "Sunday"),
            payload.get("location", ""), user["id"],
            start_time=payload.get("start_time"),
            end_time=payload.get("end_time"),
            image=image,
        )
    elif payload.get("end_date"):
        event_id = events.create_multi_day_event(
            title, payload.get("description", ""),
            payload.get("event_date"), payload.get("end_date"),
            payload.get("location", ""), user["id"],
            image=image,
        )
    else:
        event_id = events.create_event(
            title, payload.get("description", ""),
            payload.get("event_date"), payload.get("location", ""), user["id"],
            image=image,
        )
    activity_logs.log_activity(user["id"], "created", "Events", title)
    invalidate_public_cache()
    return {"id": event_id}


@router.put("/events/{event_id}")
def edit_event(event_id: int, payload: dict, user: dict = Depends(require(*WRITERS))):
    update = dict(payload)
    if update.get("image"):
        update["image"] = _validate_image(update["image"])
    events.update_event(event_id, **update)
    activity_logs.log_activity(user["id"], "updated", "Events", f"Event {event_id}")
    invalidate_public_cache()
    return {"message": "Event updated"}


@router.delete("/events/{event_id}")
def remove_event(event_id: int, user: dict = Depends(require(*WRITERS))):
    events.delete_event(event_id)
    activity_logs.log_activity(user["id"], "deleted", "Events", f"Event {event_id}")
    invalidate_public_cache()
    return {"message": "Event deleted"}


@router.post("/events/{event_id}/attendance")
def event_attendance(event_id: int, payload: dict, user: dict = Depends(require(*WRITERS))):
    # Record a single member's presence at an event.
    member_id = payload.get("member_id")
    if not member_id:
        raise HTTPException(status_code=400, detail="member_id is required")
    attendance_id = events.record_attendance(
        member_id, event_id,
        payload.get("service_date"),
        status=payload.get("status", "Present"),
    )
    return {"id": attendance_id}


@router.get("/attendance-summary")
def attendance_summary(event_id: int = None, start_date: str = None, end_date: str = None,
                       user: dict = Depends(require(*ALL_LOGGED))):
    # Aggregated attendance counts, optionally filtered by event or date range.
    return events.get_attendance_summary(event_id=event_id, start_date=start_date, end_date=end_date)


# ---- Ministries ----

def _can_manage_ministry(user: dict, ministry_id: int) -> bool:
    # Admins manage everything; otherwise only the ministry's own manager can.
    return user["role"] == "admin" or ministries.is_ministry_manager(user["id"], ministry_id)


@router.get("/ministries")
def ministries_list(user: dict = Depends(require(*ALL_LOGGED))):
    # List all ministries enriched with the viewer's own membership/role so the
    # UI can show join buttons and the user's role within each ministry.
    data = ministries.get_all_ministries()
    mine = ministries.get_user_ministries(user["id"])
    roles_by_id = {m["id"]: m.get("ministry_role") for m in mine}
    for m in data:
        m["roles"] = ministries.get_ministry_roles(m)
        m["is_member"] = m["id"] in roles_by_id
        m["my_role"] = roles_by_id.get(m["id"])
    return data


@router.post("/ministries/{ministry_id}/join")
def join_ministry(ministry_id: int, payload: dict = None, user: dict = Depends(require(*ALL_LOGGED))):
    m = ministries.get_ministry(ministry_id)
    if not m:
        raise HTTPException(status_code=404, detail="Organisation not found")
    # Default to the ministry's first defined role (usually "Member") when none is given.
    roles = ministries.get_ministry_roles(m)
    role = (payload or {}).get("role") or (roles[0] if roles else "Member")
    ministries.add_member_to_ministry(ministry_id, user["id"], role=role)
    activity_logs.log_activity(user["id"], "joined", "Organisations", f"Joined organisation {ministry_id} as {role}")
    return {"message": "Joined", "role": role}


@router.post("/ministries/{ministry_id}/leave")
def leave_ministry(ministry_id: int, user: dict = Depends(require(*ALL_LOGGED))):
    # Self-serve removal; the user can only leave (never remove others here).
    ministries.remove_member_from_ministry(ministry_id, user["id"])
    activity_logs.log_activity(user["id"], "left", "Organisations", f"Left organisation {ministry_id}")
    return {"message": "Left"}


@router.post("/ministries")
def create_ministry(payload: dict, user: dict = Depends(require(*WRITERS))):
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    ministry_id = ministries.create_ministry(
        name, payload.get("description", ""),
        leader_id=payload.get("leader_id"),
        roles=payload.get("roles") or ["Member"],
    )
    activity_logs.log_activity(user["id"], "created", "Organisations", name)
    invalidate_public_cache()
    return {"id": ministry_id}


@router.get("/ministries/{ministry_id}/members")
def ministry_members(ministry_id: int, user: dict = Depends(require(*ALL_LOGGED))):
    return ministries.get_ministry_members(ministry_id)


@router.post("/ministries/{ministry_id}/members")
def add_ministry_member(ministry_id: int, payload: dict, user: dict = Depends(require(*WRITERS))):
    # Admin adds a member to a ministry with an explicit role.
    member_id = payload.get("member_id")
    if not member_id:
        raise HTTPException(status_code=400, detail="member_id is required")
    ministries.add_member_to_ministry(ministry_id, member_id, role=payload.get("role", "Member"))
    activity_logs.log_activity(user["id"], "updated", "Organisations", f"Added member {member_id} to ministry {ministry_id}")
    return {"message": "Member added"}


@router.put("/ministries/{ministry_id}/members/{member_id}")
def edit_ministry_member(ministry_id: int, member_id: int, payload: dict, user: dict = Depends(require(*WRITERS))):
    # Change a member's role within the ministry.
    ministries.update_member_role(ministry_id, member_id, role=payload.get("role", "Member"))
    return {"message": "Role updated"}


@router.delete("/ministries/{ministry_id}/members/{member_id}")
def remove_ministry_member(ministry_id: int, member_id: int, user: dict = Depends(require(*WRITERS))):
    ministries.remove_member_from_ministry(ministry_id, member_id)
    activity_logs.log_activity(user["id"], "updated", "Organisations", f"Removed member {member_id} from ministry {ministry_id}")
    return {"message": "Member removed"}


@router.put("/ministries/{ministry_id}")
def edit_ministry(ministry_id: int, payload: dict, user: dict = Depends(require(*WRITERS))):
    ministries.update_ministry(
        ministry_id,
        payload.get("name", ""),
        payload.get("description", ""),
        leader_id=payload.get("leader_id"),
        roles=payload.get("roles"),
    )
    activity_logs.log_activity(user["id"], "updated", "Organisations", f"Ministry {ministry_id}")
    invalidate_public_cache()
    return {"message": "Ministry updated"}


@router.delete("/ministries/{ministry_id}")
def remove_ministry(ministry_id: int, user: dict = Depends(require(*WRITERS))):
    ministries.delete_ministry(ministry_id)
    activity_logs.log_activity(user["id"], "deleted", "Organisations", f"Ministry {ministry_id}")
    invalidate_public_cache()
    return {"message": "Ministry deleted"}


# ---- Organisation events ----

@router.get("/ministries/{ministry_id}/events")
def ministry_events_list(ministry_id: int, user: dict = Depends(require(*ALL_LOGGED))):
    return ministries.get_ministry_events(ministry_id)


@router.post("/ministries/{ministry_id}/events")
def create_ministry_event(ministry_id: int, payload: dict, user: dict = Depends(require(*ALL_LOGGED))):
    # Unlike normal events, ministry event writes are gated on ministry leadership.
    if not _can_manage_ministry(user, ministry_id):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    title = (payload.get("title") or "").strip()
    if not title or not payload.get("event_date"):
        raise HTTPException(status_code=400, detail="Title and event date are required")
    image = _validate_image(payload["image"]) if payload.get("image") else None
    event_id = ministries.create_ministry_event(
        ministry_id, title, payload.get("description", ""),
        payload.get("event_date"), payload.get("location", ""), user["id"],
        end_date=payload.get("end_date"), image=image,
    )
    activity_logs.log_activity(user["id"], "created", "Organisation Events", title)
    invalidate_public_cache()
    return {"id": event_id}


@router.put("/ministries/{ministry_id}/events/{event_id}")
def edit_ministry_event(ministry_id: int, event_id: int, payload: dict, user: dict = Depends(require(*ALL_LOGGED))):
    if not _can_manage_ministry(user, ministry_id):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    update = dict(payload)
    if update.get("image"):
        update["image"] = _validate_image(update["image"])
    events.update_event(event_id, **update)
    activity_logs.log_activity(user["id"], "updated", "Organisation Events", f"Event {event_id}")
    invalidate_public_cache()
    return {"message": "Event updated"}


@router.delete("/ministries/{ministry_id}/events/{event_id}")
def remove_ministry_event(ministry_id: int, event_id: int, user: dict = Depends(require(*ALL_LOGGED))):
    if not _can_manage_ministry(user, ministry_id):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    events.delete_event(event_id)
    activity_logs.log_activity(user["id"], "deleted", "Organisation Events", f"Event {event_id}")
    invalidate_public_cache()
    return {"message": "Event deleted"}


# ---- Organisation pictures ----

@router.get("/ministries/{ministry_id}/pictures")
def ministry_pictures_list(ministry_id: int, user: dict = Depends(require(*ALL_LOGGED))):
    return ministries.get_ministry_pictures(ministry_id)


@router.post("/ministries/{ministry_id}/pictures")
def upload_ministry_picture(ministry_id: int, payload: dict, user: dict = Depends(require(*ALL_LOGGED))):
    if not _can_manage_ministry(user, ministry_id):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    image = payload.get("image")
    if not image:
        raise HTTPException(status_code=400, detail="image is required")
    # Base64 data-URI images are validated for type, size and magic bytes first.
    image = _validate_image(image)
    picture_id = ministries.add_ministry_picture(
        ministry_id, image, (payload.get("caption") or "").strip(), user["id"],
    )
    activity_logs.log_activity(user["id"], "created", "Organisation Pictures", f"Uploaded picture {picture_id}")
    invalidate_public_cache()
    return {"id": picture_id}


@router.delete("/ministries/{ministry_id}/pictures/{picture_id}")
def remove_ministry_picture(ministry_id: int, picture_id: int, user: dict = Depends(require(*ALL_LOGGED))):
    if not _can_manage_ministry(user, ministry_id):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    ministries.delete_ministry_picture(picture_id)
    activity_logs.log_activity(user["id"], "deleted", "Organisation Pictures", f"Picture {picture_id}")
    invalidate_public_cache()
    return {"message": "Picture deleted"}


@router.get("/ministries/user/{user_id}")
def user_ministries(user_id: int, user: dict = Depends(require(*ALL_LOGGED))):
    # Ministries a given user belongs to, with their role in each.
    return ministries.get_user_ministries(user_id)


# ---- Privacy policy ----

def _default_privacy_text():
    # When nothing has been customized, return the bundled PRIVACY.md so the
    # public default always matches the source file (and the frontend's initial
    # render), avoiding any flash of changing content.
    try:
        path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "PRIVACY.md")
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""


@router.get("/privacy")
def privacy_policy():
    # Public read of the privacy policy (no auth, so visitors can review it
    # before registering). Returns the saved text, or the bundled PRIVACY.md
    # when it has never been customized.
    try:
        content = church_content.get_church_content("privacy_policy")
    except Exception:
        content = None
    if not content:
        content = _default_privacy_text()
    return {"content": content or ""}


@router.put("/privacy")
def update_privacy_policy(payload: dict, user: dict = Depends(require("admin"))):
    # Only admins may edit the privacy policy; stored as a plain markdown string.
    text = payload.get("content", "")
    if not isinstance(text, str):
        raise HTTPException(status_code=400, detail="content must be a string")
    church_content.save_church_content("privacy_policy", text)
    activity_logs.log_activity(user["id"], "updated", "Privacy", "Privacy policy")
    return {"message": "Privacy policy updated"}
