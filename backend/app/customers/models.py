import enum
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class TransactionType(str, enum.Enum):
    sale = "sale"
    payment = "payment"
    refund = "refund"
    opening_balance = "opening_balance"


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(200), nullable=False, index=True)
    phone_number = Column(String(15), unique=True, nullable=True, index=True)
    email = Column(String(100), nullable=True)
    address = Column(String(500), default="")
    gstin = Column(String(15), nullable=True)
    state = Column(String(50), default="")  # For CGST/SGST vs IGST determination
    total_purchases = Column(
        Numeric(12, 2),
        default=0.00
    )
    current_balance = Column(
        Numeric(12, 2),
        default=0.00
    )
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ledger_entries = relationship("CustomerLedger", back_populates="customer", cascade="all, delete-orphan")


class CustomerLedger(Base):
    __tablename__ = "customer_ledger"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    transaction_date = Column(DateTime(timezone=True), server_default=func.now())
    transaction_type = Column(SAEnum(TransactionType), nullable=False)
    reference_id = Column(Integer, nullable=True)  # sale_id, etc.
    debit = Column(Numeric(12, 2), default=0.00)   # Amount charged to customer
    credit = Column(Numeric(12, 2), default=0.00)  # Amount paid by customer
    balance_after = Column(Numeric(12, 2), default=0.00)
    description = Column(String(255), default="")

    customer = relationship("Customer", back_populates="ledger_entries")

