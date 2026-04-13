# app/api/v1/routes/auth.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordSchema,
    LoginSchema,
    RefreshTokenSchema,
    RequestActivationSchema,
    SetPasswordSchema,
    TokenResponse,
    VerifyOtpSchema,
    CurrentUserResponse,
)
from app.schemas.institution import SchoolCreate, SchoolResponse
from app.services.auth_service import (
    change_password,
    login,
    refresh_access_token,
    request_activation,
    request_password_reset,
    set_password,
    verify_otp,
    verify_reset_otp,
)
from app.services.institutional_service import create_school

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/admin/register-school", response_model=SchoolResponse)
async def handle_register_school_admin(
    payload: SchoolCreate,
    db: AsyncSession = Depends(get_db)
):
    return await create_school(db, payload)


@router.post("/request-activation")
async def handle_request_activation(
    payload: RequestActivationSchema, db: AsyncSession = Depends(get_db)
):
    await request_activation(db, payload.email)
    return {"message": "OTP sent to your email"}


@router.post("/verify-otp")
async def handle_verify_otp(
    payload: VerifyOtpSchema, db: AsyncSession = Depends(get_db)
):
    token = await verify_otp(db, payload.email, payload.otp)
    return {"temp_token": token}


@router.post("/set-password", response_model=TokenResponse)
async def handle_set_password(
    payload: SetPasswordSchema, db: AsyncSession = Depends(get_db)
):
    return await set_password(db, payload.token, payload.new_password)


@router.post("/forgot-password")
async def handle_forgot_password(
    payload: RequestActivationSchema, db: AsyncSession = Depends(get_db)
):
    await request_password_reset(db, payload.email)
    return {"message": "OTP sent to your email"}


@router.post("/verify-reset-otp")
async def handle_verify_reset_otp(
    payload: VerifyOtpSchema, db: AsyncSession = Depends(get_db)
):
    token = await verify_reset_otp(db, payload.email, payload.otp)
    return {"temp_token": token}


@router.post("/reset-password", response_model=TokenResponse)
async def handle_reset_password(
    payload: SetPasswordSchema, db: AsyncSession = Depends(get_db)
):
    return await set_password(db, payload.token, payload.new_password)


@router.post("/login", response_model=TokenResponse)
async def handle_login(
    payload: LoginSchema, db: AsyncSession = Depends(get_db)
):
    return await login(payload.email, payload.password, db)


@router.post("/refresh")
async def handle_refresh(
    payload: RefreshTokenSchema, db: AsyncSession = Depends(get_db)
):
    token = await refresh_access_token(db, payload.refresh_token)
    return {"access_token": token["access_token"], "token_type": token["token_type"]}


@router.post("/change-password")
async def handle_change_password(
    payload: ChangePasswordSchema,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await change_password(db, current_user.id, payload.old_password, payload.new_password)
    return {"message": "Password changed successfully."}


@router.get("/me", response_model=CurrentUserResponse)
async def handle_get_current_user(
    current_user: User = Depends(get_current_user),
):
    return CurrentUserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        school_id=current_user.school_id,
    )
