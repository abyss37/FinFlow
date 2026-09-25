import json
import os
import hmac
import secrets
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation

from flask import Flask, jsonify, redirect, render_template, request, url_for, send_from_directory, session, send_file
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps
from functools import wraps
from sqlalchemy import Numeric, func
from sqlalchemy.exc import IntegrityError

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

app = Flask(__name__)

COMPANY_STAMP_DIR = os.path.join(
    app.root_path,
    "static",
    "uploads",
    "company-stamps",
)

ALLOWED_STAMP_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
MAX_STAMP_FILE_SIZE = 5 * 1024 * 1024

OUR_COMPANY_ASSET_ROOT = os.path.join(
    app.root_path,
    "static",
    "uploads",
    "our-company",
)

OUR_COMPANY_ASSET_DIRS = {
    "logo": os.path.join(OUR_COMPANY_ASSET_ROOT, "logos"),
    "stamp": os.path.join(OUR_COMPANY_ASSET_ROOT, "stamps"),
    "signature": os.path.join(OUR_COMPANY_ASSET_ROOT, "signatures"),
}

ALLOWED_OUR_COMPANY_ASSET_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
MAX_OUR_COMPANY_ASSET_FILE_SIZE = 5 * 1024 * 1024

STAMP_MAX_DIMENSION = 1600
STAMP_BACKGROUND_THRESHOLD = 42
STAMP_BACKGROUND_SOFTNESS = 24


def process_company_stamp(uploaded_file):
    """
    Convert an uploaded company stamp into a transparent PNG suitable
    for invoice documents.

    The algorithm keeps existing transparency, samples the image corners
    as the background reference, removes pixels close to that background
    color, preserves the original stamp color, and keeps a soft alpha
    transition around the edges.
    """
    uploaded_file.stream.seek(0)

    with Image.open(uploaded_file.stream) as source:
        image = ImageOps.exif_transpose(source).convert("RGBA")

    width, height = image.size

    if max(width, height) > STAMP_MAX_DIMENSION:
        scale = STAMP_MAX_DIMENSION / max(width, height)
        image = image.resize(
            (
                max(1, round(width * scale)),
                max(1, round(height * scale)),
            ),
            Image.Resampling.LANCZOS,
        )

    rgb = image.convert("RGB")
    original_alpha = image.getchannel("A")

    sample_points = [
        (0, 0),
        (rgb.width - 1, 0),
        (0, rgb.height - 1),
        (rgb.width - 1, rgb.height - 1),
    ]

    samples = [rgb.getpixel(point) for point in sample_points]

    background = tuple(
        sum(sample[channel] for sample in samples) // len(samples)
        for channel in range(3)
    )

    background_image = Image.new(
        "RGB",
        rgb.size,
        background,
    )

    difference = ImageChops.difference(
        rgb,
        background_image,
    )

    difference = ImageEnhance.Contrast(
        difference
    ).enhance(1.35)

    distance = difference.convert("L")

    threshold = STAMP_BACKGROUND_THRESHOLD
    softness = STAMP_BACKGROUND_SOFTNESS

    alpha = distance.point(
        lambda value: (
            0
            if value <= threshold
            else min(
                255,
                int(
                    ((value - threshold) / softness)
                    * 255
                ),
            )
        )
    )

    alpha = alpha.filter(
        ImageFilter.GaussianBlur(0.35)
    )

    alpha = ImageChops.multiply(
        original_alpha,
        alpha,
    )

    rgb = ImageEnhance.Contrast(rgb).enhance(1.08)

    processed = Image.merge(
        "RGBA",
        (
            rgb.getchannel("R"),
            rgb.getchannel("G"),
            rgb.getchannel("B"),
            alpha,
        ),
    )

    return processed


def process_our_company_image(uploaded_file):
    """
    Normalize a logo or signature upload into a PNG with correct EXIF
    orientation and a maximum dimension of 2400 px.
    """
    uploaded_file.stream.seek(0)

    try:
        with Image.open(uploaded_file.stream) as source:
            image = ImageOps.exif_transpose(source).convert("RGBA")
    except Exception as exc:
        raise ValueError("Файл не является корректным изображением.") from exc

    width, height = image.size

    if width <= 0 or height <= 0:
        raise ValueError("Изображение имеет некорректные размеры.")

    max_dimension = 2400

    if max(width, height) > max_dimension:
        scale = max_dimension / max(width, height)
        image = image.resize(
            (
                max(1, round(width * scale)),
                max(1, round(height * scale)),
            ),
            Image.Resampling.LANCZOS,
        )

    return image


@app.after_request
def finflow_no_cache_html(response):
    """Prevent browsers from serving stale HTML shells after UI updates."""
    content_type = response.headers.get("Content-Type", "")
    if content_type.startswith("text/html"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


# Session security.
# The secret must be supplied through the production environment and must
# never be committed to Git or hardcoded in app.py.
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY is not set. Refusing to start without an explicit session secret."
    )

app.config["SECRET_KEY"] = SECRET_KEY
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = True


# CSRF protection.
# A per-session token is required for every POST request.
def get_csrf_token():
    token = session.get("csrf_token")

    if not token:
        token = secrets.token_urlsafe(32)
        session["csrf_token"] = token

    return token


@app.context_processor
def inject_csrf_token():
    return {
        "csrf_token": get_csrf_token,
    }


@app.before_request
def csrf_protect():
    if request.method != "POST":
        return None

    expected = session.get("csrf_token")
    provided = (
        request.form.get("csrf_token")
        or request.headers.get("X-CSRF-Token")
    )

    if (
        not expected
        or not provided
        or not hmac.compare_digest(expected, provided)
    ):
        if request.path.startswith("/api/") or request.is_json:
            return jsonify({"error": "csrf_failed"}), 403

        return (
            render_template(
                "error.html",
                error_code=403,
                error_title="Security check failed",
                error_message="CSRF validation failed. Please reload the page and try again.",
            ),
            403,
        )

    return None



# Global HTTP error handlers.
# Browser requests use the FinFlow Glass error page.
# API requests keep JSON responses so frontend integrations are not broken.

@app.errorhandler(404)
def handle_404(error):
    if request.path.startswith("/api/") or request.is_json:
        return jsonify({
            "error": "not_found",
            "message": "Resource not found."
        }), 404

    return render_template(
        "error.html",
        error_code=404,
        error_title="Page not found",
        error_message="The page you requested could not be found. It may have been moved or the address may be incorrect.",
    ), 404


@app.errorhandler(403)
def handle_403(error):
    if request.path.startswith("/api/") or request.is_json:
        return jsonify({
            "error": "forbidden",
            "message": "Access denied."
        }), 403

    return render_template(
        "error.html",
        error_code=403,
        error_title="Access denied",
        error_message="You do not have permission to access this resource.",
    ), 403


@app.errorhandler(500)
def handle_500(error):
    if request.path.startswith("/api/") or request.is_json:
        return jsonify({
            "error": "internal_server_error",
            "message": "An internal server error occurred."
        }), 500

    return render_template(
        "error.html",
        error_code=500,
        error_title="Something went wrong",
        error_message="FinFlow encountered an unexpected server error. Please try again or return to the dashboard.",
    ), 500



# SQLite remains the default for the current single-user deployment.
# For PostgreSQL set DATABASE_URL, e.g.:
# postgresql+psycopg://finflow:password@localhost:5432/finflow
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Refusing to start without an explicit database configuration."
    )
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+psycopg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True} if DATABASE_URL.startswith("postgresql") else {}

db = SQLAlchemy(app)

SOFTWARE_ALIASES = {
    "Product Alpha": "ALPHA",
    "Product Beta": "BETA",
    "Alpha": "ALPHA",
    "Beta": "BETA",
    "ALPHA": "ALPHA",
    "BETA": "BETA",
}


def canonical_software(value):
    value = (value or "ALPHA").strip()
    return SOFTWARE_ALIASES.get(value, value)


SUPPORTED_CURRENCIES = {
    "EUR": "€",
    "USD": "$",
    "UAH": "₴",
}


def canonical_currency(value):
    currency = (value or "EUR").strip().upper()

    if currency not in SUPPORTED_CURRENCIES:
        raise ValueError("Unsupported currency")

    return currency


def currency_symbol(value):
    return SUPPORTED_CURRENCIES.get(
        canonical_currency(value),
        "€",
    )


def money(value, default="0.00"):
    try:
        amount = Decimal(str(value if value not in (None, "") else default))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError("Invalid monetary value")
    return amount.quantize(Decimal("0.01"))


def money_float(value):
    return float(value or 0)


def payment_state(amount_eur, paid_amount_eur):
    """Return normalized paid amount and payment status."""
    total = money(amount_eur)
    paid = money(paid_amount_eur)

    if paid < 0:
        raise ValueError("Paid amount cannot be negative")

    if paid > total:
        raise ValueError("Paid amount cannot exceed invoice total")

    if paid == Decimal("0.00"):
        status = "UNPAID"
    elif paid < total:
        status = "PARTIALLY_PAID"
    else:
        status = "PAID"

    return paid, status
NOTIFICATION_TYPES = {
    "OVERDUE_INVOICE",
    "BUDGET_WARNING",
    "BUDGET_CRITICAL",
    "BUDGET_EXCEEDED",
    "CONTRACT_EXPIRING",
}

NOTIFICATION_LEVELS = {
    "info",
    "warning",
    "critical",
}


def create_notification(
    notification_type,
    level,
    title,
    message,
    dedup_key,
    company_id=None,
    invoice_id=None,
    software=None,
):
    """
    Create a persistent notification once.

    The unique dedup_key protects against duplicate notifications
    when multiple Gunicorn workers process requests concurrently.
    """

    if notification_type not in NOTIFICATION_TYPES:
        raise ValueError(
            f"Unknown notification type: {notification_type}"
        )

    if level not in NOTIFICATION_LEVELS:
        raise ValueError(
            f"Unknown notification level: {level}"
        )

    existing = Notification.query.filter_by(
        dedup_key=dedup_key
    ).first()

    if existing:
        return existing, False

    notification = Notification(
        type=notification_type,
        level=level,
        title=title,
        message=message,
        company_id=company_id,
        invoice_id=invoice_id,
        software=canonical_software(software) if software else None,
        dedup_key=dedup_key,
    )

    try:
        with db.session.begin_nested():
            db.session.add(notification)
            db.session.flush()

        return notification, True

    except IntegrityError:
        existing = Notification.query.filter_by(
            dedup_key=dedup_key
        ).first()

        if existing:
            return existing, False

        raise


def parse_contract_details(raw_details):
    if not raw_details:
        return "—"
    try:
        data = json.loads(raw_details)
        if isinstance(data, dict):
            items = data.get("items", [])
            items_str = "; ".join(items) if isinstance(items, list) else ""
            return data.get("description") or items_str or (
                f"PO № {data.get('po_number')}" if data.get("po_number") else "—"
            )
    except Exception:
        pass
    return raw_details


app.jinja_env.filters["parse_details"] = parse_contract_details


class User(db.Model):
    __tablename__ = "user"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(
        db.String(20),
        nullable=False,
        default="viewer",
        server_default="viewer",
    )
    is_active = db.Column(
        db.Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.now(),
    )
    last_login = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )
    last_login_ip = db.Column(
        db.String(45),
        nullable=True,
    )


# ---------------------------------------------------------------------------
# Authentication helpers
# ---------------------------------------------------------------------------

VALID_ROLES = {"admin", "manager", "viewer"}


def get_current_user():
    """Return the authenticated active user, or None."""
    user_id = session.get("user_id")

    if not user_id:
        return None

    user = db.session.get(User, user_id)

    if not user or not user.is_active:
        session.clear()
        return None

    return user


def login_user(user):
    """Create a minimal Flask session for an authenticated user."""
    session.clear()
    session["user_id"] = user.id


def logout_user():
    """Destroy the current authentication session."""
    session.clear()


def login_required(view):
    """Require an authenticated active user."""
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        user = get_current_user()

        if user is None:
            if request.path.startswith("/api/"):
                return jsonify({
                    "error": "authentication_required"
                }), 401

            return redirect(
                url_for(
                    "login",
                    next=request.full_path if request.query_string else request.path,
                )
            )

        return view(*args, **kwargs)

    return wrapped_view


def role_required(*roles):
    """Require authentication and one of the supplied roles."""
    allowed_roles = set(roles)

    invalid_roles = allowed_roles - VALID_ROLES
    if invalid_roles:
        raise ValueError(
            f"Unknown role(s): {', '.join(sorted(invalid_roles))}"
        )

    def decorator(view):
        @wraps(view)
        def wrapped_view(*args, **kwargs):
            user = get_current_user()

            if user is None:
                if request.path.startswith("/api/"):
                    return jsonify({
                        "error": "authentication_required"
                    }), 401

                return redirect(
                    url_for(
                        "login",
                        next=request.full_path if request.query_string else request.path,
                    )
                )

            if user.role not in allowed_roles:
                if request.path.startswith("/api/"):
                    return jsonify({
                        "error": "forbidden"
                    }), 403

                return (
                    render_template(
                        "error.html",
                        error_code=403,
                        error_title="Access denied",
                        error_message="You do not have permission to access this page.",
                    ),
                    403,
                )

            return view(*args, **kwargs)

        return wrapped_view

    return decorator


class Product(db.Model):
    __tablename__ = "product"

    id = db.Column(db.Integer, primary_key=True)

    code = db.Column(
        db.String(50),
        unique=True,
        nullable=False,
    )

    name = db.Column(
        db.String(255),
        nullable=False,
    )

    description = db.Column(
        db.Text,
        nullable=True,
    )

    status = db.Column(
        db.String(20),
        nullable=False,
        default="ACTIVE",
        server_default="ACTIVE",
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.now(),
    )

    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.now(),
    )


class Company(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False)
    stamp_filename = db.Column(db.String(255), nullable=True)
    invoices = db.relationship("Invoice", backref="company", lazy=True, cascade="all, delete-orphan")
    budgets = db.relationship("CompanyBudget", backref="company", lazy=True, cascade="all, delete-orphan")


class OurCompany(db.Model):
    __tablename__ = "our_company"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False)
    director_name = db.Column(db.String(255), nullable=True)
    director_position = db.Column(db.String(255), nullable=True)
    phone = db.Column(db.String(100), nullable=True)
    email = db.Column(db.String(255), nullable=True)
    logo_filename = db.Column(db.String(255), nullable=True)
    stamp_filename = db.Column(db.String(255), nullable=True)
    signature_filename = db.Column(db.String(255), nullable=True)
    ecp_reference = db.Column(db.String(500), nullable=True)
    status = db.Column(
        db.String(20),
        nullable=False,
        default="ACTIVE",
        server_default="ACTIVE",
    )
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.now(),
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.now(),
    )

    details = db.relationship(
        "OurCompanyDetails",
        backref="our_company",
        lazy=True,
        cascade="all, delete-orphan",
    )


