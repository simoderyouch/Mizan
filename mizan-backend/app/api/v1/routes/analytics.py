# Analytics and dashboard endpoints — mood graphs, weekly report, mode distribution stats
# app/api/v1/routes/analytics.py
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import Role, User
from app.schemas.analytics import (
    AdminDashboardResponse,
    ModeDistribution,
    MoodGraphPoint,
    StudentDashboard,
    WeeklyReport,
)
from app.services.analytics_service import (
    get_admin_dashboard,
    get_mode_distribution,
    get_mood_graph,
    get_student_dashboard,
    get_weekly_report,
)
from app.services.student_service import get_student_by_user_id

router = APIRouter(prefix="/analytics", tags=["Analytics"])
admin_scope_dep = Depends(require_role(Role.ADMIN))


@router.get("/dashboard", response_model=StudentDashboard)
async def api_get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    return await get_student_dashboard(db, student.id)


@router.get("/mood", response_model=List[MoodGraphPoint])
async def api_get_mood_graph(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    return await get_mood_graph(db, student.id, days)


@router.get("/modes", response_model=List[ModeDistribution])
async def api_get_mode_distribution(
    days: int = Query(7, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    return await get_mode_distribution(db, student.id, days)


@router.get("/weekly-report", response_model=WeeklyReport)
async def api_get_weekly_report(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    return await get_weekly_report(db, student.id)


@router.get("/admin/dashboard", response_model=AdminDashboardResponse, dependencies=[admin_scope_dep])
async def api_get_admin_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await get_admin_dashboard(db, current_user)
