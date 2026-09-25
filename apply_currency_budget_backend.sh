#!/usr/bin/env bash
set -euo pipefail

APP="/opt/accounting-app/app.py"
STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP="${APP}.before_currency_budget_${STAMP}"

echo "============================================================"
echo " FinFlow - Currency budget backend patch"
echo "============================================================"
echo

echo "=== Creating backup ==="
cp -a "$APP" "$BACKUP"
echo "Backup created:"
echo "  $BACKUP"
echo

python3 - "$APP" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")


def replace_in_function(text, function_name, old, new, label):
    marker = f"def {function_name}("
    start = text.find(marker)

    if start == -1:
        raise RuntimeError(f"{label}: function {function_name} not found")

    next_def = text.find("\ndef ", start + len(marker))
    block_end = len(text) if next_def == -1 else next_def

    block = text[start:block_end]
    count = block.count(old)

    if count != 1:
        raise RuntimeError(
            f"{label}: expected exactly 1 occurrence inside "
            f"{function_name}(), found {count}"
        )

    block = block.replace(old, new, 1)

    return text[:start] + block + text[block_end:]


# ============================================================
# update_company_budget
# ============================================================

text = replace_in_function(
    text,
    "update_company_budget",
'''        company_id = int(request.form.get("company_id"))
        software = canonical_software(request.form.get("software"))
        total_amount = money(request.form.get("total_amount", 0))
''',
'''        company_id = int(request.form.get("company_id"))
        software = canonical_software(request.form.get("software"))
        currency = canonical_currency(request.form.get("currency"))
        total_amount = money(request.form.get("total_amount", 0))
''',
"update_company_budget currency parsing",
)
print("OK: update_company_budget currency parsing")

text = replace_in_function(
    text,
    "update_company_budget",
'''        budget = CompanyBudget.query.filter_by(
            company_id=company_id,
            software=software,
        ).first()
''',
'''        budget = CompanyBudget.query.filter_by(
            company_id=company_id,
            software=software,
            currency=currency,
        ).first()
''',
"update_company_budget currency lookup",
)
print("OK: update_company_budget currency lookup")

text = replace_in_function(
    text,
    "update_company_budget",
'''            budget = CompanyBudget(
                company_id=company_id,
                software=software,
                total_amount=total_amount,
            )
''',
'''            budget = CompanyBudget(
                company_id=company_id,
                software=software,
                total_amount=total_amount,
                currency=currency,
            )
''',
"update_company_budget currency creation",
)
print("OK: update_company_budget currency creation")

text = replace_in_function(
    text,
    "update_company_budget",
'''                details={
                    "company": company.name,
                    "software": software,
                    "changes": {
''',
'''                details={
                    "company": company.name,
                    "software": software,
                    "currency": currency,
                    "changes": {
''',
"update_company_budget audit currency",
)
print("OK: update_company_budget audit currency")

text = replace_in_function(
    text,
    "update_company_budget",
'''        return jsonify({
            "status": "ok",
            "total_amount": money_float(total_amount),
        })
''',
'''        return jsonify({
            "status": "ok",
            "total_amount": money_float(total_amount),
            "currency": currency,
        })
''',
"update_company_budget response currency",
)
print("OK: update_company_budget response currency")


# ============================================================
# update_company_completion_date
# ============================================================

text = replace_in_function(
    text,
    "update_company_completion_date",
'''        company_id = int(request.form.get("company_id"))
        software = canonical_software(request.form.get("software"))
        completion_date_raw = request.form.get("completion_date", "").strip()
''',
'''        company_id = int(request.form.get("company_id"))
        software = canonical_software(request.form.get("software"))
        currency = canonical_currency(request.form.get("currency"))
        completion_date_raw = request.form.get("completion_date", "").strip()
''',
"update_company_completion_date currency parsing",
)
print("OK: update_company_completion_date currency parsing")

text = replace_in_function(
    text,
    "update_company_completion_date",
'''        budget = CompanyBudget.query.filter_by(
            company_id=company_id,
            software=software,
        ).first()
''',
'''        budget = CompanyBudget.query.filter_by(
            company_id=company_id,
            software=software,
            currency=currency,
        ).first()
''',
"update_company_completion_date currency lookup",
)
print("OK: update_company_completion_date currency lookup")

text = replace_in_function(
    text,
    "update_company_completion_date",
'''            budget = CompanyBudget(
                company_id=company_id,
                software=software,
                total_amount=Decimal("0.00"),
                completion_date=completion_date,
            )
''',
'''            budget = CompanyBudget(
                company_id=company_id,
                software=software,
                total_amount=Decimal("0.00"),
                currency=currency,
                completion_date=completion_date,
            )
''',
"update_company_completion_date currency creation",
)
print("OK: update_company_completion_date currency creation")

text = replace_in_function(
    text,
    "update_company_completion_date",
'''                details={
                    "company": company.name,
                    "software": software,
                    "changes": {
                        "completion_date": {
''',
'''                details={
                    "company": company.name,
                    "software": software,
                    "currency": currency,
                    "changes": {
                        "completion_date": {
''',
"update_company_completion_date audit currency",
)
print("OK: update_company_completion_date audit currency")

text = replace_in_function(
    text,
    "update_company_completion_date",
'''        return jsonify({
            "status": "ok",
            "completion_date": completion_date.isoformat() if completion_date else ""
        })
''',
'''        return jsonify({
            "status": "ok",
            "completion_date": completion_date.isoformat() if completion_date else "",
            "currency": currency,
        })
''',
"update_company_completion_date response currency",
)
print("OK: update_company_completion_date response currency")


# Write only after every replacement succeeds.
path.write_text(text, encoding="utf-8")
PY

echo
echo "=== PYTHON COMPILE ==="
python3 -m py_compile "$APP"
echo "OK: app.py syntax"

echo
echo "=== GIT DIFF CHECK ==="
git -C /opt/accounting-app diff --check
echo "OK: git diff --check"

echo
echo "=== DIFF STAT ==="
git -C /opt/accounting-app diff --stat -- app.py

echo
echo "=== CURRENCY BUDGET DIFF ==="
git -C /opt/accounting-app diff -- app.py | grep -E '^[+-].*(currency|Currency)' || true

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