class OurCompanyDetails(db.Model):
    __tablename__ = "our_company_details"

    id = db.Column(db.Integer, primary_key=True)
    our_company_id = db.Column(
        db.Integer,
        db.ForeignKey("our_company.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = db.Column(db.String(255), nullable=False)
    legal_address = db.Column(db.Text, nullable=True)
    actual_address = db.Column(db.Text, nullable=True)
    registration_number = db.Column(db.String(100), nullable=True)
    tax_number = db.Column(db.String(100), nullable=True)
    vat_number = db.Column(db.String(100), nullable=True)
    bank_name = db.Column(db.String(255), nullable=True)
    iban = db.Column(db.String(100), nullable=True)
    swift = db.Column(db.String(50), nullable=True)
    additional_details = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.now(),
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.now(),
    )


class CompanyBudget(db.Model):
    __table_args__ = (
        db.Index("idx_company_budget_company_id", "company_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey("company.id"), nullable=False)
    software = db.Column(db.String(50), nullable=False)
    # Numeric is intentional: PostgreSQL stores money exactly; existing SQLite DBs
    # can continue working until an explicit migration converts the column.
    total_amount = db.Column(Numeric(14, 2), default=Decimal("0.00"))
    currency = db.Column(db.String(3), nullable=False, default="EUR")
    completion_date = db.Column(db.Date, nullable=True)


class AuditLog(db.Model):
    __tablename__ = "audit_log"

    id = db.Column(db.BigInteger, primary_key=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.now(),
    )
    action = db.Column(db.String(50), nullable=False)
    entity_type = db.Column(db.String(50), nullable=False)
    entity_id = db.Column(db.String(100), nullable=True)
    company_id = db.Column(db.Integer, nullable=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", ondelete="SET NULL"),
        nullable=True,
    )
    software = db.Column(db.String(50), nullable=True)
    description = db.Column(db.Text, nullable=False)
    details = db.Column(db.Text, nullable=True)
    user = db.relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        db.Index("idx_audit_log_created_at", "created_at"),
        db.Index("idx_audit_log_action", "action"),
        db.Index("idx_audit_log_company_id", "company_id"),
    )

class Notification(db.Model):
    __tablename__ = "notification"

    id = db.Column(db.BigInteger, primary_key=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.now(),
    )

    type = db.Column(db.String(50), nullable=False)
    level = db.Column(db.String(20), nullable=False)

    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)

    company_id = db.Column(
        db.Integer,
        db.ForeignKey("company.id", ondelete="CASCADE"),
        nullable=True,
    )

    invoice_id = db.Column(
        db.Integer,
        db.ForeignKey("invoice.id", ondelete="CASCADE"),
        nullable=True,
    )

    software = db.Column(db.String(50), nullable=True)

    is_read = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        server_default=db.false(),
    )

    read_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    dedup_key = db.Column(
        db.String(255),
        nullable=True,
        unique=True,
    )

    company = db.relationship(
        "Company",
        foreign_keys=[company_id],
    )

    invoice = db.relationship(
        "Invoice",
        foreign_keys=[invoice_id],
    )


