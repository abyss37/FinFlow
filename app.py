import json
import os
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation

from flask import Flask, jsonify, redirect, render_template, request, url_for, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Numeric, func
from sqlalchemy.exc import IntegrityError

app = Flask(__name__)

# SQLite remains the default for the current single-user deployment.
# For PostgreSQL set DATABASE_URL, e.g.:
# postgresql+psycopg://finflow:password@localhost:5432/finflow
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////opt/accounting-app/accounting.db")
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


def money(value, default="0.00"):
    try:
        amount = Decimal(str(value if value not in (None, "") else default))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError("Invalid monetary value")
    return amount.quantize(Decimal("0.01"))


def money_float(value):
    return float(value or 0)


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


class Company(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False)
    invoices = db.relationship("Invoice", backref="company", lazy=True, cascade="all, delete-orphan")
    budgets = db.relationship("CompanyBudget", backref="company", lazy=True, cascade="all, delete-orphan")


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
    completion_date = db.Column(db.Date, nullable=True)


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
    contract_details = db.Column(db.Text, nullable=True)
    status = db.Column(
        db.String(20),
        nullable=False,
        default="ISSUED",
        server_default="ISSUED",
    )
    cancelled_at = db.Column(db.DateTime(timezone=True), nullable=True)
    cancellation_reason = db.Column(db.Text, nullable=True)


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
        budgets = {
            b.software: b for b in company.budgets if canonical_software(b.software) in ("ALPHA", "BETA")
        }
        alpha_budget = budgets.get("ALPHA")
        beta_budget = budgets.get("BETA")
        active_invoices = [inv for inv in company.invoices if inv.status != "CANCELLED"]
        alpha_spent = sum((money(inv.amount_eur) for inv in active_invoices if canonical_software(inv.software) == "ALPHA"), Decimal("0.00"))
        beta_spent = sum((money(inv.amount_eur) for inv in active_invoices if canonical_software(inv.software) == "BETA"), Decimal("0.00"))
        has_alpha = any(canonical_software(inv.software) == "ALPHA" for inv in active_invoices) or bool(alpha_budget and money(alpha_budget.total_amount) > 0)
        has_beta = any(canonical_software(inv.software) == "BETA" for inv in active_invoices) or bool(beta_budget and money(beta_budget.total_amount) > 0)
        if not has_alpha and not has_beta:
            has_alpha = True
        default_sw = "ALPHA" if has_alpha else "BETA"
        cards.append({
            "id": company.id,
            "name": company.name,
            "has_alpha": has_alpha,
            "has_beta": has_beta,
            "default_sw": default_sw,
            "alpha_budget": money_float(alpha_budget.total_amount) if alpha_budget else 0,
            "alpha_spent": money_float(alpha_spent),
            "alpha_date": alpha_budget.completion_date.isoformat() if alpha_budget and alpha_budget.completion_date else "",
            "beta_budget": money_float(beta_budget.total_amount) if beta_budget else 0,
            "beta_spent": money_float(beta_spent),
            "beta_date": beta_budget.completion_date.isoformat() if beta_budget and beta_budget.completion_date else "",
        })
    return cards




def dashboard_metrics(company_cards, invoices):
    total_budget = sum((Decimal(str(c["alpha_budget"])) + Decimal(str(c["beta_budget"])) for c in company_cards), Decimal("0.00"))
    total_spent = sum((money(inv.amount_eur) for inv in invoices if inv.status != "CANCELLED"), Decimal("0.00"))
    remaining = total_budget - total_spent
    utilization = (total_spent / total_budget * 100) if total_budget > 0 else Decimal("0")
    return {
        "total_budget": money_float(total_budget),
        "total_spent": money_float(total_spent),
        "remaining": money_float(remaining),
        "utilization": round(float(utilization), 1),
    }



