from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.invoices.models import Invoice
from app.invoices.pdf_generator import generate_invoice_pdf
from app.sales.models import Sale
from app.customers.models import Customer
from app.settings.service import get_settings


def get_or_create_invoice(db: Session, sale_id: int) -> tuple:
    """Get or create invoice for a sale. Returns (invoice, pdf_buffer)."""
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    # Get customer
    customer = None
    if sale.customer_id:
        customer = db.query(Customer).filter(Customer.id == sale.customer_id).first()

    # Get shop settings
    shop_settings = get_settings(db)

    # Generate PDF
    pdf_buffer = generate_invoice_pdf(sale, sale.items, shop_settings, customer)

    # Create or update invoice record
    invoice = db.query(Invoice).filter(Invoice.sale_id == sale_id).first()
    if not invoice:
        invoice = Invoice(
            sale_id=sale_id,
            invoice_number=sale.invoice_number,
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)

    return invoice, pdf_buffer


def get_invoices(db: Session, skip: int = 0, limit: int = 50) -> list:
    """List all invoices."""
    return (
        db.query(Invoice)
        .order_by(Invoice.generated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
