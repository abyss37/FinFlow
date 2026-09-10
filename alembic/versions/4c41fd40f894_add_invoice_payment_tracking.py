"""add invoice payment tracking

Revision ID: 4c41fd40f894
Revises: 1a377231e5b3
Create Date: 2026-09-09
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "4c41fd40f894"
down_revision = "1a377231e5b3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "invoice",
        sa.Column(
            "payment_status",
            sa.String(length=20),
            nullable=False,
            server_default="UNPAID",
        ),
    )

    op.add_column(
        "invoice",
        sa.Column(
            "paid_amount_eur",
            sa.Numeric(14, 2),
            nullable=False,
            server_default=sa.text("0.00"),
        ),
    )

    op.create_check_constraint(
        "ck_invoice_payment_status",
        "invoice",
        "payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')",
    )

    op.create_check_constraint(
        "ck_invoice_paid_amount_nonnegative",
        "invoice",
        "paid_amount_eur >= 0",
    )

    op.create_check_constraint(
        "ck_invoice_paid_amount_not_over_total",
        "invoice",
        "paid_amount_eur <= amount_eur",
    )

    op.create_index(
        "idx_invoice_payment_status",
        "invoice",
        ["payment_status"],
    )


def downgrade():
    op.drop_index(
        "idx_invoice_payment_status",
        table_name="invoice",
    )

    op.drop_constraint(
        "ck_invoice_paid_amount_not_over_total",
        "invoice",
        type_="check",
    )

    op.drop_constraint(
        "ck_invoice_paid_amount_nonnegative",
        "invoice",
        type_="check",
    )

    op.drop_constraint(
        "ck_invoice_payment_status",
        "invoice",
        type_="check",
    )

    op.drop_column("invoice", "paid_amount_eur")
    op.drop_column("invoice", "payment_status")
