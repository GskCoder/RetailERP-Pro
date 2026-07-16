from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.sales.models import Sale, SaleItem, PaymentMethod, PaymentStatus, SaleStatus
from app.products.models import Product
from app.customers.models import Customer
from app.settings.service import get_settings
from app.inventory.service import record_movement
from app.inventory.models import TransactionType
from app.audit.service import log_action
from app.auth.models import User

def money(value):
    return Decimal(str(value)).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP
    )

def _generate_invoice_number(db: Session) -> str:
    """Generate unique invoice number: PREFIX-YYYYMMDD-XXXX."""
    settings = get_settings(db)
    prefix = settings.invoice_prefix or "INV"
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    pattern = f"{prefix}-{today}-%"

    # Count existing invoices for today
    count = db.query(Sale).filter(Sale.invoice_number.like(pattern)).count()
    seq = str(count + 1).zfill(4)
    return f"{prefix}-{today}-{seq}"


def _calculate_item_gst(unit_price: float, quantity: int, discount: float, gst_percentage: float, is_inter_state: bool) -> dict:
    """Calculate GST for a single item."""
    unit_price = money(unit_price)
    discount = money(discount)
    gst_percentage = Decimal(str(gst_percentage))

    taxable_value = (
        unit_price * quantity
    ) - discount

    gst_amount = (
        taxable_value
        * gst_percentage
        / Decimal("100")
    )

    if is_inter_state:
        return {
            "cgst": Decimal("0.00"),
            "sgst": Decimal("0.00"),
            "igst": money(gst_amount),
            "total": money(taxable_value + gst_amount),
            "taxable_value": money(taxable_value),
        }
    else:
        half_gst = money(gst_amount / 2)
        return {
            "cgst": half_gst,
            "sgst": half_gst,
            "igst": Decimal("0.00"),
            "total": money(taxable_value + gst_amount),
            "taxable_value": money(taxable_value),
        }


