from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

NotificationType = Literal["info", "warning", "wellbeing", "task", "mode"]


class NotificationResponse(BaseModel):
    id: UUID
    student_id: UUID
    type: NotificationType | str
    title: str
    body: str
    payload: Optional[dict[str, Any]]
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationReadUpdate(BaseModel):
    is_read: bool = Field(default=True)
