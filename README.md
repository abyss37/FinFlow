# FinFlow

Financial control and accounting management platform for companies, invoices, budgets, payments and financial analytics.

**Stack:** Flask · PostgreSQL · Jinja2 · Tailwind CSS · JavaScript

---

## Overview

**FinFlow** is a web-based financial control platform focused on practical management of company budgets, outgoing invoices, payments and financial exposure.

Current direction:

- company-level financial control;
- outgoing invoice management;
- budget tracking;
- payment tracking;
- financial analytics;
- notifications;
- audit logging;
- user accounts and roles;
- document generation;
- Ukrainian and English localization;
- PostgreSQL production database;
- local production Tailwind CSS build.

The project is evolving toward a broader financial platform with multi-currency support, incoming financial flows, CRM, external accounting integrations and simplified production deployment.

---

## Current Features

### Dashboard

The Dashboard is the operational overview of FinFlow.

It provides:

- total budget;
- total invoiced amount;
- remaining budget;
- company count;
- overall financial progress;
- separate company cards;
- ALPHA / BETA software views;
- company-specific budget and spending information;
- alerts and notifications;
- latest invoices.

Detailed analytics are intentionally separated into the dedicated `/analytics` page.

### Financial Analytics

Available at:

```text
/analytics
```

Current analytics include:

- Budget;
- Invoiced;
- Remaining;
- Exposure;
- Utilization;
- spending by company;
- spending by product/software;
- monthly spending;
- date filters;
- company filters;
- product filters.

### Invoice Management

FinFlow supports the outgoing invoice lifecycle:

- invoice creation and editing;
- invoice status tracking;
- invoice amounts and dates;
- contract/completion dates;
- payment tracking;
- payment status;
- company/software association;
- filtering;
- invoice totals;
- outstanding exposure calculation.

### Budget Management

Current functionality includes:

- budget values;
- invoiced/spent values;
- remaining budget;
- utilization;
- company-level budget state;
- ALPHA / BETA separation;
- budget health visualization.

### Notifications

The notification center provides:

- invoice-related events;
- payment-related information;
- financial alerts;
- localized notification text;
- notification deduplication.

### Audit Log

The Audit Log provides visibility into:

- performed actions;
- affected entities;
- responsible users;
- timestamps;
- audit information.

### User Management

FinFlow supports:

- user accounts;
- authentication;
- roles;
- permissions;
- user management;
- audit attribution.

### Document Generation

Document-generation functionality is available at:

```text
/generator
```

---

## Authentication & Security

FinFlow uses authenticated sessions and protected application routes.

Security-related functionality includes:

- password hashing;
- authenticated sessions;
- protected routes;
- role-based authorization;
- CSRF protection;
- security-oriented HTTP configuration;
- database integrity constraints;
- audit logging.

Unauthenticated users receive the public landing page. Authenticated users receive the main Dashboard.

---

## Internationalization

FinFlow currently supports:

- 🇺🇦 **Ukrainian**
- 🇬🇧 **English**

**Default language: Ukrainian**

Shared localization layer:

```text
static/js/finflow-i18n.js
```

The project previously contained Russian localization. Russian is now treated as a transitional legacy value and is automatically mapped to Ukrainian.

The shared i18n layer provides:

- language detection;
- language switching;
- translation;
- smart translation/fallback;
- language event handling;
- shared language switchers.

---

## UI

FinFlow uses a modern responsive interface built around:

- Tailwind CSS;
- responsive layouts;
- reusable cards;
- dashboards;
- modal dialogs;
- tables;
- status badges;
- progress indicators;
- responsive navigation.

The interface is being progressively refined toward a consistent **FinFlow Design System**.

---

## Tailwind CSS

FinFlow no longer uses the Tailwind CDN in production.

Tailwind CSS is compiled locally into a production stylesheet.

Relevant files:

```text
tailwind.config.js
static/css/tailwind-input.css
static/css/tailwind.css
```

Current Tailwind version:

```text
3.4.19
```

Build command:

```bash
tailwindcss -c tailwind.config.js -i static/css/tailwind-input.css -o static/css/tailwind.css --minify
```

The generated CSS should be rebuilt whenever Tailwind classes are changed or added.

---

## Database

Production database:

```text
PostgreSQL 17
```

