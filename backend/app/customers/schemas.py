from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal


class CustomerCreate(BaseModel):
    customer_name: str
    phone_number: Optional[str] = None
    email: Optional[str] = None
    address: str = ""
    gstin: Optional[str] = None
    state: str = ""


class CustomerUpdate(BaseModel):
    customer_name: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    state: Optional[str] = None


class CustomerResponse(BaseModel):
    id: int
    customer_name: str
    phone_number: Optional[str] = None
    email: Optional[str] = None
    address: str
    gstin: Optional[str] = None
    state: str
    total_purchases: float
    current_balance: float = 0.0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CustomerLedgerResponse(BaseModel):
    id: int
    customer_id: int
    transaction_date: datetime
    transaction_type: str
    reference_id: Optional[int] = None
    debit: float
    credit: float
    balance_after: float
    description: str

    class Config:
        from_attributes = True


class CustomerLedgerSummary(BaseModel):
    opening_balance: float = 0.0
    total_debit: float = 0.0
    total_credit: float = 0.0
    closing_balance: float = 0.0
    entries: list[CustomerLedgerResponse] = []
    customer_name: str = ""
    customer_phone: Optional[str] = None
    customer_gstin: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None


class CustomerPaymentCreate(BaseModel):
    amount: float
    payment_method: str = "cash"
    description: str = "Account Payment"
