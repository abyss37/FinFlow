"""add currency to budgets and invoices

Revision ID: 31e542adaf4f
Revises: d9d0cd767f81
Create Date: 2026-09-15
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "31e542adaf4f"
down_revision = "d9d0cd767f81"
branch_labels = None
depends_on = None


SUPPORTED_CURRENCIES = ("EUR", "USD", "UAH")


def upgrade():
    # Existing financial records are EUR.
    op.add_column(
        "company_budget",
        sa.Column(
            "currency",
            sa.String(length=3),
            nullable=False,
            server_default="EUR",
        ),
    )

    op.add_column(
        "invoice",
        sa.Column(
            "currency",
            sa.String(length=3),
            nullable=False,
            server_default="EUR",
        ),
    )

    op.create_check_constraint(
        "ck_company_budget_currency_supported",
        "company_budget",
        "currency IN ('EUR', 'USD', 'UAH')",
    )

    op.create_check_constraint(
        "ck_invoice_currency_supported",
        "invoice",
        "currency IN ('EUR', 'USD', 'UAH')",
    )

    # Keep the database schema explicit: newly created records must
    # provide their currency from the application layer.
    op.alter_column(
        "company_budget",
        "currency",
        server_default=None,
    )

    op.alter_column(
        "invoice",
        "currency",
        server_default=None,
    )


def downgrade():
    op.drop_constraint(
        "ck_invoice_currency_supported",
        "invoice",
        type_="check",
    )

    op.drop_constraint(
        "ck_company_budget_currency_supported",
        "company_budget",
        type_="check",
    )

    op.drop_column("invoice", "currency")
    op.drop_column("company_budget", "currency")
