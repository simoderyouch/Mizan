# Personal goal tracking — create goals, record progress, detect completion and celebrate
# app/services/goal_service.py
from datetime import date
from typing import List
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal, GoalProgress
from app.schemas.goal import GoalCreate, GoalProgressCreate, GoalWithProgressResponse


def _normalize_whitespace(value: str) -> str:
    return " ".join(value.split()).strip()


async def create_goal(db: AsyncSession, student_id: UUID, data: GoalCreate) -> Goal:
    normalized_title = _normalize_whitespace(data.title)
    normalized_unit = _normalize_whitespace(data.unit)
    if not normalized_title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Goal title is required")
    if not normalized_unit:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Goal unit is required")

    result = await db.execute(
        select(func.count()).select_from(Goal).where(Goal.student_id == student_id, Goal.is_active == True)
    )
    active_count = result.scalar() or 0

    if active_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum of 5 active goals allowed"
        )

    duplicate_result = await db.execute(
        select(Goal).where(
            and_(
                Goal.student_id == student_id,
                Goal.is_active == True,
                func.lower(Goal.title) == normalized_title.lower(),
            )
        )
    )
    if duplicate_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An active goal with this title already exists",
        )

    goal = Goal(
        student_id=student_id,
        title=normalized_title,
        target_value=data.target_value,
        unit=normalized_unit,
        is_active=True
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal


async def get_student_goals(db: AsyncSession, student_id: UUID) -> List[Goal]:
    result = await db.execute(
        select(Goal)
        .where(Goal.student_id == student_id, Goal.is_active == True)
        .order_by(Goal.created_at.desc())
    )
    return list(result.scalars().all())


async def get_goal_with_progress(db: AsyncSession, goal_id: UUID, student_id: UUID) -> GoalWithProgressResponse:
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.student_id == student_id)
    )
    goal = result.scalars().first()
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found or does not belong to the student"
        )

    progress_result = await db.execute(
        select(GoalProgress).where(GoalProgress.goal_id == goal_id).order_by(GoalProgress.date.desc())
    )
    progresses = list(progress_result.scalars().all())

    today = date.today()
    today_progress = sum(p.value for p in progresses if p.date == today)
    total_progress = sum(p.value for p in progresses)
    completion_percentage = (total_progress / goal.target_value * 100) if goal.target_value > 0 else 0.0
    remaining_value = max(0.0, goal.target_value - total_progress)
    is_achieved = total_progress >= goal.target_value

    return GoalWithProgressResponse(
        id=goal.id,
        student_id=goal.student_id,
        title=goal.title,
        target_value=goal.target_value,
        unit=goal.unit,
        is_active=goal.is_active,
        today_progress=today_progress,
        total_progress=total_progress,
        completion_percentage=min(round(completion_percentage, 2), 100.0),
        remaining_value=round(remaining_value, 2),
        is_achieved=is_achieved,
        progress_history=progresses
    )


async def log_progress(db: AsyncSession, student_id: UUID, data: GoalProgressCreate) -> GoalProgress:
    result = await db.execute(
        select(Goal).where(Goal.id == data.goal_id, Goal.student_id == student_id)
    )
    goal = result.scalars().first()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found"
        )
    
    if not goal.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot log progress for an inactive goal"
        )

    total_before_result = await db.execute(
        select(func.coalesce(func.sum(GoalProgress.value), 0.0)).where(GoalProgress.goal_id == goal.id)
    )
    total_before = float(total_before_result.scalar() or 0.0)

    progress = GoalProgress(
        goal_id=goal.id,
        date=date.today(),
        value=data.value,
        note=data.note.strip() if data.note else None
    )
    db.add(progress)

    total_after = total_before + data.value
    if total_after >= goal.target_value:
        goal.is_active = False

    await db.commit()
    await db.refresh(progress)
    return progress


async def deactivate_goal(db: AsyncSession, goal_id: UUID, student_id: UUID) -> Goal:
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.student_id == student_id)
    )
    goal = result.scalars().first()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found or does not belong to the student"
        )

    goal.is_active = False
    await db.commit()
    await db.refresh(goal)
    return goal


async def get_today_summary(db: AsyncSession, student_id: UUID) -> List[dict]:
    goals = await get_student_goals(db, student_id)
    if not goals:
        return []

    goal_ids = [g.id for g in goals]
    today = date.today()
    
    progress_result = await db.execute(
        select(GoalProgress).where(GoalProgress.goal_id.in_(goal_ids))
    )
    progresses = progress_result.scalars().all()

    today_progress_map = {}
    total_progress_map = {}
    for p in progresses:
        total_progress_map[p.goal_id] = total_progress_map.get(p.goal_id, 0.0) + p.value
        if p.date == today:
            today_progress_map[p.goal_id] = today_progress_map.get(p.goal_id, 0.0) + p.value

    summary = []
    for goal in goals:
        today_val = today_progress_map.get(goal.id, 0.0)
        total_val = total_progress_map.get(goal.id, 0.0)
        completion_percentage = (total_val / goal.target_value * 100) if goal.target_value > 0 else 0.0
        
        summary.append({
            "goal_id": goal.id,
            "title": goal.title,
            "target_value": goal.target_value,
            "unit": goal.unit,
            "today_value": today_val,
            "total_value": total_val,
            "remaining_value": max(0.0, goal.target_value - total_val),
            "completion_percentage": min(round(completion_percentage, 2), 100.0),
            "achieved": total_val >= goal.target_value
        })

    return summary
