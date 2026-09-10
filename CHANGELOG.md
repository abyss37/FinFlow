# Changelog

All notable changes to FinFlow are documented in this file.

## [1.0.0] — 2026-09-10

First production-ready baseline of FinFlow.

### Added

- Modern Flask-based financial management platform.
- PostgreSQL production database.
- Alembic database migration workflow.
- User authentication with session-based login.
- Role-based access control with three roles:
  - Administrator
  - Manager
  - Viewer
- User management for administrators.
- Protected application routes and API endpoints.
- CSRF protection for state-changing requests.
- Audit Log with user attribution.
- Notifications with read/unread state.
- Company-specific budget and spending dashboards.
- ALPHA / BETA product analytics.
- Invoice lifecycle management.
- Invoice payment tracking.
- Invoice cancellation workflow.
- Invoice generator with PDF/HTML output.
- Contract date management.
- RU/EN interface localization.
- Modern responsive dashboard UI.
- User profile dropdown with role information and logout.
- PostgreSQL-aware database connection configuration.
- Gunicorn production deployment.
- systemd service configuration.
- Automated daily project and PostgreSQL backups.
- 14-day backup retention and rotation.
- Backup integrity verification.
- Git-based release workflow.

### Security

- Explicit application `SECRET_KEY` configuration through the production environment.
- Secure session cookies with:
  - HttpOnly
  - SameSite=Lax
  - Secure
- Authentication required for application pages.
- Role-based authorization for financial write operations.
- CSRF token validation for all POST requests.
- API-specific authentication and authorization responses.
- Passwords stored using Werkzeug password hashing.
- Sensitive environment configuration kept outside the Git repository.
- Backup archives explicitly exclude secrets, virtual environments, Git metadata, and temporary files.

### Database

- Production database migrated to PostgreSQL.
- SQLAlchemy 2.x based data layer.
- Alembic migration chain established and applied.
- Accounting data integrity constraints.
- Invoice lifecycle fields.
- Invoice payment tracking.
- Notification persistence and deduplication.
- User accounts and roles.
- Audit Log user attribution.

### Dashboard & Analytics

- Company-specific ALPHA and BETA dashboard cards.
- Budget, spending and remaining-budget calculations.
- Contract completion dates.
- Invoice payment status.
- Outstanding invoice exposure based on unpaid amounts.
- Analytics v2.
- Product-level financial overview.
- Improved dashboard presentation and responsive layout.

### Audit & Notifications

- Centralized Audit Log.
- Automatic attribution of new audit events to the authenticated user.
- Historical audit entries remain available without forced attribution.
- Notification API for reading and marking notifications.
- Read-all notification action.
- Notification deduplication support.

### Infrastructure

- Python 3.13 production runtime.
- Flask 3.x.
- Flask-SQLAlchemy 3.x.
- SQLAlchemy 2.x.
- PostgreSQL 17.
- Alembic.
- Gunicorn.
- systemd.
- Reverse-proxy compatible deployment.
- Linux production deployment.
- Automated backup job through cron.

### Documentation

- Complete project README.
- Documented architecture and project structure.
- Documented authentication and role model.
- Documented security model.
- Documented database migrations.
- Documented deployment workflow.
- Documented backup strategy.
- GitHub release workflow established.

---

## Versioning

FinFlow follows semantic versioning for published releases.

- `MAJOR` — incompatible architectural or API changes.
- `MINOR` — backward-compatible feature additions.
- `PATCH` — backward-compatible bug fixes and maintenance changes.

[1.0.0]: https://github.com/abyss37/FinFlow/releases/tag/v1.0.0
