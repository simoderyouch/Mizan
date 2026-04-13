# app/api/v1/routes/voice.py
from fastapi import APIRouter, Depends, File, UploadFile, WebSocket, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, get_db
from app.core.security import decode_token
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.voice import (
    VoiceAnalysisResponse,
    VoiceSessionResponse,
    VoiceSessionStart,
    VoiceSessionSubmit,
    VoiceChatRequest,
    VoiceChatResponse,
)
from app.services.student_service import get_student_by_user_id
from app.services.voice_service import (
    analyze_voice_responses,
    start_voice_session,
    transcribe_audio,
    chat_with_voice_agent,
    stream_realtime_transcription,
)
from app.services.autonomous_events import build_chat_event, publish_autonomous_event

router = APIRouter(prefix="/voice", tags=["Voice"])


def _extract_websocket_token(websocket: WebSocket) -> str:
    query_token = (websocket.query_params.get("token") or "").strip()
    if query_token:
        return query_token
    auth_header = (websocket.headers.get("authorization") or "").strip()
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    return ""


async def _authenticate_websocket_user(websocket: WebSocket) -> User | None:
    token = _extract_websocket_token(websocket)
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return None
    try:
        payload = decode_token(token)
        user_id = payload.get("user_id")
        if not user_id:
            raise JWTError("user_id missing")
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return None
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unknown user")
            return None
        return user


@router.post("/start", response_model=VoiceSessionResponse)
async def api_start_voice_session(
    data: VoiceSessionStart,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    return await start_voice_session(db, student.id, data.period)


@router.post("/transcribe")
async def api_transcribe_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    text = await transcribe_audio(file)
    return {"transcription": text}


@router.post("/submit", response_model=VoiceAnalysisResponse)
async def api_submit_voice_session(
    data: VoiceSessionSubmit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    return await analyze_voice_responses(db, student.id, data)


@router.post("/chat", response_model=VoiceChatResponse)
async def api_voice_chat(
    data: VoiceChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    response = await chat_with_voice_agent(db, student.id, data)
    await publish_autonomous_event(
        db,
        build_chat_event("VOICE", student_id=student.id, message=data.user_text),
    )
    return response


@router.websocket("/realtime")
async def api_voice_realtime(websocket: WebSocket):
    current_user = await _authenticate_websocket_user(websocket)
    if not current_user:
        return
    await websocket.accept()
    await stream_realtime_transcription(websocket)