FinFlow uses SQLAlchemy / Flask-SQLAlchemy for database access.

PostgreSQL is the authoritative production database. SQLite remains useful for local development and migration/testing workflows.

---

## Database Migrations

Schema changes are managed with **Flask-Migrate / Alembic**.

Current documented migration chain:

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

Before production migrations:

```bash
flask db current
flask db heads
flask db upgrade
```

Always verify the database state after migrations.

---

## Technology Stack

### Backend

- Python 3
- Flask
- SQLAlchemy
- Flask-Migrate
- Alembic
- Gunicorn

### Database

- PostgreSQL 17
- SQLite for development/testing workflows

### Frontend

- HTML5
- Jinja2
- JavaScript
- Tailwind CSS 3.4.19
- locally compiled production CSS

### Infrastructure

- Linux
- systemd
- Gunicorn
- Git
- PostgreSQL

---

## Project Structure

```text
FinFlow/
├── app.py
├── config.py
├── requirements.txt
├── README.md
├── tailwind.config.js
│
├── migrations/
│   ├── versions/
│   └── ...
│
├── templates/
│   ├── index.html
│   ├── analytics.html
│   ├── generator.html
│   ├── users.html
│   ├── audit-log.html
│   ├── landing.html
│   ├── login.html
│   └── error.html
│
├── static/
│   ├── css/
│   │   ├── tailwind-input.css
│   │   └── tailwind.css
│   ├── js/
│   │   └── finflow-i18n.js
│   └── ...
│
├── instance/
│   └── ...
│
└── ...
```

---

## Configuration

Production configuration should be provided through environment variables or the deployment environment.

Typical configuration:

```text
DATABASE_URL
SECRET_KEY
FLASK_ENV
```

Never commit production secrets, passwords, tokens or private credentials to Git.

---

## Local Development

Clone the repository:

```bash
git clone https://github.com/abyss37/FinFlow.git
cd FinFlow
```

Create a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Configure the required environment variables and database.

Run migrations:

```bash
flask db upgrade
```

Start the development server:

```bash
flask run
```

---

## Production Deployment

Current production deployment:

```text
Linux
   ↓
systemd
   ↓
Gunicorn
   ↓
Flask / FinFlow
   ↓
PostgreSQL 17
```

Current production application path:

```text
/opt/accounting-app
```

Service:

```text
accounting-app
```

Useful commands:

```bash
systemctl status accounting-app
systemctl restart accounting-app
journalctl -u accounting-app -n 100 --no-pager
```

---

## Database Maintenance

Before destructive or schema-changing database operations:

1. verify the target database;
2. create or verify a backup;
3. inspect migration state;
4. apply changes;
5. verify application functionality.

Useful commands:

```bash
flask db current
flask db heads
```

---

## Demo / Seed Data

Development/demo data may be created using the project's available seed functionality.

Seed data must never be confused with production financial data.

When preparing production, verify that no demo/test records are present unless explicitly required.

---

## SQLite Migration / Development

SQLite may be used for local development and migration/testing workflows.

Production should use PostgreSQL.

When moving between database engines, verify:

- data types;
- constraints;
- indexes;
- date/time behavior;
- transaction behavior;
- migration compatibility.

---

## Testing

Before committing changes:

```bash
git diff --check
```

For application changes, verify at minimum:

- application starts;
- protected routes require authentication;
- Dashboard loads;
- Analytics loads;
- invoice workflows work;
- payment tracking works;
- company filtering remains correct;
- language switching works;
- notifications work;
- user menu works;
- no new browser console errors were introduced.

---

## Authentication Smoke Test

### Anonymous

```text
/
```

should show the public landing page.

Protected routes should redirect unauthenticated users to login.

### Authenticated

After login verify:

```text
/
/analytics
/generator
/users
/audit-log
```

according to the authenticated user's permissions.

---

## Roadmap

### Phase 1 — Product Polish

- [x] PostgreSQL production database
- [x] Operational Dashboard
- [x] Dedicated Analytics page
- [x] Notifications
- [x] Audit Log
- [x] User management and roles
- [x] Ukrainian / English localization foundation
- [x] Local production Tailwind build
- [ ] Remove remaining dead Dashboard Analytics JavaScript
- [ ] Final FinFlow Design System
- [ ] UI consistency and polish
- [ ] Complete Ukrainian / English translation review
- [ ] Multi-currency foundation