class Invoice(db.Model):
    __table_args__ = (
        db.Index("idx_invoice_company_id", "company_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey("company.id"), nullable=False)
    invoice_number = db.Column(db.String(100), nullable=True)
    invoice_date = db.Column(db.Date, nullable=True)
    completion_date = db.Column(db.Date, nullable=True)
    software = db.Column(db.String(50), nullable=False)
    amount_eur = db.Column(Numeric(14, 2), nullable=False)
    currency = db.Column(db.String(3), nullable=False, default="EUR")
    contract_details = db.Column(db.Text, nullable=True)
    status = db.Column(
        db.String(20),
        nullable=False,
        default="ISSUED",
        server_default="ISSUED",
    )
    cancelled_at = db.Column(db.DateTime(timezone=True), nullable=True)
    cancellation_reason = db.Column(db.Text, nullable=True)
    payment_status = db.Column(
        db.String(20),
        nullable=False,
        default="UNPAID",
        server_default="UNPAID",
    )
    paid_amount_eur = db.Column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default="0.00",
    )


def write_audit_log(
    action,
    entity_type,
    entity_id=None,
    company_id=None,
    software=None,
    description="",
    details=None,
):
    current_user_id = session.get("user_id")

    log = AuditLog(
        action=action,
        entity_type=entity_type,
        user_id=current_user_id,
        entity_id=str(entity_id) if entity_id is not None else None,
        company_id=company_id,
        software=canonical_software(software) if software else None,
        description=description,
        details=json.dumps(details, ensure_ascii=False, default=str) if details is not None else None,
    )
    db.session.add(log)
    return log


def migrate_legacy_software():
    """Small, idempotent compatibility migration for the current SQLite database."""
    changed = False
    for model in (Invoice, CompanyBudget):
        rows = model.query.all()
        for row in rows:
            canonical = canonical_software(row.software)
            if canonical != row.software and canonical in ("ALPHA", "BETA"):
                row.software = canonical
                changed = True
    if changed:
        db.session.commit()


def build_company_cards(companies):
    cards = []

    for company in companies:
        active_invoices = [
            inv for inv in company.invoices
            if inv.status != "CANCELLED"
        ]

        software_data = {}

        for software in ("ALPHA", "BETA"):
            software_budgets = [
                budget
                for budget in company.budgets
                if canonical_software(budget.software) == software
            ]

            software_invoices = [
                inv
                for inv in active_invoices
                if canonical_software(inv.software) == software
            ]

            # A company/software card represents one budget.
            # Prefer the existing budget with the highest amount.
            # Currency is kept explicitly so EUR/USD/UAH are never mixed.
            budget = (
                max(
                    software_budgets,
                    key=lambda item: money(item.total_amount),
                )
                if software_budgets
                else None
            )

            if budget:
                currency = canonical_currency(budget.currency)
            elif software_invoices:
                currency = canonical_currency(software_invoices[0].currency)
            else:
                currency = "EUR"

            spent = sum(
                (
                    money(inv.amount_eur)
                    for inv in software_invoices
                    if canonical_currency(inv.currency) == currency
                ),
                Decimal("0.00"),
            )

            has_software = bool(software_invoices) or bool(
                budget and money(budget.total_amount) > 0
            )

            software_data[software] = {
                "budget": budget,
                "currency": currency,
                "spent": spent,
                "has": has_software,
            }

        alpha = software_data["ALPHA"]
        beta = software_data["BETA"]

        has_alpha = alpha["has"]
        has_beta = beta["has"]

        if not has_alpha and not has_beta:
            has_alpha = True

        default_sw = "ALPHA" if has_alpha else "BETA"

        # Dynamic product layer.
        # Keep the legacy ALPHA/BETA fields below for compatibility
        # with the current Companies frontend and notification logic.
        products = []

        active_products = (
            Product.query
            .filter(Product.status == "ACTIVE")
            .order_by(Product.name.asc())
            .all()
        )

        for product in active_products:
            product_budgets = [
                budget
                for budget in company.budgets
                if canonical_software(budget.software) == product.code
            ]

            product_invoices = [
                inv
                for inv in active_invoices
                if canonical_software(inv.software) == product.code
            ]

            product_budget = (
                max(
                    product_budgets,
                    key=lambda item: money(item.total_amount),
                )
                if product_budgets
                else None
            )

            if product_budget:
                product_currency = canonical_currency(
                    product_budget.currency
                )
            elif product_invoices:
                product_currency = canonical_currency(
                    product_invoices[0].currency
                )
            else:
                product_currency = "EUR"

            product_spent = sum(
                (
                    money(inv.amount_eur)
                    for inv in product_invoices
                    if canonical_currency(inv.currency) == product_currency
                ),
                Decimal("0.00"),
            )

            product_has = bool(product_invoices) or bool(
                product_budget and money(product_budget.total_amount) > 0
            )

            if not product_has:
                continue

            products.append({
                "id": product.id,
                "code": product.code,
                "name": product.name,
                "status": product.status,
                "budget": (
                    money_float(product_budget.total_amount)
                    if product_budget else 0
                ),
                "spent": money_float(product_spent),
                "currency": product_currency,
                "symbol": currency_symbol(product_currency),
                "completion_date": (
                    product_budget.completion_date.isoformat()
                    if product_budget and product_budget.completion_date
                    else ""
                ),
                "has": True,
            })

        cards.append({
            "id": company.id,
            "name": company.name,
            "stamp_filename": company.stamp_filename or "",
            "stamp_url": (
                url_for(
                    "static",
                    filename=f"uploads/company-stamps/{company.stamp_filename}",
                )
                if company.stamp_filename
                else ""
            ),

            "products": products,

            "has_alpha": has_alpha,
            "has_beta": has_beta,
            "default_sw": default_sw,

            "alpha_budget": (
                money_float(alpha["budget"].total_amount)
                if alpha["budget"] else 0
            ),
            "alpha_spent": money_float(alpha["spent"]),
            "alpha_currency": alpha["currency"],
            "alpha_symbol": currency_symbol(alpha["currency"]),
            "alpha_date": (
                alpha["budget"].completion_date.isoformat()
                if alpha["budget"] and alpha["budget"].completion_date
                else ""
            ),

            "beta_budget": (
                money_float(beta["budget"].total_amount)
                if beta["budget"] else 0
            ),
            "beta_spent": money_float(beta["spent"]),
            "beta_currency": beta["currency"],
            "beta_symbol": currency_symbol(beta["currency"]),
            "beta_date": (
                beta["budget"].completion_date.isoformat()
                if beta["budget"] and beta["budget"].completion_date
                else ""
            ),
        })

    return cards



def dashboard_metrics(company_cards, invoices):
    """
    Calculate dashboard financial metrics separately for each currency.

    Budgets are taken from the dynamic product layer of company cards.
    Invoice amounts are grouped by their own currency.
    Different currencies are never summed together.
    """

    by_currency = {}

    def ensure_currency(currency):
        currency = canonical_currency(currency)

        if currency not in by_currency:
            by_currency[currency] = {
                "currency": currency,
                "symbol": currency_symbol(currency),
                "total_budget": Decimal("0.00"),
                "total_spent": Decimal("0.00"),
            }

        return by_currency[currency]

    # Budgets come from the dynamic product layer.
    for card in company_cards:
        for product in card.get("products", []):
            budget = Decimal(
                str(product.get("budget") or 0)
            )

            if budget <= 0:
                continue

            currency = canonical_currency(
                product.get("currency")
            )

            data = ensure_currency(currency)
            data["total_budget"] += budget

    # Invoices are grouped by their own currency.
    for inv in invoices:
        if inv.status == "CANCELLED":
            continue

        currency = canonical_currency(inv.currency)
        data = ensure_currency(currency)

        data["total_spent"] += money(inv.amount_eur)

    result = {}

    for currency, data in by_currency.items():
        remaining = (
            data["total_budget"] -
            data["total_spent"]
        )

        utilization = (
            data["total_spent"] /
            data["total_budget"] *
            Decimal("100")
            if data["total_budget"] > 0
            else Decimal("0")
        )

        result[currency] = {
            "currency": currency,
            "symbol": data["symbol"],
            "total_budget": money_float(data["total_budget"]),
            "total_spent": money_float(data["total_spent"]),
            "remaining": money_float(remaining),
            "utilization": round(float(utilization), 1),
        }

    # Keep legacy top-level values for compatibility with older
    # consumers. The currency-aware frontend uses by_currency.
    eur = result.get("EUR", {})

    return {
        "by_currency": result,
        "total_budget": eur.get("total_budget", 0),
        "total_spent": eur.get("total_spent", 0),
        "remaining": eur.get("remaining", 0),
        "utilization": eur.get("utilization", 0),
    }


def build_alerts(company_cards, invoices=None):
    """
    Build dashboard financial alerts from company-card and invoice data.

    Budget thresholds:
      < 80%    -> healthy
      80-89.9% -> warning
      90-99.9% -> critical
      >= 100%  -> exceeded

    Also keeps contract-end alerts for contracts ending within 30 days
    and adds overdue invoice alerts.

    Monetary values are displayed using the currency of the
    corresponding budget or invoice.
    """

    alerts = []
    today = date.today()

    for card in company_cards:
        company_name = card["name"]

        for software in ("ALPHA", "BETA"):
            prefix = software.lower()

            budget = Decimal(
                str(card[f"{prefix}_budget"] or 0)
            )
            spent = Decimal(
                str(card[f"{prefix}_spent"] or 0)
            )
            currency = canonical_currency(
                card[f"{prefix}_currency"]
            )
            symbol = currency_symbol(currency)

            if budget <= 0:
                continue

            pct = (spent / budget) * Decimal("100")
            remaining = budget - spent

            if pct >= Decimal("100"):
                alerts.append({
                    "level": "critical",
                    "icon": "bi-exclamation-octagon",
                    "title": f"{company_name} · {software}",
                    "text": (
                        f"Budget exceeded by "
                        f"{symbol}{abs(remaining):,.2f}"
                    ),
                })
            elif pct >= Decimal("90"):
                alerts.append({
                    "level": "critical",
                    "icon": "bi-exclamation-octagon",
                    "title": f"{company_name} · {software}",
                    "text": (
                        f"{pct:.1f}% of the budget has been invoiced. "
                        f"{symbol}{remaining:,.2f} remains."
                    ),
                })
            elif pct >= Decimal("80"):
                alerts.append({
                    "level": "warning",
                    "icon": "bi-exclamation-triangle",
                    "title": f"{company_name} · {software}",
                    "text": (
                        f"{pct:.1f}% of the budget has been invoiced. "
                        f"{symbol}{remaining:,.2f} remains."
                    ),
                })

            completion = card[f"{prefix}_date"]

            if isinstance(completion, str):
                try:
                    completion = date.fromisoformat(completion)
                except ValueError:
                    completion = None

            if completion:
                days = (completion - today).days

                if 0 <= days <= 30:
                    alerts.append({
                        "level": "warning",
                        "icon": "bi-calendar-event",
                        "title": f"{company_name} · {software}",
                        "text": (
                            f"Contract ends in "
                            f"{days} day{'s' if days != 1 else ''}"
                        ),
                    })

    # Overdue invoices:
    # - cancelled invoices are ignored
    # - fully paid invoices are ignored
    # - invoices without a completion date are ignored
    # - partially paid invoices use the outstanding balance
    for inv in invoices or []:
        if inv.status == "CANCELLED":
            continue

        completion = inv.completion_date
        if not completion:
            continue

        paid = money(inv.paid_amount_eur)
        amount = money(inv.amount_eur)

        if paid >= amount:
            continue

        days_overdue = (today - completion).days
        if days_overdue <= 0:
            continue

        outstanding = amount - paid
        company_name = inv.company.name if inv.company else "Unknown company"
        software = canonical_software(inv.software)
        currency = canonical_currency(inv.currency)
        symbol = currency_symbol(currency)

        alerts.append({
            "level": "critical",
            "icon": "bi-clock-history",
            "title": f"{company_name} · {software}",
            "text": (
                f"Invoice {inv.invoice_number or inv.id} is "
                f"{days_overdue} day{'s' if days_overdue != 1 else ''} overdue. "
                f"{symbol}{outstanding:,.2f} outstanding."
            ),
            "type": "overdue_invoice",
            "invoice_id": inv.id,
            "company_id": inv.company_id,
            "software": software,
        })

    severity = {
        "critical": 0,
        "warning": 1,
    }

    alerts.sort(
        key=lambda item: (
            severity.get(item["level"], 9),
            item["title"],
            item["text"],
        )
    )

    return alerts[:8]

def sync_notifications(company_cards, invoices):
    """
    Synchronize dashboard conditions into persistent notifications.

    Notifications are deduplicated by database-enforced dedup_key.
    Existing notifications are preserved so the user can mark them read.

    Monetary values are displayed using the currency of the
    corresponding budget or invoice.
    """

    today = date.today()

    # =========================================================
    # Budget and contract notifications
    # =========================================================

    for card in company_cards:
        company_id = card["id"]
        company_name = card["name"]

        for software in ("ALPHA", "BETA"):
            prefix = software.lower()

            budget = Decimal(
                str(card[f"{prefix}_budget"] or 0)
            )

            spent = Decimal(
                str(card[f"{prefix}_spent"] or 0)
            )

            currency = canonical_currency(
                card[f"{prefix}_currency"]
            )
            symbol = currency_symbol(currency)

            if budget > 0:
                pct = (spent / budget) * Decimal("100")
                remaining = budget - spent

                if pct >= Decimal("100"):
                    create_notification(
                        notification_type="BUDGET_EXCEEDED",
                        level="critical",
                        title=f"{company_name} · {software}",
                        message=(
                            f"Budget exceeded by "
                            f"{symbol}{abs(remaining):,.2f}."
                        ),
                        dedup_key=(
                            f"BUDGET_EXCEEDED:"
                            f"{company_id}:{software}"
                        ),
                        company_id=company_id,
                        software=software,
                    )

                elif pct >= Decimal("90"):
                    create_notification(
                        notification_type="BUDGET_CRITICAL",
                        level="critical",
                        title=f"{company_name} · {software}",
                        message=(
                            f"{pct:.1f}% of the budget has been "
                            f"invoiced. {symbol}{remaining:,.2f} remains."
                        ),
                        dedup_key=(
                            f"BUDGET_CRITICAL:"
                            f"{company_id}:{software}"
                        ),
                        company_id=company_id,
                        software=software,
                    )

                elif pct >= Decimal("80"):
                    create_notification(
                        notification_type="BUDGET_WARNING",
                        level="warning",
                        title=f"{company_name} · {software}",
                        message=(
                            f"{pct:.1f}% of the budget has been "
                            f"invoiced. {symbol}{remaining:,.2f} remains."
                        ),
                        dedup_key=(
                            f"BUDGET_WARNING:"
                            f"{company_id}:{software}"
                        ),
                        company_id=company_id,
                        software=software,
                    )

            # -------------------------------------------------
            # Contract expiration
            # -------------------------------------------------

            completion = card[f"{prefix}_date"]

            if isinstance(completion, str):
                try:
                    completion = date.fromisoformat(completion)
                except ValueError:
                    completion = None

            if completion:
                days = (completion - today).days

                if 0 <= days <= 30:
                    create_notification(
                        notification_type="CONTRACT_EXPIRING",
                        level="warning",
                        title=f"{company_name} · {software}",
                        message=(
                            f"Contract ends in "
                            f"{days} day"
                            f"{'s' if days != 1 else ''}."
                        ),
                        dedup_key=(
                            f"CONTRACT_EXPIRING:"
                            f"{company_id}:{software}"
                        ),
                        company_id=company_id,
                        software=software,
                    )

    # =========================================================
    # Overdue invoice notifications
    # =========================================================

    for inv in invoices:
        if inv.status == "CANCELLED":
            continue

        completion = inv.completion_date

        if not completion:
            continue

        amount = money(inv.amount_eur)
        paid = money(inv.paid_amount_eur)

        if paid >= amount:
            continue

        days_overdue = (today - completion).days

        if days_overdue <= 0:
            continue

        outstanding = amount - paid

        company_name = (
            inv.company.name
            if inv.company
            else "Unknown company"
        )

        software = canonical_software(inv.software)
        currency = canonical_currency(inv.currency)
        symbol = currency_symbol(currency)

        create_notification(
            notification_type="OVERDUE_INVOICE",
            level="critical",
            title=f"{company_name} · {software}",
            message=(
                f"Invoice {inv.invoice_number or inv.id} is "
                f"{days_overdue} day"
                f"{'s' if days_overdue != 1 else ''} overdue. "
                f"{symbol}{outstanding:,.2f} outstanding."
            ),
            dedup_key=f"OVERDUE_INVOICE:{inv.id}",
            company_id=inv.company_id,
            invoice_id=inv.id,
            software=software,
        )

    db.session.commit()

def notification_payload(notification):
    return {
        "id": notification.id,
        "created_at": (
            notification.created_at.isoformat()
            if notification.created_at
            else None
        ),
        "type": notification.type,
        "level": notification.level,
        "title": notification.title,
        "message": notification.message,
        "company_id": notification.company_id,
        "invoice_id": notification.invoice_id,
        "software": notification.software,
        "is_read": bool(notification.is_read),
        "read_at": (
            notification.read_at.isoformat()
            if notification.read_at
            else None
        ),
    }

@app.route("/login", methods=["GET", "POST"])
def login():
    next_url = request.args.get("next", "")

    if next_url and not next_url.startswith("/"):
        next_url = ""

    user = get_current_user()

    if user is not None:
        return redirect(next_url or url_for("index"))

    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        password = request.form.get("password") or ""

        user = User.query.filter_by(username=username).first()

        if (
            user is None
            or not user.is_active
            or not check_password_hash(user.password_hash, password)
        ):
            return render_template(
                "login.html",
                error="Invalid username or password.",
                next_url=next_url,
            ), 401

        login_user(user)

        user.last_login = datetime.now(timezone.utc)
        user.last_login_ip = request.headers.get("X-Real-IP") or request.remote_addr
        db.session.commit()

        return redirect(next_url or url_for("index"))

    return render_template(
        "login.html",
        error=None,
        next_url=next_url,
    )


@app.route("/logout", methods=["POST"])
def logout():
    logout_user()
    return redirect(url_for("login"))


@app.route("/finflow-preview.png")
def finflow_preview():
    return send_from_directory(
        app.static_folder,
        "finflow-preview.png",
        mimetype="image/png",
    )


@app.route("/")
def index():
    current_user = get_current_user()

    if current_user is None:
        return render_template("landing.html")

    companies = Company.query.order_by(Company.name).all()
    invoices = Invoice.query.order_by(Invoice.id.desc()).all()

    active_our_company = (
        OurCompany.query
        .filter(OurCompany.status == "ACTIVE")
        .order_by(OurCompany.name.asc())
        .first()
    )

    active_products = (
        Product.query
        .filter(Product.status == "ACTIVE")
        .order_by(Product.name.asc())
        .all()
    )

    products = [
        {
            "id": product.id,
            "code": product.code,
            "name": product.name,
            "status": product.status,
        }
        for product in active_products
    ]

    company_cards = build_company_cards(companies)

    # Synchronize persistent notifications before rendering
    # the dashboard. Database-level deduplication makes this
    # safe across multiple Gunicorn workers.
    sync_notifications(company_cards, invoices)

    metrics = dashboard_metrics(company_cards, invoices)
    alerts = build_alerts(company_cards, invoices)

    return render_template(
        "index.html",
        companies=companies,
        invoices=invoices,
        company_cards=company_cards,
        products=products,
        metrics=metrics,
        alerts=alerts,
        active_our_company=active_our_company,
        current_user=get_current_user(),
        currency_symbols=SUPPORTED_CURRENCIES,
        database_backend="PostgreSQL" if DATABASE_URL.startswith("postgresql") else "SQLite",
    )

@app.route("/budgets")
@login_required
def budgets_page():
    active_products = (
        Product.query
        .filter(Product.status == "ACTIVE")
        .order_by(Product.name.asc())
        .all()
    )

    companies = (
        Company.query
        .order_by(Company.name.asc())
        .all()
    )

    budgets = (
        CompanyBudget.query
        .join(Company)
        .order_by(Company.name.asc(), CompanyBudget.software.asc(), CompanyBudget.currency.asc())
        .all()
    )

    active_invoices = Invoice.query.filter(
        Invoice.status != "CANCELLED"
    ).all()

    spent_map = {}

    for inv in active_invoices:
        software = canonical_software(inv.software)
        currency = canonical_currency(inv.currency)

        key = (inv.company_id, software, currency)

        spent_map[key] = (
            spent_map.get(key, Decimal("0.00"))
            + money(inv.amount_eur)
        )

    budget_data = []

    for budget in budgets:
        software = canonical_software(budget.software)
        currency = canonical_currency(budget.currency)

        total_amount = money(budget.total_amount)
        spent_amount = spent_map.get(
            (budget.company_id, software, currency),
            Decimal("0.00"),
        )

        remaining_amount = total_amount - spent_amount

        utilization = (
            spent_amount / total_amount * Decimal("100")
            if total_amount > 0
            else Decimal("0.00")
        )

        budget_data.append({
            "id": budget.id,
            "company_id": budget.company_id,
            "company_name": budget.company.name if budget.company else "",
            "software": software,
            "currency": currency,
            "symbol": currency_symbol(currency),
            "total_amount": money_float(total_amount),
            "spent_amount": money_float(spent_amount),
            "remaining_amount": money_float(remaining_amount),
            "utilization": float(utilization),
            "completion_date": (
                budget.completion_date.isoformat()
                if budget.completion_date
                else ""
            ),
        })

    return render_template(
        "budgets.html",
        budgets=budget_data,
        products=active_products,
        companies=companies,
        current_user=get_current_user(),
        currency_symbols=SUPPORTED_CURRENCIES,
    )



@app.route("/invoices")
@login_required
def invoices_page():
    active_products = (
        Product.query
        .filter(Product.status == "ACTIVE")
        .order_by(Product.name.asc())
        .all()
    )

    companies = (
        Company.query
        .order_by(Company.name.asc())
        .all()
    )

    invoices = (
        Invoice.query
        .join(Company)
        .order_by(Invoice.id.desc())
        .all()
    )

    invoice_data = []

    for inv in invoices:
        amount = money(inv.amount_eur)
        paid = money(inv.paid_amount_eur)
        currency = canonical_currency(inv.currency)
        software = canonical_software(inv.software)

        invoice_data.append({
            "id": inv.id,
            "company_id": inv.company_id,
            "company_name": inv.company.name if inv.company else "",
            "invoice_number": inv.invoice_number or "",
            "invoice_date": (
                inv.invoice_date.isoformat()
                if inv.invoice_date
                else ""
            ),
            "completion_date": (
                inv.completion_date.isoformat()
                if inv.completion_date
                else ""
            ),
            "software": software,
            "amount": money_float(amount),
            "currency": currency,
            "symbol": currency_symbol(currency),
            "contract_details": inv.contract_details or "",
            "status": inv.status or "ISSUED",
            "cancelled_at": (
                inv.cancelled_at.isoformat()
                if inv.cancelled_at
                else ""
            ),
            "cancellation_reason": (
                inv.cancellation_reason or ""
            ),
            "payment_status": (
                inv.payment_status or "UNPAID"
            ),
            "paid_amount": money_float(paid),
            "outstanding_amount": money_float(
                max(amount - paid, Decimal("0.00"))
            ),
        })

    return render_template(
        "invoices.html",
        invoices=invoice_data,
        products=active_products,
        companies=companies,
        current_user=get_current_user(),
    )


@app.route("/companies")
@login_required
def companies_page():
    companies = Company.query.order_by(Company.name).all()
    invoices = Invoice.query.order_by(Invoice.id.desc()).all()

    company_cards = build_company_cards(companies)

    invoice_data = []
    for inv in invoices:
        invoice_data.append({
            "id": inv.id,
            "company_id": inv.company_id,
            "company_name": inv.company.name if inv.company else "",
            "invoice_number": inv.invoice_number,
            "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else "",
            "completion_date": (
                inv.completion_date.isoformat()
                if inv.completion_date else ""
            ),
            "software": inv.software,
            "amount": money_float(inv.amount_eur),
            "currency": canonical_currency(inv.currency),
            "contract_details": inv.contract_details or "",
            "status": inv.status,
            "cancelled_at": (
                inv.cancelled_at.isoformat()
                if inv.cancelled_at else ""
            ),
            "cancellation_reason": inv.cancellation_reason or "",
            "payment_status": inv.payment_status,
            "paid_amount": money_float(inv.paid_amount_eur),
        })

    return render_template(
        "companies.html",
        companies=companies,
        company_cards=company_cards,
        invoices=invoice_data,
        current_user=get_current_user(),
        currency_symbols=SUPPORTED_CURRENCIES,
    )


@app.route("/companies/create", methods=["POST"])
@role_required("admin", "manager")
def create_company():
    try:
        data = request.get_json(silent=True) or request.form
        name = str(data.get("name", "")).strip()

        if not name:
            return jsonify({
                "status": "error",
                "message": "Название компании обязательно."
            }), 400

        if len(name) > 255:
            return jsonify({
                "status": "error",
                "message": "Название компании не должно превышать 255 символов."
            }), 400

        existing = Company.query.filter(
            db.func.lower(Company.name) == name.lower()
        ).first()

        if existing:
            return jsonify({
                "status": "error",
                "code": "duplicate",
                "message": "Компания с таким названием уже существует."
            }), 409

        company = Company(name=name)
        db.session.add(company)
        db.session.flush()

        write_audit_log(
            action="COMPANY_CREATED",
            entity_type="company",
            entity_id=company.id,
            company_id=company.id,
            description=f"Company {name} created",
            details={
                "company_name": name,
            },
        )

        db.session.commit()

        return jsonify({
            "status": "ok",
            "company": {
                "id": company.id,
                "name": company.name,
            },
        })

    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "code": "duplicate",
            "message": "Компания с таким названием уже существует."
        }), 409
    except Exception as exc:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 400


