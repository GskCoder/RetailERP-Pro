from pydantic_settings import BaseSettings
import secrets
import os


class Settings(BaseSettings):
    """Application settings - only infrastructure config.
    Shop-level settings are stored in the database settings table."""

    # Database — set DATABASE_URL env var for PostgreSQL in production
    # e.g. postgresql://user:pass@host/dbname?sslmode=require
    DATABASE_URL: str = "sqlite:///./retailerp.db"

    # JWT — use a fixed SECRET_KEY in production (set via env var)
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    # CORS — set FRONTEND_URL to your Vercel domain in production
    FRONTEND_URL: str = "http://localhost:5173"

    # PDF storage
    INVOICE_PDF_DIR: str = "./invoices"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

