# Pydantic schemas for check-ins — MorningCheckinCreate, EveningCheckinCreate, PlanResponse
# app/schemas/checkin.py
from datetime import date, datetime
from typing import Any, Literal, Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


AnswerType = Literal["text", "number", "scale", "time_hours", "single_choice", "multi_choice", "boolean", "voice_text"]
TargetField = Literal["mood_score", "sleep_hours", "plan_completed", "notes", "context"]


class CheckinQuestion(BaseModel):
    id: str
    text: str
    answer_type: AnswerType
    required: bool = True
    options: Optional[List[str]] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    step: Optional[float] = None
    target_field: Optional[TargetField] = None


class CheckinAnswer(BaseModel):
    question_id: str
    value: Any


class MorningCheckinCreate(BaseModel):
    sleep_hours: Optional[float] = Field(default=None, ge=0, le=16)
    mood_score: Optional[int] = Field(default=None, ge=1, le=5)
    mode: str = "qcm"
    question_set: Optional[List[CheckinQuestion]] = None
    responses: Optional[List[CheckinAnswer]] = None
    executive_summary: Optional[str] = None
    detailed_action_plan: Optional[List[str]] = None
    detected_risks: Optional[List[str]] = None

class EveningCheckinCreate(BaseModel):
    plan_completed: Optional[bool] = None
    mood_score: Optional[int] = Field(default=None, ge=1, le=5)
    notes: Optional[str] = None
    mode: str = "qcm"
    question_set: Optional[List[CheckinQuestion]] = None
    responses: Optional[List[CheckinAnswer]] = None
    executive_summary: Optional[str] = None
    detailed_action_plan: Optional[List[str]] = None
    detected_risks: Optional[List[str]] = None

    @field_validator("plan_completed", mode="before")
    @classmethod
    def _normalize_plan_completed(cls, value: Any) -> Any:
        if value is None or isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "yes", "oui", "1", "done", "completed"}:
                return True
            if normalized in {"false", "no", "non", "0", "not_done", "incomplete"}:
                return False
        return value


class PersonalizedCheckinQuestionsResponse(BaseModel):
    period: Literal["MORNING", "EVENING"]
    mode: Literal["qcm", "voice"]
    questions: List[CheckinQuestion]


class MorningCheckinResponse(BaseModel):
    id: UUID
    student_id: UUID
    date: date
    sleep_hours: float
    mood_score: int
    mode: str
    executive_summary: Optional[str]
    detailed_action_plan: Optional[List[str]]
    detected_risks: Optional[List[str]]
    question_set: Optional[List[CheckinQuestion]]
    question_answers: Optional[List[CheckinAnswer]]
    checkin_time: datetime

    model_config = ConfigDict(from_attributes=True)


class EveningCheckinResponse(BaseModel):
    id: UUID
    student_id: UUID
    date: date
    plan_completed: bool
    mood_score: int
    notes: Optional[str]
    mode: str
    executive_summary: Optional[str]
    detailed_action_plan: Optional[List[str]]
    detected_risks: Optional[List[str]]
    question_set: Optional[List[CheckinQuestion]]
    question_answers: Optional[List[CheckinAnswer]]
    checkin_time: datetime

    model_config = ConfigDict(from_attributes=True)