@app.route("/companies/<int:company_id>/stamp", methods=["POST"])
@role_required("admin", "manager")
def upload_company_stamp(company_id):
    company = Company.query.get_or_404(company_id)

    stamp = request.files.get("stamp")

    if not stamp or not stamp.filename:
        return jsonify({
            "status": "error",
            "message": "Файл печати не выбран.",
        }), 400

    original_name = stamp.filename.strip()
    extension = (
        original_name.rsplit(".", 1)[-1].lower()
        if "." in original_name
        else ""
    )

    if extension not in ALLOWED_STAMP_EXTENSIONS:
        return jsonify({
            "status": "error",
            "message": "Допустимые форматы печати: PNG, JPG, JPEG, WebP.",
        }), 400

    stamp.stream.seek(0, os.SEEK_END)
    file_size = stamp.stream.tell()
    stamp.stream.seek(0)

    if file_size > MAX_STAMP_FILE_SIZE:
        return jsonify({
            "status": "error",
            "message": "Размер файла печати не должен превышать 5 МБ.",
        }), 400

    os.makedirs(COMPANY_STAMP_DIR, exist_ok=True)

    old_filename = company.stamp_filename
    filename = f"company-{company.id}-{secrets.token_hex(12)}.png"
    destination = os.path.join(COMPANY_STAMP_DIR, filename)

    try:
        processed_stamp = process_company_stamp(stamp)

        processed_stamp.save(
            destination,
            format="PNG",
            optimize=True,
        )

        company.stamp_filename = filename

        write_audit_log(
            action="COMPANY_STAMP_UPDATED",
            entity_type="company",
            entity_id=company.id,
            company_id=company.id,
            description=f"Company stamp updated for {company.name}",
            details={
                "old_filename": old_filename or "",
                "new_filename": filename,
                "original_filename": original_name,
                "original_extension": extension,
                "processed_format": "PNG",
            },
        )

        db.session.commit()

    except Exception:
        db.session.rollback()

        if os.path.exists(destination):
            os.remove(destination)

        raise

    if old_filename:
        old_path = os.path.join(COMPANY_STAMP_DIR, old_filename)

        if old_path != destination and os.path.isfile(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

    return jsonify({
        "status": "ok",
        "company": {
            "id": company.id,
            "name": company.name,
            "stamp_filename": company.stamp_filename,
            "stamp_url": url_for(
                "static",
                filename=f"uploads/company-stamps/{company.stamp_filename}",
            ),
        },
    })


@app.route("/companies/<int:company_id>/update", methods=["POST"])
@role_required("admin", "manager")
def update_company(company_id):
    company = Company.query.get_or_404(company_id)

    try:
        data = request.get_json(silent=True) or request.form
        name = str(data.get("name", "")).strip()

        if not name:
            return jsonify({
                "status": "error",
                "message": "Название компании обязательно."
            }), 400

        if len(name) > 255:
            return jsonify({
                "status": "error",
                "message": "Название компании не должно превышать 255 символов."
            }), 400

        duplicate = Company.query.filter(
            db.func.lower(Company.name) == name.lower(),
            Company.id != company.id,
        ).first()

        if duplicate:
            return jsonify({
                "status": "error",
                "code": "duplicate",
                "message": "Компания с таким названием уже существует."
            }), 409

        old_name = company.name

        if old_name != name:
            company.name = name

            write_audit_log(
                action="COMPANY_UPDATED",
                entity_type="company",
                entity_id=company.id,
                company_id=company.id,
                description=f"Company {old_name} renamed to {name}",
                details={
                    "changes": {
                        "name": {
                            "from": old_name,
                            "to": name,
                        }
                    }
                },
            )

        db.session.commit()

        return jsonify({
            "status": "ok",
            "company": {
                "id": company.id,
                "name": company.name,
            },
        })

    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "code": "duplicate",
            "message": "Компания с таким названием уже существует."
        }), 409

    except Exception as exc:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 400


@app.route("/companies/<int:company_id>/delete", methods=["POST"])
@role_required("admin", "manager")
def delete_company(company_id):
    company = Company.query.get_or_404(company_id)

    try:
        company_id_value = company.id
        company_name = company.name
        invoice_count = len(company.invoices)
        budget_count = len(company.budgets)

        write_audit_log(
            action="COMPANY_DELETED",
            entity_type="company",
            entity_id=company_id_value,
            company_id=company_id_value,
            description=f"Company {company_name} deleted",
            details={
                "company_name": company_name,
                "invoice_count": invoice_count,
                "budget_count": budget_count,
            },
        )

        db.session.delete(company)
        db.session.commit()

        return jsonify({
            "status": "ok",
            "company_id": company_id_value,
            "company_name": company_name,
        })

    except Exception as exc:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 400



@app.route("/products")
@login_required
def products_page():
    products = Product.query.order_by(Product.status.asc(), Product.name.asc()).all()

    usage_counts = {}

    for product in products:
        usage_counts[product.code] = {
            "budgets": CompanyBudget.query.filter(
                CompanyBudget.software == product.code
            ).count(),
            "invoices": Invoice.query.filter(
                Invoice.software == product.code
            ).count(),
        }

    return render_template(
        "products.html",
        products=products,
        usage_counts=usage_counts,
        current_user=get_current_user(),
    )


@app.route("/products/create", methods=["POST"])
@role_required("admin", "manager")
def create_product():
    try:
        data = request.get_json(silent=True) or request.form

        code = str(data.get("code", "")).strip().upper()
        name = str(data.get("name", "")).strip()
        description = str(data.get("description", "")).strip()

        if not code:
            return jsonify({
                "status": "error",
                "message": "Код продукта обязателен."
            }), 400

        if len(code) > 50:
            return jsonify({
                "status": "error",
                "message": "Код продукта не должен превышать 50 символов."
            }), 400

        if not code.replace("_", "").replace("-", "").isalnum():
            return jsonify({
                "status": "error",
                "message": "Код продукта может содержать только латинские буквы, цифры, дефис и подчёркивание."
            }), 400

        if not name:
            return jsonify({
                "status": "error",
                "message": "Название продукта обязательно."
            }), 400

        if len(name) > 255:
            return jsonify({
                "status": "error",
                "message": "Название продукта не должно превышать 255 символов."
            }), 400

        if len(description) > 10000:
            return jsonify({
                "status": "error",
                "message": "Описание продукта не должно превышать 10000 символов."
            }), 400

        existing = Product.query.filter(
            db.func.lower(Product.code) == code.lower()
        ).first()

        if existing:
            return jsonify({
                "status": "error",
                "code": "duplicate",
                "message": "Продукт с таким кодом уже существует."
            }), 409

        product = Product(
            code=code,
            name=name,
            description=description or None,
            status="ACTIVE",
        )

        db.session.add(product)
        db.session.flush()

        write_audit_log(
            action="PRODUCT_CREATED",
            entity_type="product",
            entity_id=product.id,
            description=f"Product {product.code} created",
            details={
                "code": product.code,
                "name": product.name,
                "description": product.description,
                "status": product.status,
            },
        )

        db.session.commit()

        return jsonify({
            "status": "ok",
            "product": {
                "id": product.id,
                "code": product.code,
                "name": product.name,
                "description": product.description or "",
                "status": product.status,
                "created_at": product.created_at.isoformat() if product.created_at else None,
                "updated_at": product.updated_at.isoformat() if product.updated_at else None,
                "usage": {
                    "budgets": 0,
                    "invoices": 0,
                },
            },
        })

    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "code": "duplicate",
            "message": "Продукт с таким кодом уже существует."
        }), 409

    except Exception as exc:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 400


@app.route("/products/<int:product_id>/update", methods=["POST"])
@role_required("admin", "manager")
def update_product(product_id):
    product = Product.query.get_or_404(product_id)

    try:
        data = request.get_json(silent=True) or request.form

        code = str(data.get("code", "")).strip().upper()
        name = str(data.get("name", "")).strip()
        description = str(data.get("description", "")).strip()

        if not code:
            return jsonify({
                "status": "error",
                "message": "Код продукта обязателен."
            }), 400

        if len(code) > 50:
            return jsonify({
                "status": "error",
                "message": "Код продукта не должен превышать 50 символов."
            }), 400

        if not code.replace("_", "").replace("-", "").isalnum():
            return jsonify({
                "status": "error",
                "message": "Код продукта может содержать только латинские буквы, цифры, дефис и подчёркивание."
            }), 400

        if not name:
            return jsonify({
                "status": "error",
                "message": "Название продукта обязательно."
            }), 400

        if len(name) > 255:
            return jsonify({
                "status": "error",
                "message": "Название продукта не должно превышать 255 символов."
            }), 400

        if len(description) > 10000:
            return jsonify({
                "status": "error",
                "message": "Описание продукта не должно превышать 10000 символов."
            }), 400

        duplicate = Product.query.filter(
            db.func.lower(Product.code) == code.lower(),
            Product.id != product.id,
        ).first()

        if duplicate:
            return jsonify({
                "status": "error",
                "code": "duplicate",
                "message": "Продукт с таким кодом уже существует."
            }), 409

        old_values = {
            "code": product.code,
            "name": product.name,
            "description": product.description or "",
            "status": product.status,
        }

        if product.code != code:
            budget_count = CompanyBudget.query.filter(
                CompanyBudget.software == product.code
            ).count()

            invoice_count = Invoice.query.filter(
                Invoice.software == product.code
            ).count()

            if budget_count or invoice_count:
                return jsonify({
                    "status": "error",
                    "code": "code_in_use",
                    "message": (
                        f"Код продукта {product.code} используется "
                        f"в финансовых данных "
                        f"(бюджетов: {budget_count}, "
                        f"счетов: {invoice_count}). "
                        "Для используемого продукта код нельзя изменить."
                    ),
                    "usage": {
                        "budgets": budget_count,
                        "invoices": invoice_count,
                    },
                }), 409

        changes = {}

        if product.code != code:
            changes["code"] = {
                "from": product.code,
                "to": code,
            }

        if product.name != name:
            changes["name"] = {
                "from": product.name,
                "to": name,
            }

        old_description = product.description or ""
        if old_description != description:
            changes["description"] = {
                "from": old_description,
                "to": description,
            }

        if changes:
            product.code = code
            product.name = name
            product.description = description or None
            product.updated_at = db.func.now()

            write_audit_log(
                action="PRODUCT_UPDATED",
                entity_type="product",
                entity_id=product.id,
                description=f"Product {code} updated",
                details={
                    "changes": changes,
                    "previous": old_values,
                },
            )

        db.session.commit()

        return jsonify({
            "status": "ok",
            "product": {
                "id": product.id,
                "code": product.code,
                "name": product.name,
                "description": product.description or "",
                "status": product.status,
                "created_at": product.created_at.isoformat() if product.created_at else None,
                "updated_at": product.updated_at.isoformat() if product.updated_at else None,
                "usage": {
                    "budgets": CompanyBudget.query.filter(
                        CompanyBudget.software == product.code
                    ).count(),
                    "invoices": Invoice.query.filter(
                        Invoice.software == product.code
                    ).count(),
                },
            },
        })

    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "code": "duplicate",
            "message": "Продукт с таким кодом уже существует."
        }), 409

    except Exception as exc:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 400


@app.route("/products/<int:product_id>/archive", methods=["POST"])
@role_required("admin", "manager")
def archive_product(product_id):
    product = Product.query.get_or_404(product_id)

    try:
        if product.status == "ARCHIVED":
            return jsonify({
                "status": "ok",
                "product": {
                    "id": product.id,
                    "code": product.code,
                    "status": product.status,
                },
            })

        old_status = product.status
        product.status = "ARCHIVED"
        product.updated_at = db.func.now()

        write_audit_log(
            action="PRODUCT_ARCHIVED",
            entity_type="product",
            entity_id=product.id,
            description=f"Product {product.code} archived",
            details={
                "code": product.code,
                "status": {
                    "from": old_status,
                    "to": "ARCHIVED",
                },
            },
        )

        db.session.commit()

        return jsonify({
            "status": "ok",
            "product": {
                "id": product.id,
                "code": product.code,
                "status": product.status,
            },
        })

    except Exception as exc:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 400


@app.route("/products/<int:product_id>/delete", methods=["POST"])
@role_required("admin", "manager")
def delete_product(product_id):
    product = Product.query.get_or_404(product_id)

    try:
        product_code = product.code
        product_name = product.name

        budget_count = CompanyBudget.query.filter(
            CompanyBudget.software == product_code
        ).count()

        invoice_count = Invoice.query.filter(
            Invoice.software == product_code
        ).count()

        if budget_count or invoice_count:
            return jsonify({
                "status": "error",
                "code": "in_use",
                "message": (
                    f"Продукт {product_code} используется в финансовых данных "
                    f"(бюджетов: {budget_count}, счетов: {invoice_count}). "
                    "Его можно только архивировать."
                ),
                "usage": {
                    "budgets": budget_count,
                    "invoices": invoice_count,
                },
            }), 409

        write_audit_log(
            action="PRODUCT_DELETED",
            entity_type="product",
            entity_id=product.id,
            description=f"Product {product_code} deleted",
            details={
                "code": product_code,
                "name": product_name,
            },
        )

        db.session.delete(product)
        db.session.commit()

        return jsonify({
            "status": "ok",
            "product_id": product.id,
            "product_code": product_code,
            "product_name": product_name,
        })

    except IntegrityError:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "code": "in_use",
            "message": "Продукт используется в системе и не может быть удалён."
        }), 409

    except Exception as exc:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 400


@app.route("/analytics")
@login_required
def analytics():
    companies = Company.query.order_by(Company.name).all()
    invoices = Invoice.query.order_by(Invoice.id.desc()).all()
    company_cards = build_company_cards(companies)
    metrics = dashboard_metrics(company_cards, invoices)

    invoice_data = []

    for inv in invoices:
        amount = money(inv.amount_eur)

        invoice_data.append({
            "id": inv.id,
            "company_id": inv.company_id,
            "company_name": inv.company.name if inv.company else "",
            "invoice_number": inv.invoice_number or "",
            "invoice_date": (
                inv.invoice_date.isoformat()
                if inv.invoice_date
                else ""
            ),
            "completion_date": (
                inv.completion_date.isoformat()
                if inv.completion_date
                else ""
            ),
            "software": canonical_software(inv.software),
            "amount": money_float(amount),
            "currency": canonical_currency(inv.currency),
            "symbol": currency_symbol(
                canonical_currency(inv.currency)
            ),
            "contract_details": inv.contract_details or "",
            "status": inv.status or "ISSUED",
            "cancelled_at": (
                inv.cancelled_at.isoformat()
                if inv.cancelled_at
                else ""
            ),
            "cancellation_reason": (
                inv.cancellation_reason or ""
            ),
            "payment_status": (
                inv.payment_status or "UNPAID"
            ),
            "paid_amount": money_float(
                money(inv.paid_amount_eur)
            ),
        })

    return render_template(
        "analytics.html",
        companies=companies,
        invoices=invoice_data,
        company_cards=company_cards,
        metrics=metrics,
        currency_symbols=SUPPORTED_CURRENCIES,
        database_backend=(
            "PostgreSQL"
            if DATABASE_URL.startswith("postgresql")
            else "SQLite"
        ),
        current_user=get_current_user(),
    )



