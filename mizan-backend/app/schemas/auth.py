# app/schemas/auth.py
from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional


class RequestActivationSchema(BaseModel):
    email: str


class VerifyOtpSchema(BaseModel):
    email: str
    otp: str


class SetPasswordSchema(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class LoginSchema(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenSchema(BaseModel):
    refresh_token: str


class ChangePasswordSchema(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)


class CurrentUserResponse(BaseModel):
    id: UUID
    email: str
    role: str
    school_id: Optional[UUID] = None