def create_sale(db: Session, data: dict, user: User) -> Sale:
    """Create a sale with GST calculation, stock deduction, and payment tracking."""
    settings = get_settings(db)
    shop_state = (settings.shop_state or "").strip().lower()

    # Determine if inter-state
    customer = None
    is_inter_state = False
    if data.get("customer_id"):
        customer = db.query(Customer).filter(Customer.id == data["customer_id"]).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        customer_state = (customer.state or "").strip().lower()
        if customer_state and shop_state and customer_state != shop_state:
            is_inter_state = True

    # Generate invoice number
    invoice_number = _generate_invoice_number(db)

    # Process items
    sale_items = []
    total_subtotal = Decimal("0.00")
    total_cgst = Decimal("0.00")
    total_sgst = Decimal("0.00")
    total_igst = Decimal("0.00")
    total_profit = Decimal("0.00")

    for item_data in data["items"]:
        product = db.query(Product).filter(Product.id == item_data["product_id"]).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product ID {item_data['product_id']} not found")

        if product.stock_quantity < item_data["quantity"]:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{product.product_name}'. Available: {product.stock_quantity}",
            )

        item_discount = item_data.get("discount", 0)
        gst_result = _calculate_item_gst(
            product.selling_price, item_data["quantity"], item_discount,
            product.gst_percentage, is_inter_state,
        )

        item_profit = (money(product.selling_price) - money(product.purchase_price)) * item_data["quantity"] - money(item_discount)

        sale_item = SaleItem(
            product_id=product.id,
            product_name=product.product_name,
            hsn_code=product.hsn_code or "",
            quantity=item_data["quantity"],
            unit_price=product.selling_price,
            discount=item_discount,
            gst_percentage=product.gst_percentage,
            cgst=gst_result["cgst"],
            sgst=gst_result["sgst"],
            igst=gst_result["igst"],
            total=gst_result["total"],
        )
        sale_items.append(sale_item)

        total_subtotal += gst_result["taxable_value"]
        total_cgst += gst_result["cgst"]
        total_sgst += gst_result["sgst"]
        total_igst += gst_result["igst"]
        total_profit += item_profit

    overall_discount = money(data.get("discount_amount", 0))

    total_amount = money(
        total_subtotal
        + total_cgst
        + total_sgst
        + total_igst
        - overall_discount
    )

    # Payment handling
    payment_method = data.get("payment_method", "cash")
    amount_paid = data.get("amount_paid")
    due_date = data.get("due_date")

    if payment_method == "credit":
        if amount_paid is None:
            amount_paid = 0
        amount_due = money(
            money(total_amount)
            - money(amount_paid)
        )
        if amount_paid >= total_amount:
            payment_status = "paid"
            amount_due = 0
        elif amount_paid > 0:
            payment_status = "partial"
        else:
            payment_status = "unpaid"
    else:
        amount_paid = total_amount
        amount_due = 0
        payment_status = "paid"

    # Create sale
    sale = Sale(
        invoice_number=invoice_number,
        customer_id=data.get("customer_id"),
        user_id=user.id,
        subtotal=round(total_subtotal, 2),
        discount_amount=overall_discount,
        cgst=round(total_cgst, 2),
        sgst=round(total_sgst, 2),
        igst=round(total_igst, 2),
        total_amount=total_amount,
        profit=round(total_profit - overall_discount, 2),
        payment_method=payment_method,
        payment_status=payment_status,
        amount_paid=round(amount_paid, 2),
        amount_due=round(amount_due, 2),
        due_date=due_date,
        status="completed",
    )
    sale.items = sale_items
    db.add(sale)
    db.flush()

    # Ledger entries for customer
    if customer:
        from app.customers.models import CustomerLedger, TransactionType as CustomerTransactionType
        
        # Add sale total as debit
        customer.current_balance = money(customer.current_balance or 0) + total_amount
        debit_entry = CustomerLedger(
            customer_id=customer.id,
            transaction_type=CustomerTransactionType.sale,
            reference_id=sale.id,
            debit=total_amount,
            credit=Decimal("0.00"),
            balance_after=customer.current_balance,
            description=f"Sale Invoice {invoice_number}"
        )
        db.add(debit_entry)

        # If payment made at sale time, add credit
        if amount_paid > 0:
            payment_amount = money(amount_paid)
            customer.current_balance = customer.current_balance - payment_amount
            credit_entry = CustomerLedger(
                customer_id=customer.id,
                transaction_type=CustomerTransactionType.payment,
                reference_id=sale.id,
                debit=Decimal("0.00"),
                credit=payment_amount,
                balance_after=customer.current_balance,
                description=f"Initial Payment for Invoice {invoice_number}"
            )
            db.add(credit_entry)

    # Deduct stock via inventory ledger
    for item_data in data["items"]:
        record_movement(
            db, item_data["product_id"],
            TransactionType.SALE,
            -item_data["quantity"],
            f"Sale {invoice_number}",
            user,
        )

    # Update customer total_purchases
    if customer:
        customer.total_purchases = (customer.total_purchases or 0) + total_amount

    # Audit log
    log_action(db, user, "CREATE", "sale", sale.id, new_values={
        "invoice_number": invoice_number,
        "total_amount": total_amount,
        "payment_method": payment_method,
        "items_count": len(sale_items),
    })

    db.commit()
    db.refresh(sale)
    return sale


