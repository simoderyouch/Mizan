# Personal goals endpoints — create, update, track progress, celebrate completion
# app/api/v1/routes/goals.py
from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.goal import (
    GoalCreate,
    GoalProgressCreate,
    GoalProgressResponse,
    GoalResponse,
    GoalWithProgressResponse,
)
from app.services.goal_service import (
    create_goal,
    deactivate_goal,
    get_goal_with_progress,
    get_student_goals,
    get_today_summary,
    log_progress,
)
from app.services.student_service import get_student_by_user_id

router = APIRouter(prefix="/goals", tags=["Goals"])


@router.post("", response_model=GoalResponse, include_in_schema=False)
@router.post("/", response_model=GoalResponse)
async def api_create_goal(
    data: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    return await create_goal(db, student.id, data)


@router.get("", response_model=List[GoalResponse], include_in_schema=False)
@router.get("/", response_model=List[GoalResponse])
async def api_get_student_goals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    return await get_student_goals(db, student.id)


@router.get("/today", response_model=List[Dict[str, Any]])
async def api_get_today_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    return await get_today_summary(db, student.id)


@router.get("/{goal_id}", response_model=GoalWithProgressResponse)
async def api_get_goal_with_progress(
    goal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    return await get_goal_with_progress(db, goal_id, student.id)


@router.post("/progress", response_model=GoalProgressResponse)
async def api_log_progress(
    data: GoalProgressCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    return await log_progress(db, student.id, data)


@router.delete("/{goal_id}")
async def api_deactivate_goal(
    goal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    await deactivate_goal(db, goal_id, student.id)
    return {"message": "Goal deactivated successfully"}