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
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_ENV: str = "development"
    
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

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def resolved_database_url(self) -> str:
        if self.USE_LOCAL_DATABASE:
            if not self.LOCAL_DATABASE_URL:
                raise ValueError("LOCAL_DATABASE_URL must be set when USE_LOCAL_DATABASE=true")
            return self.LOCAL_DATABASE_URL
        return self.DATABASE_URL


@lru_cache
def get_settings() -> Settings:
    return Settings()
