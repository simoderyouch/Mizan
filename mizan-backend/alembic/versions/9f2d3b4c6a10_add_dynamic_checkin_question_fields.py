"""add dynamic checkin question fields

Revision ID: 9f2d3b4c6a10
Revises: 4557bb1440f7
Create Date: 2026-04-12 17:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9f2d3b4c6a10"
down_revision: Union[str, None] = "4557bb1440f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("morning_checkin", sa.Column("question_set", sa.JSON(), nullable=True))
    op.add_column("morning_checkin", sa.Column("question_answers", sa.JSON(), nullable=True))
    op.add_column("evening_checkin", sa.Column("question_set", sa.JSON(), nullable=True))
    op.add_column("evening_checkin", sa.Column("question_answers", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("evening_checkin", "question_answers")
    op.drop_column("evening_checkin", "question_set")
    op.drop_column("morning_checkin", "question_answers")
    op.drop_column("morning_checkin", "question_set")
