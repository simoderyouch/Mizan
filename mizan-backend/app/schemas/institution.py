# Pydantic schemas for institutional entities — SchoolCreate, FiliereCreate, ClassCreate, responses
# app/schemas/institution.py
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SchoolCreate(BaseModel):
    name: str = Field(min_length=1)
    admin_email: str
    admin_password: str = Field(min_length=8)
    official_identifier: str = Field(min_length=3)
    contact_phone: str = Field(min_length=8)


class SchoolResponse(BaseModel):
    id: UUID
    name: str
    official_identifier: Optional[str] = None
    contact_phone: Optional[str] = None
    verification_status: str
    verification_note: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FiliereCreate(BaseModel):
    name: str
    school_id: Optional[UUID] = None


class FiliereResponse(BaseModel):
    id: UUID
    name: str
    school_id: UUID

    model_config = ConfigDict(from_attributes=True)


class PromotionCreate(BaseModel):
    name: str
    filiere_id: UUID


class PromotionResponse(BaseModel):
    id: UUID
    name: str
    filiere_id: UUID

    model_config = ConfigDict(from_attributes=True)


class ClassCreate(BaseModel):
    name: str
    promotion_id: UUID
    academic_year: str


class ClassResponse(BaseModel):
    id: UUID
    name: str
    promotion_id: UUID
    academic_year: str

    model_config = ConfigDict(from_attributes=True)


class SchoolVerify(BaseModel):
    status: str # VERIFIED or REJECTED
    note: Optional[str] = None
