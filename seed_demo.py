import datetime
from decimal import Decimal

from app import app, db, Company, Invoice, CompanyBudget


def seed():
    with app.app_context():
        # Clean demo database
        db.drop_all()
        db.create_all()

        # Demo companies
        c1 = Company(name="ACME Global Corp Ltd")
        c2 = Company(name="Nexus Digital Solutions Inc.")
        c3 = Company(name="Starlight Venture Technologies Sp. z o.o.")
        c4 = Company(name="Orion Synergy Technologies Ltd")

        db.session.add_all([c1, c2, c3, c4])
        db.session.flush()

        # Product budgets
        budgets = [
            CompanyBudget(
                company_id=c1.id,
                software="ALPHA",
                total_amount=Decimal("3000.00"),
                completion_date=datetime.date(2027, 12, 31),
            ),
            CompanyBudget(
                company_id=c2.id,
                software="ALPHA",
                total_amount=Decimal("4500.00"),
                completion_date=datetime.date(2027, 10, 31),
            ),
            CompanyBudget(
                company_id=c3.id,
                software="BETA",
                total_amount=Decimal("5000.00"),
                completion_date=datetime.date(2027, 9, 30),
            ),
            CompanyBudget(
                company_id=c4.id,
                software="BETA",
                total_amount=Decimal("6000.00"),
                completion_date=datetime.date(2027, 12, 31),
            ),
        ]

        db.session.add_all(budgets)

        # Demo invoices
        invoices = [
            Invoice(
                company_id=c1.id,
                invoice_number="INV-2026-001-ALPHA",
                invoice_date=datetime.date(2026, 1, 15),
                completion_date=datetime.date(2027, 12, 31),
                software="ALPHA",
                amount_eur=Decimal("1250.00"),
                contract_details="Accounting System License — ALPHA",
                status="ISSUED",
            ),
            Invoice(
                company_id=c2.id,
                invoice_number="INV-2026-002-ALPHA",
                invoice_date=datetime.date(2026, 2, 10),
                completion_date=datetime.date(2027, 10, 31),
                software="ALPHA",
                amount_eur=Decimal("2000.00"),
                contract_details="Digital Solutions License — ALPHA",
                status="ISSUED",
            ),
            Invoice(
                company_id=c3.id,
                invoice_number="INV-2026-003-BETA",
                invoice_date=datetime.date(2026, 3, 5),
                completion_date=datetime.date(2027, 9, 30),
                software="BETA",
                amount_eur=Decimal("1750.00"),
                contract_details="Venture Technology License — BETA",
                status="ISSUED",
            ),
            Invoice(
                company_id=c4.id,
                invoice_number="INV-2026-004-BETA",
                invoice_date=datetime.date(2026, 4, 12),
                completion_date=datetime.date(2027, 12, 31),
                software="BETA",
                amount_eur=Decimal("3500.00"),
                contract_details="Synergy Technology License — BETA",
                status="ISSUED",
            ),
        ]

        db.session.add_all(invoices)
        db.session.commit()

        print("Demo database successfully recreated!")
        print()
        print("ALPHA:")
        print("  Budget:   EUR 7,500.00")
        print("  Invoiced: EUR 3,250.00")
        print("  Remaining: EUR 4,250.00")
        print("  Companies: 2")
        print()
        print("BETA:")
        print("  Budget:   EUR 11,000.00")
        print("  Invoiced: EUR 5,250.00")
        print("  Remaining: EUR 5,750.00")
        print("  Companies: 2")


if __name__ == "__main__":
    seed()
