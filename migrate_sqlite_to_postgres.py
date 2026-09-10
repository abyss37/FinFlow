"""One-time migration from FinFlow SQLite to PostgreSQL."""

import os
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

SOURCE = os.getenv(
    "SOURCE_SQLITE_URL",
    "sqlite:////opt/accounting-app/accounting.db",
)

TARGET = os.getenv("TARGET_DATABASE_URL")

if not TARGET:
    raise SystemExit(
        "ERROR: TARGET_DATABASE_URL is required.\n"
        "Example:\n"
        "export TARGET_DATABASE_URL='postgresql+psycopg://finflow:PASSWORD@localhost:5432/finflow'"
    )

# Tell app.py which database we are working with before importing it.
os.environ["DATABASE_URL"] = TARGET

from app import (
    app,
    db,
    Company,
    CompanyBudget,
    Invoice,
    canonical_software,
)


def count_rows(session, model):
    return session.query(model).count()


def set_postgres_sequences():
    """Move PostgreSQL sequences past the imported primary keys."""
    tables = ("company", "company_budget", "invoice")

    for table in tables:
        db.session.execute(
            text(
                f"""
                SELECT setval(
                    pg_get_serial_sequence('{table}', 'id'),
                    COALESCE((SELECT MAX(id) FROM {table}), 1),
                    true
                )
                """
            )
        )


print("=" * 60)
print("FinFlow SQLite → PostgreSQL migration")
print("=" * 60)
print(f"Source: {SOURCE}")
print(f"Target: {TARGET}")
print()

source_engine = create_engine(SOURCE)
SourceSession = sessionmaker(bind=source_engine)

source = SourceSession()

try:
    # Read everything from SQLite before touching PostgreSQL.
    companies = source.query(Company).order_by(Company.id).all()
    budgets = source.query(CompanyBudget).order_by(CompanyBudget.id).all()
    invoices = source.query(Invoice).order_by(Invoice.id).all()

    print(
        f"SQLite records: "
        f"{len(companies)} companies, "
        f"{len(budgets)} budgets, "
        f"{len(invoices)} invoices"
    )
    print()

    with app.app_context():

        # This is an explicit migration operation.
        # It is NOT executed merely by importing app.py.
        print("Resetting PostgreSQL schema...")
        db.drop_all()
        db.create_all()

        try:
            # ---------------------------------------------------------
            # Companies
            # ---------------------------------------------------------
            print("Migrating companies...")

            for row in companies:
                db.session.add(
                    Company(
                        id=row.id,
                        name=row.name,
                    )
                )

            db.session.flush()

            # ---------------------------------------------------------
            # Budgets
            # ---------------------------------------------------------
            print("Migrating budgets...")

            for row in budgets:
                db.session.add(
                    CompanyBudget(
                        id=row.id,
                        company_id=row.company_id,
                        software=canonical_software(row.software),
                        total_amount=row.total_amount,
                        completion_date=row.completion_date,
                    )
                )

            db.session.flush()

            # ---------------------------------------------------------
            # Invoices
            # ---------------------------------------------------------
            print("Migrating invoices...")

            for row in invoices:
                db.session.add(
                    Invoice(
                        id=row.id,
                        company_id=row.company_id,
                        invoice_number=row.invoice_number,
                        invoice_date=row.invoice_date,
                        completion_date=row.completion_date,
                        software=canonical_software(row.software),
                        amount_eur=row.amount_eur,
                        contract_details=row.contract_details,
                    )
                )

            db.session.flush()

            # ---------------------------------------------------------
            # Verification before commit
            # ---------------------------------------------------------
            postgres_company_count = count_rows(db.session, Company)
            postgres_budget_count = count_rows(db.session, CompanyBudget)
            postgres_invoice_count = count_rows(db.session, Invoice)

            print()
            print("Verification:")
            print(
                f"  Companies: {postgres_company_count}/{len(companies)}"
            )
            print(
                f"  Budgets:   {postgres_budget_count}/{len(budgets)}"
            )
            print(
                f"  Invoices:  {postgres_invoice_count}/{len(invoices)}"
            )

            if postgres_company_count != len(companies):
                raise RuntimeError("Company count mismatch")

            if postgres_budget_count != len(budgets):
                raise RuntimeError("CompanyBudget count mismatch")

            if postgres_invoice_count != len(invoices):
                raise RuntimeError("Invoice count mismatch")

            # ---------------------------------------------------------
            # PostgreSQL sequences
            # ---------------------------------------------------------
            print()
            print("Updating PostgreSQL ID sequences...")
            set_postgres_sequences()

            # ---------------------------------------------------------
            # Commit
            # ---------------------------------------------------------
            db.session.commit()

            print()
            print("=" * 60)
            print("MIGRATION SUCCESSFUL")
            print("=" * 60)
            print(
                f"Migrated {len(companies)} companies, "
                f"{len(budgets)} budgets and "
                f"{len(invoices)} invoices."
            )

        except Exception:
            db.session.rollback()
            print()
            print("=" * 60)
            print("MIGRATION FAILED — PostgreSQL transaction rolled back")
            print("=" * 60)
            raise

finally:
    source.close()
    source_engine.dispose()
