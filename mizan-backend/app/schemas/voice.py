# app/schemas/voice.py
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

VoicePeriod = Literal["MORNING", "EVENING"]


class VoiceSessionStart(BaseModel):
    period: VoicePeriod


class VoiceTranscription(BaseModel):
    question_index: int = Field(ge=0)
    question_id: Optional[str] = None
    transcription: str = Field(min_length=1, max_length=2000)


class VoiceSessionSubmit(BaseModel):
    session_id: Optional[UUID] = None
    period: VoicePeriod
    transcriptions: List[VoiceTranscription]


class VoiceQuestion(BaseModel):
    index: int
    id: str
    text: str
    answer_type: str = "voice_text"
    target_field: Optional[str] = None
    audio_base64: Optional[str] = None
    audio_url: Optional[str] = None


class VoiceSessionResponse(BaseModel):
    session_id: str
    questions: List[VoiceQuestion]
    first_audio_base64: str


class VoiceAnalysisResponse(BaseModel):
    analysis: str
    mood_score: int
    sleep_hours: Optional[float] = None
    recommendations: List[str]
    parsed_answers: Optional[List[dict]] = None
    saved_checkin_id: UUID


class VoiceChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class VoiceChatRequest(BaseModel):
    user_text: str
    history: List[VoiceChatMessage] = []


class VoiceChatResponse(BaseModel):
    agent_text: str
    agent_audio_base64: str
