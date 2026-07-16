from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class InvoiceResponse(BaseModel):
    id: int
    sale_id: int
    invoice_number: str
    pdf_path: Optional[str] = None
    generated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
