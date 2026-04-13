# app/services/auth_service.py
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    generate_otp,
    hash_password,
    send_otp_email,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import TokenResponse

settings = get_settings()


async def request_activation(db: AsyncSession, email: str) -> None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    if user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already activated")
        
    otp = generate_otp()
    user.activation_token = otp
    user.token_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    await db.commit()
    
    await asyncio.to_thread(send_otp_email, email, otp)


async def verify_otp(db: AsyncSession, email: str, otp: str) -> str:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    if user.activation_token != otp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")
        
    if not user.token_expires_at or user.token_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")
        
    to_encode = {
        "email": user.email,
        "purpose": "set_password",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10)
    }
    
    temp_token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return temp_token


async def request_password_reset(db: AsyncSession, email: str) -> None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account not activated")
        
    otp = generate_otp()
    user.activation_token = otp
    user.token_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    await db.commit()
    
    await asyncio.to_thread(send_otp_email, email, otp)


async def verify_reset_otp(db: AsyncSession, email: str, otp: str) -> str:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    if user.activation_token != otp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")
        
    if not user.token_expires_at or user.token_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")
        
    to_encode = {
        "email": user.email,
        "purpose": "reset_password",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10)
    }
    
    temp_token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return temp_token


async def set_password(db: AsyncSession, token: str, new_password: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("email")
        purpose = payload.get("purpose")
        
        if purpose not in ["set_password", "reset_password"] or not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")
        
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    user.password_hash = hash_password(new_password)
    user.is_active = True
    user.activation_token = None
    user.token_expires_at = None
    
    await db.commit()
    
    access_token = create_access_token({"user_id": str(user.id), "role": user.role})
    refresh_token = create_refresh_token({"user_id": str(user.id), "role": user.role})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


async def login(email: str, password: str, db: AsyncSession) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid credentials or user is not active"
        )
        
    if not verify_password(password, str(user.password_hash)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid credentials"
        )
        
    access_token = create_access_token({"user_id": str(user.id), "role": user.role})
    refresh_token = create_refresh_token({"user_id": str(user.id), "role": user.role})
    
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


async def refresh_access_token(db: AsyncSession, token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("user_id")
        role = payload.get("role")
        
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    new_access_token = create_access_token({"user_id": user_id, "role": role})
    
    return {"access_token": new_access_token, "token_type": "bearer"}


async def change_password(db: AsyncSession, user_id: uuid.UUID, old_password: str, new_password: str) -> None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not verify_password(old_password, str(user.password_hash)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    if old_password == new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be different")

    user.password_hash = hash_password(new_password)
    await db.commit()
