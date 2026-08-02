"""Comprehensive seed script — populates ALL modules with realistic demo data.

Idempotent: only seeds if the database is empty (checks products table).
Run standalone:  python seed.py
Also called from main.py lifespan on first boot.
"""

import random
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from app.core.database import create_tables, SessionLocal
from app.core.security import hash_password
from app.auth.models import User, UserRole
from app.settings.models import ShopSettings
from app.products.models import Category, Product
from app.customers.models import Customer, CustomerLedger, TransactionType as CustTxnType
from app.suppliers.models import Supplier
from app.sales.models import Sale, SaleItem, PaymentMethod, PaymentStatus, SaleStatus
from app.inventory.models import InventoryTransaction, TransactionType as InvTxnType
from app.purchases.models import Purchase, PurchaseItem, PurchaseStatus, PaymentStatus as PurchPayStatus
from app.expenses.models import Expense, ExpenseCategory
from app.audit.models import AuditLog

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _money(v):
    return float(Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _rand_date(days_back=30):
    """Random datetime within the last `days_back` days."""
    delta = random.randint(0, days_back * 24 * 60)
    return datetime.now(timezone.utc) - timedelta(minutes=delta)


def _rand_past_date(days_back=30):
    """Random date (not datetime) within last `days_back` days."""
    return date.today() - timedelta(days=random.randint(0, days_back))


# ---------------------------------------------------------------------------
# Seed functions
# ---------------------------------------------------------------------------

def seed_admin(db):
    """Create default admin if no users exist."""
    if db.query(User).first():
        return db.query(User).filter(User.username == "admin").first()

    admin = User(
        username="admin",
        email="admin@retailerp.local",
        hashed_password=hash_password("admin123"),
        role=UserRole.admin,
        is_active=True,
        must_change_password=False,  # Demo mode — no forced reset
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    print("[OK] Default admin created: admin / admin123")
    return admin


def seed_settings(db):
    """Configure shop settings for demo store."""
    settings = db.query(ShopSettings).first()
    if not settings:
        settings = ShopSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # Update with demo store info
    settings.shop_name = "Gaurav Electronics"
    settings.shop_address = "Shop No. 12, Hazratganj Market, Lucknow, UP - 226001"
    settings.shop_phone = "9876543210"
    settings.shop_email = "gaurav.electronics@gmail.com"
    settings.shop_gstin = "09AABCU9603R1ZP"
    settings.shop_state = "Uttar Pradesh"
    settings.invoice_prefix = "GE"
    db.commit()
    print("[OK] Shop settings configured")


def seed_categories(db):
    """Create product categories."""
    if db.query(Category).count() > 0:
        return

    categories = [
        ("Mobile Phones", "Smartphones and feature phones"),
        ("Accessories", "Phone cases, screen guards, chargers"),
        ("Audio", "Headphones, earbuds, speakers"),
        ("Cables & Adapters", "USB cables, HDMI, adapters"),
        ("Storage", "Pen drives, memory cards, hard drives"),
        ("Wearables", "Smartwatches, fitness bands"),
        ("Lighting", "LED bulbs, desk lamps, strip lights"),
        ("Electronics", "Power banks, calculators, misc electronics"),
    ]
    for name, desc in categories:
        db.add(Category(name=name, description=desc))
    db.commit()
    print(f"[OK] {len(categories)} categories seeded")


def seed_expense_categories(db):
    """Seed default expense categories if none exist."""
    if db.query(ExpenseCategory).count() > 0:
        return

    defaults = [
        ("Rent", "Shop/office rent"),
        ("Salary", "Employee wages and salaries"),
        ("Utilities", "Electricity, water, internet bills"),
        ("Transport", "Delivery and transportation costs"),
        ("Maintenance", "Repairs and maintenance"),
        ("Supplies", "Office and shop supplies"),
        ("Marketing", "Advertising and promotion"),
        ("Miscellaneous", "Other business expenses"),
    ]
    for name, desc in defaults:
        db.add(ExpenseCategory(name=name, description=desc))
    db.commit()
    print(f"[OK] {len(defaults)} expense categories seeded")


def seed_suppliers(db):
    """Create Indian suppliers."""
    if db.query(Supplier).count() > 0:
        return db.query(Supplier).all()

    suppliers_data = [
        {
            "supplier_name": "Sunrise Distributors",
            "contact_person": "Rajesh Kumar",
            "phone_number": "9811234567",
            "email": "rajesh@sunrisedist.com",
            "address": "Plot 45, Nehru Place, New Delhi - 110019",
            "gstin": "07AAACS1234R1ZP",
            "state": "Delhi",
        },
        {
            "supplier_name": "TechZone Wholesale",
            "contact_person": "Amit Sharma",
            "phone_number": "9822345678",
            "email": "amit@techzonewholesale.in",
            "address": "B-12, Electronics Market, Lamington Road, Mumbai - 400004",
            "gstin": "27AABCT5678R1ZQ",
            "state": "Maharashtra",
        },
        {
            "supplier_name": "South India Electronics",
            "contact_person": "K. Venkatesh",
            "phone_number": "9833456789",
            "email": "venkatesh@sielec.com",
            "address": "No. 78, SP Road, Bengaluru - 560002",
            "gstin": "29AABCS9012R1ZR",
            "state": "Karnataka",
        },
        {
            "supplier_name": "Gupta Trading Co.",
            "contact_person": "Sunil Gupta",
            "phone_number": "9844567890",
            "email": "sunil@guptatrading.in",
            "address": "Sadar Bazaar, Kanpur, UP - 208001",
            "gstin": "09AABCG3456R1ZS",
            "state": "Uttar Pradesh",
        },
        {
            "supplier_name": "Eastern Electronics Hub",
            "contact_person": "Debashis Roy",
            "phone_number": "9855678901",
            "email": "debashis@easternhub.com",
            "address": "Chandni Chowk, Kolkata - 700072",
            "gstin": "19AABCE7890R1ZT",
            "state": "West Bengal",
        },
    ]

    suppliers = []
    for s in suppliers_data:
        sup = Supplier(**s)
        db.add(sup)
        suppliers.append(sup)
    db.commit()
    for s in suppliers:
        db.refresh(s)
    print(f"[OK] {len(suppliers)} suppliers seeded")
    return suppliers


def seed_products(db, suppliers):
    """Create realistic products with proper HSN codes and GST rates."""
    if db.query(Product).count() > 0:
        return db.query(Product).all()

    categories = {c.name: c.id for c in db.query(Category).all()}
    supplier_ids = [s.id for s in suppliers]

    products_data = [
        # Mobile Phones (HSN: 8517, GST: 18%)
        ("Samsung Galaxy M15", "Mobile Phones", "Samsung", "8517", 18, 8500, 11999, 50, 5, "8901234560001"),
        ("Redmi Note 14", "Mobile Phones", "Xiaomi", "8517", 18, 10500, 14999, 35, 5, "8901234560002"),
        ("iPhone 15 (128GB)", "Mobile Phones", "Apple", "8517", 18, 55000, 64999, 12, 3, "8901234560003"),
        ("Realme Narzo 70", "Mobile Phones", "Realme", "8517", 18, 7800, 10999, 40, 5, "8901234560004"),
        ("OnePlus Nord CE4", "Mobile Phones", "OnePlus", "8517", 18, 17500, 24999, 20, 3, "8901234560005"),

        # Accessories (HSN: 3926, GST: 18%)
        ("Tempered Glass (Universal)", "Accessories", "Generic", "3926", 18, 25, 149, 500, 50, "8901234560006"),
        ("iPhone 15 Silicone Case", "Accessories", "Generic", "3926", 18, 120, 499, 200, 30, "8901234560007"),
        ("65W Fast Charger (USB-C)", "Accessories", "Anker", "8504", 18, 450, 999, 100, 15, "8901234560008"),
        ("Car Phone Mount", "Accessories", "Generic", "3926", 18, 150, 399, 80, 10, "8901234560009"),
        ("Wireless Charging Pad", "Accessories", "Samsung", "8504", 18, 600, 1299, 45, 8, "8901234560010"),

        # Audio (HSN: 8518, GST: 18%)
        ("boAt Rockerz 450", "Audio", "boAt", "8518", 18, 700, 1499, 60, 10, "8901234560011"),
        ("JBL Tune 230NC TWS", "Audio", "JBL", "8518", 18, 2800, 4999, 25, 5, "8901234560012"),
        ("Sony WH-1000XM5", "Audio", "Sony", "8518", 18, 18000, 26990, 8, 2, "8901234560013"),
        ("boAt Airdopes 141", "Audio", "boAt", "8518", 18, 500, 1099, 100, 15, "8901234560014"),
        ("JBL Go 4 Speaker", "Audio", "JBL", "8518", 18, 2200, 3999, 30, 5, "8901234560015"),

        # Cables & Adapters (HSN: 8544, GST: 18%)
        ("USB-C to USB-C Cable 1m", "Cables & Adapters", "Anker", "8544", 18, 80, 249, 300, 30, "8901234560016"),
        ("Lightning Cable 1m (MFi)", "Cables & Adapters", "Apple", "8544", 18, 350, 999, 120, 15, "8901234560017"),
        ("HDMI 2.1 Cable 2m", "Cables & Adapters", "Generic", "8544", 18, 200, 599, 80, 10, "8901234560018"),
        ("USB-C Hub 7-in-1", "Cables & Adapters", "Anker", "8473", 18, 1200, 2499, 35, 5, "8901234560019"),

        # Storage (HSN: 8523, GST: 18%)
        ("SanDisk 64GB Pen Drive", "Storage", "SanDisk", "8523", 18, 250, 499, 150, 20, "8901234560020"),
        ("Samsung 256GB microSD", "Storage", "Samsung", "8523", 18, 1200, 2199, 60, 10, "8901234560021"),
        ("WD 1TB External HDD", "Storage", "WD", "8523", 18, 2800, 4299, 20, 3, "8901234560022"),

        # Wearables (HSN: 9102, GST: 18%)
        ("Fire-Boltt Phoenix Ultra", "Wearables", "Fire-Boltt", "9102", 18, 900, 1999, 50, 8, "8901234560023"),
        ("Apple Watch SE (2nd Gen)", "Wearables", "Apple", "9102", 18, 22000, 29900, 6, 2, "8901234560024"),

        # Lighting (HSN: 9405, GST: 12%)
        ("Philips 9W LED Bulb (Pack of 4)", "Lighting", "Philips", "9405", 12, 180, 349, 200, 25, "8901234560025"),
        ("USB LED Desk Lamp", "Lighting", "Generic", "9405", 12, 350, 799, 40, 8, "8901234560026"),

        # Electronics (HSN: 8507, GST: 18%)
        ("Ambrane 20000mAh Power Bank", "Electronics", "Ambrane", "8507", 18, 700, 1499, 70, 10, "8901234560027"),
        ("Portronics Power Plate 10", "Electronics", "Portronics", "8507", 18, 500, 999, 55, 8, "8901234560028"),
        ("Casio Scientific Calculator", "Electronics", "Casio", "8470", 18, 400, 849, 30, 5, "8901234560029"),
        ("TP-Link WiFi Router N300", "Electronics", "TP-Link", "8517", 18, 800, 1499, 25, 5, "8901234560030"),
    ]

    products = []
    for name, cat, brand, hsn, gst, pp, sp, stock, min_stock, barcode in products_data:
        p = Product(
            product_name=name,
            category_id=categories.get(cat),
            supplier_id=random.choice(supplier_ids),
            brand=brand,
            barcode=barcode,
            hsn_code=hsn,
            gst_percentage=Decimal(str(gst)),
            purchase_price=Decimal(str(pp)),
            selling_price=Decimal(str(sp)),
            stock_quantity=stock,
            minimum_stock=min_stock,
            expiry_date=None,
        )
        db.add(p)
        products.append(p)
    db.commit()
    for p in products:
        db.refresh(p)
    print(f"[OK] {len(products)} products seeded")
    return products


def seed_customers(db):
    """Create Indian customers with diverse states."""
    if db.query(Customer).count() > 0:
        return db.query(Customer).all()

    customers_data = [
        ("Aarav Patel", "9900112233", "aarav.patel@gmail.com", "45, MG Road, Lucknow", "09AABCA1111R1ZA", "Uttar Pradesh"),
        ("Priya Sharma", "9900223344", "priya.sharma@gmail.com", "12, Civil Lines, Kanpur", "09AABCP2222R1ZB", "Uttar Pradesh"),
        ("Vikram Singh", "9900334455", "vikram.singh@yahoo.com", "B-5, Sector 62, Noida", "09AABCV3333R1ZC", "Uttar Pradesh"),
        ("Neha Gupta", "9900445566", "neha.gupta@hotmail.com", "78, Gomti Nagar, Lucknow", "", "Uttar Pradesh"),
        ("Rohan Mehta", "9900556677", "rohan.mehta@gmail.com", "23, Connaught Place, Delhi", "07AABCR4444R1ZD", "Delhi"),
        ("Anjali Verma", "9900667788", "anjali.v@gmail.com", "Plot 9, Banjara Hills, Hyderabad", "36AABCA5555R1ZE", "Telangana"),
        ("Karthik Nair", "9900778899", "karthik.nair@outlook.com", "15, MG Road, Kochi", "32AABCK6666R1ZF", "Kerala"),
        ("Divya Joshi", "9900889900", "divya.joshi@gmail.com", "34, Aundh, Pune", "27AABCD7777R1ZG", "Maharashtra"),
        ("Manish Tiwari", "9901001122", "manish.t@gmail.com", "Hazratganj, Lucknow", "", "Uttar Pradesh"),
        ("Sonia Kapoor", "9901112233", "sonia.k@gmail.com", "Sector 17, Chandigarh", "04AABCS8888R1ZH", "Chandigarh"),
    ]

    customers = []
    for name, phone, email, addr, gstin, state in customers_data:
        c = Customer(
            customer_name=name,
            phone_number=phone,
            email=email,
            address=addr,
            gstin=gstin,
            state=state,
            total_purchases=Decimal("0.00"),
            current_balance=Decimal("0.00"),
        )
        db.add(c)
        customers.append(c)
    db.commit()
    for c in customers:
        db.refresh(c)
    print(f"[OK] {len(customers)} customers seeded")
    return customers


def seed_sales(db, admin, products, customers):
    """Create realistic sales with proper GST calculations."""
    if db.query(Sale).count() > 0:
        return

    shop_state = "Uttar Pradesh"
    invoice_counter = 1
    all_inventory_txns = []
    all_ledger_entries = []

    # Generate 20 sales spread across the last 30 days
    for i in range(20):
        sale_date = _rand_date(30)
        customer = random.choice(customers + [None])  # Sometimes walk-in
        num_items = random.randint(1, 4)
        chosen_products = random.sample(products, min(num_items, len(products)))

        # Determine payment method
        pm_choice = random.choices(
            [PaymentMethod.cash, PaymentMethod.upi, PaymentMethod.card, PaymentMethod.credit],
            weights=[40, 30, 15, 15],
        )[0]

        invoice_number = f"GE-{sale_date.strftime('%Y%m')}-{invoice_counter:04d}"
        invoice_counter += 1

        subtotal = Decimal("0")
        total_cgst = Decimal("0")
        total_sgst = Decimal("0")
        total_igst = Decimal("0")
        total_profit = Decimal("0")
        total_discount = Decimal("0")

        sale_items = []

        for prod in chosen_products:
            qty = random.randint(1, 3)
            unit_price = prod.selling_price
            discount = Decimal("0")

            # 20% chance of a small discount
            if random.random() < 0.2:
                discount = Decimal(str(random.choice([10, 20, 50, 100])))

            line_total_before_tax = (unit_price * qty) - discount
            gst_pct = prod.gst_percentage
            gst_amount = _money(float(line_total_before_tax) * float(gst_pct) / 100)

            # Same state => CGST+SGST, different => IGST
            customer_state = customer.state if customer else shop_state
            is_same_state = customer_state == shop_state or customer_state == ""

            if is_same_state:
                item_cgst = Decimal(str(_money(gst_amount / 2)))
                item_sgst = Decimal(str(_money(gst_amount / 2)))
                item_igst = Decimal("0")
            else:
                item_cgst = Decimal("0")
                item_sgst = Decimal("0")
                item_igst = Decimal(str(_money(gst_amount)))

            line_total = Decimal(str(_money(float(line_total_before_tax) + gst_amount)))
            item_profit = (unit_price - prod.purchase_price) * qty - discount

            sale_items.append(SaleItem(
                product_id=prod.id,
                product_name=prod.product_name,
                hsn_code=prod.hsn_code,
                quantity=qty,
                unit_price=unit_price,
                discount=discount,
                gst_percentage=gst_pct,
                cgst=item_cgst,
                sgst=item_sgst,
                igst=item_igst,
                total=line_total,
            ))

            subtotal += line_total_before_tax
            total_cgst += item_cgst
            total_sgst += item_sgst
            total_igst += item_igst
            total_profit += item_profit
            total_discount += discount

            # Deduct stock
            prod.stock_quantity = max(0, prod.stock_quantity - qty)

            # Inventory transaction
            all_inventory_txns.append({
                "product_id": prod.id,
                "type": InvTxnType.SALE,
                "quantity": -qty,
                "stock_after": prod.stock_quantity,
                "reference": invoice_number,
                "user_id": admin.id,
                "created_at": sale_date,
            })

        total_amount = Decimal(str(_money(float(subtotal) + float(total_cgst) + float(total_sgst) + float(total_igst))))

        # Payment logic
        if pm_choice == PaymentMethod.credit:
            amount_paid = Decimal(str(_money(float(total_amount) * random.choice([0, 0.3, 0.5]))))
            amount_due = total_amount - amount_paid
            pay_status = PaymentStatus.unpaid if amount_paid == 0 else PaymentStatus.partial
        else:
            amount_paid = total_amount
            amount_due = Decimal("0")
            pay_status = PaymentStatus.paid

        sale = Sale(
            invoice_number=invoice_number,
            customer_id=customer.id if customer else None,
            user_id=admin.id,
            sale_date=sale_date,
            subtotal=subtotal,
            discount_amount=total_discount,
            cgst=total_cgst,
            sgst=total_sgst,
            igst=total_igst,
            total_amount=total_amount,
            profit=total_profit,
            payment_method=pm_choice,
            payment_status=pay_status,
            amount_paid=amount_paid,
            amount_due=amount_due,
            due_date=sale_date.date() + timedelta(days=30) if pm_choice == PaymentMethod.credit else None,
            status=SaleStatus.completed,
            items=sale_items,
        )
        db.add(sale)
        db.flush()

        # Customer ledger entry for credit sales
        if customer and pm_choice == PaymentMethod.credit:
            customer.total_purchases += total_amount
            customer.current_balance += amount_due

            all_ledger_entries.append({
                "customer_id": customer.id,
                "transaction_type": CustTxnType.sale,
                "reference_id": sale.id,
                "debit": total_amount,
                "credit": amount_paid,
                "balance_after": customer.current_balance,
                "description": f"Sale {invoice_number}",
                "transaction_date": sale_date,
            })
        elif customer:
            customer.total_purchases += total_amount

    # Bulk insert inventory transactions
    for txn in all_inventory_txns:
        db.add(InventoryTransaction(**txn))

    # Bulk insert ledger entries
    for entry in all_ledger_entries:
        db.add(CustomerLedger(**entry))

    db.commit()
    print(f"[OK] 20 sales with items, inventory, and ledger entries seeded")


def seed_purchases(db, admin, products, suppliers):
    """Create purchase orders from suppliers."""
    if db.query(Purchase).count() > 0:
        return

    for i in range(8):
        supplier = random.choice(suppliers)
        purchase_date = _rand_date(30)
        num_items = random.randint(1, 3)
        chosen = random.sample(products, min(num_items, len(products)))

        subtotal = Decimal("0")
        items = []

        for prod in chosen:
            qty = random.randint(5, 25)
            unit_price = prod.purchase_price
            line_total = unit_price * qty
            subtotal += line_total

            items.append(PurchaseItem(
                product_id=prod.id,
                quantity=qty,
                unit_price=unit_price,
                total=line_total,
            ))

            # Add stock from purchase
            prod.stock_quantity += qty
            db.add(InventoryTransaction(
                product_id=prod.id,
                type=InvTxnType.PURCHASE,
                quantity=qty,
                stock_after=prod.stock_quantity,
                reference=f"PO-{i+1:04d}",
                user_id=admin.id,
                created_at=purchase_date,
            ))

        tax_amount = Decimal(str(_money(float(subtotal) * 0.18)))
        total_amount = subtotal + tax_amount

        purchase = Purchase(
            supplier_invoice_number=f"SUP-INV-{random.randint(10000, 99999)}",
            supplier_id=supplier.id,
            user_id=admin.id,
            purchase_date=purchase_date,
            subtotal=subtotal,
            discount_amount=Decimal("0"),
            tax_amount=tax_amount,
            total_amount=total_amount,
            payment_status=random.choice([PurchPayStatus.PAID, PurchPayStatus.PAID, PurchPayStatus.PARTIAL]),
            amount_paid=total_amount if random.random() > 0.2 else Decimal(str(_money(float(total_amount) * 0.7))),
            status=PurchaseStatus.COMPLETED,
            items=items,
        )
        db.add(purchase)

    db.commit()
    print("[OK] 8 purchase orders seeded")


def seed_expenses(db, admin):
    """Create realistic expenses across categories over the past month."""
    if db.query(Expense).count() > 0:
        return

    categories = {c.name: c.id for c in db.query(ExpenseCategory).all()}

    expenses_data = [
        ("Rent", "Monthly shop rent - August 2026", 15000, "bank_transfer", "RENT-AUG-2026"),
        ("Rent", "Godown rent - August 2026", 5000, "bank_transfer", "RENT-GDN-AUG"),
        ("Salary", "Staff salary - Rahul (counter)", 12000, "bank_transfer", "SAL-RAHUL-AUG"),
        ("Salary", "Staff salary - Pooja (billing)", 11000, "bank_transfer", "SAL-POOJA-AUG"),
        ("Salary", "Part-time delivery boy", 4000, "cash", "SAL-DELIVERY-AUG"),
        ("Utilities", "Electricity bill - July 2026", 3500, "upi", "ELEC-JUL-2026"),
        ("Utilities", "Internet bill - August 2026", 999, "upi", "NET-AUG-2026"),
        ("Utilities", "Water bill - Q2 2026", 800, "cash", "WATER-Q2-2026"),
        ("Transport", "Stock pickup from Delhi supplier", 2500, "cash", "TRANS-DEL-001"),
        ("Transport", "Local delivery charges", 600, "cash", "TRANS-LOCAL-001"),
        ("Maintenance", "AC repair - shop", 1800, "upi", "MAINT-AC-001"),
        ("Maintenance", "Computer formatting & setup", 500, "cash", "MAINT-PC-001"),
        ("Supplies", "Billing paper rolls & bags", 450, "cash", "SUP-PAPER-001"),
        ("Marketing", "Google Business ads - July", 2000, "card", "MKT-GOOGLE-JUL"),
        ("Miscellaneous", "Tea & snacks for month", 1200, "cash", "MISC-TEA-AUG"),
    ]

    for cat_name, desc, amount, method, ref in expenses_data:
        db.add(Expense(
            category_id=categories.get(cat_name, 8),
            description=desc,
            amount=Decimal(str(amount)),
            expense_date=_rand_past_date(30),
            payment_method=method,
            reference=ref,
            user_id=admin.id,
        ))

    db.commit()
    print(f"[OK] {len(expenses_data)} expenses seeded")


def seed_audit_logs(db, admin):
    """Create sample audit log entries."""
    if db.query(AuditLog).count() > 0:
        return

    logs = [
        ("CREATE", "settings", 1, None, '{"shop_name": "Gaurav Electronics"}'),
        ("CREATE", "product", 1, None, '{"product_name": "Samsung Galaxy M15", "stock": 50}'),
        ("CREATE", "product", 5, None, '{"product_name": "OnePlus Nord CE4", "stock": 20}'),
        ("CREATE", "customer", 1, None, '{"customer_name": "Aarav Patel"}'),
        ("CREATE", "supplier", 1, None, '{"supplier_name": "Sunrise Distributors"}'),
        ("CREATE", "sale", 1, None, '{"invoice": "GE-202607-0001", "total": 14999}'),
        ("UPDATE", "settings", 1, '{"shop_name": "My Retail Store"}', '{"shop_name": "Gaurav Electronics"}'),
    ]

    for action, entity_type, entity_id, old_val, new_val in logs:
        db.add(AuditLog(
            user_id=admin.id,
            username=admin.username,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=old_val,
            new_values=new_val,
            timestamp=_rand_date(25),
        ))

    db.commit()
    print(f"[OK] {len(logs)} audit log entries seeded")


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run_comprehensive_seed():
    """Run the full seeding pipeline. Idempotent — skips if data exists."""
    create_tables()
    db = SessionLocal()

    try:
        # Quick check — if products already exist, the DB has been seeded
        if db.query(Product).count() > 0:
            print("[SKIP] Database already has data. Skipping seed.")
            # Still ensure admin and settings exist
            from app.auth.service import seed_default_admin
            from app.settings.service import get_settings
            seed_default_admin(db)
            get_settings(db)
            return

        print("=" * 50)
        print("  RetailERP-Pro -- Comprehensive Data Seeding")
        print("=" * 50)

        admin = seed_admin(db)
        seed_settings(db)
        seed_categories(db)
        seed_expense_categories(db)
        suppliers = seed_suppliers(db)
        products = seed_products(db, suppliers)
        customers = seed_customers(db)
        seed_sales(db, admin, products, customers)
        seed_purchases(db, admin, products, suppliers)
        seed_expenses(db, admin)
        seed_audit_logs(db, admin)

        print("=" * 50)
        print("  [OK] All seed data created successfully!")
        print("=" * 50)

    finally:
        db.close()


if __name__ == "__main__":
    run_comprehensive_seed()