def get_sales(
    db: Session,
    status: str | None = None,
    payment_status: str | None = None,
    customer_id: int | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple:
    query = db.query(Sale)
    if status:
        query = query.filter(Sale.status == status)
    if payment_status:
        query = query.filter(Sale.payment_status == payment_status)
    if customer_id:
        query = query.filter(Sale.customer_id == customer_id)

    total = query.count()
    sales = query.order_by(Sale.created_at.desc()).offset(skip).limit(limit).all()
    return sales, total


def get_sale(db: Session, sale_id: int) -> Sale:
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return sale


def get_sale_with_customer_name(db: Session, sale: Sale) -> dict:
    """Convert sale to response dict with customer_name."""
    customer_name = None
    if sale.customer_id:
        customer = db.query(Customer).filter(Customer.id == sale.customer_id).first()
        if customer:
            customer_name = customer.customer_name

    # Serialize items to dicts
    items = []
    for item in sale.items:
        items.append({
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product_name,
            "hsn_code": item.hsn_code,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "discount": item.discount,
            "gst_percentage": item.gst_percentage,
            "cgst": item.cgst,
            "sgst": item.sgst,
            "igst": item.igst,
            "total": item.total,
        })

    return {
        "id": sale.id,
        "invoice_number": sale.invoice_number,
        "customer_id": sale.customer_id,
        "customer_name": customer_name,
        "user_id": sale.user_id,
        "sale_date": sale.sale_date,
        "subtotal": sale.subtotal,
        "discount_amount": sale.discount_amount,
        "cgst": sale.cgst,
        "sgst": sale.sgst,
        "igst": sale.igst,
        "total_amount": sale.total_amount,
        "profit": sale.profit,
        "payment_method": sale.payment_method.value if hasattr(sale.payment_method, 'value') else sale.payment_method,
        "payment_status": sale.payment_status.value if hasattr(sale.payment_status, 'value') else sale.payment_status,
        "amount_paid": sale.amount_paid,
        "amount_due": sale.amount_due,
        "due_date": sale.due_date,
        "status": sale.status.value if hasattr(sale.status, 'value') else sale.status,
        "items": items,
        "created_at": sale.created_at,
    }


def return_sale(db: Session, sale_id: int, user: User) -> Sale:
    """Return a sale — restore stock, mark as returned."""
    sale = get_sale(db, sale_id)
    if sale.status != SaleStatus.completed:
        raise HTTPException(status_code=400, detail=f"Cannot return a {sale.status.value} sale")

    sale.status = SaleStatus.returned

    if sale.customer_id:
        customer = db.query(Customer).filter(Customer.id == sale.customer_id).first()
        if customer:
            from app.customers.models import CustomerLedger, TransactionType as CustomerTransactionType
            # Return reverses the outstanding balance
            refund_amount = money(sale.amount_due)
            if refund_amount > 0:
                customer.current_balance = money(customer.current_balance or 0) - refund_amount
                ledger_entry = CustomerLedger(
                    customer_id=customer.id,
                    transaction_type=CustomerTransactionType.refund,
                    reference_id=sale.id,
                    debit=Decimal("0.00"),
                    credit=refund_amount,
                    balance_after=customer.current_balance,
                    description=f"Return for Invoice {sale.invoice_number}"
                )
                db.add(ledger_entry)

    # Restore stock
    for item in sale.items:
        record_movement(
            db, item.product_id,
            TransactionType.RETURN,
            item.quantity,  # positive = stock in
            f"Return {sale.invoice_number}",
            user,
        )

    # Reverse customer total_purchases
    if sale.customer_id:
        customer = db.query(Customer).filter(Customer.id == sale.customer_id).first()
        if customer:
            customer.total_purchases = max(0, (customer.total_purchases or 0) - sale.total_amount)

    log_action(db, user, "RETURN", "sale", sale.id, old_values={
        "status": "completed",
        "invoice_number": sale.invoice_number,
    })

    db.commit()
    db.refresh(sale)
    return sale


def cancel_sale(db: Session, sale_id: int, user: User) -> Sale:
    """Cancel a sale — restore stock, mark as cancelled."""
    sale = get_sale(db, sale_id)
    if sale.status != SaleStatus.completed:
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {sale.status.value} sale")

    sale.status = SaleStatus.cancelled

    if sale.customer_id:
        customer = db.query(Customer).filter(Customer.id == sale.customer_id).first()
        if customer:
            from app.customers.models import CustomerLedger, TransactionType as CustomerTransactionType
            refund_amount = money(sale.amount_due)
            if refund_amount > 0:
                customer.current_balance = money(customer.current_balance or 0) - refund_amount
                ledger_entry = CustomerLedger(
                    customer_id=customer.id,
                    transaction_type=CustomerTransactionType.refund,
                    reference_id=sale.id,
                    debit=Decimal("0.00"),
                    credit=refund_amount,
                    balance_after=customer.current_balance,
                    description=f"Cancelled Invoice {sale.invoice_number}"
                )
                db.add(ledger_entry)

    # Restore stock
    for item in sale.items:
        record_movement(
            db, item.product_id,
            TransactionType.RETURN,
            item.quantity,
            f"Cancelled {sale.invoice_number}",
            user,
        )

    # Reverse customer total_purchases
    if sale.customer_id:
        customer = db.query(Customer).filter(Customer.id == sale.customer_id).first()
        if customer:
            customer.total_purchases = max(0, (customer.total_purchases or 0) - sale.total_amount)

    log_action(db, user, "CANCEL", "sale", sale.id, old_values={
        "status": "completed",
        "invoice_number": sale.invoice_number,
    })

    db.commit()
    db.refresh(sale)
    return sale


def record_payment(db: Session, sale_id: int, amount: float, user: User) -> Sale:
    """Record a payment against a credit sale."""
    sale = get_sale(db, sale_id)
    if sale.status != SaleStatus.completed:
        raise HTTPException(status_code=400, detail="Can only record payment for completed sales")
    if sale.payment_status == PaymentStatus.paid:
        raise HTTPException(status_code=400, detail="Sale is already fully paid")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be positive")

    old_paid = sale.amount_paid
    sale.amount_paid = money(money(sale.amount_paid or 0) + money(amount))
    sale.amount_due = money(sale.total_amount - sale.amount_paid)

    if sale.amount_due <= 0:
        sale.amount_due = 0
        sale.payment_status = PaymentStatus.paid
    else:
        sale.payment_status = PaymentStatus.partial

    if sale.customer_id:
        customer = db.query(Customer).filter(Customer.id == sale.customer_id).first()
        if customer:
            from app.customers.models import CustomerLedger, TransactionType as CustomerTransactionType
            payment_amount = money(amount)
            customer.current_balance = money(customer.current_balance or 0) - payment_amount
            ledger_entry = CustomerLedger(
                customer_id=customer.id,
                transaction_type=CustomerTransactionType.payment,
                reference_id=sale.id,
                debit=Decimal("0.00"),
                credit=payment_amount,
                balance_after=customer.current_balance,
                description=f"Payment for Invoice {sale.invoice_number}"
            )
            db.add(ledger_entry)

    log_action(db, user, "UPDATE", "sale", sale.id, old_values={
        "amount_paid": old_paid,
        "payment_status": "partial" if old_paid > 0 else "unpaid",
    }, new_values={
        "amount_paid": sale.amount_paid,
        "amount_due": sale.amount_due,
        "payment_status": sale.payment_status.value,
        "payment_recorded": amount,
    })

    db.commit()
    db.refresh(sale)
    return sale


def get_credit_pending(db: Session) -> list:
    """Get all sales with outstanding credit."""
    return (
        db.query(Sale)
        .filter(Sale.payment_status.in_(["partial", "unpaid"]), Sale.status == "completed")
        .order_by(Sale.due_date, Sale.created_at.desc())
        .all()
    )


def get_today_sales_summary(db: Session) -> dict:
    """Get today's sales summary for dashboard."""
    from datetime import date
    today = date.today()

    # Filter in Python for SQLite compatibility
    all_completed = db.query(Sale).filter(Sale.status == "completed").all()
    today_sales = [s for s in all_completed
                   if s.created_at and s.created_at.date() == today]

    return {
        "today_count": len(today_sales),
        "today_revenue": float(money(sum(Decimal(str(s.total_amount))for s in today_sales))),
        "today_profit": float(money(sum(Decimal(str(s.profit))for s in today_sales))),
    }