### Phase 2 — Financial Platform

- [x] Outgoing invoice lifecycle
- [x] Payment tracking
- [x] Outstanding exposure calculation
- [ ] Incoming invoices
- [ ] Incoming financial flows
- [ ] Incoming budgets
- [ ] Expanded outgoing/incoming budget model
- [ ] Payables and receivables tracking
- [ ] Advanced financial reporting
- [ ] Currency exchange rates
- [ ] Forecasting
- [ ] Plan vs Actual reporting

### Phase 3 — CRM

- [ ] Companies / counterparties
- [ ] Contacts
- [ ] Deals
- [ ] Interaction history
- [ ] Documents
- [ ] CRM ↔ FinFlow integration
- [ ] Link counterparties with invoices
- [ ] Link counterparties with payments
- [ ] Link counterparties with budgets
- [ ] Link deals with financial data

The goal is to make CRM a natural business layer around the existing FinFlow financial core.

### Phase 4 — External Integrations

- [ ] 1C integration
- [ ] M.E.Doc integration
- [ ] Financial document import/export
- [ ] Automated synchronization
- [ ] Integration error handling
- [ ] Synchronization history
- [ ] Mapping between external and FinFlow entities

The integration architecture should avoid coupling the core financial model directly to one external accounting system.

### Phase 5 — Production Packaging

The final deployment target is a reproducible containerized installation.

Planned:

- [ ] Docker image
- [ ] Docker Compose
- [ ] PostgreSQL container
- [ ] Persistent volumes
- [ ] Environment configuration
- [ ] Automatic database migrations
- [ ] Health checks
- [ ] Backup / restore workflow
- [ ] One-command installation
- [ ] One-command update
- [ ] Versioned releases
- [ ] Production documentation

Target concept:

```bash
docker compose up -d
```

### Phase 6 — Mobile Application

The mobile application is planned as a client of the FinFlow backend, not as a separate financial system.

Architecture target:

```text
                 ┌── Web UI
                 │
FinFlow API ─────┼── Mobile App
                 │
                 ├── CRM
                 │
                 ├── 1C
                 │
                 └── M.E.Doc
```

Planned:

- [ ] Define stable mobile API contract
- [ ] Mobile authentication
- [ ] Mobile Dashboard
- [ ] Invoices and payments
- [ ] Financial status
- [ ] Notifications
- [ ] CRM access
- [ ] Cross-platform Android / iOS client
- [ ] Google Play release
- [ ] App Store release

Mobile development should start after the core financial model and API boundaries are stable.

---

## Git Hygiene

Before committing:

```bash
git status
git diff --check
git diff
```

Recommended workflow:

```bash
git pull --ff-only
# make changes
git diff --check
git diff
git status
git add <files>
git commit -m "Describe the change"
git push origin main
```

Do not commit:

```text
.env
.env.*
*.sqlite
*.db
instance/*.db
__pycache__/
*.pyc
venv/
.venv/
secrets
credentials
private keys
production dumps
```

---

## Deployment Checklist

Before deploying:

- [ ] `git diff --check`
- [ ] review the actual diff
- [ ] verify no secrets are included
- [ ] verify database migration requirements
- [ ] verify templates
- [ ] verify JavaScript
- [ ] verify static assets
- [ ] restart/reload the application if required
- [ ] check service status
- [ ] check application logs
- [ ] test login
- [ ] test Dashboard
- [ ] test Analytics
- [ ] test invoices
- [ ] test payments
- [ ] test language switching
- [ ] test notifications
- [ ] test permissions

---

## Current Status

FinFlow currently has a working production-oriented foundation with:

- PostgreSQL 17;
- Flask backend;
- authenticated application;
- Dashboard;
- dedicated Analytics;
- company-level financial control;
- outgoing invoices;
- payment tracking;
- notifications;
- audit logging;
- user management;
- Ukrainian / English localization;
- locally compiled Tailwind CSS;
- production Gunicorn/systemd deployment.

The next major direction is:

```text
Multi-currency
      ↓
Incoming + Outgoing Finance
      ↓
CRM
      ↓
1C / M.E.Doc integrations
      ↓
Docker / one-command deployment
      ↓
Mobile client
```

---

## License

License information will be defined as the project matures.
