import sqlite3

db_path = '/opt/accounting-app/accounting.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT id, name FROM company")
companies = cursor.fetchall()

def normalize_key(name):
    n = name.strip()
    if n.endswith('.'):
        n = n[:-1].strip()
    return n.lower()

groups = {}
for c_id, name in companies:
    key = normalize_key(name)
    groups.setdefault(key, []).append((c_id, name))

merged_count = 0

for key, comps in groups.items():
    if len(comps) > 1:
        # Приоритет компании с точкой на конце (стандарт для Sp. z o.o.)
        primary_id, primary_name = comps[0]
        for cid, cname in comps:
            if cname.endswith('.'):
                primary_id, primary_name = cid, cname
                break
        
        dup_ids = [cid for cid, cname in comps if cid != primary_id]
        print(f"Объединение дубликатов {dup_ids} в главную компанию ID {primary_id} ('{primary_name}')...")

        for dup_id in dup_ids:
            # Перенос всех инвойсов
            cursor.execute("UPDATE invoice SET company_id = ? WHERE company_id = ?", (primary_id, dup_id))
            
            # Перенос бюджетов
            cursor.execute("SELECT software, total_amount FROM company_budget WHERE company_id = ?", (dup_id,))
            dup_budgets = cursor.fetchall()
            for sw, amt in dup_budgets:
                cursor.execute("SELECT id, total_amount FROM company_budget WHERE company_id = ? AND software = ?", (primary_id, sw))
                p_budget = cursor.fetchone()
                if p_budget:
                    if amt > p_budget[1]:
                        cursor.execute("UPDATE company_budget SET total_amount = ? WHERE id = ?", (amt, p_budget[0]))
                    cursor.execute("DELETE FROM company_budget WHERE company_id = ? AND software = ?", (dup_id, sw))
                else:
                    cursor.execute("UPDATE company_budget SET company_id = ? WHERE company_id = ? AND software = ?", (primary_id, dup_id, sw))
            
            # Удаление дубликата компании
            cursor.execute("DELETE FROM company WHERE id = ?", (dup_id,))
            merged_count += 1

conn.commit()
print(f"Успешно объединено карточек дубликатов: {merged_count}")
conn.close()
