#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/accounting-app"
FILE="$APP_DIR/templates/index.html"
BACKUP="$FILE.before-budget-health-fix"

echo "=== FinFlow: Budget Health product filter fix ==="

cd "$APP_DIR"

if [ ! -f "$FILE" ]; then
    echo "ERROR: $FILE not found"
    exit 1
fi

if [ ! -f "$BACKUP" ]; then
    cp "$FILE" "$BACKUP"
    echo "Backup created: $BACKUP"
else
    echo "Backup already exists: $BACKUP"
fi

python3 - "$FILE" <<'PY'
import sys
from pathlib import Path

file = Path(sys.argv[1])
text = file.read_text(encoding="utf-8")

original = text

# ------------------------------------------------------------
# 1. Product card click:
#    ALPHA -> openBudgetHealthModal('ALPHA')
#    BETA  -> openBudgetHealthModal('BETA')
# ------------------------------------------------------------

old = """document.querySelectorAll('#product-ALPHA, #product-BETA').forEach(card=>{
      card.style.cursor='pointer';
      card.title='Click to view full budget overview';
      card.addEventListener('click',function(e){
        if(e.target.closest('button,a,input,select,textarea'))return;
        openBudgetHealthModal();
      });
    });"""

new = """document.querySelectorAll('#product-ALPHA, #product-BETA').forEach(card=>{
      card.style.cursor='pointer';
      card.title='Click to view budget overview for this product';
      card.addEventListener('click',function(e){
        if(e.target.closest('button,a,input,select,textarea'))return;
        const software = card.id === 'product-ALPHA' ? 'ALPHA' : 'BETA';
        openBudgetHealthModal(software);
      });
    });"""

if old not in text:
    raise SystemExit(
        "ERROR: Product card click handler was not found. "
        "No changes were made."
    )

text = text.replace(old, new, 1)


# ------------------------------------------------------------
# 2. Modal opener gets selected software
# ------------------------------------------------------------

old = """function openBudgetHealthModal(){
      renderBudgetHealth();
      const m=document.getElementById('budgetHealthModal');
      m.classList.remove('hidden');
      m.classList.add('flex');
    }"""

new = """function openBudgetHealthModal(selectedSoftware=null){
      renderBudgetHealth(selectedSoftware);

      const title = document.querySelector('#budgetHealthModal h3');
      const subtitle = document.querySelector('#budgetHealthModal .budget-health-subtitle');

      if(title){
        title.textContent = selectedSoftware
          ? `Budget health · ${selectedSoftware}`
          : 'Budget health';
      }

      if(subtitle){
        subtitle.textContent = selectedSoftware
          ? `Remaining budget by company · ${selectedSoftware}`
          : 'All companies, budgets and invoice history';
      }

      const m=document.getElementById('budgetHealthModal');
      m.classList.remove('hidden');
      m.classList.add('flex');
    }"""

if old not in text:
    raise SystemExit(
        "ERROR: openBudgetHealthModal() was not found. "
        "No changes were made."
    )

text = text.replace(old, new, 1)


# ------------------------------------------------------------
# 3. Add a class to modal subtitle so JS can update it safely
# ------------------------------------------------------------

old = """<p class="text-xs text-slate-500 mt-1">All companies, budgets and invoice history</p>"""

new = """<p class="text-xs text-slate-500 mt-1 budget-health-subtitle">All companies, budgets and invoice history</p>"""

if old not in text:
    raise SystemExit(
        "ERROR: Budget Health subtitle was not found. "
        "No changes were made."
    )

text = text.replace(old, new, 1)


# ------------------------------------------------------------
# 4. renderBudgetHealth(selectedSoftware)
# ------------------------------------------------------------

old = """function renderBudgetHealth(){"""

new = """function renderBudgetHealth(selectedSoftware=null){
      const activeSoftware = selectedSoftware
        ? String(selectedSoftware).toUpperCase()
        : null;"""

