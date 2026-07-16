from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional

from app.core.dependencies import get_db, get_current_user, require_admin
from app.customers import schemas, service
from app.auth.models import User

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("/credit-due", response_model=list[schemas.CustomerResponse])
def credit_due_customers(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get customers with outstanding credit sales."""
    customers = service.get_customers_with_credit_sales(db)
    return [schemas.CustomerResponse.model_validate(c) for c in customers]


@router.get("", response_model=dict)
def list_customers(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List customers with search and pagination."""
    customers, total = service.get_customers(db, search, skip, limit)
    return {
        "customers": [schemas.CustomerResponse.model_validate(c) for c in customers],
        "total": total,
    }


@router.get("/{customer_id}", response_model=schemas.CustomerResponse)
def get_customer(
    customer_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get customer detail."""
    customer = service.get_customer(db, customer_id)
    return schemas.CustomerResponse.model_validate(customer)


@router.post("", response_model=schemas.CustomerResponse)
def create_customer(
    data: schemas.CustomerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new customer."""
    customer = service.create_customer(db, data.model_dump(), current_user)
    return schemas.CustomerResponse.model_validate(customer)


@router.put("/{customer_id}", response_model=schemas.CustomerResponse)
def update_customer(
    customer_id: int,
    data: schemas.CustomerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a customer."""
    customer = service.update_customer(db, customer_id, data.model_dump(exclude_unset=True), current_user)
    return schemas.CustomerResponse.model_validate(customer)


@router.delete("/{customer_id}")
def delete_customer(
    customer_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a customer (admin only)."""
    service.delete_customer(db, customer_id, admin)
    return {"message": "Customer deleted successfully"}


@router.get("/{customer_id}/sales")
def customer_sales(
    customer_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all sales for a specific customer."""
    # Verify customer exists
    service.get_customer(db, customer_id)
    sales = service.get_customer_sales(db, customer_id, skip, limit)
    return sales


@router.get("/{customer_id}/ledger", response_model=schemas.CustomerLedgerSummary)
def get_customer_ledger(
    customer_id: int,
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Filter by month (1-12)"),
    year: Optional[int] = Query(None, description="Filter by year (e.g. 2026)"),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get customer ledger with date filtering."""
    return service.get_customer_ledger(db, customer_id, date_from, date_to, month, year)


@router.get("/{customer_id}/ledger/download/pdf")
def download_ledger_pdf(
    customer_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download customer ledger as PDF."""
    from app.settings.service import get_settings

    customer = service.get_customer(db, customer_id)
    ledger_data = service.get_customer_ledger(db, customer_id, date_from, date_to, month, year)
    shop_settings = get_settings(db)

    pdf_buffer = service.generate_ledger_pdf(
        customer, ledger_data["entries"], ledger_data, shop_settings,
        date_from=ledger_data.get("date_from"), date_to=ledger_data.get("date_to"),
    )

    filename = f"Ledger_{customer.customer_name.replace(' ', '_')}_{date_from or 'all'}_{date_to or 'time'}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{customer_id}/ledger/download/csv")
def download_ledger_csv(
    customer_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download customer ledger as CSV."""
    customer = service.get_customer(db, customer_id)
    ledger_data = service.get_customer_ledger(db, customer_id, date_from, date_to, month, year)

    csv_buffer = service.generate_ledger_csv(customer, ledger_data["entries"], ledger_data)

    filename = f"Ledger_{customer.customer_name.replace(' ', '_')}_{date_from or 'all'}_{date_to or 'time'}.csv"
    return StreamingResponse(
        iter([csv_buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{customer_id}/payments")
def record_account_payment(
    customer_id: int,
    data: schemas.CustomerPaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a lump sum payment against a customer's account."""
    return service.record_account_payment(
        db, customer_id, data.amount, data.payment_method, data.description, current_user
    )

