"""add our company and company details

Revision ID: 5e7c1a9d4b2f
Revises: 3b55f065b21e
Create Date: 2026-09-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5e7c1a9d4b2f"
down_revision: Union[str, Sequence[str], None] = "3b55f065b21e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "our_company",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "name",
            sa.String(length=255),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "director_name",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "director_position",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "phone",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "email",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "logo_filename",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "stamp_filename",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "signature_filename",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "ecp_reference",
            sa.String(length=500),
            nullable=True,
        ),
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
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "our_company_details",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "our_company_id",
            sa.Integer(),
            sa.ForeignKey(
                "our_company.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "name",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "legal_address",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "actual_address",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "registration_number",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "tax_number",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "vat_number",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "bank_name",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "iban",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "swift",
            sa.String(length=50),
            nullable=True,
        ),
        sa.Column(
            "additional_details",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "idx_our_company_details_company_id",
        "our_company_details",
        ["our_company_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_our_company_details_company_id",
        table_name="our_company_details",
    )
    op.drop_table("our_company_details")
    op.drop_table("our_company")
