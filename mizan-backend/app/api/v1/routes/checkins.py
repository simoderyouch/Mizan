# Morning and evening check-in endpoints — submit check-in, get briefing, retrieve history
# app/api/v1/routes/checkins.py
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.checkin import (
    EveningCheckinCreate,
    EveningCheckinResponse,
    MorningCheckinCreate,
    MorningCheckinResponse,
    PersonalizedCheckinQuestionsResponse,
)
from app.services.checkin_service import (
    create_evening_checkin,
    create_morning_checkin,
    get_checkin_history,
    get_morning_briefing,
    get_personalized_checkin_questions,
)
from app.services.student_service import get_student_by_user_id

router = APIRouter(prefix="/checkins", tags=["Check-ins"])


@router.get("/morning/briefing")
async def api_get_morning_briefing(
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    return await get_morning_briefing(db, student.id)


@router.get("/questions", response_model=PersonalizedCheckinQuestionsResponse)
async def api_get_personalized_questions(
    period: Literal["MORNING", "EVENING"] = Query(...),
    mode: Literal["qcm", "voice"] = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_by_user_id(db, current_user.id)
    questions = await get_personalized_checkin_questions(db, student.id, period, mode)
    return {"period": period, "mode": mode, "questions": questions}


@router.post("/morning", response_model=MorningCheckinResponse)
async def api_create_morning_checkin(
    data: MorningCheckinCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    return await create_morning_checkin(db, student.id, data)


@router.post("/evening", response_model=EveningCheckinResponse)
async def api_create_evening_checkin(
    data: EveningCheckinCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    return await create_evening_checkin(db, student.id, data)


@router.get("/history")
async def api_get_history(
    days: int = Query(7, ge=1, le=30),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    return await get_checkin_history(db, student.id, days)
