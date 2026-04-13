# app/services/voice_service.py
import base64
import asyncio
import json
import logging
import os
import shutil
import subprocess
import tempfile
from datetime import date, datetime, timezone
from json import JSONDecodeError
from typing import Any, List, Optional
from uuid import UUID

from fastapi import HTTPException, UploadFile, WebSocket, WebSocketDisconnect, status
import httpx
from mistralai.client import Mistral
from sqlalchemy import and_, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.checkin import EveningCheckin, MorningCheckin
from app.models.voice_session import VoiceSession, VoiceSessionStatus
from app.schemas.voice import (
    VoiceAnalysisResponse,
    VoiceQuestion,
    VoiceSessionResponse,
    VoiceSessionSubmit,
    VoiceChatRequest,
    VoiceChatResponse,
)
from app.services.autonomous_events import build_checkin_event, publish_autonomous_event
from app.services.checkin_service import has_morning_checkin_today
from app.services.context_builder import build_agent_context
from app.services.question_service import generate_personalized_questions

settings = get_settings()
logger = logging.getLogger(__name__)


def _normalize_period(period: str) -> str:
    normalized = (period or "").upper().strip()
    if normalized not in {"MORNING", "EVENING"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Period must be MORNING or EVENING")
    return normalized


def _normalize_session_status(status_value: Any) -> str:
    if hasattr(status_value, "value"):
        return str(status_value.value)
    raw = str(status_value)
    if raw.startswith("VoiceSessionStatus."):
        return raw.split(".", 1)[1]
    return raw


def _normalize_mood_score(raw_value: Any) -> int:
    try:
        parsed = int(round(float(raw_value)))
    except (TypeError, ValueError):
        parsed = 3
    return max(1, min(5, parsed))


def _normalize_sleep_hours(raw_value: Any) -> Optional[float]:
    if raw_value in (None, ""):
        return None
    try:
        parsed = float(raw_value)
    except (TypeError, ValueError):
        return None
    return round(max(0.0, min(16.0, parsed)), 2)


def _normalize_plan_completed(raw_value: Any) -> bool:
    if isinstance(raw_value, bool):
        return raw_value
    if isinstance(raw_value, (int, float)):
        return raw_value != 0
    if isinstance(raw_value, str):
        return raw_value.strip().lower() in {"true", "yes", "oui", "1", "done"}
    return False


def _normalize_recommendations(raw_value: Any) -> List[str]:
    if not isinstance(raw_value, list):
        return []
    recommendations: List[str] = []
    for item in raw_value:
        text = str(item).strip() if item is not None else ""
        if text and text not in recommendations:
            recommendations.append(text)
        if len(recommendations) >= 4:
            break
    return recommendations


def _fallback_recommendations(period: str, mood_score: int, sleep_hours: Optional[float]) -> List[str]:
    if period == "MORNING":
        recommendations = [
            "Set one priority focus block (30-45 min) and start it within the next hour.",
            "Write your top 3 tasks for today and pick one realistic deadline for each.",
        ]
        if sleep_hours is not None and sleep_hours < 6:
            recommendations.insert(
                1,
                "Add a short 20-minute recovery break before your most demanding study/work block.",
            )
        if mood_score <= 2:
            recommendations.append(
                "Do a 5-minute breathing reset, then begin with a small easy task to build momentum.",
            )
        return recommendations[:4]

    recommendations = [
        "Pick one short shutdown task now so tomorrow starts with less pressure.",
        "Prepare your first task for tomorrow before you sleep.",
    ]
    if mood_score <= 2:
        recommendations.append("Take a short calming routine before bed and reduce screen time.")
    return recommendations[:4]


def _compose_checkin_note(analysis: str, recommendations: List[str]) -> str:
    if not recommendations:
        return analysis
    recommendation_lines = "\n".join([f"- {rec}" for rec in recommendations])
    return f"{analysis}\n\nRecommendations:\n{recommendation_lines}"


def _extract_message_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                if item.strip():
                    parts.append(item.strip())
                continue
            text_value = ""
            if isinstance(item, dict):
                text_value = str(item.get("text", "")).strip()
            else:
                text_value = str(getattr(item, "text", "")).strip()
            if text_value:
                parts.append(text_value)
        return " ".join(parts).strip()
    return str(content or "").strip()


def _extract_chat_response_text(response: Any) -> str:
    choices = getattr(response, "choices", None)
    if not choices:
        return ""
    first_choice = choices[0]
    message = getattr(first_choice, "message", None)
    if message is None:
        return ""
    content = getattr(message, "content", "")
    return _extract_message_text(content)


def _validate_transcriptions(
    transcriptions: list,
    session_questions: list[dict],
) -> None:
    expected_question_count = len(session_questions or [])
    if not transcriptions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one transcription is required",
        )
    if len(transcriptions) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least two transcriptions are required for analysis",
        )

    seen_indexes = set()
    question_ids = {str(q.get("id", "")).strip() for q in session_questions if isinstance(q, dict)}
    for item in transcriptions:
        text = item.transcription.strip()
        if not text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transcriptions cannot be empty",
            )
        if item.question_index in seen_indexes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each question index must appear only once",
            )
        if expected_question_count and item.question_index >= expected_question_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A transcription references a non-existent question",
            )
        if item.question_id:
            if str(item.question_id).strip() not in question_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A transcription references an unknown question id",
                )
        seen_indexes.add(item.question_index)


