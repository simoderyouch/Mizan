# Pydantic Settings — loads all environment variables from .env with type validation
# Expected settings:
#   DATABASE_URL: str
#   SECRET_KEY: str
#   ALGORITHM: str = "HS256"
#   ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
#   REFRESH_TOKEN_EXPIRE_DAYS: int = 7
#   MISTRAL_API_KEY: str
#   MISTRAL_MODEL: str = "mistral-large-latest"
#   APP_ENV: str = "development"
#   CLOUDINARY_CLOUD_NAME: str
#   CLOUDINARY_API_KEY: str
#   CLOUDINARY_API_SECRET: str
# app/core/config.py
import os
from pathlib import Path
from functools import lru_cache
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = os.path.join(BASE_DIR, ".env")


class Settings(BaseSettings):
    APP_ENV: str = "development"
    BACKEND_CORS_ORIGINS: str = (
        "http://localhost:3000,"
        "http://localhost:3001,"
        "http://localhost:8081,"
        "http://127.0.0.1:3000,"
        "http://127.0.0.1:3001"
    )
    ENABLE_SCHEDULER: bool = True
    
    DATABASE_URL: str
    USE_LOCAL_DATABASE: bool = False
    LOCAL_DATABASE_URL: str = ""
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800
    DB_POOL_PRE_PING: bool = True
    
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    AUTH_RATE_LIMIT_MAX_REQUESTS: int = 10
    AUTH_RATE_LIMIT_WINDOW_SECONDS: int = 60
    MAX_IMAGE_UPLOAD_BYTES: int = 5 * 1024 * 1024
    MAX_AUDIO_UPLOAD_BYTES: int = 25 * 1024 * 1024
    MAX_CSV_UPLOAD_BYTES: int = 5 * 1024 * 1024
    DAILY_WELLBEING_NOTIFICATION_CAP: int = 3
    
    MISTRAL_API_KEY: str
    MISTRAL_MODEL: str = "mistral-large-latest"
    MISTRAL_STT_MODEL: str = "voxtral-mini-latest"
    MISTRAL_STT_LANGUAGE: str = "fr"
    MISTRAL_REALTIME_MODEL: str = "voxtral-mini-transcribe-realtime-2602"
    MISTRAL_REALTIME_SAMPLE_RATE: int = 16000
    MISTRAL_REALTIME_TARGET_DELAY_MS: int = 700
    MISTRAL_REALTIME_SERVER_URL: str = "wss://api.mistral.ai"
    MISTRAL_TTS_MODEL: str = "voxtral-mini-tts-latest"
    MISTRAL_TTS_VOICE_ID: str = ""
    MISTRAL_TTS_VOICE: str = ""
    MISTRAL_TTS_OUTPUT_GAIN: float = 2.0
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str = ""

    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def validate_production_safety(self):
        if self.APP_ENV != "production":
            return self

        weak_secret_values = {
            "change-me",
            "change-me-in-production",
            "change-this-before-public-deploy",
            "secret",
            "your-secret-key",
        }
        normalized_secret = (self.SECRET_KEY or "").strip()
        if normalized_secret in weak_secret_values or len(normalized_secret) < 32:
            raise ValueError("SECRET_KEY must be a strong non-default value when APP_ENV=production")

        if "*" in self.cors_origins:
            raise ValueError("BACKEND_CORS_ORIGINS cannot include '*' when APP_ENV=production")

        database_url = self.resolved_database_url
        if ":postgres@" in database_url or database_url.endswith(":postgres"):
            raise ValueError("DATABASE_URL must not use the default postgres password when APP_ENV=production")

        return self

    @property
    def resolved_database_url(self) -> str:
        if self.USE_LOCAL_DATABASE:
            if not self.LOCAL_DATABASE_URL:
                raise ValueError("LOCAL_DATABASE_URL must be set when USE_LOCAL_DATABASE=true")
            return self.LOCAL_DATABASE_URL
        return self.DATABASE_URL

    @property
    def cors_origins(self) -> list[str]:
        origins = [
            origin.strip().rstrip("/")
            for origin in self.BACKEND_CORS_ORIGINS.split(",")
            if origin.strip()
        ]
        return origins or []


@lru_cache
def get_settings() -> Settings:
    return Settings()
