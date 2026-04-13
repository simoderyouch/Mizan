from datetime import date, time
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ScheduleCreate(BaseModel):
    subject: str = Field(min_length=1)
    day_of_week: str = Field(min_length=1)
    start_time: time
    end_time: time
    room: str = ""
    professor: str = ""


class ScheduleUpdate(BaseModel):
    subject: Optional[str] = Field(default=None, min_length=1)
    day_of_week: Optional[str] = Field(default=None, min_length=1)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    room: Optional[str] = None
    professor: Optional[str] = None


class ScheduleResponse(BaseModel):
    id: UUID
    student_id: UUID
    subject: str
    day_of_week: str
    start_time: time
    end_time: time
    room: str
    professor: str

    model_config = ConfigDict(from_attributes=True)


class ExamCreate(BaseModel):
    subject: str = Field(min_length=1)
    exam_date: date
    start_time: time
    end_time: time
    room: str = ""


class ExamUpdate(BaseModel):
    subject: Optional[str] = Field(default=None, min_length=1)
    exam_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    room: Optional[str] = None


class ExamResponse(BaseModel):
    id: UUID
    student_id: UUID
    subject: str
    exam_date: date
    start_time: time
    end_time: time
    room: str

    model_config = ConfigDict(from_attributes=True)


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1)
    subject: str = Field(min_length=1)
    due_date: date
    members: List[str] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    subject: Optional[str] = Field(default=None, min_length=1)
    due_date: Optional[date] = None
    members: Optional[List[str]] = None


class ProjectResponse(BaseModel):
    id: UUID
    student_id: UUID
    name: str
    subject: str
    due_date: date
    members: List[str]

    model_config = ConfigDict(from_attributes=True)
