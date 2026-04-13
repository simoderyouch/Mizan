# app/schemas/resource.py
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.resource import ResourceType


class ResourceResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    category: str
    type: ResourceType
    url: str
    tags: List[str]
    mood_trigger: str
    ai_instruction: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ResourceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "General"
    type: ResourceType
    url: str
    tags: List[str]
    mood_trigger: str
    ai_instruction: Optional[str] = None


class ResourceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    type: Optional[ResourceType] = None
    url: Optional[str] = None
    tags: Optional[List[str]] = None
    mood_trigger: Optional[str] = None
    ai_instruction: Optional[str] = None