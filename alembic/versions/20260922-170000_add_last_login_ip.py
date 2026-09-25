"""add last login ip

Revision ID: f4a8c91e2b7d
Revises: 31e542adaf4f
Create Date: 2026-09-22
"""

from alembic import op
import sqlalchemy as sa


revision = "f4a8c91e2b7d"
down_revision = "31e542adaf4f"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user",
        sa.Column(
            "last_login_ip",
            sa.String(length=45),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("user", "last_login_ip")
