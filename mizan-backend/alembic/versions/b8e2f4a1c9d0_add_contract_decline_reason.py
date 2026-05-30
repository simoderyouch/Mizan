"""add contract decline_reason

Revision ID: b8e2f4a1c9d0
Revises: a7c9d1e2f3b4
Create Date: 2026-05-29

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8e2f4a1c9d0"
down_revision: Union[str, Sequence[str], None] = "c8d4a6b9e2f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agent_action_contract",
        sa.Column("decline_reason", sa.String(length=40), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("agent_action_contract", "decline_reason")
