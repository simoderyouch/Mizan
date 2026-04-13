"""add agent run and notifications

Revision ID: f4b7c9d2e1a0
Revises: c1a2e3f4b5c6
Create Date: 2026-04-13 14:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "f4b7c9d2e1a0"
down_revision: Union[str, None] = "c1a2e3f4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notification",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("student.id"), nullable=False),
        sa.Column("type", sa.String(length=30), nullable=False, server_default="info"),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_notification_student_created", "notification", ["student_id", "created_at"])
    op.create_index("ix_notification_student_read", "notification", ["student_id", "is_read"])

    op.create_table(
        "agent_run",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("student.id"), nullable=False),
        sa.Column("trigger_type", sa.String(length=60), nullable=False),
        sa.Column("idempotency_key", sa.String(length=160), nullable=False, unique=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="skipped"),
        sa.Column("reasoning_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_agent_run_student_created", "agent_run", ["student_id", "created_at"])
    op.create_index("ix_agent_run_trigger", "agent_run", ["trigger_type"])

    op.create_table(
        "agent_decision",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("agent_run.id"), nullable=False),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("thought", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_agent_decision_run_created", "agent_decision", ["run_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_agent_decision_run_created", table_name="agent_decision")
    op.drop_table("agent_decision")

    op.drop_index("ix_agent_run_trigger", table_name="agent_run")
    op.drop_index("ix_agent_run_student_created", table_name="agent_run")
    op.drop_table("agent_run")

    op.drop_index("ix_notification_student_read", table_name="notification")
    op.drop_index("ix_notification_student_created", table_name="notification")
    op.drop_table("notification")
