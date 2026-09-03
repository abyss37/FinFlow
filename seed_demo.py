import datetime
from app import app, db, Company, Invoice, CompanyBudget

def seed():
    with app.app_context():
        db.drop_all()
        db.create_all()

        # Создаем демо-компании
        c1 = Company(name="Nexus Tech Corp")
        c2 = Company(name="Global Logistics Ltd")
        db.session.add_all([c1, c2])
        db.session.commit()

        # Создаем демо-бюджеты по продуктам (Product Alpha и Product Beta)
        b1 = CompanyBudget(company_id=c1.id, software="Product Alpha", total_amount=50000.0, completion_date=datetime.date(2027, 12, 31))
        b2 = CompanyBudget(company_id=c2.id, software="Product Beta", total_amount=120000.0, completion_date=datetime.date(2026, 11, 30))
        db.session.add_all([b1, b2])

        # Создаем демо-инвойсы
        i1 = Invoice(company_id=c1.id, invoice_number="INV-1001", invoice_date=datetime.date(2026, 1, 15), amount_eur=15000.0, software="Product Alpha")
        i2 = Invoice(company_id=c2.id, invoice_number="INV-1002", invoice_date=datetime.date(2026, 2, 10), amount_eur=45000.0, software="Product Beta")
        db.session.add_all([i1, i2])

        db.session.commit()
        print("Чистая демо-база успешно создана!")

if __name__ == '__main__':
    seed()
