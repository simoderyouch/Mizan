# app/models/student.py
import uuid
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional

from sqlalchemy import Date, DateTime, ForeignKey, JSON, String, Time, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Student(Base):
    __tablename__ = "student"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"), nullable=False)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("class.id"), nullable=False)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    cne: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    photo_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="student")
    class_: Mapped["Class"] = relationship("Class", back_populates="students")
    
    schedules: Mapped[List["Schedule"]] = relationship("Schedule", back_populates="student")
    exams: Mapped[List["Exam"]] = relationship("Exam", back_populates="student")
    projects: Mapped[List["Project"]] = relationship("Project", back_populates="student")
    
    morning_checkins: Mapped[List["MorningCheckin"]] = relationship("MorningCheckin", back_populates="student")
    evening_checkins: Mapped[List["EveningCheckin"]] = relationship("EveningCheckin", back_populates="student")
    goals: Mapped[List["Goal"]] = relationship("Goal", back_populates="student")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="student")
    mode_sessions: Mapped[List["ModeSession"]] = relationship("ModeSession", back_populates="student")
    voice_sessions: Mapped[List["VoiceSession"]] = relationship("VoiceSession", back_populates="student")
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="student")
    agent_runs: Mapped[List["AgentRun"]] = relationship("AgentRun", back_populates="student")
    agent_contracts: Mapped[List["AgentActionContract"]] = relationship(
        "AgentActionContract", back_populates="student"
    )


class Schedule(Base):
    __tablename__ = "schedule"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student.id"), nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    day_of_week: Mapped[str] = mapped_column(String, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    room: Mapped[str] = mapped_column(String, nullable=False)
    professor: Mapped[str] = mapped_column(String, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    student: Mapped["Student"] = relationship("Student", back_populates="schedules")


class Exam(Base):
    __tablename__ = "exam"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student.id"), nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    exam_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    room: Mapped[str] = mapped_column(String, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    student: Mapped["Student"] = relationship("Student", back_populates="exams")


class Project(Base):
    __tablename__ = "project"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    members: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    student: Mapped["Student"] = relationship("Student", back_populates="projects")
