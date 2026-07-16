from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.customers.models import Customer
from app.audit.service import log_action
from app.auth.models import User


def _customer_snapshot(c: Customer) -> dict:
    return {
        "customer_name": c.customer_name,
        "phone_number": c.phone_number,
        "state": c.state,
        "total_purchases": float(c.total_purchases or 0),
        "current_balance": float(c.current_balance or 0),
    }


def get_customers(
    db: Session,
    search: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple:
    query = db.query(Customer)
    if search:
        term = f"%{search}%"
        query = query.filter(
            (Customer.customer_name.ilike(term))
            | (Customer.phone_number.ilike(term))
            | (Customer.email.ilike(term))
        )
    total = query.count()
    customers = query.order_by(Customer.customer_name).offset(skip).limit(limit).all()
    return customers, total


def get_customer(db: Session, customer_id: int) -> Customer:
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


def create_customer(db: Session, data: dict, user: User) -> Customer:
    if data.get("phone_number"):
        existing = db.query(Customer).filter(Customer.phone_number == data["phone_number"]).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Phone number '{data['phone_number']}' already registered")
    customer = Customer(**data)
    db.add(customer)
    db.flush()
    log_action(db, user, "CREATE", "customer", customer.id, new_values=_customer_snapshot(customer))
    db.commit()
    db.refresh(customer)
    return customer


def update_customer(db: Session, customer_id: int, data: dict, user: User) -> Customer:
    customer = get_customer(db, customer_id)
    old_values = _customer_snapshot(customer)
    for key, value in data.items():
        if value is not None and hasattr(customer, key):
            setattr(customer, key, value)
    db.flush()
    log_action(db, user, "UPDATE", "customer", customer.id, old_values=old_values, new_values=_customer_snapshot(customer))
    db.commit()
    db.refresh(customer)
    return customer


def delete_customer(db: Session, customer_id: int, user: User) -> None:
    customer = get_customer(db, customer_id)
    log_action(db, user, "DELETE", "customer", customer.id, old_values=_customer_snapshot(customer))
    db.delete(customer)
    db.commit()


def get_customers_with_credit(db: Session) -> list:
    """Get customers who have outstanding credit (total_purchases is tracked separately)."""
    # This will be more useful when sales with credit are linked
    return db.query(Customer).filter(Customer.total_purchases > 0).order_by(Customer.total_purchases.desc()).all()


def get_customers_with_credit_sales(db: Session) -> list:
    """Get customers who have outstanding credit sales (unpaid/partial)."""
    from app.sales.models import Sale
    customer_ids = (
        db.query(Sale.customer_id)
        .filter(
            Sale.customer_id.isnot(None),
            Sale.payment_status.in_(["partial", "unpaid"]),
            Sale.status == "completed",
        )
        .distinct()
        .all()
    )
    ids = [cid[0] for cid in customer_ids]
    if not ids:
        return []
    return db.query(Customer).filter(Customer.id.in_(ids)).order_by(Customer.customer_name).all()


def get_customer_sales(db: Session, customer_id: int, skip: int = 0, limit: int = 50) -> list:
    """Get all sales for a specific customer."""
    from app.sales.models import Sale
    from app.sales.service import get_sale_with_customer_name
    sales = (
        db.query(Sale)
        .filter(Sale.customer_id == customer_id)
        .order_by(Sale.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [get_sale_with_customer_name(db, s) for s in sales]


def get_customer_ledger(
    db: Session,
    customer_id: int,
    date_from: str | None = None,
    date_to: str | None = None,
    month: int | None = None,
    year: int | None = None,
) -> dict:
    """Get customer ledger with optional date filtering. Returns summary + entries."""
    from app.customers.models import CustomerLedger
    from datetime import datetime, date as date_type
    from decimal import Decimal

    customer = get_customer(db, customer_id)
    query = db.query(CustomerLedger).filter(CustomerLedger.customer_id == customer_id)

    # Build date filters
    filter_start = None
    filter_end = None

    if date_from:
        filter_start = datetime.strptime(date_from, "%Y-%m-%d")
    if date_to:
        filter_end = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59)

    if month and year:
        import calendar
        filter_start = datetime(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        filter_end = datetime(year, month, last_day, 23, 59, 59)
    elif year and not month:
        filter_start = datetime(year, 1, 1)
        filter_end = datetime(year, 12, 31, 23, 59, 59)

    if filter_start:
        query = query.filter(CustomerLedger.transaction_date >= filter_start)
    if filter_end:
        query = query.filter(CustomerLedger.transaction_date <= filter_end)

    entries = query.order_by(CustomerLedger.transaction_date.asc(), CustomerLedger.id.asc()).all()

    # Calculate opening balance: balance before filter_start
    opening_balance = 0.0
    if filter_start:
        prior_entry = (
            db.query(CustomerLedger)
            .filter(
                CustomerLedger.customer_id == customer_id,
                CustomerLedger.transaction_date < filter_start,
            )
            .order_by(CustomerLedger.transaction_date.desc(), CustomerLedger.id.desc())
            .first()
        )
        if prior_entry:
            opening_balance = float(prior_entry.balance_after or 0)

    total_debit = sum(float(e.debit or 0) for e in entries)
    total_credit = sum(float(e.credit or 0) for e in entries)
    closing_balance = float(entries[-1].balance_after) if entries else opening_balance

    return {
        "opening_balance": opening_balance,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "closing_balance": closing_balance,
        "entries": entries,
        "customer_name": customer.customer_name,
        "customer_phone": customer.phone_number,
        "customer_gstin": customer.gstin,
        "date_from": date_from or (filter_start.strftime("%Y-%m-%d") if filter_start else None),
        "date_to": date_to or (filter_end.strftime("%Y-%m-%d") if filter_end else None),
    }


def generate_ledger_pdf(customer, entries, summary, shop_settings, date_from=None, date_to=None):
    """Generate a professional A4 PDF of the customer ledger using ReportLab."""
    import io
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    elements = []

    # Custom styles
    title_style = ParagraphStyle(
        'LedgerTitle', parent=styles['Heading1'],
        fontSize=18, alignment=TA_CENTER, spaceAfter=2 * mm,
        textColor=colors.HexColor('#1e293b'),
    )
    subtitle_style = ParagraphStyle(
        'Subtitle', parent=styles['Normal'],
        fontSize=9, alignment=TA_CENTER, textColor=colors.HexColor('#64748b'),
    )
    header_style = ParagraphStyle(
        'Header', parent=styles['Normal'],
        fontSize=10, textColor=colors.HexColor('#334155'),
    )
    small_style = ParagraphStyle(
        'Small', parent=styles['Normal'],
        fontSize=8, textColor=colors.HexColor('#94a3b8'),
    )

    # --- Shop Header ---
    shop_name = shop_settings.shop_name or "Retail Store"
    elements.append(Paragraph(f"<b>{shop_name}</b>", title_style))
    if shop_settings.shop_address:
        elements.append(Paragraph(shop_settings.shop_address, subtitle_style))
    contact_parts = []
    if shop_settings.shop_phone:
        contact_parts.append(f"Phone: {shop_settings.shop_phone}")
    if shop_settings.shop_email:
        contact_parts.append(f"Email: {shop_settings.shop_email}")
    if contact_parts:
        elements.append(Paragraph(" | ".join(contact_parts), subtitle_style))
    if shop_settings.shop_gstin:
        elements.append(Paragraph(f"<b>GSTIN: {shop_settings.shop_gstin}</b>", subtitle_style))

    elements.append(Spacer(1, 3 * mm))

    # --- Divider ---
    divider_data = [['CUSTOMER LEDGER STATEMENT']]
    divider_table = Table(divider_data, colWidths=[doc.width])
    divider_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#4F46E5')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(divider_table)
    elements.append(Spacer(1, 3 * mm))

    # --- Customer Info + Date Range ---
    from datetime import datetime
    date_range_str = "All Time"
    if date_from and date_to:
        date_range_str = f"{date_from} to {date_to}"
    elif date_from:
        date_range_str = f"From {date_from}"
    elif date_to:
        date_range_str = f"Up to {date_to}"

    left_col = [
        Paragraph(f"<b>Customer:</b> {customer.customer_name}", header_style),
        Paragraph(f"<b>Phone:</b> {customer.phone_number or 'N/A'}", header_style),
        Paragraph(f"<b>GSTIN:</b> {customer.gstin or 'N/A'}", header_style),
    ]
    right_col = [
        Paragraph(f"<b>Period:</b> {date_range_str}", header_style),
        Paragraph(f"<b>Generated:</b> {datetime.now().strftime('%d/%m/%Y %I:%M %p')}", header_style),
        Paragraph(f"<b>Address:</b> {customer.address or 'N/A'}", header_style),
    ]

    meta_data = [[left_col[i], right_col[i]] for i in range(3)]
    meta_table = Table(meta_data, colWidths=[doc.width / 2, doc.width / 2])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 4 * mm))

    # --- Opening Balance Row ---
    opening_data = [[
        '', '', '',
        Paragraph('<b>Opening Balance:</b>', ParagraphStyle('ob', parent=styles['Normal'], fontSize=9, alignment=TA_RIGHT)),
        Paragraph(f"<b>Rs. {summary['opening_balance']:,.2f}</b>", ParagraphStyle('obv', parent=styles['Normal'], fontSize=9, alignment=TA_RIGHT)),
    ]]
    ob_table = Table(opening_data, colWidths=[25 * mm, 65 * mm, 30 * mm, 30 * mm, 30 * mm])
    ob_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    elements.append(ob_table)
    elements.append(Spacer(1, 1 * mm))

    # --- Ledger Table ---
    table_header = ['Date', 'Description', 'Debit (Dr)', 'Credit (Cr)', 'Balance']
    col_widths = [25 * mm, 65 * mm, 30 * mm, 30 * mm, 30 * mm]
    table_data = [table_header]

    for entry in entries:
        tx_date = entry.transaction_date
        date_str = tx_date.strftime("%d/%m/%Y") if tx_date else ""
        debit_str = f"Rs. {float(entry.debit):,.2f}" if float(entry.debit or 0) > 0 else "-"
        credit_str = f"Rs. {float(entry.credit):,.2f}" if float(entry.credit or 0) > 0 else "-"
        balance_str = f"Rs. {float(entry.balance_after):,.2f}"
        table_data.append([date_str, entry.description or "", debit_str, credit_str, balance_str])

    ledger_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    ledger_table.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#334155')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        # Body
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#475569')),
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        # Alternating rows
        *[('BACKGROUND', (0, i), (-1, i), colors.HexColor('#fafafa')) for i in range(2, len(table_data), 2)],
    ]))
    elements.append(ledger_table)
    elements.append(Spacer(1, 3 * mm))

    # --- Summary Row ---
    summary_data = [
        ['', 'Totals:', f"Rs. {summary['total_debit']:,.2f}", f"Rs. {summary['total_credit']:,.2f}", ''],
        ['', '', '', 'Closing Balance:', f"Rs. {summary['closing_balance']:,.2f}"],
    ]
    summary_table = Table(summary_data, colWidths=col_widths)
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1e293b')),
        ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEABOVE', (0, 0), (-1, 0), 1.5, colors.HexColor('#4F46E5')),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 8 * mm))

    # --- Footer ---
    elements.append(Paragraph(
        "This is a computer-generated statement and does not require a signature.",
        ParagraphStyle('Footer', parent=styles['Normal'], fontSize=7, alignment=TA_CENTER,
                       textColor=colors.HexColor('#94a3b8')),
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_ledger_csv(customer, entries, summary):
    """Generate a CSV of the customer ledger entries."""
    import io
    import csv

    buffer = io.StringIO()
    writer = csv.writer(buffer)

    # Header info
    writer.writerow(["Customer Ledger Statement"])
    writer.writerow(["Customer", customer.customer_name])
    writer.writerow(["Phone", customer.phone_number or "N/A"])
    writer.writerow(["GSTIN", customer.gstin or "N/A"])
    if summary.get("date_from") or summary.get("date_to"):
        writer.writerow(["Period", f"{summary.get('date_from', 'Start')} to {summary.get('date_to', 'Present')}"])
    writer.writerow([])

    # Opening balance
    writer.writerow(["Opening Balance", "", "", "", f"{summary['opening_balance']:.2f}"])
    writer.writerow([])

    # Column headers
    writer.writerow(["Date", "Type", "Description", "Debit (Dr)", "Credit (Cr)", "Balance"])

    for entry in entries:
        tx_date = entry.transaction_date.strftime("%d/%m/%Y") if entry.transaction_date else ""
        writer.writerow([
            tx_date,
            entry.transaction_type.value if hasattr(entry.transaction_type, 'value') else str(entry.transaction_type),
            entry.description or "",
            f"{float(entry.debit or 0):.2f}",
            f"{float(entry.credit or 0):.2f}",
            f"{float(entry.balance_after or 0):.2f}",
        ])

    # Summary
    writer.writerow([])
    writer.writerow(["", "", "Total Debit", f"{summary['total_debit']:.2f}"])
    writer.writerow(["", "", "Total Credit", f"{summary['total_credit']:.2f}"])
    writer.writerow(["", "", "Closing Balance", f"{summary['closing_balance']:.2f}"])

    buffer.seek(0)
    return buffer


def record_account_payment(db: Session, customer_id: int, amount: float, method: str, description: str, user: User) -> dict:
    from app.customers.models import CustomerLedger, TransactionType
    from decimal import Decimal
    from app.sales.service import money

    customer = get_customer(db, customer_id)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be positive")

    payment_amount = money(amount)
    customer.current_balance = money(customer.current_balance or 0) - payment_amount

    ledger_entry = CustomerLedger(
        customer_id=customer.id,
        transaction_type=TransactionType.payment,
        debit=Decimal("0.00"),
        credit=payment_amount,
        balance_after=customer.current_balance,
        description=description,
    )
    db.add(ledger_entry)

    # Distribute payment to unpaid sales
    from app.sales.models import Sale, PaymentStatus
    unpaid_sales = db.query(Sale).filter(
        Sale.customer_id == customer_id,
        Sale.payment_status.in_([PaymentStatus.unpaid, PaymentStatus.partial]),
        Sale.status == "completed"
    ).order_by(Sale.created_at.asc()).all()

    remaining_amount = payment_amount
    for sale in unpaid_sales:
        if remaining_amount <= 0:
            break
        due = money(sale.amount_due)
        if due > 0:
            pay = min(due, remaining_amount)
            sale.amount_paid = money(money(sale.amount_paid or 0) + pay)
            sale.amount_due = money(sale.total_amount - sale.amount_paid)
            remaining_amount -= pay

            if sale.amount_due <= 0:
                sale.payment_status = PaymentStatus.paid
            else:
                sale.payment_status = PaymentStatus.partial

    log_action(db, user, "UPDATE", "customer", customer.id, old_values={}, new_values={"payment_received": amount, "new_balance": float(customer.current_balance)})

    db.commit()
    db.refresh(customer)
    return {"message": "Payment recorded", "current_balance": float(customer.current_balance)}