def build_alerts(company_cards):
    """
    Build dashboard financial alerts from existing company-card data.

    Budget thresholds:
      < 80%    -> healthy
      80-89.9% -> warning
      90-99.9% -> critical
      >= 100%  -> exceeded

    Also keeps contract-end alerts for contracts ending within 30 days.
    """

    alerts = []
    today = date.today()

    for card in company_cards:
        company_name = card["name"]

        for software in ("ALPHA", "BETA"):
            budget = Decimal(str(card[f"{software.lower()}_budget"] or 0))
            spent = Decimal(str(card[f"{software.lower()}_spent"] or 0))

            if budget <= 0:
                continue

            pct = (spent / budget) * Decimal("100")
            remaining = budget - spent

            if pct >= Decimal("100"):
                alerts.append({
                    "level": "critical",
                    "icon": "bi-exclamation-octagon",
                    "title": f"{company_name} · {software}",
                    "text": f"Budget exceeded by €{abs(remaining):,.2f}",
                })
            elif pct >= Decimal("90"):
                alerts.append({
                    "level": "critical",
                    "icon": "bi-exclamation-octagon",
                    "title": f"{company_name} · {software}",
                    "text": f"{pct:.1f}% of the budget has been invoiced. €{remaining:,.2f} remains.",
                })
            elif pct >= Decimal("80"):
                alerts.append({
                    "level": "warning",
                    "icon": "bi-exclamation-triangle",
                    "title": f"{company_name} · {software}",
                    "text": f"{pct:.1f}% of the budget has been invoiced. €{remaining:,.2f} remains.",
                })

            completion = card[f"{software.lower()}_date"]

            if completion:
                days = (completion - today).days

                if 0 <= days <= 30:
                    alerts.append({
                        "level": "warning",
                        "icon": "bi-calendar-event",
                        "title": f"{company_name} · {software}",
                        "text": f"Contract ends in {days} day{'s' if days != 1 else ''}",
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


@app.route("/finflow-preview.png")
def finflow_preview():
    return send_from_directory(
        app.static_folder,
        "finflow-preview.png",
        mimetype="image/png",
    )


@app.route("/")
def index():
    companies = Company.query.order_by(Company.name).all()
    invoices = Invoice.query.order_by(Invoice.id.desc()).all()
    company_cards = build_company_cards(companies)
    metrics = dashboard_metrics(company_cards, invoices)
    alerts = build_alerts(company_cards)
    return render_template(
        "index.html",
        companies=companies,
        invoices=invoices,
        company_cards=company_cards,
        metrics=metrics,
        alerts=alerts,
        database_backend="PostgreSQL" if DATABASE_URL.startswith("postgresql") else "SQLite",
    )


@app.route("/generator")
def generator():
    companies = Company.query.order_by(Company.name).all()
    invoices = Invoice.query.order_by(Invoice.id.desc()).all()
    initial_invoice_id = request.args.get("invoice_id", type=int)
    invoices_list = [
        {
            "id": inv.id,
            "company_name": inv.company.name if inv.company else "",
            "invoice_number": inv.invoice_number or "—",
            "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else "",
            "completion_date": inv.completion_date.isoformat() if inv.completion_date else "",
            "software": canonical_software(inv.software),
            "amount_eur": money_float(inv.amount_eur),
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
    )


def get_or_create_company(name):
    company = Company.query.filter(func.lower(Company.name) == name.lower()).first()
    if not company:
        company = Company(name=name)
        db.session.add(company)
        db.session.flush()
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
    amount = money(data.get("amount_eur", 0))
    contract_details = (data.get("contract_details") or "").strip()
    if not company_name:
        raise ValueError("Company name is required")
    if software not in ("ALPHA", "BETA"):
        raise ValueError("Unknown software product")
    if require_amount and amount <= 0:
        raise ValueError("Total amount must be greater than 0")
    return company_name, invoice_number, invoice_date, completion_date, software, amount, contract_details


@app.route("/add_invoice", methods=["POST"])
def add_invoice():
    try:
        data = request.form.to_dict()
        company_name, invoice_number, invoice_date, completion_date, software, amount, _ = invoice_payload(data)
        company = get_or_create_company(company_name)
        duplicate = duplicate_invoice(company.id, software, invoice_number)
        if duplicate:
            return jsonify({"status": "error", "code": "duplicate", "message": f"Invoice {invoice_number} already exists for this company and product."}), 409
        new_inv = Invoice(company_id=company.id, invoice_number=invoice_number, invoice_date=invoice_date, completion_date=completion_date, software=software, amount_eur=amount)
        db.session.add(new_inv)
        db.session.commit()
        return redirect(url_for("index"))
    except (ValueError, TypeError) as exc:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(exc)}), 400
    except IntegrityError:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Could not save invoice."}), 400


@app.route("/save_generated_invoice", methods=["POST"])
def save_generated_invoice():
    try:
        company_name, invoice_number, invoice_date, completion_date, software, amount, contract_details = invoice_payload(request.json or {})
        company = get_or_create_company(company_name)
        duplicate = duplicate_invoice(company.id, software, invoice_number)
        if duplicate:
            return jsonify({"status": "error", "code": "duplicate", "message": f"Invoice {invoice_number} already exists for this company and product."}), 409
        new_inv = Invoice(company_id=company.id, invoice_number=invoice_number, invoice_date=invoice_date, completion_date=completion_date, software=software, amount_eur=amount, contract_details=contract_details)
        db.session.add(new_inv)
        db.session.commit()
        return jsonify({"status": "ok", "invoice_id": new_inv.id})
    except (ValueError, TypeError) as exc:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(exc)}), 400


