"""add agent action contract table

Revision ID: a7c9d1e2f3b4
Revises: f4b7c9d2e1a0
Create Date: 2026-04-13 15:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "a7c9d1e2f3b4"
down_revision: Union[str, None] = "f4b7c9d2e1a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_action_contract",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("student.id"), nullable=False),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("agent_run.id"), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("task.id"), nullable=True),
        sa.Column("contract_text", sa.Text(), nullable=False),
        sa.Column("adaptive_level", sa.String(length=20), nullable=False, server_default="standard"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("followup_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("followup_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_agent_contract_student_created",
        "agent_action_contract",
        ["student_id", "created_at"],
    )
    op.create_index(
        "ix_agent_contract_student_status",
        "agent_action_contract",
        ["student_id", "status"],
    )
    op.create_index(
        "ix_agent_contract_followup_due",
        "agent_action_contract",
        ["followup_at", "followup_sent_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_agent_contract_followup_due", table_name="agent_action_contract")
    op.drop_index("ix_agent_contract_student_status", table_name="agent_action_contract")
    op.drop_index("ix_agent_contract_student_created", table_name="agent_action_contract")
    op.drop_table("agent_action_contract")
