import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AgentActionContract(Base):
    __tablename__ = "agent_action_contract"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student.id"), nullable=False)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agent_run.id"), nullable=False)
    task_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("task.id"), nullable=True)
    contract_text: Mapped[str] = mapped_column(Text, nullable=False)
    adaptive_level: Mapped[str] = mapped_column(String(20), nullable=False, default="standard")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    followup_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    followup_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    student: Mapped["Student"] = relationship("Student", back_populates="agent_contracts")
    run: Mapped["AgentRun"] = relationship("AgentRun")
    task: Mapped[Optional["Task"]] = relationship("Task")
