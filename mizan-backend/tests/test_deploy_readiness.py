import asyncio

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.core.config import Settings
from app.services.file_service import validate_audio_bytes, validate_image_file


class _FakeUploadFile:
    def __init__(self, content: bytes, filename: str, content_type: str | None = None):
        self._content = content
        self._position = 0
        self.filename = filename
        self.content_type = content_type
        self.size = len(content)

    async def read(self, size: int = -1) -> bytes:
        if size == -1:
            size = len(self._content) - self._position
        start = self._position
        end = min(len(self._content), start + size)
        self._position = end
        return self._content[start:end]

    async def seek(self, offset: int) -> None:
        self._position = offset


def _settings_kwargs(**overrides):
    values = {
        "APP_ENV": "production",
        "DATABASE_URL": "sqlite+aiosqlite:///tmp.db",
        "USE_LOCAL_DATABASE": False,
        "SECRET_KEY": "abcdefghijklmnopqrstuvwxyz1234567890",
        "BACKEND_CORS_ORIGINS": "https://mizan.example.com",
        "MISTRAL_API_KEY": "",
        "CLOUDINARY_CLOUD_NAME": "",
        "CLOUDINARY_API_KEY": "",
        "CLOUDINARY_API_SECRET": "",
    }
    values.update(overrides)
    return values


def test_production_settings_reject_weak_secret_key() -> None:
    with pytest.raises(ValidationError):
        Settings(**_settings_kwargs(SECRET_KEY="short"))


def test_production_settings_reject_wildcard_cors() -> None:
    with pytest.raises(ValidationError):
        Settings(**_settings_kwargs(BACKEND_CORS_ORIGINS="*"))


def test_production_settings_accept_locked_down_values() -> None:
    settings = Settings(**_settings_kwargs())
    assert settings.cors_origins == ["https://mizan.example.com"]


def test_audio_size_limit_is_enforced(monkeypatch) -> None:
    monkeypatch.setattr("app.services.file_service.settings.MAX_AUDIO_UPLOAD_BYTES", 3)
    with pytest.raises(HTTPException) as exc_info:
        validate_audio_bytes(b"1234")
    assert exc_info.value.status_code == 413


def test_image_size_limit_is_enforced(monkeypatch) -> None:
    monkeypatch.setattr("app.services.file_service.settings.MAX_IMAGE_UPLOAD_BYTES", 3)
    file = _FakeUploadFile(b"1234", "student.png", "image/png")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(validate_image_file(file))
    assert exc_info.value.status_code == 413
