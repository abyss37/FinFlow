"""add notification dedup key

Revision ID: 8a4b6d2e91f0
Revises: 7f3a9c2d1b6e
Create Date: 2026-09-09
"""

from alembic import op
import sqlalchemy as sa


revision = "8a4b6d2e91f0"
down_revision = "7f3a9c2d1b6e"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "notification",
        sa.Column(
            "dedup_key",
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.create_index(
        "uq_notification_dedup_key",
        "notification",
        ["dedup_key"],
        unique=True,
    )


def downgrade():
    op.drop_index(
        "uq_notification_dedup_key",
        table_name="notification",
    )

    op.drop_column(
        "notification",
        "dedup_key",
    )
