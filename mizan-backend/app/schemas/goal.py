# Pydantic schemas for personal goals — GoalCreate, GoalUpdate, GoalResponse, GoalProgressResponse
# app/schemas/goal.py
from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GoalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    target_value: float = Field(gt=0)
    unit: str = Field(min_length=1, max_length=40)


class GoalProgressCreate(BaseModel):
    goal_id: UUID
    value: float = Field(gt=0)
    note: Optional[str] = Field(default=None, max_length=300)


class GoalResponse(BaseModel):
    id: UUID
    student_id: UUID
    title: str
    target_value: float
    unit: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GoalProgressResponse(BaseModel):
    id: UUID
    goal_id: UUID
    date: date
    value: float
    note: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GoalWithProgressResponse(BaseModel):
    id: UUID
    student_id: UUID
    title: str
    target_value: float
    unit: str
    is_active: bool
    today_progress: float
    total_progress: float
    completion_percentage: float
    remaining_value: float
    is_achieved: bool
    progress_history: List[GoalProgressResponse]
