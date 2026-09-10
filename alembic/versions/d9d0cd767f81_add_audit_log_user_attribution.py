"""add audit log user attribution

Revision ID: d9d0cd767f81
Revises: 9c7e4a1b2d6f
Create Date: 2026-09-10
"""

from alembic import op
import sqlalchemy as sa


revision = "d9d0cd767f81"
down_revision = "9c7e4a1b2d6f"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "audit_log",
        sa.Column("user_id", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_audit_log_user_id_user",
        "audit_log",
        "user",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(
        "idx_audit_log_user_id",
        "audit_log",
        ["user_id"],
    )


def downgrade():
    op.drop_index(
        "idx_audit_log_user_id",
        table_name="audit_log",
    )

    op.drop_constraint(
        "fk_audit_log_user_id_user",
        "audit_log",
        type_="foreignkey",
    )

    op.drop_column(
        "audit_log",
        "user_id",
    )
