# SQLAlchemy models for School, Filière (department), and Class (promotion) entities
# app/models/institution.py
import enum
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class VerificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class School(Base):
    __tablename__ = "school"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    
    official_identifier: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    verification_status: Mapped[VerificationStatus] = mapped_column(String, default=VerificationStatus.PENDING)
    verification_note: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    filieres: Mapped[List["Filiere"]] = relationship("Filiere", back_populates="school")
    admins: Mapped[List["User"]] = relationship("User", back_populates="school")


class Filiere(Base):
    __tablename__ = "filiere"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school.id"), nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    school: Mapped["School"] = relationship("School", back_populates="filieres")
    promotions: Mapped[List["Promotion"]] = relationship("Promotion", back_populates="filiere")


class Promotion(Base):
    __tablename__ = "promotion"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    filiere_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("filiere.id"), nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    filiere: Mapped["Filiere"] = relationship("Filiere", back_populates="promotions")
    classes: Mapped[List["Class"]] = relationship("Class", back_populates="promotion")


class Class(Base):
    __tablename__ = "class"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    promotion_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("promotion.id"), nullable=False)
    academic_year: Mapped[str] = mapped_column(String, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    promotion: Mapped["Promotion"] = relationship("Promotion", back_populates="classes")
    students: Mapped[List["Student"]] = relationship("Student", back_populates="class_")
