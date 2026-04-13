import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, JSON, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MorningCheckin(Base):
    __tablename__ = "morning_checkin"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    sleep_hours: Mapped[float] = mapped_column(Float, nullable=False)
    mood_score: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Advanced Ritual Override
    mode: Mapped[str] = mapped_column("mode", String, default="qcm", quote=True)
    executive_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    detailed_action_plan: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    detected_risks: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    question_set: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    question_answers: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    checkin_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    student: Mapped["Student"] = relationship("Student", back_populates="morning_checkins")


class EveningCheckin(Base):
    __tablename__ = "evening_checkin"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    plan_completed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    mood_score: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Advanced Ritual Override
    mode: Mapped[str] = mapped_column("mode", String, default="qcm", quote=True)
    executive_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    detailed_action_plan: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    detected_risks: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    question_set: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    question_answers: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    checkin_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    student: Mapped["Student"] = relationship("Student", back_populates="evening_checkins")
