"""add notifications

Revision ID: 7f3a9c2d1b6e
Revises: 4c41fd40f894
Create Date: 2026-09-09
"""

from alembic import op
import sqlalchemy as sa


revision = "7f3a9c2d1b6e"
down_revision = "4c41fd40f894"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "notification",
        sa.Column(
            "id",
            sa.BigInteger(),
            primary_key=True,
            autoincrement=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "type",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "level",
            sa.String(length=20),
            nullable=False,
        ),
        sa.Column(
            "title",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "message",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("company.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "invoice_id",
            sa.Integer(),
            sa.ForeignKey("invoice.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "software",
            sa.String(length=50),
            nullable=True,
        ),
        sa.Column(
            "is_read",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "read_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.create_check_constraint(
        "ck_notification_level",
        "notification",
        "level IN ('info', 'warning', 'critical')",
    )

    op.create_check_constraint(
        "ck_notification_type",
        "notification",
        """
        type IN (
            'OVERDUE_INVOICE',
            'BUDGET_WARNING',
            'BUDGET_CRITICAL',
            'BUDGET_EXCEEDED',
            'CONTRACT_EXPIRING'
        )
        """,
    )

    op.create_index(
        "idx_notification_created_at",
        "notification",
        ["created_at"],
    )

    op.create_index(
        "idx_notification_is_read",
        "notification",
        ["is_read"],
    )

    op.create_index(
        "idx_notification_company_id",
        "notification",
        ["company_id"],
    )

    op.create_index(
        "idx_notification_invoice_id",
        "notification",
        ["invoice_id"],
    )

    op.create_index(
        "idx_notification_type",
        "notification",
        ["type"],
    )


def downgrade():
    op.drop_index(
        "idx_notification_type",
        table_name="notification",
    )

    op.drop_index(
        "idx_notification_invoice_id",
        table_name="notification",
    )

    op.drop_index(
        "idx_notification_company_id",
        table_name="notification",
    )

    op.drop_index(
        "idx_notification_is_read",
        table_name="notification",
    )

    op.drop_index(
        "idx_notification_created_at",
        table_name="notification",
    )

    op.drop_constraint(
        "ck_notification_type",
        "notification",
        type_="check",
    )

    op.drop_constraint(
        "ck_notification_level",
        "notification",
        type_="check",
    )

    op.drop_table("notification")