@app.route("/update_generated_invoice/<int:invoice_id>", methods=["POST"])
def update_generated_invoice(invoice_id):
    inv = Invoice.query.get_or_404(invoice_id)
    if inv.status == "CANCELLED":
        return jsonify({
            "status": "error",
            "code": "cancelled",
            "message": "Cancelled invoices cannot be edited.",
        }), 409
    try:
        company_name, invoice_number, invoice_date, completion_date, software, amount, contract_details = invoice_payload(request.json or {})
        company = get_or_create_company(company_name)
        duplicate = duplicate_invoice(company.id, software, invoice_number, exclude_id=inv.id)
        if duplicate:
            return jsonify({"status": "error", "code": "duplicate", "message": f"Invoice {invoice_number} already exists for this company and product."}), 409
        inv.company_id = company.id
        inv.invoice_number = invoice_number
        inv.invoice_date = invoice_date
        inv.completion_date = completion_date
        inv.software = software
        inv.amount_eur = amount
        inv.contract_details = contract_details
        db.session.commit()
        return jsonify({"status": "ok", "invoice_id": inv.id})
    except (ValueError, TypeError) as exc:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(exc)}), 400


@app.route("/update_company_budget", methods=["POST"])
def update_company_budget():
    try:
        company_id = int(request.form.get("company_id"))
        software = canonical_software(request.form.get("software"))
        total_amount = money(request.form.get("total_amount", 0))
        if software not in ("ALPHA", "BETA") or total_amount < 0:
            raise ValueError("Invalid budget")
        budget = CompanyBudget.query.filter_by(company_id=company_id, software=software).first()
        if not budget:
            budget = CompanyBudget(company_id=company_id, software=software, total_amount=total_amount)
            db.session.add(budget)
        else:
            budget.total_amount = total_amount
        db.session.commit()
        return jsonify({"status": "ok", "total_amount": money_float(total_amount)})
    except (ValueError, TypeError) as exc:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(exc)}), 400


@app.route("/update_company_completion_date", methods=["POST"])
def update_company_completion_date():
    try:
        company_id = int(request.form.get("company_id"))
        software = canonical_software(request.form.get("software"))
        completion_date_raw = request.form.get("completion_date", "").strip()
        completion_date = date.fromisoformat(completion_date_raw) if completion_date_raw else None
        budget = CompanyBudget.query.filter_by(company_id=company_id, software=software).first()
        if not budget:
            budget = CompanyBudget(company_id=company_id, software=software, total_amount=Decimal("0.00"), completion_date=completion_date)
            db.session.add(budget)
        else:
            budget.completion_date = completion_date
        db.session.commit()
        return jsonify({
            "status": "ok",
            "completion_date": completion_date.isoformat() if completion_date else ""
        })
    except (ValueError, TypeError) as exc:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(exc)}), 400


@app.route("/cancel_invoice/<int:invoice_id>", methods=["POST"])
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

    try:
        inv.status = "CANCELLED"
        inv.cancelled_at = datetime.now(timezone.utc)
        inv.cancellation_reason = reason
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


@app.route("/health")
def health():
    return jsonify({"status": "ok", "database": "postgresql" if DATABASE_URL.startswith("postgresql") else "sqlite"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
