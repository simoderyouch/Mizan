from datetime import date, datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

TaskStatus = Literal["pending", "in_progress", "done"]
TaskSource = Literal["morning_checkin", "chat", "voice_chat", "manual"]


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    description: Optional[str] = Field(default=None, max_length=1200)
    due_date: Optional[date] = None
    source: TaskSource = "chat"


class TaskBulkCreate(BaseModel):
    tasks: List[TaskCreate] = Field(min_length=1, max_length=20)


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=180)
    description: Optional[str] = Field(default=None, max_length=1200)
    due_date: Optional[date] = None


class TaskBulkComplete(BaseModel):
    task_ids: List[UUID] = Field(min_length=1, max_length=100)


class TaskResponse(BaseModel):
    id: UUID
    student_id: UUID
    title: str
    description: Optional[str]
    due_date: date
    source: TaskSource | str
    status: TaskStatus | str
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskSuggestionItem(BaseModel):
    title: str
    description: Optional[str] = None


class ChatTaskSuggestionRequest(BaseModel):
    user_message: str = Field(min_length=1, max_length=2000)
    assistant_message: str = Field(min_length=1, max_length=4000)


class TaskSuggestionResponse(BaseModel):
    suggestions: List[TaskSuggestionItem]
