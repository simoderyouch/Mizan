"""repair voice_session table

Revision ID: c8d4a6b9e2f1
Revises: b3e4d7f9a1c2
Create Date: 2026-05-20 16:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8d4a6b9e2f1"
down_revision: Union[str, None] = "b3e4d7f9a1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "voice_session" in inspector.get_table_names():
        return

    op.create_table(
        "voice_session",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("period", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("questions", sa.JSON(), nullable=False),
        sa.Column("transcriptions", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "voice_session" in inspector.get_table_names():
        op.drop_table("voice_session")
