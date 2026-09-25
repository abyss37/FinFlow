#!/usr/bin/env bash
set -u

cd /opt/accounting-app

APP="app.py"
BACKUP="app.py.before_currency_backend_$(date +%Y%m%d_%H%M%S)"

echo "============================================================"
echo " FinFlow - Currency backend patch"
echo "============================================================"
echo

if [[ ! -f "$APP" ]]; then
    echo "ERROR: $APP not found"
    exit 1
fi

echo "=== Creating backup ==="
cp -p "$APP" "$BACKUP"

if [[ ! -f "$BACKUP" ]]; then
    echo "ERROR: backup was not created"
    exit 1
fi

echo "Backup created:"
echo "  $BACKUP"
echo

python3 - <<'PY'
from pathlib import Path
import sys

path = Path("app.py")
text = path.read_text(encoding="utf-8")
original = text


def replace_once(old, new, label):
    global text

    count = text.count(old)

    if count != 1:
        print()
        print(f"ERROR: [{label}]")
        print(f"Expected exactly 1 occurrence, found: {count}")
        print()
        print("No changes will be written to app.py.")
        sys.exit(2)

    text = text.replace(old, new, 1)
    print(f"OK: {label}")


# ============================================================
# 1. Currency helpers
# ============================================================

replace_once(
'''def money(value, default="0.00"):
''',
'''SUPPORTED_CURRENCIES = {
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
''',
"currency helpers",
)


# ============================================================
# 2. CompanyBudget model
# ============================================================

replace_once(
'''    total_amount = db.Column(Numeric(14, 2), default=Decimal("0.00"))
    completion_date = db.Column(db.Date, nullable=True)
''',
'''    total_amount = db.Column(Numeric(14, 2), default=Decimal("0.00"))
    currency = db.Column(db.String(3), nullable=False, default="EUR")
    completion_date = db.Column(db.Date, nullable=True)
''',
"CompanyBudget.currency",
)


# ============================================================
# 3. Invoice model
# ============================================================

replace_once(
'''    software = db.Column(db.String(50), nullable=False)
    amount_eur = db.Column(Numeric(14, 2), nullable=False)
    contract_details = db.Column(db.Text, nullable=True)
''',
'''    software = db.Column(db.String(50), nullable=False)
    amount_eur = db.Column(Numeric(14, 2), nullable=False)
    currency = db.Column(db.String(3), nullable=False, default="EUR")
    contract_details = db.Column(db.Text, nullable=True)
''',
"Invoice.currency",
)


# ============================================================
# 4. invoice_payload()
# ============================================================

replace_once(
'''    software = canonical_software(data.get("software"))
    amount = money(data.get("amount_eur", 0))
    contract_details = (data.get("contract_details") or "").strip()
''',
'''    software = canonical_software(data.get("software"))
    currency = canonical_currency(data.get("currency"))
    amount = money(data.get("amount_eur", 0))
    contract_details = (data.get("contract_details") or "").strip()
''',
"invoice_payload currency parsing",
)


replace_once(
'''    return company_name, invoice_number, invoice_date, completion_date, software, amount, contract_details
''',
'''    return (
        company_name,
        invoice_number,
        invoice_date,
        completion_date,
        software,
        currency,
        amount,
        contract_details,
    )
''',
"invoice_payload return",
)


# ============================================================
# 5. add_invoice()
# ============================================================

replace_once(
'''        company_name, invoice_number, invoice_date, completion_date, software, amount, _ = invoice_payload(data)
''',
'''        company_name, invoice_number, invoice_date, completion_date, software, currency, amount, _ = invoice_payload(data)
''',
"add_invoice payload",
)


replace_once(
'''        new_inv = Invoice(company_id=company.id, invoice_number=invoice_number, invoice_date=invoice_date, completion_date=completion_date, software=software, amount_eur=amount)
''',
'''        new_inv = Invoice(
            company_id=company.id,
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            completion_date=completion_date,
            software=software,
            amount_eur=amount,
            currency=currency,
        )
''',
"add_invoice model",
)


replace_once(
'''                "amount_eur": str(amount),
            },
        )

        db.session.commit()
        return redirect(url_for("index"))
''',
'''                "amount_eur": str(amount),
                "currency": currency,
            },
        )

        db.session.commit()
        return redirect(url_for("index"))
''',
"add_invoice audit currency",
)


# ============================================================
# 6. save_generated_invoice()
# ============================================================

replace_once(
'''@app.route("/save_generated_invoice", methods=["POST"])
@role_required("admin", "manager")
def save_generated_invoice():
    try:
        company_name, invoice_number, invoice_date, completion_date, software, amount, contract_details = invoice_payload(request.json or {})
''',
'''@app.route("/save_generated_invoice", methods=["POST"])
@role_required("admin", "manager")
def save_generated_invoice():
    try:
        company_name, invoice_number, invoice_date, completion_date, software, currency, amount, contract_details = invoice_payload(request.json or {})
''',
"save_generated_invoice payload",
)


