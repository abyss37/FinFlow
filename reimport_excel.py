import sqlite3
import pandas as pd
import re
import os

db_path = '/opt/accounting-app/accounting.db'
excel_path = '/opt/accounting-app/uploads/реєстр інвойсів юрособи.xlsx'

# Если файл лежит в корне, проверяем его
if not os.path.exists(excel_path):
    excel_path = 'реєстр інвойсів юрособи.xlsx'

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 1. Добавляем колонки invoice_number и invoice_date в таблицу invoice (если их нет)
cursor.execute("PRAGMA table_info(invoice)")
cols = [c[1] for c in cursor.fetchall()]

if 'invoice_number' not in cols:
    cursor.execute("ALTER TABLE invoice ADD COLUMN invoice_number TEXT")
if 'invoice_date' not in cols:
    cursor.execute("ALTER TABLE invoice ADD COLUMN invoice_date TEXT")
if 'contract_details' not in cols:
    cursor.execute("ALTER TABLE invoice ADD COLUMN contract_details TEXT")

conn.commit()

# Очищаем старые инвойсы перед свежим импортом
cursor.execute("DELETE FROM invoice")
conn.commit()

def parse_amount(val):
    if pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    val_str = re.sub(r'[^\d.,]', '', str(val).strip())
    if not val_str:
        return 0.0
    if ',' in val_str and '.' in val_str:
        val_str = val_str.replace('.', '').replace(',', '.')
    elif ',' in val_str:
        val_str = val_str.replace(',', '.')
    try:
        return float(val_str)
    except ValueError:
        return 0.0

def format_date(d_val):
    if pd.isna(d_val):
        return '—'
    d_str = str(d_val).split(' ')[0].strip()
    if re.match(r'^\d{4}-\d{2}-\d{2}$', d_str):
        parts = d_str.split('-')
        return f"{parts[2]}.{parts[1]}.{parts[0]}"
    return d_str if d_str else '—'

def normalize_company(raw_text):
    t = " ".join(str(raw_text).split())
    splitters = [r'License Agreement', r'Licence Agreement', r'No\.', r'№', r'-\s*\d{2}\.\d{2}']
    pattern = r'(' + '|'.join(splitters) + r')'
    parts = re.split(pattern, t, flags=re.IGNORECASE)
    
    clean_name = parts[0].strip(' ,-.\t\n')
    contract_info = t[len(parts[0]):].strip(' ,-.\t\n') if len(parts) > 1 else ""

    clean_upper = clean_name.upper()
    if any(k in clean_upper for k in ['E2 TRADE', 'E 2 TRADE', '2 TRADE']):
        clean_name = 'E2 TRADE LTD'
    elif 'RYT TRADE' in clean_upper:
        clean_name = 'RYT TRADE Sp. z o.o.'
    elif 'UXFIELD' in clean_upper:
        clean_name = 'UXFIELD LLP'
    elif 'BRIDGE DIGI' in clean_upper:
        clean_name = 'BRIDGE DIGI LIMITED'
    elif 'CORDUS' in clean_upper:
        clean_name = 'CORDUS TECHNOLOGIES INC.'
    elif 'CRYSTALL' in clean_upper:
        clean_name = 'CRYSTALL Sp. z o.o.'
    elif 'EXPERTIPO' in clean_upper:
        clean_name = 'EXPERTIPO S.R.O.'
    elif 'BLUEOCEAN' in clean_upper:
        clean_name = 'BLUEOCEAN DEVELOPMENT AI LTD'
    elif 'BONNY' in clean_upper:
        clean_name = 'BONNY ONE SERVICES FZE'
    elif 'BERIL' in clean_upper:
        clean_name = 'BERIL KV S.R.O.'
    elif 'TITARUM' in clean_upper:
        clean_name = 'TITARUM TRADE LTD'
    elif 'CLIPFORGE' in clean_upper:
        clean_name = 'CLIPFORGE SOLUTIONS AI LTD'
    elif 'POLDIST' in clean_upper:
        clean_name = 'POLDIST TECH Sp. z o.o.'

    return clean_name.strip(), contract_info

# Читаем Excel
df = pd.read_excel(excel_path, header=None)

# Находим строку с заголовками
header_row = 0
data_df = df.iloc[header_row + 1:]

imported_count = 0

for idx, row in data_df.iterrows():
    inv_num_raw = str(row[1]).replace('\n', '').strip() if pd.notna(row[1]) else '—'
    inv_date_raw = format_date(row[2])
    amount_raw = row[3]
    company_raw = row[4]
    row_full_str = " ".join([str(v) for v in row.values if pd.notna(v)]).upper()

    if pd.isna(company_raw) or str(company_raw).strip().lower() in ['nan', 'none', '']:
        continue

    sw = 'KUDO' if 'KUDO' in row_full_str else ('MERCURIUS' if 'MERCURIUS' in row_full_str else None)
    amt = parse_amount(amount_raw)

    if amt <= 0 or not sw:
        continue

    clean_comp, contract_details = normalize_company(company_raw)

    # Находим или создаем компанию
    cursor.execute("SELECT id FROM company WHERE name = ?", (clean_comp,))
    comp_row = cursor.fetchone()
    if comp_row:
        comp_id = comp_row[0]
    else:
        cursor.execute("INSERT INTO company (name) VALUES (?)", (clean_comp,))
        comp_id = cursor.lastrowid

    # Вставляем инвойс
    cursor.execute("""
        INSERT INTO invoice (company_id, software, amount_eur, contract_details, invoice_number, invoice_date)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (comp_id, sw, amt, contract_details, inv_num_raw, inv_date_raw))

    imported_count += 1

conn.commit()
print(f"Повторный импорт завершен! Успешно загружено {imported_count} инвойсов с датами и номерами.")
conn.close()
