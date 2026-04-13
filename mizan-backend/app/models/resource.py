# SQLAlchemy WellbeingResource model — links mental state tags to curated resource content
# app/models/resource.py
import enum
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import DateTime, JSON, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ResourceType(str, enum.Enum):
    VIDEO = "VIDEO"
    ARTICLE = "ARTICLE"
    EXERCISE = "EXERCISE"


class WellbeingResource(Base):
    __tablename__ = "wellbeing_resource"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    category: Mapped[str] = mapped_column(String, nullable=False, default="General")
    type: Mapped[ResourceType] = mapped_column(String, nullable=False)
    url: Mapped[str] = mapped_column(String, nullable=False)
    tags: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    mood_trigger: Mapped[str] = mapped_column(String, nullable=False)
    ai_instruction: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())