def _pdf_escape_text(value):
    """Normalize arbitrary invoice text for ReportLab Paragraphs."""
    if value is None:
        return ""
    return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _pdf_money(value, currency):
    amount = money(value)
    code = canonical_currency(currency)
    formatted = f"{amount:,.2f}".replace(",", " ").replace(".", ",")
    return f"{code} {formatted}"


def _pdf_contract_data(raw):
    """Read both legacy string-item and current object-item contract formats."""
    if not raw:
        return {
            "po_number": "",
            "bill_to_details": "",
            "payment_terms": "",
            "notes": "",
            "terms": "",
            "items": [],
        }

    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return {
            "po_number": "",
            "bill_to_details": "",
            "payment_terms": "",
            "notes": str(raw),
            "terms": "",
            "items": [],
        }

    if not isinstance(data, dict):
        return {
            "po_number": "",
            "bill_to_details": "",
            "payment_terms": "",
            "notes": "",
            "terms": "",
            "items": [],
        }

    items = data.get("items") or []
    normalized_items = []

    for item in items:
        if isinstance(item, dict):
            description = str(item.get("description") or "").strip()
            quantity = money(item.get("quantity", 1))
            rate = money(item.get("rate", 0))

            if quantity <= 0:
                quantity = Decimal("1.00")

            normalized_items.append({
                "description": description,
                "quantity": quantity,
                "rate": rate,
                "amount": quantity * rate,
            })
        else:
            description = str(item or "").strip()
            if description:
                normalized_items.append({
                    "description": description,
                    "quantity": Decimal("1.00"),
                    "rate": Decimal("0.00"),
                    "amount": Decimal("0.00"),
                })

    return {
        "po_number": str(data.get("po_number") or "").strip(),
        "bill_to_details": str(data.get("bill_to_details") or "").strip(),
        "payment_terms": str(data.get("payment_terms") or "").strip(),
        "notes": str(data.get("notes") or "").strip(),
        "terms": str(data.get("terms") or "").strip(),
        "items": normalized_items,
    }


def build_invoice_pdf(invoice):
    """Build a standalone A4 FinFlow invoice PDF from the current DB invoice."""
    buffer = BytesIO()

    font_regular = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    font_bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

    pdfmetrics.registerFont(TTFont("FinFlowSans", font_regular))
    pdfmetrics.registerFont(TTFont("FinFlowSansBold", font_bold))

    from reportlab.platypus import SimpleDocTemplate

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        title=f"FinFlow Invoice {invoice.invoice_number or invoice.id}",
        author="FinFlow",
        subject="Invoice",
    )

    width, _ = A4
    content_width = width - 32 * mm

    currency = canonical_currency(invoice.currency)
    symbol = currency_symbol(currency)
    software = canonical_software(invoice.software)
    contract = _pdf_contract_data(invoice.contract_details)

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "FFTitle",
        parent=styles["Normal"],
        fontName="FinFlowSansBold",
        fontSize=25,
        leading=29,
        textColor=colors.HexColor("#0f172a"),
        alignment=TA_RIGHT,
        spaceAfter=3,
    )

    label_style = ParagraphStyle(
        "FFLabel",
        parent=styles["Normal"],
        fontName="FinFlowSansBold",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#64748b"),
        uppercase=True,
    )

    body_style = ParagraphStyle(
        "FFBody",
        parent=styles["Normal"],
        fontName="FinFlowSans",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1e293b"),
    )

    small_style = ParagraphStyle(
        "FFSmall",
        parent=body_style,
        fontSize=7.5,
        leading=10,
    )

    right_style = ParagraphStyle(
        "FFRight",
        parent=body_style,
        alignment=TA_RIGHT,
    )

    header_company = Paragraph(
        "<b>ACME SOFTWARE SOLUTIONS LTD</b><br/>"
        "Registration number - <b>HE 123456</b><br/>"
        "T.I.C.- <b>12345678X</b>, VAT <b>CY 12345678X</b><br/>"
        "123 Business Street, Suite 100, Limassol, Cyprus<br/>"
        "Email: info@example.com",
        small_style,
    )

    invoice_number = _pdf_escape_text(invoice.invoice_number or str(invoice.id))

    header = Table(
        [[
            header_company,
            [
                Paragraph("INVOICE", title_style),
                Paragraph(
                    f"<b># {invoice_number}</b>",
                    ParagraphStyle(
                        "FFNumber",
                        parent=right_style,
                        fontName="FinFlowSansBold",
                        fontSize=10,
                        textColor=colors.HexColor("#059669"),
                    ),
                ),
            ],
        ]],
        colWidths=[content_width * 0.62, content_width * 0.38],
    )

    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, 0), 0.7, colors.HexColor("#cbd5e1")),
    ]))

    story = [header, Spacer(1, 8 * mm)]

    bill_to = _pdf_escape_text(invoice.company.name if invoice.company else "")
    bill_details = _pdf_escape_text(contract["bill_to_details"])

    invoice_date = (
        invoice.invoice_date.strftime("%d.%m.%Y")
        if invoice.invoice_date
        else "—"
    )
    completion_date = (
        invoice.completion_date.strftime("%d.%m.%Y")
        if invoice.completion_date
        else "—"
    )

    meta_left = [
        Paragraph("BILL TO", label_style),
        Paragraph(f"<b>{bill_to or '—'}</b>", body_style),
    ]

    if bill_details:
        meta_left.append(Paragraph(bill_details.replace("\n", "<br/>"), small_style))

    meta_right = [
        Paragraph("INVOICE DATE", label_style),
        Paragraph(f"<b>{invoice_date}</b>", body_style),
        Spacer(1, 3),
        Paragraph("COMPLETION DATE", label_style),
        Paragraph(f"<b>{completion_date}</b>", body_style),
    ]

    if contract["payment_terms"]:
        meta_right.extend([
            Spacer(1, 3),
            Paragraph("PAYMENT TERMS", label_style),
            Paragraph(
                _pdf_escape_text(contract["payment_terms"]),
                body_style,
            ),
        ])

    meta = Table(
        [[meta_left, meta_right]],
        colWidths=[content_width * 0.60, content_width * 0.40],
    )

    meta.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    story.extend([meta, Spacer(1, 8 * mm)])

    details = [
        [Paragraph("PRODUCT", label_style), Paragraph("CURRENCY", label_style)],
        [Paragraph(f"<b>{software}</b>", body_style), Paragraph(f"<b>{currency}</b>", body_style)],
    ]

    if contract["po_number"]:
        details[0].append(Paragraph("PO NUMBER", label_style))
        details[1].append(
            Paragraph(_pdf_escape_text(contract["po_number"]), body_style)
        )

    detail_widths = [content_width / len(details[0])] * len(details[0])
    detail_table = Table(details, colWidths=detail_widths)

    detail_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))

    story.extend([detail_table, Spacer(1, 8 * mm)])

    items = contract["items"]

    if not items:
        items = [{
            "description": f"{software} Software License",
            "quantity": Decimal("1.00"),
            "rate": money(invoice.amount_eur),
            "amount": money(invoice.amount_eur),
        }]

    table_data = [[
        Paragraph("DESCRIPTION", label_style),
        Paragraph("QTY", label_style),
        Paragraph("RATE", label_style),
        Paragraph("AMOUNT", label_style),
    ]]

    subtotal = Decimal("0.00")

    for item in items:
        amount = money(item["amount"])
        subtotal += amount

        table_data.append([
            Paragraph(
                _pdf_escape_text(item["description"] or "—").replace("\n", "<br/>"),
                body_style,
            ),
            Paragraph(
                f"{item['quantity']:,.2f}".rstrip("0").rstrip("."),
                ParagraphStyle(
                    "FFQty",
                    parent=body_style,
                    alignment=TA_CENTER,
                ),
            ),
            Paragraph(
                _pdf_money(item["rate"], currency),
                right_style,
            ),
            Paragraph(
                _pdf_money(amount, currency),
                ParagraphStyle(
                    "FFAmount",
                    parent=right_style,
                    fontName="FinFlowSansBold",
                ),
            ),
        ])

    item_table = Table(
        table_data,
        colWidths=[
            content_width * 0.54,
            content_width * 0.12,
            content_width * 0.17,
            content_width * 0.17,
        ],
        repeatRows=1,
    )

    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))

    story.extend([item_table, Spacer(1, 7 * mm)])

    total = money(invoice.amount_eur)

    totals = Table(
        [
            [Paragraph("SUBTOTAL", label_style), Paragraph(_pdf_money(subtotal, currency), right_style)],
            [Paragraph("<b>TOTAL</b>", body_style), Paragraph(
                f"<b>{_pdf_money(total, currency)}</b>",
                ParagraphStyle(
                    "FFTotal",
                    parent=right_style,
                    fontName="FinFlowSansBold",
                    fontSize=11,
                ),
            )],
        ],
        colWidths=[content_width * 0.70, content_width * 0.30],
    )

    totals.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, 1), (-1, 1), 0.8, colors.HexColor("#0f172a")),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))

    story.append(totals)

    if contract["notes"] or contract["terms"]:
        story.append(Spacer(1, 8 * mm))

        notes = []

        if contract["notes"]:
            notes.append([
                Paragraph("NOTES", label_style),
                Paragraph(
                    _pdf_escape_text(contract["notes"]).replace("\n", "<br/>"),
                    small_style,
                ),
            ])

        if contract["terms"]:
            notes.append([
                Paragraph("TERMS", label_style),
                Paragraph(
                    _pdf_escape_text(contract["terms"]).replace("\n", "<br/>"),
                    small_style,
                ),
            ])

        notes_table = Table(
            notes,
            colWidths=[content_width * 0.18, content_width * 0.82],
        )

        notes_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))

        story.append(notes_table)

    # ------------------------------------------------------------
    # SIGNATURE / COMPANY STAMP
    # Mirrors generator preview:
    # signature LEFT -> stamp RIGHT.
    # AUTHORIZED BY / director data intentionally omitted.
    # ------------------------------------------------------------
    active_our_company = (
        OurCompany.query
        .filter(OurCompany.status == "ACTIVE")
        .order_by(OurCompany.id.asc())
        .first()
    )

    if active_our_company:
        signature_path = None
        stamp_path = None

        if active_our_company.signature_filename:
            candidate = os.path.join(
                OUR_COMPANY_ASSET_DIRS["signature"],
                active_our_company.signature_filename,
            )
            if os.path.isfile(candidate):
                signature_path = candidate

        if active_our_company.stamp_filename:
            candidate = os.path.join(
                OUR_COMPANY_ASSET_DIRS["stamp"],
                active_our_company.stamp_filename,
            )
            if os.path.isfile(candidate):
                stamp_path = candidate

        if signature_path or stamp_path:
            signature_flowable = None
            stamp_flowable = None

            # Preview: 145 x 72 px.
            # Keep the same visual proportion in the PDF.
            if signature_path:
                try:
                    from PIL import Image as PILImage

                    with PILImage.open(signature_path) as img:
                        sig_w, sig_h = img.size

                    max_sig_w = 38 * mm
                    max_sig_h = 19 * mm

                    sig_scale = min(
                        max_sig_w / sig_w,
                        max_sig_h / sig_h,
                    )

                    signature_flowable = Image(
                        signature_path,
                        width=sig_w * sig_scale,
                        height=sig_h * sig_scale,
                        hAlign="CENTER",
                    )
                except Exception:
                    signature_flowable = None

            # Preview: 120 x 120 px.
            # Approximately 2x the signature visual mass.
            if stamp_path:
                try:
                    from PIL import Image as PILImage

                    with PILImage.open(stamp_path) as img:
                        stamp_w, stamp_h = img.size

                    max_stamp_w = 32 * mm
                    max_stamp_h = 32 * mm

                    stamp_scale = min(
                        max_stamp_w / stamp_w,
                        max_stamp_h / stamp_h,
                    )

                    stamp_flowable = Image(
                        stamp_path,
                        width=stamp_w * stamp_scale,
                        height=stamp_h * stamp_scale,
                        hAlign="CENTER",
                    )
                except Exception:
                    stamp_flowable = None

            if signature_flowable or stamp_flowable:

                signature_stamp_table = Table(
                    [[
                        signature_flowable or "",
                        stamp_flowable or "",
                    ]],
                    colWidths=[
                        content_width * 0.38,
                        content_width * 0.38,
                    ],
                    hAlign="CENTER",
                )

                signature_stamp_table.setStyle(TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]))

                signature_stamp_table.spaceBefore = 1 * mm
                signature_stamp_table.spaceAfter = 0
                story.append(signature_stamp_table)

    if invoice.status == "CANCELLED":
        reason = _pdf_escape_text(invoice.cancellation_reason or "No reason provided")
        story.extend([
            Spacer(1, 7 * mm),
            Table(
                [[Paragraph(
                    f"<b>CANCELLED</b><br/>{reason}",
                    ParagraphStyle(
                        "FFCancelled",
                        parent=small_style,
                        textColor=colors.HexColor("#991b1b"),
                    ),
                )]],
                colWidths=[content_width],
                style=TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fef2f2")),
                    ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#fecaca")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]),
            ),
        ])

    doc.build(story)
    buffer.seek(0)
    return buffer


@app.route("/generator/pdf/<int:invoice_id>")
@login_required
def generator_pdf(invoice_id):
    invoice = (
        Invoice.query
        .join(Company)
        .filter(Invoice.id == invoice_id)
        .first_or_404()
    )

    pdf = build_invoice_pdf(invoice)

    invoice_number = (invoice.invoice_number or f"invoice-{invoice.id}").strip()
    safe_name = "".join(
        ch if ch.isalnum() or ch in "-_." else "_"
        for ch in invoice_number
    ).strip("._")

    if not safe_name:
        safe_name = f"invoice-{invoice.id}"

    return send_file(
        pdf,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"FinFlow_{safe_name}.pdf",
    )


