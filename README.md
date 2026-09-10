<div align="center">

<img src="static/finflow-logo.png" alt="FinFlow" width="180">

# FinFlow

**Lightweight Flask-based financial management platform for invoices, contracts, budgets, analytics, and document generation.**

[![Release](https://img.shields.io/github/v/release/abyss37/FinFlow?style=flat-square)](https://github.com/abyss37/FinFlow/releases)
[![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.x-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License](https://img.shields.io/github/license/abyss37/FinFlow?style=flat-square)](https://github.com/abyss37/FinFlow/blob/main/LICENSE)

</div>

<p align="center">
  <img src="static/finflow-preview.png" alt="FinFlow Dashboard Preview">
</p>

---

## Features

### Dashboard

The main dashboard provides an overview of the current financial state of the managed companies.

It includes:

- company budget cards
- budget utilization
- invoiced amounts
- remaining budget
- contract/completion dates
- product-specific metrics
- financial health indicators
- recent financial activity
- notifications
- quick invoice operations
- company-specific statistics

Company cards are isolated from each other.

For example:

- the **ALPHA** card displays only ALPHA financial data
- the **BETA** card displays only BETA financial data

---

## Financial Analytics

The Analytics page provides a more detailed view of financial performance.

Available filters include:

- date range
- company
- product

Current analytics include:

- total budget
- invoiced amount
- remaining budget
- budget utilization
- outstanding unpaid exposure
- company comparison
- product comparison
- monthly spending

### Financial exposure

Exposure represents the actual outstanding invoice amount rather than simply duplicating the invoiced amount.

For each invoice:

```text
Outstanding = Invoice Amount - Paid Amount
```

The paid amount is constrained to the invoice amount and cannot produce a negative outstanding balance.

---

## Invoice Management

FinFlow supports the complete invoice lifecycle.

Available operations include:

- creating invoices
- editing invoices
- generating invoices
- updating generated invoices
- tracking payment status
- cancelling invoices

Invoice data includes:

- invoice number
- company
- product
- amount
- payment amount
- invoice status
- invoice dates
- payment information
- related financial metadata

Financial modification operations are restricted by user role.

---

## Budget Management

Authorized users can update company budgets directly from the application.

Budget changes are protected by role-based authorization and recorded in the Audit Log.

The dashboard and Analytics page use the company-specific budget when calculating financial metrics.

---

## Contract / Completion Dates

Authorized users can update company contract or completion dates.

Changes are recorded in the Audit Log.

---

## Notifications

FinFlow includes an integrated notification center.

Notifications can be associated with:

- companies
- invoices
- financial events
- system events

The notification center provides:

- unread notification count
- unread-first ordering
- notification details
- mark as read
- mark all as read
- navigation to related company or invoice
- periodic refresh

Notification deduplication is supported through a unique deduplication key.

---

## Audit Log

FinFlow provides a complete Audit Log for important financial and administrative operations.

The Audit Log records events such as:

- company creation
- invoice creation
- invoice updates
- payment status changes
- budget changes
- contract date changes
- invoice cancellation
- user creation

Each new audit event can contain:

- timestamp
- action
- entity type
- entity ID
- company
- user
- software
- description
- details

### User attribution

Audit events created during an authenticated session are automatically associated with the current user.

Historical records created before user attribution was introduced may have an empty user field. This is intentional and preserves the original historical data.

### Audit filters

The Audit Log supports filtering by:

- user
- action
- company
- product/software

---

## Authentication

FinFlow uses session-based authentication.

The application supports:

- login
- logout
- persistent user accounts
- active/inactive users
- last login tracking
- role-based authorization

Passwords are stored as secure password hashes and are never stored in plaintext.

---

## Roles and Permissions

FinFlow currently supports three roles:

- `admin`
- `manager`
- `viewer`

### Permission matrix

| Action | Admin | Manager | Viewer |
|---|:---:|:---:|:---:|
| Dashboard | Yes | Yes | Yes |
| Analytics | Yes | Yes | Yes |
| Audit Log | Yes | Yes | Yes |
| View notifications | Yes | Yes | Yes |
| Create invoice | Yes | Yes | No |
| Edit invoice | Yes | Yes | No |
| Cancel invoice | Yes | Yes | No |
| Change budget | Yes | Yes | No |
| Change contract date | Yes | Yes | No |
| Change payment status | Yes | Yes | No |
| Manage users and roles | Yes | No | No |

The first administrator is created during the initial database/bootstrap process.

---

## CSRF Protection

All POST requests are protected by CSRF validation.

FinFlow uses a per-session CSRF token.

The token can be supplied through:

- a hidden `csrf_token` form field
- the `X-CSRF-Token` request header

Invalid or missing CSRF tokens are rejected with HTTP `403`.

This protection applies to both normal form submissions and JSON/API POST requests.

---

## Security

The application includes several security protections.

### Session security

Session cookies are configured with:

```text
HttpOnly
SameSite=Lax
Secure
```

### Secret key

The Flask session secret is supplied through the server environment and is not stored in the application source code.

FinFlow refuses to start if an explicit `SECRET_KEY` is not configured.

### Open redirect protection

Login redirection is restricted to local application paths.

External redirect targets are rejected.

### Authentication protection

Protected pages require an authenticated user.

Protected API endpoints return authentication errors instead of exposing application pages.

### Role protection

Financial modification endpoints require either:

- `admin`
- `manager`

User management requires:

- `admin`

---

## Internationalization

FinFlow currently supports:

- 🇷🇺 Russian
- 🇬🇧 English

The language preference is stored in the browser using the FinFlow localization system.

### Language switcher

There is intentionally **one language switcher on the Dashboard**.

Other pages inherit the selected language automatically.

The following pages do not display their own language switcher:

- Analytics
- Generator
- Audit Log
- Users
- Login

This keeps the interface consistent and avoids multiple independent language controls.

---

## UI

FinFlow uses a modern dark financial-dashboard design.

The current interface includes:

- dark theme
- glass-style panels
- rounded cards
- compact controls
- status badges
- responsive layouts
- consistent navigation
- contextual user menu
- notification center
- modern dashboard cards
- company-specific financial visualization

The Dashboard header includes:

- FinFlow branding
- database backend indicator
- language switcher
- authenticated username
- role indicator
- user dropdown
- logout action

Administrators additionally see the **Users** management entry.

---

## Database

FinFlow currently uses **PostgreSQL** as its production database.

Example backend:

```text
PostgreSQL 17
```

SQLAlchemy is used as the database abstraction layer.

The PostgreSQL connection is configured through:

```text
DATABASE_URL
```

The application normalizes PostgreSQL URLs to use the Psycopg driver:

```text
postgresql+psycopg
```

Database connections use connection health checking where appropriate.

---

## Database Migrations

FinFlow uses **Alembic** for database schema migrations.

The migration chain currently contains:

```text
ea1415587321  baseline existing FinFlow schema
        ↓
4257ca3abaf2  add accounting data integrity constraints
        ↓
1a377231e5b3  add invoice lifecycle fields
        ↓
4c41fd40f894  add invoice payment tracking
        ↓
7f3a9c2d1b6e  add notifications
        ↓
8a4b6d2e91f0  add notification dedup key
        ↓
9c7e4a1b2d6f  add users
        ↓
d9d0cd767f81  add audit log user attribution
```

The current migration head is:

```text
d9d0cd767f81
```

Check the current database revision with:

```bash
./venv/bin/alembic current
```

Check available heads with:

```bash
./venv/bin/alembic heads
```

Apply pending migrations with:

```bash
./venv/bin/alembic upgrade head
```

---

## Technology Stack

### Backend

- Python 3.13+
- Flask 3.1
- Flask-SQLAlchemy
- SQLAlchemy 2.x
- Alembic
- Psycopg 3

### Database

- PostgreSQL 17+

### Production server

- Gunicorn
- systemd

### Frontend

- HTML5
- JavaScript
- Tailwind CSS
- browser localStorage for language preference

---

## Project Structure

```text
FinFlow/
├── .github/
│   ├── dependabot.yml
│   └── workflows/
│       └── ci.yml
│
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       ├── ea1415587321_baseline_existing_finflow_schema.py
│       ├── 4257ca3abaf2_add_accounting_data_integrity_.py
│       ├── 1a377231e5b3_add_invoice_lifecycle_fields.py
│       ├── 4c41fd40f894_add_invoice_payment_tracking.py
│       ├── 20260909153330_add_notifications.py
│       ├── 20260909-153654_add_notification_dedup_key.py
│       ├── 20260909-195600_add_users.py
│       └── d9d0cd767f81_add_audit_log_user_attribution.py
│
├── static/
│   ├── favicon.svg
│   ├── finflow-logo.png
│   ├── finflow-preview.png
│   ├── stamp_signature.png
│   └── js/
│       └── finflow-i18n.js
│
├── templates/
│   ├── index.html
│   ├── analytics.html
│   ├── generator.html
│   ├── audit-log.html
│   ├── users.html
│   ├── login.html
│   └── error.html
│
├── alembic.ini
├── app.py
├── seed_demo.py
├── fix_budget_health.sh
├── migrate_sqlite_to_postgres.py
├── requirements.txt
├── deploy.sh
├── README.md
├── CHANGELOG.md
└── LICENSE
```

---

## Configuration

Production configuration is provided through an environment file.

Example:

```text
DATABASE_URL=postgresql+psycopg://finflow:<password>@localhost:5432/finflow
SECRET_KEY=<strong-random-secret>
```

Do not commit production credentials or secrets to Git.

---

## Local Development

Clone the repository:

```bash
git clone git@github.com:abyss37/FinFlow.git
cd FinFlow
```

Create a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Configure the environment:

```bash
export DATABASE_URL="postgresql+psycopg://..."
export SECRET_KEY="..."
```

Run migrations:

```bash
alembic upgrade head
```

Start Flask:

```bash
flask --app app run
```

For a production-like local server:

```bash
gunicorn --workers 3 --bind 127.0.0.1:5000 app:app
```

---

## Production Deployment

The production application runs under systemd.

Example service:

```text
accounting-app.service
```

The application is served by Gunicorn on:

```text
127.0.0.1:5000
```

The application process runs as a dedicated system user.

Check service status:

```bash
systemctl status accounting-app
```

Restart the application:

```bash
systemctl restart accounting-app
```

Check recent service logs:

```bash
journalctl -u accounting-app -n 100 --no-pager
```

---

## Database Maintenance

Check PostgreSQL connectivity:

```bash
psql -d finflow
```

Check Alembic state:

```bash
./venv/bin/alembic current
```

Apply migrations:

```bash
./venv/bin/alembic upgrade head
```

Never manually modify the production schema when a migration should be used.

Create a new migration for schema changes:

```bash
./venv/bin/alembic revision -m "describe change"
```

Review the generated migration before applying it.

---

## Demo / Seed Data

The repository contains:

```text
seed_demo.py
```

for preparing demo data.

Demo data should only be used intentionally and should not overwrite production data without verification.

---

## Migration from SQLite

The project previously used SQLite during development.

The current production architecture uses PostgreSQL.

The repository contains:

```text
migrate_sqlite_to_postgres.py
```

for migration purposes.

SQLite database files are intentionally excluded from Git.

---

## Testing

Before committing changes, basic Python syntax should be checked:

```bash
python3 -m py_compile app.py seed_demo.py
```

Templates should be rendered through the application and protected routes should be tested with an authenticated session.

Important areas to verify after backend changes:

- login
- logout
- role authorization
- CSRF validation
- invoice operations
- payment updates
- budget updates
- notifications
- Audit Log
- user attribution
- Analytics
- language switching

---

## Authentication Smoke Test

The following behavior is expected:

```text
Unauthenticated protected page
        ↓
HTTP 302
        ↓
/login
```

Insufficient role:

```text
Authenticated user
        ↓
Unauthorized operation
        ↓
HTTP 403
```

Unauthenticated API request:

```text
HTTP 401
```

Invalid CSRF token:

```text
HTTP 403
```

---

## Git Hygiene

Local development and production servers may contain temporary backup files created during development.

These include files such as:

```text
*.before-*
*.bak
*.bak-*
```

They are intentionally excluded from Git.

Local databases, logs, virtual environments, backups, and environment files are also excluded.

Only the actual application source, configuration templates, migrations, assets, and documentation should be committed.

---

## Deployment Checklist

Before deploying a new version:

```bash
git status
git diff
python3 -m py_compile app.py seed_demo.py
```

Verify the migration state:

```bash
./venv/bin/alembic current
./venv/bin/alembic heads
```

Apply migrations if required:

```bash
./venv/bin/alembic upgrade head
```

Restart the service:

```bash
systemctl restart accounting-app
```

Verify:

```bash
systemctl is-active accounting-app
```

Check recent errors:

```bash
journalctl -u accounting-app -n 50 --no-pager
```

Then verify the main application pages and authentication flow.

---

## Current Status

FinFlow currently includes:

- [x] PostgreSQL production database
- [x] SQLAlchemy database layer
- [x] Alembic migrations
- [x] Invoice lifecycle management
- [x] Payment tracking
- [x] Budget management
- [x] Financial notifications
- [x] Notification deduplication
- [x] User accounts
- [x] Role-based access control
- [x] Session authentication
- [x] CSRF protection
- [x] Audit Log
- [x] Audit Log user attribution
- [x] Audit Log filters
- [x] Financial Analytics
- [x] Company-specific dashboard metrics
- [x] RU/EN localization
- [x] Single Dashboard language switcher
- [x] Modernized UI
- [x] Responsive dashboard
- [x] Production systemd/Gunicorn deployment

---

## Roadmap

Planned next steps include:

- final UI polish across all pages
- additional consistency improvements
- deployment and backup documentation
- backup/restore procedures
- additional automated tests
- further reporting and financial controls

---

## Repository

GitHub:

```text
https://github.com/abyss37/FinFlow
```

---

## License

See [`LICENSE`](LICENSE) for the project license.