async def get_questions_for_student(db: AsyncSession, student_id: UUID, period: str) -> List[dict]:
    period = _normalize_period(period)
    context = await build_agent_context(db, student_id)
    generated = await generate_personalized_questions(context, period, "voice")
    questions: list[dict] = []
    for idx, item in enumerate(generated):
        if not isinstance(item, dict):
            continue
        text = str(item.get("text", "")).strip()
        if not text:
            continue
        questions.append(
            {
                "id": str(item.get("id", f"q_{idx+1}")).strip() or f"q_{idx+1}",
                "text": text,
                "answer_type": "voice_text",
                "target_field": item.get("target_field"),
            }
        )
    return questions[:8]


def _apply_tts_output_gain(audio_bytes: bytes) -> bytes:
    gain = max(0.1, min(4.0, float(settings.MISTRAL_TTS_OUTPUT_GAIN)))
    if abs(gain - 1.0) < 1e-6:
        return audio_bytes

    ffmpeg_binary = shutil.which("ffmpeg")
    if not ffmpeg_binary:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Voice amplification requires ffmpeg on the backend server",
        )

    input_path: str | None = None
    output_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as input_file:
            input_file.write(audio_bytes)
            input_path = input_file.name

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as output_file:
            output_path = output_file.name

        command = [
            ffmpeg_binary,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            input_path,
            "-filter:a",
            f"volume={gain}",
            "-c:a",
            "libmp3lame",
            "-q:a",
            "2",
            output_path,
        ]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "unknown ffmpeg error").strip()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Voice amplification failed: {detail}",
            )

        with open(output_path, "rb") as boosted_file:
            boosted_bytes = boosted_file.read()

        if not boosted_bytes:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Voice amplification failed: empty audio output",
            )
        return boosted_bytes
    finally:
        if input_path and os.path.exists(input_path):
            os.remove(input_path)
        if output_path and os.path.exists(output_path):
            os.remove(output_path)