@app.route("/generator")
@login_required
def generator():
    companies = Company.query.order_by(Company.name).all()
    invoices = Invoice.query.order_by(Invoice.id.desc()).all()
    initial_invoice_id = request.args.get("invoice_id", type=int)

    active_our_company = (
        OurCompany.query
        .filter(OurCompany.status == "ACTIVE")
        .order_by(OurCompany.name.asc())
        .first()
    )

    our_company_data = None

    if active_our_company:
        details = sorted(
            active_our_company.details or [],
            key=lambda item: (
                item.name or "",
                item.id or 0,
            ),
        )

        our_company_data = {
            "id": active_our_company.id,
            "name": active_our_company.name or "",
            "director_name": active_our_company.director_name or "",
            "director_position": active_our_company.director_position or "",
            "phone": active_our_company.phone or "",
            "email": active_our_company.email or "",
            "logo_url": (
                url_for(
                    "static",
                    filename=(
                        "uploads/our-company/logos/"
                        + active_our_company.logo_filename
                    ),
                )
                if active_our_company.logo_filename
                else ""
            ),
            "stamp_url": (
                url_for(
                    "static",
                    filename=(
                        "uploads/our-company/stamps/"
                        + active_our_company.stamp_filename
                    ),
                )
                if active_our_company.stamp_filename
                else ""
            ),
            "signature_url": (
                url_for(
                    "static",
                    filename=(
                        "uploads/our-company/signatures/"
                        + active_our_company.signature_filename
                    ),
                )
                if active_our_company.signature_filename
                else ""
            ),
            "ecp_reference": active_our_company.ecp_reference or "",
            "details": [
                {
                    "id": item.id,
                    "name": item.name or "",
                    "legal_address": item.legal_address or "",
                    "actual_address": item.actual_address or "",
                    "registration_number": item.registration_number or "",
                    "tax_number": item.tax_number or "",
                    "vat_number": item.vat_number or "",
                    "bank_name": item.bank_name or "",
                    "iban": item.iban or "",
                    "swift": item.swift or "",
                    "additional_details": item.additional_details or "",
                }
                for item in details
            ],
        }

    invoices_list = [
        {
            "id": inv.id,
            "company_name": inv.company.name if inv.company else "",
            "stamp_url": (
                url_for(
                    "static",
                    filename=f"uploads/company-stamps/{inv.company.stamp_filename}",
                )
                if inv.company and inv.company.stamp_filename
                else ""
            ),
            "invoice_number": inv.invoice_number or "—",
            "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else "",
            "completion_date": inv.completion_date.isoformat() if inv.completion_date else "",
            "software": canonical_software(inv.software),
            "currency": canonical_currency(inv.currency),
            "currency_symbol": currency_symbol(inv.currency),
            "amount_eur": money_float(inv.amount_eur),
            "amount": money_float(inv.amount_eur),
            "paid_amount_eur": money_float(inv.paid_amount_eur),
            "paid_amount": money_float(inv.paid_amount_eur),
            "contract_details": inv.contract_details or "",
            "status": inv.status,
            "cancelled_at": inv.cancelled_at.isoformat() if inv.cancelled_at else "",
            "cancellation_reason": inv.cancellation_reason or "",
        }
        for inv in invoices
    ]

    return render_template(
        "generator.html",
        companies=companies,
        archived_invoices=invoices_list,
        initial_invoice_id=initial_invoice_id,
        our_company=our_company_data,
        current_user=get_current_user(),
    )

def get_or_create_company(name):
    company = Company.query.filter(
        func.lower(Company.name) == name.lower()
    ).first()

    if not company:
        company = Company(name=name)
        db.session.add(company)
        db.session.flush()

        write_audit_log(
            action="COMPANY_CREATED",
            entity_type="company",
            entity_id=company.id,
            company_id=company.id,
            description=f"Company {company.name} created",
            details={
                "company": company.name,
            },
        )

    return company


def duplicate_invoice(company_id, software, invoice_number, exclude_id=None):
    if not invoice_number:
        return None
    query = Invoice.query.filter_by(company_id=company_id, software=software, invoice_number=invoice_number)
    if exclude_id:
        query = query.filter(Invoice.id != exclude_id)
    return query.first()


def invoice_payload(data, require_amount=True):
    company_name = (data.get("company_name") or "").strip()
    invoice_number = (data.get("invoice_number") or "").strip()
    invoice_date_raw = (data.get("invoice_date") or "").strip()
    completion_date_raw = (data.get("completion_date") or "").strip()

    try:
        invoice_date = date.fromisoformat(invoice_date_raw) if invoice_date_raw else None
        completion_date = date.fromisoformat(completion_date_raw) if completion_date_raw else None
    except ValueError as exc:
        raise ValueError("Dates must use YYYY-MM-DD format") from exc
    software = canonical_software(data.get("software"))
    currency = canonical_currency(data.get("currency"))
    amount = money(data.get("amount_eur", 0))
    contract_details = (data.get("contract_details") or "").strip()
    if not company_name:
        raise ValueError("Company name is required")

    product = Product.query.filter_by(
        code=software,
        status="ACTIVE",
    ).first()

    if not product:
        raise ValueError("Unknown software product")
    if require_amount and amount <= 0:
        raise ValueError("Total amount must be greater than 0")
    return (
        company_name,
        invoice_number,
        invoice_date,
        completion_date,
        software,
        currency,
        amount,
        contract_details,
    )


@app.route("/add_invoice", methods=["POST"])
@role_required("admin", "manager")
def add_invoice():
    try:
        data = request.form.to_dict()
        company_name, invoice_number, invoice_date, completion_date, software, currency, amount, _ = invoice_payload(data)
        company = get_or_create_company(company_name)
        duplicate = duplicate_invoice(company.id, software, invoice_number)
        if duplicate:
            return jsonify({"status": "error", "code": "duplicate", "message": f"Invoice {invoice_number} already exists for this company and product."}), 409
        new_inv = Invoice(
            company_id=company.id,
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            completion_date=completion_date,
            software=software,
            amount_eur=amount,
            currency=currency,
        )
        db.session.add(new_inv)
        db.session.flush()

        write_audit_log(
            action="INVOICE_CREATED",
            entity_type="invoice",
            entity_id=new_inv.id,
            company_id=company.id,
            software=software,
            description=f"Invoice {invoice_number or new_inv.id} created",
            details={
                "invoice_number": invoice_number,
                "invoice_date": invoice_date.isoformat() if invoice_date else None,
                "completion_date": completion_date.isoformat() if completion_date else None,
                "amount_eur": str(amount),
                "currency": currency,
            },
        )

        db.session.commit()
        return redirect(url_for("index"))
    except (ValueError, TypeError) as exc:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(exc)}), 400
    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Could not save invoice."}), 400


@app.route("/save_generated_invoice", methods=["POST"])
@role_required("admin", "manager")
def save_generated_invoice():
    try:
        company_name, invoice_number, invoice_date, completion_date, software, currency, amount, contract_details = invoice_payload(request.json or {})
        company = get_or_create_company(company_name)
        duplicate = duplicate_invoice(company.id, software, invoice_number)
        if duplicate:
            return jsonify({"status": "error", "code": "duplicate", "message": f"Invoice {invoice_number} already exists for this company and product."}), 409
        new_inv = Invoice(
            company_id=company.id,
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            completion_date=completion_date,
            software=software,
            amount_eur=amount,
            currency=currency,
            contract_details=contract_details,
        )
        db.session.add(new_inv)
        db.session.flush()

        write_audit_log(
            action="INVOICE_CREATED",
            entity_type="invoice",
            entity_id=new_inv.id,
            company_id=company.id,
            software=software,
            description=f"Invoice {invoice_number or new_inv.id} created",
            details={
                "invoice_number": invoice_number,
                "invoice_date": invoice_date.isoformat() if invoice_date else None,
                "completion_date": completion_date.isoformat() if completion_date else None,
                "amount_eur": str(amount),
                "currency": currency,
                "contract_details": contract_details or None,
            },
        )

        db.session.commit()
        return jsonify({"status": "ok", "invoice_id": new_inv.id})
    except (ValueError, TypeError) as exc:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(exc)}), 400


@app.route("/update_generated_invoice/<int:invoice_id>", methods=["POST"])
@role_required("admin", "manager")
def update_generated_invoice(invoice_id):
    inv = Invoice.query.get_or_404(invoice_id)
    if inv.status == "CANCELLED":
        return jsonify({
            "status": "error",
            "code": "cancelled",
            "message": "Cancelled invoices cannot be edited.",
        }), 409

    try:
        company_name, invoice_number, invoice_date, completion_date, software, currency, amount, contract_details = invoice_payload(request.json or {})
        company = get_or_create_company(company_name)

        duplicate = duplicate_invoice(
            company.id,
            software,
            invoice_number,
            exclude_id=inv.id,
        )

        if duplicate:
            return jsonify({
                "status": "error",
                "code": "duplicate",
                "message": f"Invoice {invoice_number} already exists for this company and product.",
            }), 409

        old_company_id = inv.company_id
        old_company = inv.company
        old_company_name = old_company.name if old_company else ""
        old_invoice_number = inv.invoice_number
        old_invoice_date = inv.invoice_date
        old_completion_date = inv.completion_date
        old_software = canonical_software(inv.software)
        old_amount = money(inv.amount_eur)
        old_paid = money(inv.paid_amount_eur)
        old_payment_status = inv.payment_status or "UNPAID"
        old_contract_details = inv.contract_details or ""
        old_currency = canonical_currency(inv.currency)

        # Payment cannot exceed the new invoice total.
        if amount < old_paid:
            return jsonify({
                "status": "error",
                "code": "amount_below_paid",
                "message": (
                    f"Invoice total cannot be less than the already paid "
                    f"amount ({currency_symbol(old_currency)}{old_paid:.2f})."
                ),
            }), 400

        new_paid, new_payment_status = payment_state(amount, old_paid)

        changes = {}

        if old_company_id != company.id:
            changes["company"] = {
                "from": old_company_name,
                "to": company.name,
            }

        if old_invoice_number != invoice_number:
            changes["invoice_number"] = {
                "from": old_invoice_number,
                "to": invoice_number,
            }

        if old_invoice_date != invoice_date:
            changes["invoice_date"] = {
                "from": old_invoice_date.isoformat() if old_invoice_date else None,
                "to": invoice_date.isoformat() if invoice_date else None,
            }

        if old_completion_date != completion_date:
            changes["completion_date"] = {
                "from": old_completion_date.isoformat() if old_completion_date else None,
                "to": completion_date.isoformat() if completion_date else None,
            }

        if old_software != software:
            changes["software"] = {
                "from": old_software,
                "to": software,
            }

        if old_amount != amount:
            changes["amount_eur"] = {
                "from": str(old_amount),
                "to": str(amount),
            }

        if old_currency != currency:
            if old_paid > 0:
                return jsonify({
                    "status": "error",
                    "code": "currency_change_after_payment",
                    "message": (
                        "Invoice currency cannot be changed after "
                        "a payment has been recorded."
                    ),
                }), 400

            changes["currency"] = {
                "from": old_currency,
                "to": currency,
            }

        if old_contract_details != contract_details:
            changes["contract_details"] = {
                "from": old_contract_details or None,
                "to": contract_details or None,
            }

        inv.company_id = company.id
        inv.invoice_number = invoice_number
        inv.invoice_date = invoice_date
        inv.completion_date = completion_date
        inv.software = software
        inv.amount_eur = amount
        inv.currency = currency
        inv.paid_amount_eur = new_paid
        inv.payment_status = new_payment_status
        inv.contract_details = contract_details

        if old_payment_status != new_payment_status:
            changes["payment_status"] = {
                "from": old_payment_status,
                "to": new_payment_status,
            }

        if changes:
            write_audit_log(
                action="INVOICE_UPDATED",
                entity_type="invoice",
                entity_id=inv.id,
                company_id=company.id,
                software=software,
                description=f"Invoice {invoice_number or inv.id} updated",
                details={
                    "changes": changes,
                },
            )

        db.session.commit()

        return jsonify({
            "status": "ok",
            "invoice_id": inv.id,
        })

    except (ValueError, TypeError) as exc:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 400


@app.route("/update_invoice_payment/<int:invoice_id>", methods=["POST"])
@role_required("admin", "manager")
def update_invoice_payment(invoice_id):
    try:
        inv = db.session.get(Invoice, invoice_id)

        if not inv:
            return jsonify({
                "status": "error",
                "message": "Invoice not found",
            }), 404

        if inv.status == "CANCELLED":
            return jsonify({
                "status": "error",
                "message": "Cancelled invoices cannot have their payment status changed.",
            }), 400

        data = request.get_json(silent=True) or {}

        if "paid_amount_eur" not in data:
            return jsonify({
                "status": "error",
                "message": "paid_amount_eur is required",
            }), 400

        old_paid = money(inv.paid_amount_eur)
        old_payment_status = inv.payment_status or "UNPAID"
        invoice_currency = canonical_currency(inv.currency)
        invoice_symbol = currency_symbol(invoice_currency)

        paid, payment_status = payment_state(
            inv.amount_eur,
            data.get("paid_amount_eur"),
        )

        if paid == old_paid and payment_status == old_payment_status:
            return jsonify({
                "status": "ok",
                "message": "Payment information unchanged.",
                "invoice": {
                    "id": inv.id,
                    "payment_status": payment_status,
                    "currency": invoice_currency,
                    "currency_symbol": invoice_symbol,
                    "paid_amount_eur": money_float(paid),
                    "amount_eur": money_float(inv.amount_eur),
                },
            })

        inv.paid_amount_eur = paid
        inv.payment_status = payment_status

        company = inv.company.name if inv.company else "Unknown company"

        write_audit_log(
            action="PAYMENT_STATUS_UPDATED",
            entity_type="invoice",
            entity_id=inv.id,
            company_id=inv.company_id,
            software=inv.software,
            description=f"Payment status for invoice {inv.invoice_number or inv.id} updated",
            details={
                "invoice_number": inv.invoice_number,
                "company": company,
                "currency": invoice_currency,
                "currency_symbol": invoice_symbol,
                "before": {
                    "payment_status": old_payment_status,
                    "paid_amount_eur": str(old_paid),
                },
                "after": {
                    "payment_status": payment_status,
                    "paid_amount_eur": str(paid),
                },
                "invoice_amount_eur": str(money(inv.amount_eur)),
            },
        )

        db.session.commit()

        return jsonify({
            "status": "ok",
            "message": "Payment information updated.",
            "invoice": {
                "id": inv.id,
                "payment_status": inv.payment_status,
                "currency": invoice_currency,
                "currency_symbol": invoice_symbol,
                "paid_amount_eur": money_float(inv.paid_amount_eur),
                "amount_eur": money_float(inv.amount_eur),
            },
        })

    except ValueError as exc:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 400

    except Exception as exc:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 500


