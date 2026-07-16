"""RetailERP Lite — FastAPI Backend Entry Point."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import create_tables, SessionLocal
from app.auth.service import seed_default_admin
from app.settings.service import get_settings

# Import all routers
from app.auth.router import router as auth_router
from app.settings.router import router as settings_router
from app.audit.router import router as audit_router
from app.products.router import router as products_router
from app.customers.router import router as customers_router
from app.inventory.router import router as inventory_router
from app.sales.router import router as sales_router
from app.invoices.router import router as invoices_router
from app.suppliers.router import router as suppliers_router
from app.purchases.router import router as purchases_router
from app.reports.router import router as reports_router
from app.analytics.router import router as analytics_router
from app.expenses.router import router as expenses_router
from app.backup.router import router as backup_router
from app.search.router import router as search_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables, seed admin, init settings."""
    create_tables()
    db = SessionLocal()
    try:
        seed_default_admin(db)
        get_settings(db)  # Creates default settings row
        from app.expenses.service import seed_default_categories
        seed_default_categories(db)  # Creates default expense categories
    finally:
        db.close()
    print("[OK] RetailERP Lite backend started!")
    yield
    print("[STOP] RetailERP Lite backend stopped.")


app = FastAPI(
    title="RetailERP Lite",
    description="Complete GST Billing, Inventory, Customer & Sales Management System",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/")
def root():
    """Root health check endpoint."""
    return {"status": "ok", "message": "RetailERP Lite API is live across the cloud!"}


@app.get("/api/health")
def health():
    """API health check endpoint."""
    return {"status": "ok", "db": "connected"}


# CORS — allow frontend origins
allowed_origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:3000",
]
# Also allow any Vercel preview deployments
if ".vercel.app" in settings.FRONTEND_URL:
    allowed_origins.append("https://*.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(audit_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(customers_router, prefix="/api")
app.include_router(inventory_router, prefix="/api")
app.include_router(sales_router, prefix="/api")
app.include_router(invoices_router, prefix="/api")
app.include_router(suppliers_router, prefix="/api")
app.include_router(purchases_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(expenses_router, prefix="/api")
app.include_router(backup_router, prefix="/api")
app.include_router(search_router, prefix="/api")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "RetailERP Lite", "version": "1.0.0"}