async def text_to_speech(text: str) -> bytes:
    text = (text or "").strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text is empty")
    if not settings.MISTRAL_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Voice synthesis is not configured on the server",
        )
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            voice_id = settings.MISTRAL_TTS_VOICE_ID.strip()
            voice = settings.MISTRAL_TTS_VOICE.strip()
            if not voice_id and not voice:
                voices_response = await client.get(
                    "https://api.mistral.ai/v1/audio/voices",
                    headers={"Authorization": f"Bearer {settings.MISTRAL_API_KEY}"},
                )
                if voices_response.status_code >= 400:
                    detail = voices_response.text
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Voice synthesis provider error: unable to list voices ({detail})",
                    )
                voices_payload = voices_response.json()
                voices = voices_payload.get("items") if isinstance(voices_payload, dict) else None
                if isinstance(voices, list):
                    first_voice = voices[0] if voices else {}
                    voice = str((first_voice or {}).get("slug", "")).strip()
                    if not voice:
                        voice = str((first_voice or {}).get("id", "")).strip()
                if not voice:
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Voice synthesis is not configured on the server (no Mistral voice found)",
                    )
            payload = {
                "model": settings.MISTRAL_TTS_MODEL,
                "input": text,
                "response_format": "mp3",
            }
            if voice_id:
                payload["voice_id"] = voice_id
            else:
                payload["voice"] = voice
            response = await client.post(
                "https://api.mistral.ai/v1/audio/speech",
                headers={
                    "Authorization": f"Bearer {settings.MISTRAL_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if response.status_code >= 400:
            detail = response.text
            try:
                payload = response.json()
                detail = payload.get("error", {}).get("message", detail)
            except Exception:
                pass
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Voice synthesis provider error: {detail}")
        content_type = str(response.headers.get("content-type", "")).lower()
        audio_bytes = b""
        if "application/json" in content_type:
            payload = response.json()
            audio_b64 = ""
            if isinstance(payload, dict):
                audio_b64 = str(payload.get("audio_data", "")).strip() or str(payload.get("audio", "")).strip()
            if audio_b64:
                try:
                    audio_bytes = base64.b64decode(audio_b64)
                except Exception as exc:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Voice synthesis provider error: invalid audio payload ({exc})",
                    ) from exc
        else:
            audio_bytes = response.content or b""
        if not audio_bytes:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Empty speech response from voice provider")
        return await asyncio.to_thread(_apply_tts_output_gain, audio_bytes)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Voice synthesis provider error: {exc}",
        ) from exc


async def speech_to_text(
    audio_bytes: bytes,
    file_name: str | None = None,
    content_type: str | None = None,
) -> str:
    if not audio_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Audio file is empty")
    if len(audio_bytes) < 2048:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio recording is too short. Please speak a bit longer and try again.",
        )
    if not settings.MISTRAL_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Voice transcription is not configured on the server",
        )

    normalized_content_type = (content_type or "audio/webm").split(";", 1)[0].strip() or "audio/webm"
    normalized_file_name = (file_name or "audio.webm").strip() or "audio.webm"

    async def _transcribe(language: str | None) -> tuple[str | None, str | None]:
        sdk_error: str | None = None
        try:
            from mistralai.client.models import File as MistralFile

            client = Mistral(api_key=settings.MISTRAL_API_KEY)
            file_payload = MistralFile(
                file_name=normalized_file_name,
                content=audio_bytes,
                content_type=normalized_content_type,
            )
            kwargs: dict[str, Any] = {
                "model": settings.MISTRAL_STT_MODEL,
                "file": file_payload,
                "timeout_ms": 120000,
            }
            if language:
                kwargs["language"] = language
            transcription = await asyncio.to_thread(client.audio.transcriptions.complete, **kwargs)
            text = str(getattr(transcription, "text", "")).strip()
            if text:
                return text, None
            sdk_error = "empty transcription response"
        except Exception as exc:
            sdk_error = str(exc)

        data = {"model": settings.MISTRAL_STT_MODEL}
        if language:
            data["language"] = language
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post(
                    "https://api.mistral.ai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {settings.MISTRAL_API_KEY}"},
                    data=data,
                    files={"file": (normalized_file_name, audio_bytes, normalized_content_type)},
                )
        except Exception as exc:
            return None, f"request failed: {exc}"

        if response.status_code >= 400:
            detail = response.text
            try:
                payload = response.json()
                detail = payload.get("error", {}).get("message", detail)
            except Exception:
                pass
            combined = f"HTTP {response.status_code}: {detail}"
            if sdk_error:
                combined = f"{combined} | SDK: {sdk_error}"
            return None, combined

        payload = response.json()
        text = str((payload or {}).get("text", "")).strip()
        if not text:
            text = str((payload or {}).get("transcript", "")).strip()
        if not text:
            return None, f"empty transcription response (SDK: {sdk_error})" if sdk_error else "empty transcription response"
        return text, None

    try:
        text, err = await _transcribe(settings.MISTRAL_STT_LANGUAGE or None)
        if text:
            return text

        # Retry without forced language to improve compatibility for mixed/unknown audio.
        retry_text, retry_err = await _transcribe(None)
        if retry_text:
            return retry_text

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Voice transcription provider error: {retry_err or err or 'unknown error'}",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Voice transcription provider error: {exc}",
        ) from exc


