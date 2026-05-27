# app/services/file_service.py
import os
import cloudinary
import cloudinary.uploader
import cloudinary.api
from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings

settings = get_settings()

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png")
IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png"}
CSV_EXTENSIONS = (".csv",)
CSV_CONTENT_TYPES = {"text/csv", "application/csv", "application/vnd.ms-excel"}
AUDIO_EXTENSIONS = (".webm", ".wav", ".mp3", ".m4a", ".aac", ".ogg", ".oga", ".opus")
AUDIO_CONTENT_TYPES = {
    "audio/webm",
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp4",
    "audio/aac",
    "audio/ogg",
    "audio/opus",
    "video/webm",
}

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True
)


def _cloudinary_configured() -> bool:
    return all(
        [
            (settings.CLOUDINARY_CLOUD_NAME or "").strip(),
            (settings.CLOUDINARY_API_KEY or "").strip(),
            (settings.CLOUDINARY_API_SECRET or "").strip(),
        ]
    )


def _ensure_cloudinary_configured() -> None:
    if not _cloudinary_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Photo storage is not configured on the server",
        )


async def upload_photo_to_cloudinary(file: UploadFile, public_id: str) -> str:
    _ensure_cloudinary_configured()
    try:
        full_public_id = f"mizan/students/{public_id}"
        result = cloudinary.uploader.upload(
            file.file,
            public_id=full_public_id,
            overwrite=True
        )
        return result.get("secure_url")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {str(e)}"
        )


def _normalized_filename(file: UploadFile) -> str:
    return os.path.basename(file.filename or "").lower()


def _normalized_content_type(file: UploadFile) -> str:
    return (file.content_type or "").split(";", 1)[0].strip().lower()


def _validate_extension(file: UploadFile, allowed_extensions: tuple[str, ...], message: str) -> None:
    filename = _normalized_filename(file)
    if not filename or not filename.endswith(allowed_extensions):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


def _validate_content_type(file: UploadFile, allowed_content_types: set[str], message: str) -> None:
    content_type = _normalized_content_type(file)
    if content_type and content_type not in allowed_content_types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


def _validate_declared_size(file: UploadFile, max_size_bytes: int, label: str) -> None:
    if file.size is not None and file.size > max_size_bytes:
        limit_mb = max_size_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"{label} exceeds {limit_mb}MB limit",
        )


async def _validate_actual_size(file: UploadFile, max_size_bytes: int, label: str) -> None:
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_size_bytes:
            await file.seek(0)
            limit_mb = max_size_bytes // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"{label} exceeds {limit_mb}MB limit",
            )
    await file.seek(0)


async def delete_photo_from_cloudinary(public_id: str) -> None:
    _ensure_cloudinary_configured()
    try:
        full_public_id = f"mizan/students/{public_id}"
        cloudinary.uploader.destroy(full_public_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete image: {str(e)}"
        )


async def validate_csv_file(file: UploadFile) -> None:
    _validate_extension(file, CSV_EXTENSIONS, "File must be a .csv")
    _validate_content_type(file, CSV_CONTENT_TYPES, "File content type must be CSV")
    _validate_declared_size(file, settings.MAX_CSV_UPLOAD_BYTES, "CSV file")
    await _validate_actual_size(file, settings.MAX_CSV_UPLOAD_BYTES, "CSV file")


async def validate_image_file(file: UploadFile) -> None:
    _validate_extension(file, IMAGE_EXTENSIONS, "File must be a .jpg, .jpeg, or .png")
    _validate_content_type(file, IMAGE_CONTENT_TYPES, "File content type must be JPEG or PNG")
    _validate_declared_size(file, settings.MAX_IMAGE_UPLOAD_BYTES, "Image file")
    await _validate_actual_size(file, settings.MAX_IMAGE_UPLOAD_BYTES, "Image file")


def validate_audio_file_metadata(file: UploadFile) -> None:
    _validate_extension(file, AUDIO_EXTENSIONS, "Audio file extension is not supported")
    _validate_content_type(file, AUDIO_CONTENT_TYPES, "Audio content type is not supported")
    _validate_declared_size(file, settings.MAX_AUDIO_UPLOAD_BYTES, "Audio file")


def validate_audio_bytes(audio_bytes: bytes) -> None:
    if len(audio_bytes) > settings.MAX_AUDIO_UPLOAD_BYTES:
        limit_mb = settings.MAX_AUDIO_UPLOAD_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Audio file exceeds {limit_mb}MB limit",
        )
