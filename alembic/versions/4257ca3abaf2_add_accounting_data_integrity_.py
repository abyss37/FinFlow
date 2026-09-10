"""add accounting data integrity constraints

Revision ID: 4257ca3abaf2
Revises: ea1415587321
Create Date: 2026-09-08 16:06:34.383339

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4257ca3abaf2"
down_revision: Union[str, Sequence[str], None] = "ea1415587321"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add accounting data integrity constraints."""

    # One budget per company/product.
    op.create_unique_constraint(
        "uq_company_budget_company_software",
        "company_budget",
        ["company_id", "software"],
    )

    # Budgets cannot be negative.
    op.create_check_constraint(
        "ck_company_budget_total_amount_nonnegative",
        "company_budget",
        "total_amount >= 0",
    )

    # Invoice amounts must be strictly positive.
    op.create_check_constraint(
        "ck_invoice_amount_eur_positive",
        "invoice",
        "amount_eur > 0",
    )

    # Invoice numbers must be unique within a company/product,
    # but NULL invoice numbers are allowed to repeat.
    op.create_index(
        "uq_invoice_company_software_number",
        "invoice",
        ["company_id", "software", "invoice_number"],
        unique=True,
        postgresql_where=sa.text("invoice_number IS NOT NULL"),
    )


def downgrade() -> None:
    """Remove accounting data integrity constraints."""

    op.drop_index(
        "uq_invoice_company_software_number",
        table_name="invoice",
    )

    op.drop_constraint(
        "ck_invoice_amount_eur_positive",
        "invoice",
        type_="check",
    )

    op.drop_constraint(
        "ck_company_budget_total_amount_nonnegative",
        "company_budget",
        type_="check",
    )

    op.drop_constraint(
        "uq_company_budget_company_software",
        "company_budget",
        type_="unique",
    )