@app.route("/update_company_budget", methods=["POST"])
@role_required("admin", "manager")
def update_company_budget():
    try:
        company_id = int(request.form.get("company_id"))
        software = canonical_software(request.form.get("software"))
        currency = canonical_currency(request.form.get("currency"))
        total_amount = money(request.form.get("total_amount", 0))

        product = Product.query.filter_by(
            code=software,
            status="ACTIVE",
        ).first()

        if not product or total_amount < 0:
            raise ValueError("Invalid budget product or amount")

        company = Company.query.get_or_404(company_id)

        budget = CompanyBudget.query.filter_by(
            company_id=company_id,
            software=software,
            currency=currency,
        ).first()

        if not budget:
            old_amount = Decimal("0.00")
            budget = CompanyBudget(
                company_id=company_id,
                software=software,
                total_amount=total_amount,
                currency=currency,
            )
            db.session.add(budget)
        else:
            old_amount = money(budget.total_amount)
            budget.total_amount = total_amount

        if old_amount != total_amount:
            write_audit_log(
                action="BUDGET_UPDATED",
                entity_type="company_budget",
                entity_id=budget.id if budget.id is not None else None,
                company_id=company_id,
                software=software,
                description=f"{software} budget updated for {company.name}",
                details={
                    "company": company.name,
                    "software": software,
                    "currency": currency,
                    "changes": {
                        "total_amount": {
                            "from": str(old_amount),
                            "to": str(total_amount),
                        }
                    },
                },
            )

        db.session.commit()

        return jsonify({
            "status": "ok",
            "total_amount": money_float(total_amount),
            "currency": currency,
        })

    except (ValueError, TypeError) as exc:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 400


@app.route("/update_company_completion_date", methods=["POST"])
@role_required("admin", "manager")
def update_company_completion_date():
    try:
        company_id = int(request.form.get("company_id"))
        software = canonical_software(request.form.get("software"))
        currency = canonical_currency(request.form.get("currency"))
        completion_date_raw = request.form.get("completion_date", "").strip()
        completion_date = date.fromisoformat(completion_date_raw) if completion_date_raw else None

        company = Company.query.get_or_404(company_id)

        budget = CompanyBudget.query.filter_by(
            company_id=company_id,
            software=software,
            currency=currency,
        ).first()

        if not budget:
            old_completion_date = None
            budget = CompanyBudget(
                company_id=company_id,
                software=software,
                total_amount=Decimal("0.00"),
                currency=currency,
                completion_date=completion_date,
            )
            db.session.add(budget)
        else:
            old_completion_date = budget.completion_date
            budget.completion_date = completion_date

        if old_completion_date != completion_date:
            write_audit_log(
                action="CONTRACT_DATE_UPDATED",
                entity_type="company_budget",
                entity_id=budget.id if budget.id is not None else None,
                company_id=company_id,
                software=software,
                description=f"{software} contract completion date updated for {company.name}",
                details={
                    "company": company.name,
                    "software": software,
                    "currency": currency,
                    "changes": {
                        "completion_date": {
                            "from": old_completion_date.isoformat() if old_completion_date else None,
                            "to": completion_date.isoformat() if completion_date else None,
                        }
                    },
                },
            )

        db.session.commit()

        return jsonify({
            "status": "ok",
            "completion_date": completion_date.isoformat() if completion_date else "",
            "currency": currency,
        })

    except (ValueError, TypeError) as exc:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 400


@app.route("/cancel_invoice/<int:invoice_id>", methods=["POST"])
@role_required("admin", "manager")
def cancel_invoice(invoice_id):
    inv = Invoice.query.get_or_404(invoice_id)

    if inv.status == "CANCELLED":
        return jsonify({
            "status": "error",
            "code": "already_cancelled",
            "message": "Invoice is already cancelled.",
        }), 409

    data = request.get_json(silent=True) or request.form.to_dict()
    reason = (data.get("reason") or data.get("cancellation_reason") or "").strip()

    if not reason:
        return jsonify({
            "status": "error",
            "code": "reason_required",
            "message": "Cancellation reason is required.",
        }), 400

    if len(reason) > 2000:
        return jsonify({
            "status": "error",
            "code": "reason_too_long",
            "message": "Cancellation reason must be 2000 characters or less.",
        }), 400

    company_id = inv.company_id
    cancelled_at = datetime.now(timezone.utc)

    try:
        old_status = inv.status
        invoice_number = inv.invoice_number
        software = canonical_software(inv.software)
        amount = money(inv.amount_eur)
        company = inv.company
        company_name = company.name if company else ""

        inv.status = "CANCELLED"
        inv.cancelled_at = cancelled_at
        inv.cancellation_reason = reason

        write_audit_log(
            action="INVOICE_CANCELLED",
            entity_type="invoice",
            entity_id=inv.id,
            company_id=company_id,
            software=software,
            description=f"Invoice {invoice_number or inv.id} cancelled",
            details={
                "invoice_number": invoice_number,
                "company": company_name,
                "amount_eur": str(amount),
                "status": {
                    "from": old_status,
                    "to": "CANCELLED",
                },
                "cancellation_reason": reason,
                "cancelled_at": cancelled_at.isoformat(),
            },
        )

        db.session.commit()

        active_invoices = Invoice.query.filter(
            Invoice.company_id == company_id,
            Invoice.status != "CANCELLED",
        ).all()

        alpha_spent = sum(
            (
                money(i.amount_eur)
                for i in active_invoices
                if canonical_software(i.software) == "ALPHA"
            ),
            Decimal("0.00"),
        )
        beta_spent = sum(
            (
                money(i.amount_eur)
                for i in active_invoices
                if canonical_software(i.software) == "BETA"
            ),
            Decimal("0.00"),
        )

        return jsonify({
            "status": "ok",
            "invoice_id": inv.id,
            "company_id": company_id,
            "invoice_status": inv.status,
            "cancelled_at": inv.cancelled_at.isoformat(),
            "cancellation_reason": inv.cancellation_reason,
            "alpha_spent": money_float(alpha_spent),
            "beta_spent": money_float(beta_spent),
        })

    except Exception:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": "Could not cancel invoice.",
        }), 400



@app.route("/our-company")
def our_company_page():
    our_companies = (
        OurCompany.query
        .order_by(OurCompany.name.asc())
        .all()
    )

    return render_template(
        "our_company.html",
        our_companies=our_companies,
        current_user=get_current_user(),
    )


@app.route("/api/our-company/<int:our_company_id>", methods=["GET"])
@login_required
def get_our_company(our_company_id):
    our_company = OurCompany.query.get_or_404(our_company_id)

    return jsonify({
        "status": "ok",
        "company": {
            "id": our_company.id,
            "name": our_company.name,
            "director_name": our_company.director_name or "",
            "director_position": our_company.director_position or "",
            "phone": our_company.phone or "",
            "email": our_company.email or "",
            "logo_filename": our_company.logo_filename or "",
            "stamp_filename": our_company.stamp_filename or "",
            "signature_filename": our_company.signature_filename or "",
            "ecp_reference": our_company.ecp_reference or "",
            "status": our_company.status,
            "created_at": (
                our_company.created_at.isoformat()
                if our_company.created_at
                else None
            ),
            "updated_at": (
                our_company.updated_at.isoformat()
                if our_company.updated_at
                else None
            ),
            "details": [
                {
                    "id": details.id,
                    "name": details.name,
                    "legal_address": details.legal_address or "",
                    "actual_address": details.actual_address or "",
                    "registration_number": details.registration_number or "",
                    "tax_number": details.tax_number or "",
                    "vat_number": details.vat_number or "",
                    "bank_name": details.bank_name or "",
                    "iban": details.iban or "",
                    "swift": details.swift or "",
                    "additional_details": details.additional_details or "",
                    "created_at": (
                        details.created_at.isoformat()
                        if details.created_at
                        else None
                    ),
                    "updated_at": (
                        details.updated_at.isoformat()
                        if details.updated_at
                        else None
                    ),
                }
                for details in our_company.details
            ],
        },
    })


@app.route("/our-company/<int:our_company_id>")
@login_required
def our_company_detail_page(our_company_id):
    our_company = OurCompany.query.get_or_404(our_company_id)

    return render_template(
        "our_company_detail.html",
        our_company=our_company,
        current_user=get_current_user(),
    )


@app.route("/our-company/create", methods=["POST"])
@role_required("admin")
def create_our_company():
    name = (request.form.get("name") or "").strip()
    director_name = (request.form.get("director_name") or "").strip()
    director_position = (request.form.get("director_position") or "").strip()
    phone = (request.form.get("phone") or "").strip()
    email = (request.form.get("email") or "").strip()
    status = (request.form.get("status") or "ACTIVE").strip().upper()

    if not name:
        return (
            render_template(
                "error.html",
                error_code=400,
                error_title="Invalid company name",
                error_message="Company name is required.",
            ),
            400,
        )

    if len(name) > 255:
        return (
            render_template(
                "error.html",
                error_code=400,
                error_title="Invalid company name",
                error_message="Company name must be 255 characters or fewer.",
            ),
            400,
        )

    if status not in {"ACTIVE", "INACTIVE"}:
        return (
            render_template(
                "error.html",
                error_code=400,
                error_title="Invalid company status",
                error_message="Unknown company status.",
            ),
            400,
        )

    existing = OurCompany.query.filter(
        func.lower(OurCompany.name) == name.lower()
    ).first()

    if existing:
        return (
            render_template(
                "error.html",
                error_code=409,
                error_title="Company already exists",
                error_message="An OurCompany with this name already exists.",
            ),
            409,
        )

    try:
        our_company = OurCompany(
            name=name,
            director_name=director_name or None,
            director_position=director_position or None,
            phone=phone or None,
            email=email or None,
            status=status,
        )

        db.session.add(our_company)
        db.session.commit()

    except Exception:
        db.session.rollback()
        app.logger.exception("Failed to create OurCompany")

        return (
            render_template(
                "error.html",
                error_code=500,
                error_title="Could not create company",
                error_message="The company could not be created.",
            ),
            500,
        )

    return redirect(url_for("our_company_page"))


@app.route("/our-company/<int:our_company_id>/details/create", methods=["POST"])
@role_required("admin")
def create_our_company_details(our_company_id):
    our_company = OurCompany.query.get_or_404(our_company_id)

    name = (request.form.get("name") or "").strip()
    legal_address = (request.form.get("legal_address") or "").strip()
    actual_address = (request.form.get("actual_address") or "").strip()
    registration_number = (request.form.get("registration_number") or "").strip()
    tax_number = (request.form.get("tax_number") or "").strip()
    vat_number = (request.form.get("vat_number") or "").strip()
    bank_name = (request.form.get("bank_name") or "").strip()
    iban = (request.form.get("iban") or "").strip()
    swift = (request.form.get("swift") or "").strip()
    additional_details = (request.form.get("additional_details") or "").strip()

    if not name:
        return "Название набора реквизитов обязательно.", 400

    if len(name) > 255:
        return "Название набора реквизитов слишком длинное.", 400

    try:
        details = OurCompanyDetails(
            our_company_id=our_company.id,
            name=name,
            legal_address=legal_address or None,
            actual_address=actual_address or None,
            registration_number=registration_number or None,
            tax_number=tax_number or None,
            vat_number=vat_number or None,
            bank_name=bank_name or None,
            iban=iban or None,
            swift=swift or None,
            additional_details=additional_details or None,
        )

        db.session.add(details)
        db.session.commit()

    except Exception:
        db.session.rollback()
        app.logger.exception(
            "Failed to create OurCompanyDetails for OurCompany %s",
            our_company_id,
        )
        return "Не удалось создать набор реквизитов.", 500

    return redirect(
        url_for(
            "our_company_detail_page",
            our_company_id=our_company.id,
        )
    )


@app.route("/our-company/<int:our_company_id>/edit", methods=["POST"])
@role_required("admin")
def edit_our_company(our_company_id):
    our_company = OurCompany.query.get_or_404(our_company_id)

    name = (request.form.get("name") or "").strip()
    director_name = (request.form.get("director_name") or "").strip()
    director_position = (request.form.get("director_position") or "").strip()
    phone = (request.form.get("phone") or "").strip()
    email = (request.form.get("email") or "").strip()
    status = (request.form.get("status") or "ACTIVE").strip().upper()

    if not name:
        return (
            render_template(
                "error.html",
                error_code=400,
                error_title="Invalid company name",
                error_message="Company name is required.",
            ),
            400,
        )

    if len(name) > 255:
        return (
            render_template(
                "error.html",
                error_code=400,
                error_title="Invalid company name",
                error_message="Company name must be 255 characters or fewer.",
            ),
            400,
        )

    if status not in {"ACTIVE", "INACTIVE"}:
        return (
            render_template(
                "error.html",
                error_code=400,
                error_title="Invalid company status",
                error_message="Unknown company status.",
            ),
            400,
        )

    existing = OurCompany.query.filter(
        func.lower(OurCompany.name) == name.lower(),
        OurCompany.id != our_company.id,
    ).first()

    if existing:
        return (
            render_template(
                "error.html",
                error_code=409,
                error_title="Company already exists",
                error_message="An OurCompany with this name already exists.",
            ),
            409,
        )

    try:
        our_company.name = name
        our_company.director_name = director_name or None
        our_company.director_position = director_position or None
        our_company.phone = phone or None
        our_company.email = email or None
        our_company.status = status

        db.session.commit()

    except Exception:
        db.session.rollback()
        app.logger.exception(
            "Failed to update OurCompany %s",
            our_company_id,
        )

        return (
            render_template(
                "error.html",
                error_code=500,
                error_title="Could not update company",
                error_message="The company could not be updated.",
            ),
            500,
        )

    return redirect(
        url_for(
            "our_company_detail_page",
            our_company_id=our_company.id,
        )
    )