if old not in text:
    raise SystemExit(
        "ERROR: renderBudgetHealth() was not found. "
        "No changes were made."
    )

text = text.replace(old, new, 1)


# ------------------------------------------------------------
# 5. Replace softwareRows construction.
#
#    When a product is selected, only that product gets a row.
#    Legacy products are intentionally excluded in product mode.
# ------------------------------------------------------------

start_marker = "const softwareRows=["
start = text.find(start_marker)

if start == -1:
    raise SystemExit(
        "ERROR: softwareRows block was not found. "
        "No changes were made."
    )

end = text.find("];", start)

if end == -1:
    raise SystemExit(
        "ERROR: end of softwareRows block was not found. "
        "No changes were made."
    )

end += 2

old_block = text[start:end]

new_block = """const softwareRows = activeSoftware
          ? [{
              software: activeSoftware,
              budget: Number(
                card.dataset[activeSoftware.toLowerCase() + 'Budget'] || 0
              )
            }]
          : [
              {
                software: 'ALPHA',
                budget: Number(card.dataset.alphaBudget || 0)
              },
              {
                software: 'BETA',
                budget: Number(card.dataset.betaBudget || 0)
              }
            ];"""

text = text[:start] + new_block + text[end:]


# ------------------------------------------------------------
# 6. In selected-product mode, invoices are filtered to that
#    product before rows/totals are calculated.
# ------------------------------------------------------------

old = """companyInvoices.forEach(inv=>{"""

new = """const visibleInvoices = activeSoftware
          ? companyInvoices.filter(inv =>
              canonicalSoftwareForUi(inv.software) === activeSoftware
            )
          : companyInvoices;

        visibleInvoices.forEach(inv=>{"""

if old not in text:
    raise SystemExit(
        "ERROR: companyInvoices.forEach() was not found. "
        "No changes were made."
    )

text = text.replace(old, new, 1)


# ------------------------------------------------------------
# 7. In product mode, only selected product is considered
#    "has data".
#
#    Preserve the existing ALPHA/BETA card behavior where a
#    configured product with zero amounts can still be shown.
# ------------------------------------------------------------

needle = """softwareRows.forEach(row=>{"""

if needle not in text:
    raise SystemExit(
        "ERROR: softwareRows.forEach() was not found. "
        "No changes were made."
    )


# ------------------------------------------------------------
# Safety checks
# ------------------------------------------------------------

required = [
    "openBudgetHealthModal(selectedSoftware=null)",
    "renderBudgetHealth(selectedSoftware=null)",
    "const activeSoftware = selectedSoftware",
    "const visibleInvoices = activeSoftware",
    "softwareRows = activeSoftware",
    "budget-health-subtitle",
    "openBudgetHealthModal(software)"
]

for item in required:
    if item not in text:
        raise SystemExit(
            f"ERROR: verification failed; missing expected text: {item}"
        )

file.write_text(text, encoding="utf-8")

print("index.html updated successfully.")
print(f"Changed: {file}")
print(f"Backup: {file}.before-budget-health-fix")
PY

echo
echo "=== Checking changed file ==="

grep -n \
  -e "openBudgetHealthModal" \
  -e "renderBudgetHealth" \
  -e "activeSoftware" \
  -e "visibleInvoices" \
  -e "budget-health-subtitle" \
  "$FILE" | head -80

echo
echo "=== Git diff ==="
git diff --stat -- "$FILE"
git diff -- "$FILE"

echo
echo "=== DONE ==="
echo
echo "Now test:"
echo "  1. Open FinFlow"
echo "  2. Click ALPHA card"
echo "  3. Modal must contain ALPHA only"
echo "  4. Close modal"
echo "  5. Click BETA card"
echo "  6. Modal must contain BETA only"
echo
echo "If everything is OK:"
echo "  git add templates/index.html"
echo "  git commit -m \"fix: filter budget health by selected product\""
echo "  git push"
