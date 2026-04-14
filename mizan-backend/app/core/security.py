# app/core/security.py
import os
import random
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


settings = get_settings()
SMTP_SERVER = settings.SMTP_SERVER
SMTP_PORT = settings.SMTP_PORT
SMTP_USER = settings.SMTP_USER
SMTP_PASSWORD = settings.SMTP_PASSWORD

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def generate_otp() -> str:
    return f"{random.randint(100000, 999999)}"


def send_otp_email(email: str, otp: str) -> None:
    if not SMTP_USER or not SMTP_PASSWORD:
        raise RuntimeError("SMTP credentials are not configured")
        
    msg = EmailMessage()
    msg.set_content(f"Votre code d'activation est : {otp}")
    msg["Subject"] = "Activation de votre compte"
    msg["From"] = SMTP_USER
    msg["To"] = email

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as exc:
        raise RuntimeError(f"Failed to send OTP email: {exc}") from exc


def send_school_approval_email(email: str, school_name: str) -> None:
    if not SMTP_USER or not SMTP_PASSWORD:
        return # Optionally log this
        
    msg = EmailMessage()
    msg.set_content(
        f"Félicitations !\n\n"
        f"Votre demande pour l'école '{school_name}' a été approuvée par l'administrateur Mizan.\n"
        f"Vous pouvez maintenant vous connecter à votre compte administrateur avec votre email et le mot de passe que vous avez choisi lors de l'inscription.\n\n"
        f"L'équipe Mizan"
    )
    msg["Subject"] = "Votre École a été approuvée - Mizan"
    msg["From"] = f"Mizan Platform <{SMTP_USER}>"
    msg["To"] = email

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as exc:
        print(f"Failed to send school approval email: {exc}")


def send_school_rejection_email(email: str, school_name: str, note: Optional[str] = None) -> None:
    if not SMTP_USER or not SMTP_PASSWORD:
        return
        
    msg = EmailMessage()
    rejection_details = f"\nNote de l'administrateur : {note}" if note else ""
    msg.set_content(
        f"Bonjour,\n\n"
        f"Nous avons examiné votre demande pour l'école '{school_name}' et nous regrettons de vous informer qu'elle a été refusée pour le moment.{rejection_details}\n\n"
        f"N'hésitez pas à nous contacter pour plus d'informations.\n\n"
        f"L'équipe Mizan"
    )
    msg["Subject"] = "Mise à jour concernant votre demande d'École - Mizan"
    msg["From"] = f"Mizan Platform <{SMTP_USER}>"
    msg["To"] = email

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as exc:
        print(f"Failed to send school rejection email: {exc}")
