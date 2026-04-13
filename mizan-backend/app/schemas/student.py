# Pydantic schemas for students — StudentResponse, ScheduleCreate, ExamCreate, ProjectCreate
# app/schemas/student.py
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StudentResponse(BaseModel):
    id: UUID
    user_id: UUID
    class_id: UUID
    class_name: Optional[str] = None
    filiere_name: Optional[str] = None
    first_name: str
    last_name: str
    cne: str
    email: Optional[str] = None
    phone: Optional[str] = None
    photo_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StudentCreateAdmin(BaseModel):
    email: str
    class_id: UUID
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    cne: str = Field(min_length=1)
    phone: Optional[str] = None
    photo_url: Optional[str] = None


class StudentUpdateAdmin(BaseModel):
    class_id: Optional[UUID] = None
    first_name: Optional[str] = Field(default=None, min_length=1)
    last_name: Optional[str] = Field(default=None, min_length=1)
    cne: Optional[str] = Field(default=None, min_length=1)
    phone: Optional[str] = None
    photo_url: Optional[str] = None


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


class ExamResponse(BaseModel):
    id: UUID
    student_id: UUID
    subject: str
    exam_date: date
    start_time: time
    end_time: time
    room: str

    model_config = ConfigDict(from_attributes=True)


class ProjectResponse(BaseModel):
    id: UUID
    student_id: UUID
    name: str
    subject: str
    due_date: date
    members: List[str]

    model_config = ConfigDict(from_attributes=True)