replace_once(
'''        new_inv = Invoice(company_id=company.id, invoice_number=invoice_number, invoice_date=invoice_date, completion_date=completion_date, software=software, amount_eur=amount, contract_details=contract_details)
''',
'''        new_inv = Invoice(
            company_id=company.id,
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            completion_date=completion_date,
            software=software,
            amount_eur=amount,
            currency=currency,
            contract_details=contract_details,
        )
''',
"save_generated_invoice model",
)


replace_once(
'''                "amount_eur": str(amount),
                "contract_details": contract_details or None,
''',
'''                "amount_eur": str(amount),
                "currency": currency,
                "contract_details": contract_details or None,
''',
"save_generated_invoice audit currency",
)


# ============================================================
# 7. update_generated_invoice()
# ============================================================

replace_once(
'''@app.route("/update_generated_invoice/<int:invoice_id>", methods=["POST"])
@role_required("admin", "manager")
def update_generated_invoice(invoice_id):
''',
'''@app.route("/update_generated_invoice/<int:invoice_id>", methods=["POST"])
@role_required("admin", "manager")
def update_generated_invoice(invoice_id):
''',
"update_generated_invoice route verification",
)


replace_once(
'''def update_generated_invoice(invoice_id):
    inv = Invoice.query.get_or_404(invoice_id)
    if inv.status == "CANCELLED":
''',
'''def update_generated_invoice(invoice_id):
    inv = Invoice.query.get_or_404(invoice_id)
    if inv.status == "CANCELLED":
''',
"update_generated_invoice function verification",
)


replace_once(
'''    try:
        company_name, invoice_number, invoice_date, completion_date, software, amount, contract_details = invoice_payload(request.json or {})
        company = get_or_create_company(company_name)

        duplicate = duplicate_invoice(
''',
'''    try:
        company_name, invoice_number, invoice_date, completion_date, software, currency, amount, contract_details = invoice_payload(request.json or {})
        company = get_or_create_company(company_name)

        duplicate = duplicate_invoice(
''',
"update_generated_invoice payload",
)


replace_once(
'''        old_payment_status = inv.payment_status or "UNPAID"
        old_contract_details = inv.contract_details or ""

        # Payment cannot exceed the new invoice total.
''',
'''        old_payment_status = inv.payment_status or "UNPAID"
        old_contract_details = inv.contract_details or ""
        old_currency = canonical_currency(inv.currency)

        # Payment cannot exceed the new invoice total.
''',
"update_generated_invoice old currency",
)


replace_once(
'''        if old_amount != amount:
            changes["amount_eur"] = {
                "from": str(old_amount),
                "to": str(amount),
            }

        if old_contract_details != contract_details:
''',
'''        if old_amount != amount:
            changes["amount_eur"] = {
                "from": str(old_amount),
                "to": str(amount),
            }

        if old_currency != currency:
            changes["currency"] = {
                "from": old_currency,
                "to": currency,
            }

        if old_contract_details != contract_details:
''',
"update_generated_invoice currency audit",
)


replace_once(
'''        inv.software = software
        inv.amount_eur = amount
        inv.paid_amount_eur = new_paid
''',
'''        inv.software = software
        inv.amount_eur = amount
        inv.currency = currency
        inv.paid_amount_eur = new_paid
''',
"update_generated_invoice currency assignment",
)


# ============================================================
# Write only after every replacement succeeded
# ============================================================

if text == original:
    print("ERROR: no changes generated")
    sys.exit(3)

path.write_text(text, encoding="utf-8")

print()
print("All backend currency changes applied successfully.")
PY

PY_STATUS=$?

if [[ "$PY_STATUS" -ne 0 ]]; then
    echo
    echo "============================================================"
    echo " PATCH FAILED"
    echo "============================================================"
    echo
    echo "app.py was NOT modified by the Python patch."
    echo "Backup:"
    echo "  $BACKUP"
    echo
    echo "Python exit code: $PY_STATUS"
    echo
    exit "$PY_STATUS"
fi


echo
echo "=== PYTHON COMPILE ==="

if ! venv/bin/python -m py_compile app.py; then
    echo "ERROR: app.py syntax check failed."
    echo "Restoring backup..."
    cp -p "$BACKUP" "$APP"
    echo "app.py restored."
    exit 10
fi

echo "OK: app.py syntax"


echo
echo "=== GIT DIFF CHECK ==="

if ! git diff --check; then
    echo "ERROR: git diff --check failed."
    echo "Restoring backup..."
    cp -p "$BACKUP" "$APP"
    echo "app.py restored."
    exit 11
fi

echo "OK: git diff --check"


echo
echo "=== DIFF STAT ==="
git diff --stat -- app.py


echo
echo "=== CURRENCY DIFF ==="
git diff -- app.py | grep -E '^[+-].*(currency|Currency|CURRENCY|EUR|USD|UAH)' || true


echo
echo "============================================================"
echo " PATCH COMPLETED SUCCESSFULLY"
echo "============================================================"
echo
echo "Backup:"
echo "  $BACKUP"
echo
echo "Gunicorn was NOT restarted."
echo "Database was NOT changed."
echo

exit 0
