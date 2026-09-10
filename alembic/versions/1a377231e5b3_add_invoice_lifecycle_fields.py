"""add invoice lifecycle fields

Revision ID: 1a377231e5b3
Revises: 4257ca3abaf2
Create Date: 2026-09-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1a377231e5b3"
down_revision: Union[str, Sequence[str], None] = "4257ca3abaf2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add invoice lifecycle fields."""

    op.add_column(
        "invoice",
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="ISSUED",
        ),
    )

    op.add_column(
        "invoice",
        sa.Column(
            "cancelled_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "invoice",
        sa.Column(
            "cancellation_reason",
            sa.Text(),
            nullable=True,
        ),
    )

    op.create_check_constraint(
        "ck_invoice_status",
        "invoice",
        "status IN ('ISSUED', 'CANCELLED')",
    )


def downgrade() -> None:
    """Remove invoice lifecycle fields."""

    op.drop_constraint(
        "ck_invoice_status",
        "invoice",
        type_="check",
    )

    op.drop_column("invoice", "cancellation_reason")
    op.drop_column("invoice", "cancelled_at")
    op.drop_column("invoice", "status")
