from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.invoices import schemas, service

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.get("", response_model=list[schemas.InvoiceResponse])
def list_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all invoices."""
    invoices = service.get_invoices(db, skip, limit)
    return [schemas.InvoiceResponse.model_validate(inv) for inv in invoices]


@router.get("/{sale_id}/pdf")
def download_invoice_pdf(
    sale_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download invoice PDF for a sale."""
    invoice, pdf_buffer = service.get_or_create_invoice(db, sale_id)
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="invoice_{invoice.invoice_number}.pdf"'
        },
    )
