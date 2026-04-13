# Pydantic schemas for work modes — ModeSessionCreate, ModeSessionResponse, ModeStats
# app/schemas/mode.py
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.mode_session import Mode


class ModeSessionCreate(BaseModel):
    mode: Mode


class ModeSessionResponse(BaseModel):
    id: UUID
    student_id: UUID
    mode: Mode
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class ModeStatItem(BaseModel):
    mode: Mode
    total_minutes: int
    percentage: float = 0.0


class ModeStatsResponse(BaseModel):
    today: List[ModeStatItem]
    this_week: List[ModeStatItem]
    current_session: Optional[ModeSessionResponse] = None
