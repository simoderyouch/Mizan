"""repair wellbeing resource schema

Revision ID: b3e4d7f9a1c2
Revises: a7c9d1e2f3b4
Create Date: 2026-04-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b3e4d7f9a1c2"
down_revision: Union[str, None] = "a7c9d1e2f3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("wellbeing_resource"):
        op.create_table(
            "wellbeing_resource",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("description", sa.String(), nullable=True),
            sa.Column("category", sa.String(), nullable=False),
            sa.Column("type", sa.String(), nullable=False),
            sa.Column("url", sa.String(), nullable=False),
            sa.Column("tags", sa.JSON(), nullable=False),
            sa.Column("mood_trigger", sa.String(), nullable=False),
            sa.Column("ai_instruction", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        return

    column_names = {col["name"] for col in inspector.get_columns("wellbeing_resource")}

    if "description" not in column_names:
        op.add_column("wellbeing_resource", sa.Column("description", sa.String(), nullable=True))

    if "category" not in column_names:
        op.add_column("wellbeing_resource", sa.Column("category", sa.String(), nullable=True))
        op.execute("UPDATE wellbeing_resource SET category = 'General' WHERE category IS NULL")
        op.alter_column("wellbeing_resource", "category", nullable=False)

    if "ai_instruction" not in column_names:
        op.add_column("wellbeing_resource", sa.Column("ai_instruction", sa.String(), nullable=True))


def downgrade() -> None:
    pass
