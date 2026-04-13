"""add school admin scope

Revision ID: 2a9e5f7c1b22
Revises: d71384240321
Create Date: 2026-04-11 20:49:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "2a9e5f7c1b22"
down_revision = "d71384240321"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user", sa.Column("school_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_user_school_id", "user", "school", ["school_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_user_school_id", "user", type_="foreignkey")
    op.drop_column("user", "school_id")

