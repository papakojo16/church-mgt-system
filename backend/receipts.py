from database import get_connection
from config import APP_NAME


def get_donation_for_receipt(donation_id):
    # Fetches one donation plus the donor's contact info for the receipt;
    # anonymous donations get the label "All Members".
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT d.*, COALESCE(u.full_name, 'All Members') as donor_name, u.email, u.phone
            FROM donations d
            LEFT JOIN users u ON d.member_id = u.id
            WHERE d.id = %s
        """, (donation_id,))
        result = cur.fetchone()
        conn.close()
        return result
    except Exception:
        return None


def delete_donation(donation_id, user_id):
    # Soft deletion per user: marks the donation as "deleted" only for this
    # user via receipt_deletions, so the actual financial record is preserved.
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT IGNORE INTO receipt_deletions (donation_id, user_id) VALUES (%s, %s)",
            (donation_id, user_id),
        )
        result = cur.rowcount
        conn.close()
        return result
    except Exception:
        return 0


def get_all_donations_with_member(user_id=None, deleted_by_user_id=None, categories=None):
    try:
        conn = get_connection()
        cur = conn.cursor()
        query = """
            SELECT d.*, COALESCE(u.full_name, 'All Members') as donor_name, u.email, u.phone
            FROM donations d
            LEFT JOIN users u ON d.member_id = u.id
        """
        params = []
        if categories:
            # Build the IN (...) placeholder list dynamically from the filter.
            query += " WHERE d.category IN (" + ",".join(["%s"] * len(categories)) + ")"
            params.extend(categories)
        if user_id:
            query += (" AND " if categories else " WHERE ") + "d.member_id = %s"
            params.append(user_id)
        if deleted_by_user_id:
            # Hide any donation this user has already soft-deleted.
            query += " AND d.id NOT IN (SELECT donation_id FROM receipt_deletions WHERE user_id = %s)"
            params.append(deleted_by_user_id)
        query += " ORDER BY d.donation_date DESC"
        cur.execute(query, tuple(params))
        result = cur.fetchall()
        conn.close()
        return result
    except Exception:
        return []


def generate_receipt_html(donation):
    from datetime import datetime
    # Printable receipt rendered as standalone HTML; the "No signature required"
    # footer marks it as auto-generated for accounting purposes.
    date_str = donation["donation_date"].strftime("%d %B %Y") if hasattr(donation["donation_date"], "strftime") else str(donation["donation_date"])
    amount = float(donation["amount"])
    ref = donation.get("reference") or "N/A"
    notes = donation.get("notes") or ""
    email = donation.get("email") or "N/A"
    phone = donation.get("phone") or "N/A"

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Receipt #{donation['id']} - {APP_NAME}</title>
<style>
    @page {{ margin: 1cm; }}
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ font-family: 'Segoe UI', Arial, sans-serif; color: #333; background: #fff; padding: 40px; }}
    .receipt {{ max-width: 600px; margin: 0 auto; border: 2px solid #4a148c; border-radius: 12px; overflow: hidden; }}
    .header {{ background: linear-gradient(135deg, #4a148c, #1a237e); color: white; padding: 24px; text-align: center; }}
    .header h1 {{ font-size: 22px; margin-bottom: 4px; }}
    .header p {{ font-size: 12px; opacity: 0.8; }}
    .receipt-id {{ background: #f3e5f5; padding: 10px 24px; font-size: 13px; color: #4a148c; font-weight: bold; display: flex; justify-content: space-between; }}
    .body {{ padding: 24px; }}
    .section {{ margin-bottom: 20px; }}
    .section-title {{ font-size: 12px; text-transform: uppercase; color: #888; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }}
    .detail-row {{ display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }}
    .detail-row .label {{ color: #666; }}
    .detail-row .value {{ font-weight: 600; text-align: right; }}
    .amount-box {{ background: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0; }}
    .amount-box .amount {{ font-size: 28px; font-weight: bold; color: #2e7d32; }}
    .amount-box .label {{ font-size: 12px; color: #666; margin-top: 4px; }}
    .footer {{ background: #fafafa; padding: 16px 24px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #eee; }}
    .footer .thanks {{ font-size: 14px; color: #4a148c; font-weight: bold; margin-bottom: 4px; }}
    @media print {{
        body {{ padding: 0; }}
        .no-print {{ display: none !important; }}
    }}
</style>
</head>
<body>
<div class="no-print" style="text-align:center; margin-bottom:20px;">
    <button onclick="window.print()" style="padding:10px 24px; font-size:14px; background:#4a148c; color:white; border:none; border-radius:8px; cursor:pointer;">Print Receipt</button>
</div>
<div class="receipt">
    <div class="header">
        <h1>{APP_NAME}</h1>
        <p>Payment Receipt</p>
    </div>
    <div class="receipt-id">
        <span>Receipt No: RCP-{donation['id']:06d}</span>
        <span>Date: {date_str}</span>
    </div>
    <div class="body">
        <div class="section">
            <div class="section-title">Donor Information</div>
            <div class="detail-row"><span class="label">Name</span><span class="value">{donation['donor_name']}</span></div>
            <div class="detail-row"><span class="label">Email</span><span class="value">{email}</span></div>
            <div class="detail-row"><span class="label">Phone</span><span class="value">{phone}</span></div>
        </div>
        <div class="amount-box">
            <div class="amount">GHC {amount:,.2f}</div>
            <div class="label">Amount Received</div>
        </div>
        <div class="section">
            <div class="section-title">Payment Details</div>
            <div class="detail-row"><span class="label">Category</span><span class="value">{donation['category']}</span></div>
            <div class="detail-row"><span class="label">Payment Method</span><span class="value">{donation['payment_method']}</span></div>
            <div class="detail-row"><span class="label">Reference</span><span class="value">{ref}</span></div>
            {'<div class="detail-row"><span class="label">Notes</span><span class="value">' + notes + '</span></div>' if notes else ''}
        </div>
    </div>
    <div class="footer">
        <div class="thanks">Thank you for your generous contribution!</div>
        <p>This is a computer-generated receipt. No signature is required.</p>
        <p>{APP_NAME} | Generated on {date_str}</p>
    </div>
</div>
</body>
</html>"""
    return html


