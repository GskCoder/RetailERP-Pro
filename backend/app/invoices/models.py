from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.core.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), unique=True, nullable=False)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)
    pdf_path = Column(String(500), nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
