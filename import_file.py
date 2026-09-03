import sqlite3
import pandas as pd
import re
import os
import glob

db_path = '/opt/accounting-app/accounting.db'

# Автоматичний пошук будь-якого .xlsx файлу в папці додатка
xlsx_files = glob.glob('/opt/accounting-app/*.xlsx')

if not xlsx_files:
    print("XLSX файл не знайдено! Завантажте файл у /opt/accounting-app/")
    exit(1)

excel_path = xlsx_files[0]
print(f"Знайдено файл для імпорту: {excel_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Перевірка та додавання необхідних колонок
cursor.execute("PRAGMA table_info(invoice)")
existing_cols = [col[1] for col in cursor.fetchall()]

if 'invoice_number' not in existing_cols:
    cursor.execute("ALTER TABLE invoice ADD COLUMN invoice_number TEXT")
if 'invoice_date' not in existing_cols:
    cursor.execute("ALTER TABLE invoice ADD COLUMN invoice_date TEXT")
if 'contract_details' not in existing_cols:
    cursor.execute("ALTER TABLE invoice ADD COLUMN contract_details TEXT")
conn.commit()

# Очищення старих записів інвойсів для чистого переімпорту
cursor.execute("DELETE FROM invoice")
conn.commit()

def parse_amount(val):
    if pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip()
    val_str = re.sub(r'[^\d.,]', '', val_str)
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

def normalize_company(raw_text):
    t = " ".join(str(raw_text).split())
    splitters = [r'License Agreement', r'Licence Agreement', r'No\.', r'№', r'-\s*\d{2}\.\d{2}']
    pattern = r'(' + '|'.join(splitters) + r')'
    parts = re.split(pattern, t, flags=re.IGNORECASE)
    
    clean_name = parts[0].strip(' ,-\t\n')
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

    return clean_name.strip(), contract_info

# Зчитування Excel
try:
    df = pd.read_excel(excel_path, sheet_name='общая табл инвойсов')
except Exception:
    df = pd.read_excel(excel_path, sheet_name=0)

count_added = 0
for idx, row in df.iterrows():
    inv_num_raw = row.get('№ інвойса')
    inv_date_raw = row.get(' Дата інвойса') if ' Дата інвойса' in row else row.get('Дата інвойса')
    amount_raw = row.get('Сума інвойса, євро')
    company_raw = row.get('Контракт, з ким, № та дата')

    amount = parse_amount(amount_raw)
    if amount <= 0:
        continue

    row_full_str = " ".join([str(v) for v in row.values if pd.notna(v)]).upper()
    software = None
    if 'KUDO' in row_full_str:
        software = 'KUDO'
    elif 'MERCURIUS' in row_full_str:
        software = 'MERCURIUS'
    else:
        continue

    # Номер інвойса
    if pd.isna(inv_num_raw):
        inv_num = "—"
    else:
        if isinstance(inv_num_raw, float) and inv_num_raw.is_integer():
            inv_num = str(int(inv_num_raw))
        else:
            inv_num = str(inv_num_raw).strip()

    # Дата інвойса
    if pd.isna(inv_date_raw):
        inv_date = "—"
    else:
        if isinstance(inv_date_raw, pd.Timestamp) or hasattr(inv_date_raw, 'strftime'):
            inv_date = inv_date_raw.strftime('%Y-%m-%d')
        else:
            inv_date = str(inv_date_raw).split()[0].strip()

    # Компанія
    if pd.isna(company_raw) or str(company_raw).strip() == "":
        company_name = "—"
        contract_info = ""
    else:
        company_name, contract_info = normalize_company(company_raw)

    cursor.execute("SELECT id FROM company WHERE name = ?", (company_name,))
    c_row = cursor.fetchone()
    if c_row:
        company_id = c_row[0]
    else:
        cursor.execute("INSERT INTO company (name) VALUES (?)", (company_name,))
        company_id = cursor.lastrowid

    cursor.execute("""
        INSERT INTO invoice (company_id, software, amount_eur, invoice_number, invoice_date, contract_details)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (company_id, software, amount, inv_num, inv_date, contract_info))
    
    count_added += 1

conn.commit()
print(f"Імпорт успішно завершено! Занесено інвойсів: {count_added}")
conn.close()
