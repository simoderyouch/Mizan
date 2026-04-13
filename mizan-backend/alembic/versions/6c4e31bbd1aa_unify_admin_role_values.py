"""unify admin role values

Revision ID: 6c4e31bbd1aa
Revises: 2a9e5f7c1b22
Create Date: 2026-04-11 21:15:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "6c4e31bbd1aa"
down_revision = "2a9e5f7c1b22"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE \"user\" SET role = 'ADMIN' WHERE role = 'SCHOOL_ADMIN'")


def downgrade() -> None:
    op.execute("UPDATE \"user\" SET role = 'SCHOOL_ADMIN' WHERE role = 'ADMIN' AND school_id IS NOT NULL")