def generate_receipt_pdf(donation):
    # PDF variant of the receipt built with fpdf; same layout as the HTML one.
    from fpdf import FPDF

    date_str = donation["donation_date"].strftime("%d %B %Y") if hasattr(donation["donation_date"], "strftime") else str(donation["donation_date"])
    amount = float(donation["amount"])
    ref = donation.get("reference") or "N/A"
    notes = donation.get("notes") or ""
    email = donation.get("email") or "N/A"
    phone = donation.get("phone") or "N/A"

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Header band in the church purple/indigo palette.
    pdf.set_fill_color(74, 20, 140)
    pdf.rect(0, 0, 210, 40, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_xy(10, 10)
    pdf.cell(190, 10, APP_NAME, align="C")
    pdf.set_font("Helvetica", "", 12)
    pdf.set_xy(10, 22)
    pdf.cell(190, 8, "Payment Receipt", align="C")

    # Receipt number / date strip below the header.
    pdf.set_fill_color(243, 229, 245)
    pdf.set_xy(0, 40)
    pdf.rect(0, 40, 210, 10, "F")
    pdf.set_text_color(74, 20, 140)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_xy(10, 41)
    pdf.cell(95, 8, f"Receipt No: RCP-{donation['id']:06d}")
    pdf.set_xy(105, 41)
    pdf.cell(95, 8, f"Date: {date_str}", align="R")

    pdf.ln(18)

    # Donor information section.
    pdf.set_text_color(136, 136, 136)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 6, "DONOR INFORMATION", ln=True)
    pdf.set_draw_color(230, 230, 230)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(4)

    pdf.set_text_color(51, 51, 51)
    for label, value in [("Name", donation["donor_name"]), ("Email", email), ("Phone", phone)]:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(102, 102, 102)
        pdf.cell(40, 7, label)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(51, 51, 51)
        pdf.cell(0, 7, str(value), ln=True)

    pdf.ln(6)

    # Green amount box that highlights the received sum.
    pdf.set_fill_color(232, 245, 233)
    pdf.set_draw_color(76, 175, 80)
    pdf.rect(10, pdf.get_y(), 190, 25, "DF")
    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(46, 125, 50)
    pdf.set_xy(10, pdf.get_y() + 2)
    pdf.cell(190, 12, f"GHC {amount:,.2f}", align="C")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(102, 102, 102)
    pdf.set_xy(10, pdf.get_y() + 12)
    pdf.cell(190, 6, "Amount Received", align="C")
    pdf.ln(20)

    # Payment details section (category, method, reference, optional notes).
    pdf.set_text_color(136, 136, 136)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 6, "PAYMENT DETAILS", ln=True)
    pdf.set_draw_color(230, 230, 230)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(4)

    for label, value in [("Category", donation["category"]), ("Payment Method", donation["payment_method"]), ("Reference", ref)]:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(102, 102, 102)
        pdf.cell(40, 7, label)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(51, 51, 51)
        pdf.cell(0, 7, str(value), ln=True)

    if notes:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(102, 102, 102)
        pdf.cell(40, 7, "Notes")
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(51, 51, 51)
        pdf.multi_cell(0, 7, str(notes))

    pdf.ln(15)
    pdf.set_draw_color(230, 230, 230)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(74, 20, 140)
    pdf.cell(0, 8, "Thank you for your generous contribution!", align="C", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(136, 136, 136)
    pdf.cell(0, 6, "This is a computer-generated receipt. No signature is required.", align="C", ln=True)
    pdf.cell(0, 6, f"{APP_NAME} | Generated on {date_str}", align="C", ln=True)

    return pdf.output()
