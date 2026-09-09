[README.md](https://github.com/user-attachments/files/31999604/README.md)
# FinFlow 💼
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Framework](https://img.shields.io/badge/Framework-Flask-green.svg)](https://flask.palletsprojects.com/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%2017-blue.svg)](https://www.postgresql.org/)
[![Migrations](https://img.shields.io/badge/Migrations-Alembic-orange.svg)](https://alembic.sqlalchemy.org/)
[![License](https://img.shields.io/badge/License-MIT-brightgreen.svg)](LICENSE)
**FinFlow** — lightweight financial control for contracts, invoices, product budgets and financial exposure.
The system provides a centralized dashboard for tracking **budgets, issued invoices, remaining limits, contract dates, financial alerts and analytics** across companies and products.
🌐 **Live application:** https://finflow.lexxkato.win/
![FinFlow Preview](https://finflow.lexxkato.win/finflow-preview.png)
---
# ✨ What FinFlow Does
FinFlow is designed around a simple operational question:
> **How much has been invoiced, how much budget remains, and where do we need to pay attention?**
The system combines contract information, product budgets and invoices into a single financial control dashboard.
### Core capabilities
- company management
- product budget management
- invoice management
- invoice lifecycle control
- budget utilization monitoring
- financial alerts
- financial analytics
- contract date monitoring
- Russian / English localization
- PostgreSQL production database
- Alembic database migrations
- automated backups
- health monitoring
- Open Graph / social preview support
---
# 🧾 Invoice Management
FinFlow provides a centralized interface for managing issued invoices.
Supported operations include:
- creating invoices
- editing active invoices
- invoice numbers
- invoice dates
- completion dates
- software/product association
- contract details
- invoice amounts in EUR
- duplicate invoice protection
- invoice cancellation
- invoice document generation
Invoices are associated with companies and products and participate in the corresponding budget calculations.
### Invoice terminology
FinFlow deliberately uses **"invoiced" / "issued invoices"** rather than "revenue" or "spending".
An issued invoice does not necessarily represent:
- recognized revenue
- received payment
- actual cash expenditure
This distinction is important for accurate financial reporting.
---
# 🚨 Financial Alerts
FinFlow automatically highlights potentially problematic financial situations.
## Budget utilization thresholds
| Utilization | Status |
|---|---|
| `< 80%` | Healthy |
| `80–89.9%` | Warning |
| `90–99.9%` | Critical |
| `≥ 100%` | Budget exceeded |
The dashboard also warns about contracts ending within the next **30 days**.
Financial alerts are designed to make important exceptions visible without requiring manual inspection of every company or invoice.
---
# 📈 Financial Analytics
The dashboard includes visual analytics for:
- budget utilization
- invoice amounts by company
- invoice amounts by product
- monthly invoiced amounts
- invoice activity by date
Analytics are based on active issued invoices.
Cancelled invoices are excluded from financial totals and analytics.
### Current terminology
The Russian interface uses terminology such as:
- **Обзор выставленных счетов**
- **Использование бюджета и динамика выставленных счетов**
- **Сумма счетов по компаниям**
- **Сумма счетов по продуктам**
- **Выставленные счета по месяцам**
- **Динамика выставленных счетов**
- **Выставлено счетов**
This avoids incorrectly describing invoices as revenue or expenses.
---
# 🌍 Localization
The user interface supports:
- 🇷🇺 Russian
- 🇬🇧 English
Russian is the default language on first visit.
The selected language is stored locally in the browser using `localStorage`.
Dashboard localization and generated invoice document content are handled independently.
---
# 🏗 Architecture
FinFlow is a server-rendered Flask application with a lightweight JavaScript frontend.
```text
                    ┌─────────────────────┐
                    │       Browser       │
                    │ HTML / CSS / JS     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │       Nginx         │
                    │   Reverse Proxy     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Gunicorn       │
                    │    Flask / WSGI     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │     SQLAlchemy      │
                    │       ORM           │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    PostgreSQL 17    │
                    └─────────────────────┘

Production database:

PostgreSQL 17

Local/fallback database:

### SQLite
The application is designed to keep the infrastructure small while still providing a production-ready database and migration layer.

---
## 🛠 Technology Stack
### Backend
* Python
* Flask
* Flask-SQLAlchemy
* SQLAlchemy
* Alembic
* Gunicorn

### Frontend
* HTML5
* CSS3
* Tailwind CSS
* Vanilla JavaScript
* Bootstrap Icons

### Database
* PostgreSQL 17 — production
* SQLite — local/fallback environments
* SQLAlchemy ORM
* Alembic migrations

### Documents & Images
* Pillow
* PNG assets
* generated invoice documents
* printable invoice layouts
* synthetic stamp/signature generation

### Infrastructure
* Nginx
* systemd
* Gunicorn
* Cloudflare Tunnel-compatible deployment
* automated PostgreSQL backups
* application health checks

---
## 📦 Project Structure
FinFlow/
│
├── app.py
│   └── Flask application, routes and SQLAlchemy models
│
├── templates/
│   ├── index.html
│   │   └── Main dashboard, analytics, alerts and invoice UI
│   │
│   └── generator.html
│       └── Invoice generation interface
│
├── static/
│   ├── finflow-logo.png
│   └── finflow-preview.png
│       └── Open Graph / social preview image
│
├── migrations/
│   └── Alembic migration history
│
├── requirements.txt
│   └── Python dependencies
│
├── alembic.ini
│   └── Alembic configuration
│
├── deploy.sh
│   └── Deployment/update helper
│
├── make_demo_stamp.py
│   └── Synthetic stamp/signature generator
│
├── migrate_sqlite_to_postgres.py
│   └── SQLite → PostgreSQL migration utility
│
├── accounting.db
│   └── Optional SQLite local/fallback database
│
├── README.md
│
└── CHANGELOG.md

---
## 🚀 Quick Start
### Requirements
* Python 3.10+
* Git
* PostgreSQL 14+ recommended
* python3-venv

### Clone repository
git clone git@github.com:abyss37/FinFlow.git
cd FinFlow

### Create virtual environment
python3 -m venv venv
source venv/bin/activate

### Install dependencies
pip install -r requirements.txt

### Configure database
For PostgreSQL:

export DATABASE_URL="postgresql+psycopg://USER:PASSWORD@HOST:5432/finflow"

For local SQLite:

export DATABASE_URL="sqlite:///accounting.db"

### Run migrations
alembic upgrade head

### Start application
python3 app.py

Application:

http://127.0.0.1:5000

---
## 🗄 Database Configuration
FinFlow uses SQLAlchemy as the database abstraction layer.

### PostgreSQL
Production deployments use PostgreSQL.

Example:

export DATABASE_URL="postgresql+psycopg://USER:PASSWORD@HOST:5432/finflow"

The application uses PostgreSQL for persistent production data.

### SQLite
SQLite can be used for:

* local development
* testing
* lightweight deployments
* fallback environments

Example:

export DATABASE_URL="sqlite:///accounting.db"

### Production credentials
Database credentials must never be committed to Git.

Recommended production configuration:

/etc/accounting-app.env

---
## 🔄 Database Migrations
FinFlow uses Alembic for database schema lifecycle management.

### Check current revision
alembic current

### Upgrade database
alembic upgrade head

### Create a migration
After changing SQLAlchemy models:

alembic revision --autogenerate -m "describe change"

Then inspect the generated migration and apply it:

alembic upgrade head

Database migrations are preferred over destructive manual schema changes.

---
## 🧪 Development
Run Flask directly:

python3 app.py

Or use Gunicorn:

gunicorn --workers 3 --bind 127.0.0.1:5000 app:app

Local application:

http://127.0.0.1:5000

Before submitting changes:

1. verify Python syntax
2. test affected application functionality
3. inspect database migrations
4. verify dashboard calculations
5. verify invoice lifecycle behavior
6. check that no secrets are committed

---
## 🔐 Configuration & Secrets
Production configuration is kept outside the Git repository.

Example:

/etc/accounting-app.env

Do not commit:

* database passwords
* API keys
* authentication secrets
* private certificates
* production environment files
* other credentials

A production environment file should have restricted filesystem permissions.

Example:

chmod 600 /etc/accounting-app.env

---
## 💾 Backups
Production PostgreSQL data is backed up independently from the application.

The backup flow is:

### PostgreSQL
    │
    ▼
pg_dump
    │
    ▼
Compressed backup
    │
    ▼
Retention policy

The production deployment includes automated PostgreSQL backups with retention of recent backup copies.

Backups should be stored separately from the primary database whenever possible.

### Restore testing
A backup is useful only if restoration works.

Restore procedures should therefore be tested periodically using a separate database or environment.

---
## ❤️ Health Checks
Production monitoring should verify:

* systemd service state
* HTTP availability
* PostgreSQL availability
* database connectivity
* backup freshness

A failed health check should be treated as an operational alert.

Example service check:

systemctl status accounting-app

Example HTTP check:

curl -I http://127.0.0.1:5000/

---
## 🧾 Invoice Lifecycle
Invoices have an explicit lifecycle:

### ISSUED
   │
   ▼
### CANCELLED
### ISSUED
An issued invoice participates in:

* budget calculations
* utilization
* analytics
* dashboard totals

### CANCELLED
A cancelled invoice:

* remains in the database
* remains available for historical inspection
* is excluded from budget calculations
* is excluded from analytics
* cannot be edited
* cannot be restored through the normal UI

Cancellation is implemented as a soft delete.

This preserves financial history without physically deleting the original record.

---
## 🛡 Data Integrity
FinFlow uses both application-level validation and database-level constraints.

Examples include:

* non-negative budgets
* positive invoice amounts
* foreign-key relationships
* company/product relationships
* duplicate invoice protection
* invoice lifecycle restrictions

Monetary values use decimal-compatible database types rather than binary floating-point values.

This is important for financial calculations where rounding precision matters.

---
## 🔎 Duplicate Protection
Where an invoice number is supplied, duplicate protection is enforced around:

Company
+
Software / Product
+
Invoice Number

This prevents accidental creation of duplicate invoice records.

The protection is implemented at the database level in addition to application validation.

---
## 🌐 Open Graph / Social Preview
FinFlow provides a dedicated Open Graph preview image:

https://finflow.lexxkato.win/finflow-preview.png

The main dashboard page exposes metadata for:

* Open Graph
* Twitter/X
* page title
* description
* preview image
* image dimensions
* image alternative text

Current preview image:

1733 × 908 PNG

The preview allows the FinFlow URL to display a branded image when shared through supported social networks and messaging platforms.

---
## 📊 Current Dashboard
The current dashboard provides four major areas.

### Financial Summary
* Total budget
* Total invoiced
* Remaining budget
* Budget utilization

### Company Cards
Each company can display:

* company name
* ALPHA budget
* ALPHA invoiced amount
* BETA budget
* BETA invoiced amount
* contract/completion dates

### Analytics
* budget utilization
* invoiced amount by company
* invoiced amount by product
* monthly invoiced amount
* invoice activity by date

### Alerts
* budget warning
* critical budget utilization
* exceeded budget
* upcoming contract end dates

---
## 🗺 Roadmap
✅ Completed

* Company management
* Product budgets
* Invoice management
* Invoice editing
* Invoice cancellation
* Invoice lifecycle
* Duplicate invoice protection
* PostgreSQL production database
* SQLite local/fallback support
* Alembic migrations
* Dashboard financial summary
* Financial analytics
* Financial alerts
* Contract expiration alerts
* Russian / English localization
* Mobile-responsive dashboard
* Production Gunicorn deployment
* Nginx reverse proxy
* PostgreSQL backup automation
* Backup restoration testing
* Health checks
* Open Graph metadata
* Social preview image

🚧 Planned

* Dedicated /analytics page
* Advanced analytics filters
* Date-range filtering
* Company filtering
* Product filtering
* Exportable financial reports
* Audit log
* User roles and permissions
* Approval workflow
* Contract status management
* Payment status tracking
* Overdue invoice monitoring
* Notifications
* Multi-currency support
* More detailed reporting
* Dashboard customization

---
## 🎯 Design Principles
Keep the dashboard operational

The main page should answer:

What is happening with the budget right now?

The dashboard should prioritize current financial exposure rather than unnecessary complexity.

Preserve financial history

Cancelled records should not simply disappear.

Financial records should remain available for historical inspection.

Separate invoices from revenue

An issued invoice is not automatically:

* recognized revenue
* received payment
* cash expenditure

FinFlow therefore uses invoice-specific terminology throughout the financial dashboard.

Prefer simple infrastructure

FinFlow deliberately uses a small technology footprint:

Flask
+
SQLAlchemy
+
### PostgreSQL
+
Vanilla JavaScript

Database-first integrity

Important financial rules should be enforced at the database level whenever practical.

Make production state recoverable

Backups, migrations and health checks are treated as part of the application rather than optional infrastructure.

Avoid unnecessary complexity

The system should remain understandable, maintainable and easy to operate.

---
## 🤝 Contributing
Contributions, bug reports and improvements are welcome.

Before submitting changes:

1. Create a feature branch.
2. Make the smallest reasonable change.
3. Run syntax checks.
4. Test affected functionality.
5. Check database migrations when models change.
6. Verify financial calculations.
7. Verify invoice lifecycle behavior.
8. Do not commit secrets or production credentials.

Example:

git checkout -b feature/my-change

Commit changes:

git add .
git commit -m "feat: describe change"

Push the branch:

git push origin feature/my-change

---
## 📄 License
FinFlow is released under the MIT License.

See LICENSE⁠￼.

```
