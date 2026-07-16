# RetailERP-Pro

> **Comprehensive GST Billing, Inventory, Customer & Sales Management System for Small and Medium Enterprises**

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

## Overview

RetailERP-Pro is a modern, full-stack enterprise resource planning solution tailored for retail businesses. It provides an intuitive interface for point-of-sale operations, inventory tracking, GST-compliant invoicing, and comprehensive audit logging.

## Core Features

- **Role-Based Access Control** — Secure JWT authentication with strict separation of privileges between administrators and staff members.
- **Advanced Product Management** — Full lifecycle management of products, supporting custom categorizations, barcode integration, and configurable HSN codes.
- **Automated GST Engine** — Real-time calculation and application of appropriate tax brackets (0%, 5%, 12%, 18%, 28%) including cross-state (IGST) and intra-state (CGST/SGST) logic.
- **Point-of-Sale (POS) Module** — Streamlined billing interface optimized for rapid customer checkout with real-time inventory deduction.
- **Dynamic Invoicing** — Automated generation of professional, A4-sized PDF invoices integrated with payment QR codes.
- **Accounts Receivable & Payment Tracking** — Multi-channel payment recording (Cash, UPI, Card) and dedicated modules for tracking outstanding credit sales.
- **Immutable Audit Trail** — Strict logging of all data mutations, capturing both pre- and post-modification states for compliance and security review.
- **Dockerized Architecture** — Containerized microservices ensuring environment consistency across development, staging, and production.

## Technology Stack

| Component | Technologies |
|:------|:-----------|
| **Frontend UI** | React 19, Tailwind CSS 4, Recharts, Lucide Icons |
| **Backend API** | FastAPI, SQLAlchemy, Pydantic |
| **Authentication** | JWT (python-jose), bcrypt password hashing |
| **Database layer** | SQLite (Development), PostgreSQL-compatible |
| **Document Generation**| ReportLab, qrcode |
| **Infrastructure** | Docker, Docker Compose, Nginx |

## Deployment Guide (Recommended)

The recommended method for deploying RetailERP-Pro is via Docker to ensure dependency encapsulation and environment parity.

### Prerequisites
- Docker Engine
- Docker Compose

### Execution

```bash
# Clone the repository
git clone https://github.com/GskCoder/RetailERP-Pro.git
cd RetailERP-Pro

# Initialize and start the containerized application
docker compose up -d --build
```

The application services will be accessible at:
- **Frontend Dashboard:** `http://localhost`
- **Backend API Documentation:** `http://localhost:8000/docs`

To gracefully halt the application and remove the container runtime environments:
```bash
docker compose down
```

## Local Development Setup

For developers requiring direct access to the application runtimes without containerization:

### Prerequisites
- Python 3.11+
- Node.js 20+

### Backend Initialization
```bash
cd backend
python -m venv venv

# Activate Virtual Environment
venv\Scripts\activate      # Windows
# source venv/bin/activate  # Linux/macOS

pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend Initialization
```bash
cd frontend
npm install
npm run dev
```

## Default System Credentials

Upon initial deployment, authenticate using the default system administrator credentials:
- **Username:** `admin`
- **Password:** `admin123`

*Note: The system will enforce a password rotation policy upon the first successful authentication.*

## System Architecture

```text
RetailERP-Pro/
├── backend/
│   ├── app/
│   │   ├── core/           # Configuration, database drivers, and security primitives
│   │   ├── auth/           # Identity provider and JWT issuance
│   │   ├── settings/       # Global application configurations
│   │   ├── audit/          # Immutable mutation logging
│   │   ├── products/       # Inventory definition models
│   │   ├── customers/      # Client relationship management
│   │   ├── inventory/      # Transactional stock ledger
│   │   ├── sales/          # Transaction processing and GST computation
│   │   └── invoices/       # PDF generation services
│   ├── requirements.txt
│   └── Dockerfile          # Backend container definition
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable React UI components
│   │   ├── pages/          # Primary routing views
│   │   ├── context/        # Application state management
│   │   ├── utils/          # Formatting and computational utilities
│   │   └── api/            # Axios HTTP client configuration
│   ├── nginx.conf          # Reverse proxy and static file server configuration
│   └── Dockerfile          # Frontend container definition
└── docker-compose.yml      # Service orchestration definition
```