@app.route(
    "/our-company/<int:our_company_id>/assets/<asset_type>",
    methods=["POST"],
)
@role_required("admin")
def upload_our_company_asset(our_company_id, asset_type):
    our_company = OurCompany.query.get_or_404(our_company_id)

    if asset_type not in OUR_COMPANY_ASSET_DIRS:
        return jsonify({
            "status": "error",
            "message": "Неизвестный тип файла.",
        }), 400

    uploaded_file = request.files.get("file")

    if not uploaded_file or not uploaded_file.filename:
        return jsonify({
            "status": "error",
            "message": "Файл не выбран.",
        }), 400

    original_name = uploaded_file.filename.strip()
    extension = (
        original_name.rsplit(".", 1)[-1].lower()
        if "." in original_name
        else ""
    )

    if extension not in ALLOWED_OUR_COMPANY_ASSET_EXTENSIONS:
        return jsonify({
            "status": "error",
            "message": "Допустимые форматы: PNG, JPG, JPEG, WebP.",
        }), 400

    uploaded_file.stream.seek(0, os.SEEK_END)
    file_size = uploaded_file.stream.tell()
    uploaded_file.stream.seek(0)

    if file_size > MAX_OUR_COMPANY_ASSET_FILE_SIZE:
        return jsonify({
            "status": "error",
            "message": "Размер файла не должен превышать 5 МБ.",
        }), 400

    asset_directory = OUR_COMPANY_ASSET_DIRS[asset_type]
    os.makedirs(asset_directory, exist_ok=True)

    field_map = {
        "logo": "logo_filename",
        "stamp": "stamp_filename",
        "signature": "signature_filename",
    }
    model_field = field_map[asset_type]

    old_filename = getattr(our_company, model_field) or ""
    filename = (
        f"our-company-{our_company.id}-{asset_type}-"
        f"{secrets.token_hex(12)}.png"
    )
    destination = os.path.join(asset_directory, filename)

    try:
        if asset_type == "stamp":
            processed_image = process_company_stamp(uploaded_file)
        else:
            processed_image = process_our_company_image(uploaded_file)

        processed_image.save(
            destination,
            format="PNG",
            optimize=True,
        )

        setattr(our_company, model_field, filename)

        write_audit_log(
            action="OUR_COMPANY_ASSET_UPDATED",
            entity_type="our_company",
            entity_id=our_company.id,
            description=f"OurCompany {asset_type} asset updated for {our_company.name}",
            details={
                "asset_type": asset_type,
                "old_filename": old_filename,
                "new_filename": filename,
                "original_filename": original_name,
                "original_extension": extension,
                "processed_format": "PNG",
            },
        )

        db.session.commit()

    except ValueError as exc:
        db.session.rollback()

        if os.path.exists(destination):
            os.remove(destination)

        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 400

    except Exception:
        db.session.rollback()

        if os.path.exists(destination):
            os.remove(destination)

        app.logger.exception(
            "Failed to upload OurCompany %s asset for %s",
            asset_type,
            our_company.id,
        )

        return jsonify({
            "status": "error",
            "message": "Не удалось сохранить файл.",
        }), 500

    if old_filename:
        old_path = os.path.join(asset_directory, old_filename)

        if old_path != destination and os.path.isfile(old_path):
            try:
                os.remove(old_path)
            except OSError:
                app.logger.warning(
                    "Could not remove old OurCompany asset: %s",
                    old_path,
                )

    return jsonify({
        "status": "ok",
        "asset_type": asset_type,
        "filename": filename,
        "url": url_for(
            "static",
            filename=f"uploads/our-company/{asset_type}s/{filename}",
        ),
    })


@app.route("/users")
@role_required("admin")
def users_page():
    users = User.query.order_by(User.username.asc()).all()

    return render_template(
        "users.html",
        users=users,
        current_user=get_current_user(),
        valid_roles=sorted(VALID_ROLES),
    )


@app.route("/users/create", methods=["POST"])
@role_required("admin")
def create_user():
    username = (request.form.get("username") or "").strip()
    password = request.form.get("password") or ""
    role = (request.form.get("role") or "viewer").strip().lower()

    if not username:
        return (
            render_template(
                "error.html",
                error_code=400,
                error_title="Invalid username",
                error_message="Username is required.",
            ),
            400,
        )

    if len(username) > 64:
        return (
            render_template(
                "error.html",
                error_code=400,
                error_title="Invalid username",
                error_message="Username must be 64 characters or fewer.",
            ),
            400,
        )

    if not password or len(password) < 8:
        return (
            render_template(
                "error.html",
                error_code=400,
                error_title="Invalid password",
                error_message="Password must contain at least 8 characters.",
            ),
            400,
        )

    if role not in VALID_ROLES:
        return (
            render_template(
                "error.html",
                error_code=400,
                error_title="Invalid role",
                error_message="Unknown user role.",
            ),
            400,
        )

    existing = User.query.filter(
        func.lower(User.username) == username.lower()
    ).first()

    if existing:
        return (
            render_template(
                "error.html",
                error_code=409,
                error_title="User already exists",
                error_message="A user with this username already exists.",
            ),
            409,
        )

    try:
        user = User(
            username=username,
            password_hash=generate_password_hash(password),
            role=role,
            is_active=True,
        )

        db.session.add(user)
        db.session.flush()

        write_audit_log(
            action="USER_CREATED",
            entity_type="user",
            entity_id=user.id,
            description=f"User {user.username} created",
            details={
                "username": user.username,
                "role": user.role,
                "is_active": user.is_active,
            },
        )

        db.session.commit()

        return redirect(url_for("users_page"))

    except IntegrityError:
        db.session.rollback()

        return (
            render_template(
                "error.html",
                error_code=409,
                error_title="User already exists",
                error_message="A user with this username already exists.",
            ),
            409,
        )


@app.route("/users/<int:user_id>/update", methods=["POST"])
@role_required("admin")
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    current_user = get_current_user()

    new_role = (request.form.get("role") or "").strip().lower()
    active_raw = request.form.get("is_active")

    if new_role not in VALID_ROLES:
        return (
            render_template(
                "error.html",
                error_code=400,
                error_title="Invalid role",
                error_message="Unknown user role.",
            ),
            400,
        )

    new_active = active_raw == "1"

    if user.id == current_user.id and not new_active:
        return (
            render_template(
                "error.html",
                error_code=400,
                error_title="Action not allowed",
                error_message="You cannot deactivate your own account.",
            ),
            400,
        )

    if user.id == current_user.id and new_role != "admin":
        return (
            render_template(
                "error.html",
                error_code=400,
                error_title="Action not allowed",
                error_message="You cannot remove the administrator role from your own account.",
            ),
            400,
        )

    active_admins = User.query.filter_by(
        role="admin",
        is_active=True,
    ).all()

    would_remove_admin = (
        user.role == "admin"
        and user.is_active
        and (new_role != "admin" or not new_active)
    )

    if would_remove_admin and len(active_admins) <= 1:
        return (
            render_template(
                "error.html",
                error_code=400,
                error_title="Action not allowed",
                error_message="At least one active administrator must remain.",
            ),
            400,
        )

    changes = {}

    if user.role != new_role:
        changes["role"] = {
            "from": user.role,
            "to": new_role,
        }

    if user.is_active != new_active:
        changes["is_active"] = {
            "from": user.is_active,
            "to": new_active,
        }

    if not changes:
        return redirect(url_for("users_page"))

    old_role = user.role
    old_active = user.is_active

    user.role = new_role
    user.is_active = new_active

    write_audit_log(
        action="USER_UPDATED",
        entity_type="user",
        entity_id=user.id,
        description=f"User {user.username} updated",
        details={
            "username": user.username,
            "changes": changes,
            "before": {
                "role": old_role,
                "is_active": old_active,
            },
            "after": {
                "role": user.role,
                "is_active": user.is_active,
            },
        },
    )

    db.session.commit()

    return redirect(url_for("users_page"))


@app.route("/users/<int:user_id>/password", methods=["POST"])
@role_required("admin")
def change_user_password(user_id):
    user = User.query.get_or_404(user_id)

    password = request.form.get("password") or ""

    if len(password) < 8:
        return (
            render_template(
                "error.html",
                error_code=400,
                error_title="Invalid password",
                error_message="Password must contain at least 8 characters.",
            ),
            400,
        )

    user.password_hash = generate_password_hash(password)

    write_audit_log(
        action="USER_PASSWORD_CHANGED",
        entity_type="user",
        entity_id=user.id,
        description=f"Password changed for user {user.username}",
        details={
            "username": user.username,
        },
    )

    db.session.commit()

    return redirect(url_for("users_page"))


@app.route("/audit-log")
@login_required
def audit_log_page():
    return render_template("audit-log.html", current_user=get_current_user())


@app.route("/api/audit-log")
@login_required
def api_audit_log():
    try:
        page = max(int(request.args.get("page", 1)), 1)
        per_page = int(request.args.get("per_page", 50))
        per_page = min(max(per_page, 10), 100)

        query = AuditLog.query

        search = (request.args.get("search") or "").strip()
        action = (request.args.get("action") or "").strip().upper()
        company_id_raw = (request.args.get("company_id") or "").strip()
        user_id_raw = (request.args.get("user_id") or "").strip()
        software = canonical_software(request.args.get("software")) if request.args.get("software") else ""
        date_from_raw = (request.args.get("date_from") or "").strip()
        date_to_raw = (request.args.get("date_to") or "").strip()

        if search:
            pattern = f"%{search}%"
            query = query.filter(
                db.or_(
                    AuditLog.description.ilike(pattern),
                    AuditLog.entity_id.ilike(pattern),
                    AuditLog.details.ilike(pattern),
                )
            )

        if action:
            query = query.filter(AuditLog.action == action)

        if company_id_raw:
            try:
                company_id = int(company_id_raw)
            except ValueError:
                return jsonify({
                    "status": "error",
                    "message": "Invalid company_id",
                }), 400

            query = query.filter(AuditLog.company_id == company_id)

        if user_id_raw:
            try:
                user_id = int(user_id_raw)
            except ValueError:
                return jsonify({
                    "status": "error",
                    "message": "Invalid user_id",
                }), 400

            query = query.filter(AuditLog.user_id == user_id)

        if software:
            if software not in ("ALPHA", "BETA"):
                return jsonify({
                    "status": "error",
                    "message": "Invalid software product",
                }), 400

            query = query.filter(AuditLog.software == software)

        if date_from_raw:
            try:
                date_from = date.fromisoformat(date_from_raw)
            except ValueError:
                return jsonify({
                    "status": "error",
                    "message": "Invalid date_from. Expected YYYY-MM-DD.",
                }), 400

            query = query.filter(
                AuditLog.created_at >= datetime.combine(
                    date_from,
                    datetime.min.time(),
                    tzinfo=timezone.utc,
                )
            )

        if date_to_raw:
            try:
                date_to = date.fromisoformat(date_to_raw)
            except ValueError:
                return jsonify({
                    "status": "error",
                    "message": "Invalid date_to. Expected YYYY-MM-DD.",
                }), 400

            # Inclusive end date: include the complete selected day.
            date_to_exclusive = date_to + timedelta(days=1)

            query = query.filter(
                AuditLog.created_at < datetime.combine(
                    date_to_exclusive,
                    datetime.min.time(),
                    tzinfo=timezone.utc,
                )
            )

        query = query.order_by(
            AuditLog.created_at.desc(),
            AuditLog.id.desc(),
        )

        total = query.count()
        pages = max((total + per_page - 1) // per_page, 1)

        if page > pages and total:
            page = pages

        rows = query.offset((page - 1) * per_page).limit(per_page).all()

        companies = Company.query.order_by(Company.name.asc()).all()
        users = User.query.filter_by(is_active=True).order_by(User.username.asc()).all()

        items = []

        for row in rows:
            details = None

            if row.details:
                try:
                    details = json.loads(row.details)
                except (TypeError, ValueError):
                    details = row.details

            items.append({
                "id": row.id,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "action": row.action,
                "entity_type": row.entity_type,
                "entity_id": row.entity_id,
                "company_id": row.company_id,
                "user_id": row.user_id,
                "username": (
                    row.user.username
                    if getattr(row, "user", None)
                    else None
                ),
                "software": row.software,
                "description": row.description,
                "details": details,
            })

        return jsonify({
            "status": "ok",
            "items": items,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": pages if total else 0,
            },
            "filters": {
                "search": search,
                "action": action,
                "company_id": company_id_raw,
                "user_id": user_id_raw,
                "software": software,
                "date_from": date_from_raw,
                "date_to": date_to_raw,
            },
            "companies": [
                {
                    "id": company.id,
                    "name": company.name,
                }
                for company in companies
            ],
            "users": [
                {
                    "id": user.id,
                    "username": user.username,
                }
                for user in users
            ],
        })

    except (ValueError, TypeError) as exc:
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 400

@app.route("/notifications")
@login_required
def notifications():
    return render_template(
        "notifications.html",
        current_user=get_current_user(),
    )

@app.route("/api/notifications", methods=["GET"])
@login_required
def api_notifications():
    try:
        notifications = (
            Notification.query
            .order_by(
                Notification.is_read.asc(),
                Notification.created_at.desc(),
            )
            .limit(50)
            .all()
        )

        unread_count = (
            Notification.query
            .filter_by(is_read=False)
            .count()
        )

        return jsonify({
            "status": "ok",
            "notifications": [
                notification_payload(item)
                for item in notifications
            ],
            "unread_count": unread_count,
        })

    except Exception as exc:
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 500
@app.route("/api/notifications/<int:notification_id>/read", methods=["POST"])
@login_required
def api_notification_read(notification_id):
    try:
        notification = db.session.get(
            Notification,
            notification_id,
        )

        if not notification:
            return jsonify({
                "status": "error",
                "message": "Notification not found",
            }), 404

        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.now(timezone.utc)
            db.session.commit()

        unread_count = (
            Notification.query
            .filter_by(is_read=False)
            .count()
        )

        return jsonify({
            "status": "ok",
            "notification": notification_payload(notification),
            "unread_count": unread_count,
        })

    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 500
@app.route("/api/notifications/<int:notification_id>", methods=["DELETE"])
@login_required
def api_notification_delete(notification_id):
    try:
        notification = db.session.get(
            Notification,
            notification_id,
        )

        if not notification:
            return jsonify({
                "status": "error",
                "message": "Notification not found",
            }), 404

        db.session.delete(notification)
        db.session.commit()

        unread_count = (
            Notification.query
            .filter_by(is_read=False)
            .count()
        )

        return jsonify({
            "status": "ok",
            "deleted_id": notification_id,
            "unread_count": unread_count,
        })

    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 500


@app.route("/api/notifications/read-all", methods=["POST"])
@login_required
def api_notifications_read_all():
    try:
        now = datetime.now(timezone.utc)

        updated = (
            Notification.query
            .filter_by(is_read=False)
            .update(
                {
                    Notification.is_read: True,
                    Notification.read_at: now,
                },
                synchronize_session=False,
            )
        )

        db.session.commit()

        return jsonify({
            "status": "ok",
            "updated": updated,
            "unread_count": 0,
        })

    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 500
@app.route("/health")
def health():
    return jsonify({"status": "ok", "database": "postgresql" if DATABASE_URL.startswith("postgresql") else "sqlite"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
