"""add company stamp filename

Revision ID: 3b55f065b21e
Revises: 766c0ee8f89a
Create Date: 2026-09-24 10:09:28.539518

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3b55f065b21e'
down_revision: Union[str, Sequence[str], None] = '766c0ee8f89a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "company",
        sa.Column("stamp_filename", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("company", "stamp_filename")