async def start_voice_session(db: AsyncSession, student_id: UUID, period: str) -> VoiceSessionResponse:
    period = _normalize_period(period)
    raw_questions = await get_questions_for_student(db, student_id, period)
    if not raw_questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No voice questions available")

    session = VoiceSession(
        student_id=student_id,
        period=period,
        status=VoiceSessionStatus.IN_PROGRESS.value,
        questions=raw_questions,
        transcriptions=None,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    questions = []
    for idx, question in enumerate(raw_questions):
        question_text = str(question.get("text", ""))
        audio_bytes = b""
        if question_text:
            try:
                audio_bytes = await text_to_speech(question_text)
            except Exception as exc:
                logger.warning("TTS generation failed for voice question %s: %s", idx, exc)
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8") if audio_bytes else ""
        questions.append(
            VoiceQuestion(
                index=idx,
                id=str(question.get("id", f"q_{idx+1}")),
                text=question_text,
                answer_type="voice_text",
                target_field=question.get("target_field"),
                audio_base64=audio_base64,
            )
        )

    first_audio_base64 = questions[0].audio_base64 or "" if questions else ""

    return VoiceSessionResponse(
        session_id=str(session.id),
        questions=questions,
        first_audio_base64=first_audio_base64
    )


async def transcribe_audio(audio_file: UploadFile) -> str:
    audio_bytes = await audio_file.read()
    return await speech_to_text(
        audio_bytes,
        file_name=audio_file.filename,
        content_type=audio_file.content_type,
    )


async def stream_realtime_transcription(websocket: WebSocket) -> None:
    if not settings.MISTRAL_API_KEY:
        await websocket.send_json({"type": "error", "message": "Mistral API key is not configured."})
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return

    try:
        from mistralai.client.models import AudioFormat
    except Exception as exc:
        await websocket.send_json({"type": "error", "message": f"Mistral realtime SDK is unavailable: {exc}"})
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return

    client = Mistral(api_key=settings.MISTRAL_API_KEY)
    audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue(maxsize=256)
    closed = False

    async def audio_stream():
        while True:
            chunk = await audio_queue.get()
            if chunk is None:
                break
            if chunk:
                yield chunk

    async def forward_realtime_events():
        try:
            audio_format = AudioFormat(
                encoding="pcm_s16le",
                sample_rate=settings.MISTRAL_REALTIME_SAMPLE_RATE,
            )
            async for event in client.audio.realtime.transcribe_stream(
                audio_stream=audio_stream(),
                model=settings.MISTRAL_REALTIME_MODEL,
                audio_format=audio_format,
                target_streaming_delay_ms=settings.MISTRAL_REALTIME_TARGET_DELAY_MS,
                server_url=settings.MISTRAL_REALTIME_SERVER_URL or None,
                timeout_ms=180000,
            ):
                event_name = event.__class__.__name__
                if event_name == "RealtimeTranscriptionSessionCreated":
                    await websocket.send_json({"type": "session_created"})
                    continue
                if event_name == "TranscriptionStreamTextDelta":
                    text = str(getattr(event, "text", "")).strip()
                    if text:
                        await websocket.send_json({"type": "transcript_delta", "text": text})
                    continue
                if event_name == "TranscriptionStreamDone":
                    text = str(getattr(event, "text", "")).strip()
                    payload = {"type": "transcript_done"}
                    if text:
                        payload["text"] = text
                    await websocket.send_json(payload)
                    continue
                if event_name == "RealtimeTranscriptionError":
                    message = str(getattr(event, "error", "") or getattr(event, "message", "") or event).strip()
                    await websocket.send_json({"type": "error", "message": message or "Unknown realtime transcription error."})
                    continue
        except Exception as exc:
            if not closed:
                await websocket.send_json({"type": "error", "message": f"Realtime stream failed: {exc}"})

    await websocket.send_json({"type": "ready", "mode": "mistral-realtime"})
    forward_task = asyncio.create_task(forward_realtime_events())
    try:
        while True:
            packet = await websocket.receive()
            packet_type = packet.get("type")
            if packet_type == "websocket.disconnect":
                break
            chunk = packet.get("bytes")
            if chunk:
                try:
                    audio_queue.put_nowait(chunk)
                except asyncio.QueueFull:
                    logger.warning("Dropping realtime audio chunk because queue is full")
                continue
            text_payload = packet.get("text")
            if text_payload:
                try:
                    payload = json.loads(text_payload)
                except JSONDecodeError:
                    payload = {}
                if payload.get("type") == "stop":
                    break
                if payload.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        closed = True
        try:
            audio_queue.put_nowait(None)
        except asyncio.QueueFull:
            await audio_queue.put(None)
        await asyncio.gather(forward_task, return_exceptions=True)


async def analyze_voice_responses(db: AsyncSession, student_id: UUID, data: VoiceSessionSubmit) -> VoiceAnalysisResponse:
    period = _normalize_period(data.period)
    session: VoiceSession | None = None

    if data.session_id is not None:
        session_result = await db.execute(
            select(VoiceSession).where(
                and_(VoiceSession.id == data.session_id, VoiceSession.student_id == student_id)
            )
        )
        session = session_result.scalars().first()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice session not found")

        session_period = _normalize_period(session.period)
        if session_period != period:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Submitted period does not match the voice session period",
            )
        if _normalize_session_status(session.status) == VoiceSessionStatus.ANALYSED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This voice session has already been analysed",
            )
    else:
        pending_session_result = await db.execute(
            select(VoiceSession)
            .where(
                and_(
                    VoiceSession.student_id == student_id,
                    VoiceSession.period == period,
                    or_(
                        VoiceSession.status == VoiceSessionStatus.IN_PROGRESS.value,
                        VoiceSession.status == "VoiceSessionStatus.IN_PROGRESS",
                    ),
                )
            )
            .order_by(desc(VoiceSession.created_at))
            .limit(1)
        )
        session = pending_session_result.scalars().first()

        if not session:
            raw_questions = await get_questions_for_student(db, student_id, period)
            session = VoiceSession(
                student_id=student_id,
                period=period,
                status=VoiceSessionStatus.IN_PROGRESS.value,
                questions=raw_questions,
                transcriptions=None,
            )
            db.add(session)
            await db.commit()
            await db.refresh(session)

    session_questions = session.questions or []
    _validate_transcriptions(data.transcriptions, session_questions)

    cleaned_transcriptions = sorted(
        [
            {
                "question_index": t.question_index,
                "question_id": t.question_id,
                "transcription": t.transcription.strip(),
            }
            for t in data.transcriptions
        ],
        key=lambda t: t["question_index"],
    )
    session.transcriptions = cleaned_transcriptions
    session.status = VoiceSessionStatus.COMPLETED.value
    await db.commit()

    context = await build_agent_context(db, student_id)
    client = Mistral(api_key=settings.MISTRAL_API_KEY)

    q_lines = []
    parsed_answers = []
    for t in cleaned_transcriptions:
        raw_meta = session_questions[t["question_index"]] if t["question_index"] < len(session_questions) else {}
        q_meta = raw_meta if isinstance(raw_meta, dict) else {"id": f"q_{t['question_index']+1}", "text": str(raw_meta), "target_field": "context"}
        q_id = str(q_meta.get("id", t.get("question_id") or f"q_{t['question_index']+1}"))
        q_text = str(q_meta.get("text", ""))
        target = str(q_meta.get("target_field", "context"))
        q_lines.append(f"{q_id} | target={target} | question={q_text} | answer={t['transcription']}")
        parsed_answers.append({"question_id": q_id, "value": t["transcription"]})
    transcriptions_text = "\n".join(q_lines)

    prompt = f"""Analyze the following transcribed voice responses from a student for their {period} check-in.

Context:
- Upcoming Exams: {len(context.get('upcoming_exams', []))}
- Today's Classes: {len(context.get('today_schedule', []))}
- Upcoming Projects: {len(context.get('upcoming_projects', []))}
- Stress Indicators: {context.get('stress_indicators', {})}

Transcriptions:
{transcriptions_text}

Extract the following information and return exactly a JSON object with these keys:
- "mood_score": an integer from 1 to 5 representing their overall mood.
- "sleep_hours": a float representing hours of sleep (or null if not mentioned).
- "plan_completed": a boolean indicating if they completed their daily plan (only relevant for EVENING, default false when unclear).
- "analysis": a short string summarizing their state and thoughts.
- "recommendations": a list of strings containing 2-4 specific, actionable recommendations.

JSON format only. No markdown formatting.
"""

    response = await asyncio.to_thread(
        client.chat.complete,
        model=settings.MISTRAL_MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    try:
        content = _extract_chat_response_text(response) or "{}"
        parsed_data = json.loads(content)
    except JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid AI analysis payload")
    if not isinstance(parsed_data, dict):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Unexpected AI analysis format")

    mood_score = _normalize_mood_score(parsed_data.get("mood_score"))
    sleep_hours = _normalize_sleep_hours(parsed_data.get("sleep_hours"))
    plan_completed = _normalize_plan_completed(parsed_data.get("plan_completed", False))
    analysis_text = str(parsed_data.get("analysis", "")).strip() or "No analysis available"
    recommendations = _normalize_recommendations(parsed_data.get("recommendations", []))
    if not recommendations:
        recommendations = _fallback_recommendations(period, mood_score, sleep_hours)
    checkin_note = _compose_checkin_note(analysis_text, recommendations)

    today = date.today()
    if period == "MORNING":
        existing_checkin_result = await db.execute(
            select(MorningCheckin)
            .where(and_(MorningCheckin.student_id == student_id, MorningCheckin.date == today))
            .order_by(desc(MorningCheckin.checkin_time))
            .limit(1)
        )
        checkin = existing_checkin_result.scalars().first()
        if checkin:
            checkin.sleep_hours = sleep_hours if sleep_hours is not None else checkin.sleep_hours
            checkin.mood_score = mood_score
            checkin.mode = "voice"
            checkin.executive_summary = analysis_text
            checkin.detailed_action_plan = recommendations
            checkin.detected_risks = []
            checkin.question_set = session_questions
            checkin.question_answers = parsed_answers
        else:
            checkin = MorningCheckin(
                student_id=student_id,
                date=today,
                sleep_hours=sleep_hours if sleep_hours is not None else 0.0,
                mood_score=mood_score,
                mode="voice",
                executive_summary=analysis_text,
                detailed_action_plan=recommendations,
                detected_risks=[],
                question_set=session_questions,
                question_answers=parsed_answers,
            )
            db.add(checkin)
    else:
        if not await has_morning_checkin_today(db, student_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Morning check-in is required before evening check-in.",
            )

        existing_checkin_result = await db.execute(
            select(EveningCheckin)
            .where(and_(EveningCheckin.student_id == student_id, EveningCheckin.date == today))
            .order_by(desc(EveningCheckin.checkin_time))
            .limit(1)
        )
        checkin = existing_checkin_result.scalars().first()
        if checkin:
            checkin.plan_completed = plan_completed
            checkin.mood_score = mood_score
            checkin.notes = checkin_note
            checkin.mode = "voice"
            checkin.executive_summary = analysis_text
            checkin.detailed_action_plan = recommendations
            checkin.detected_risks = []
            checkin.question_set = session_questions
            checkin.question_answers = parsed_answers
        else:
            checkin = EveningCheckin(
                student_id=student_id,
                date=today,
                plan_completed=plan_completed,
                mood_score=mood_score,
                notes=checkin_note,
                mode="voice",
                executive_summary=analysis_text,
                detailed_action_plan=recommendations,
                detected_risks=[],
                question_set=session_questions,
                question_answers=parsed_answers,
            )
            db.add(checkin)

    session.status = VoiceSessionStatus.ANALYSED.value
    session.ended_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(checkin)
    await publish_autonomous_event(
        db,
        build_checkin_event(period, student_id=student_id, checkin_date=checkin.date),
    )

    return VoiceAnalysisResponse(
        analysis=analysis_text,
        mood_score=mood_score,
        sleep_hours=sleep_hours,
        recommendations=recommendations,
        parsed_answers=parsed_answers,
        saved_checkin_id=checkin.id
    )


async def chat_with_voice_agent(db: AsyncSession, student_id: UUID, data: VoiceChatRequest) -> VoiceChatResponse:
    from app.services.agent_service import _compute_stress_level, _build_goal_overview
    context = await build_agent_context(db, student_id)
    client = Mistral(api_key=settings.MISTRAL_API_KEY)

    student = context.get("student", {})
    student_name = student.get("name", "Student")
    schedule = context.get("today_schedule", [])
    exams = context.get("upcoming_exams", [])
    projects = context.get("upcoming_projects", [])
    goals = context.get("active_goals", [])
    tasks = context.get("today_tasks", [])
    resources = context.get("recommended_resources", [])
    stress = context.get("stress_indicators", {})
    current_mode = context.get("current_mode")
    stress_level = _compute_stress_level(stress)

    schedule_text = "\n".join(
        [f"- {s['subject']} ({s['start_time']} - {s['end_time']})" for s in schedule]
    ) or "No classes today."
    exam_text = "\n".join(
        [f"- {e['subject']} in {e['days_until']} day(s)" for e in exams[:5]]
    ) or "No upcoming exams."
    project_text = "\n".join(
        [f"- {p['name']} due in {p['days_until']} day(s)" for p in projects[:5]]
    ) or "No upcoming projects."
    goal_text = _build_goal_overview(goals[:5])
    task_text = "\n".join(
        [f"- [{t.get('status', 'pending')}] {t.get('title', 'Task')}" for t in tasks[:8]]
    ) or "No tasks for today yet."
    resource_text = "\n".join(
        [
            f"- {r.get('title', 'Resource')} ({r.get('type', 'RESOURCE')}, trigger={r.get('mood_trigger', 'general')}): {r.get('url', '')} | guidance: {r.get('ai_instruction', '')}"
            for r in resources[:3]
        ]
    ) or "No specific resources available."
    mode_text = (
        f"{current_mode['mode']} started at {current_mode['started_at']} ({current_mode['duration_so_far_minutes']} min)"
        if current_mode
        else "No active mode"
    )

    system_prompt = f"""You are Mizan, a highly empathetic and conversational AI voice companion for a student named {student_name}.
You act as a supportive mentor.
Context:
Today's classes: {schedule_text}
Upcoming exams: {exam_text}
Upcoming projects: {project_text}
Active goals: {goal_text}
Today's tasks: {task_text}
Recommended resources: {resource_text}
Stress level: {stress_level}.
Current mode: {mode_text}

Instructions:
- Always answer in English.
- Primary role: mental wellbeing support for the student, not task generation.
- Keep answers natural, warm, empathetic, and clear.
- Default to 2-4 sentences with practical detail (roughly 60-120 words) unless the user asks for a very short answer.
- Never use bullets, dashes, or Markdown formatting because your response will be spoken aloud.
- Do not use emojis.
- If stress is HIGH, proactively reassure the student and suggest a short break.
- Reply directly to the student while using context only when relevant.
- Do not create a plan or task list unless the student explicitly asks for planning, tasks, or next steps.
- For emotional support, reflection, or simple questions, avoid task-style output.
- Use current mode naturally in your guidance.
- If it helps the student, mention one relevant resource with a short reason.
"""
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for msg in data.history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": data.user_text})

    response = await asyncio.to_thread(
        client.chat.complete,
        model=settings.MISTRAL_MODEL,
        messages=messages,
    )
    
    agent_text = _extract_chat_response_text(response) or "Sorry, I didn't fully understand. Could you rephrase that?"
    
    audio_bytes = await text_to_speech(agent_text)
    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8") if audio_bytes else ""
    
    return VoiceChatResponse(agent_text=agent_text, agent_audio_base64=audio_base64)
