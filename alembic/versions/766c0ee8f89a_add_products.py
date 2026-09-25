"""add products

Revision ID: 766c0ee8f89a
Revises: f4a8c91e2b7d
Create Date: 2026-09-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "766c0ee8f89a"
down_revision: Union[str, Sequence[str], None] = "f4a8c91e2b7d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "product",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="ACTIVE",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    product_table = sa.table(
        "product",
        sa.column("code", sa.String(length=50)),
        sa.column("name", sa.String(length=255)),
        sa.column("description", sa.Text()),
        sa.column("status", sa.String(length=20)),
    )

    op.bulk_insert(
        product_table,
        [
            {
                "code": "ALPHA",
                "name": "Product Alpha",
                "description": "Demo product.",
                "status": "ACTIVE",
            },
            {
                "code": "BETA",
                "name": "Product Beta",
                "description": "Demo product.",
                "status": "ACTIVE",
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("product")
