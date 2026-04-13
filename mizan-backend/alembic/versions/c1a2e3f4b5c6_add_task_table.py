"""add task table

Revision ID: c1a2e3f4b5c6
Revises: 9f2d3b4c6a10
Create Date: 2026-04-12 21:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "c1a2e3f4b5c6"
down_revision: Union[str, None] = "9f2d3b4c6a10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "task",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("student.id"), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False, server_default="chat"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_task_student_due", "task", ["student_id", "due_date"])
    op.create_index("ix_task_student_status", "task", ["student_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_task_student_status", table_name="task")
    op.drop_index("ix_task_student_due", table_name="task")
    op.drop_table("task")
