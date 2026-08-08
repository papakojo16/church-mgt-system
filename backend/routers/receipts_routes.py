from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import HTMLResponse

import receipts
import activity_logs
from deps import get_current_user, require

router = APIRouter(prefix="/api/receipts", tags=["receipts"])

# Roles that may view/manage all receipts; everyone else is scoped to their own.
RECEIPT_ROLES = ("admin", "finance")
ALL_LOGGED = ("admin", "finance", "pastor", "member")
# Only tithe/pledge donations produce receipts (other donations get none).
RECEIPT_CATEGORIES = ("Tithe", "Pledge")


def _assert_can_view(user, donation):
    # Finance/admin see any receipt; a member may only view their own donations.
    if user["role"] in RECEIPT_ROLES:
        return
    if donation and donation.get("member_id") == user["id"]:
        return
    raise HTTPException(status_code=403, detail="Insufficient permissions")


@router.get("")
def receipts_list(user_id: int = None, deleted_by: int = None, user: dict = Depends(require(*ALL_LOGGED))):
    # List receipts, optionally filtered by donor and/or the user who deleted them
    # (lets staff audit soft-deleted receipts). Non-staff are forced to their own.
    if user["role"] not in RECEIPT_ROLES and user["id"] != user_id:
        user_id = user["id"]
    return receipts.get_all_donations_with_member(user_id=user_id, deleted_by_user_id=deleted_by, categories=RECEIPT_CATEGORIES)


@router.post("/{donation_id}/delete")
def delete_receipt(donation_id: int, user: dict = Depends(require(*RECEIPT_ROLES))):
    # Soft delete: records who deleted it rather than removing the row, so an
    # audit trail is kept. Returns whether the receipt is now hidden.
    result = receipts.delete_donation(donation_id, user["id"])
    activity_logs.log_activity(user["id"], "deleted", "Receipts", f"Marked donation {donation_id} as deleted")
    return {"deleted": result}


@router.get("/{donation_id}/html", response_class=HTMLResponse)
def receipt_html(donation_id: int, user: dict = Depends(require(*ALL_LOGGED))):
    # Printable HTML receipt; only tithe/pledge and only if the caller may view it.
    donation = receipts.get_donation_for_receipt(donation_id)
    if not donation or donation.get("category") not in RECEIPT_CATEGORIES:
        raise HTTPException(status_code=404, detail="Donation not found")
    _assert_can_view(user, donation)
    return receipts.generate_receipt_html(donation)


@router.get("/{donation_id}/pdf")
def receipt_pdf(donation_id: int, user: dict = Depends(require(*ALL_LOGGED))):
    # PDF version of the same receipt, streamed inline so the browser renders it.
    donation = receipts.get_donation_for_receipt(donation_id)
    if not donation or donation.get("category") not in RECEIPT_CATEGORIES:
        raise HTTPException(status_code=404, detail="Donation not found")
    _assert_can_view(user, donation)
    data = bytes(receipts.generate_receipt_pdf(donation))
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="receipt-{donation_id}.pdf"'},
    )
