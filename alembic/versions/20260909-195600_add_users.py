"""add users

Revision ID: 9c7e4a1b2d6f
Revises: 8a4b6d2e91f0
Create Date: 2026-09-09
"""

from alembic import op
import sqlalchemy as sa


revision = "9c7e4a1b2d6f"
down_revision = "8a4b6d2e91f0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
        ),
        sa.Column(
            "username",
            sa.String(length=64),
            nullable=False,
        ),
        sa.Column(
            "password_hash",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "role",
            sa.String(length=20),
            nullable=False,
            server_default="viewer",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "last_login",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.UniqueConstraint(
            "username",
            name="uq_user_username",
        ),
    )


def downgrade():
    op.drop_table("user")
