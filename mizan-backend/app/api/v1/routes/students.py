from pydantic import BaseModel
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, UploadFile, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, Role
from app.models.student import Schedule, Student
from app.schemas.mode import ModeSessionResponse
from app.schemas.student import (
    ExamResponse,
    ProjectResponse,
    ScheduleResponse,
    StudentContextResponse,
    StudentCreateAdmin,
    StudentResponse,
    StudentUpdateAdmin,
)
from app.services.student_service import (
    create_student_admin, delete_student_admin, get_student_by_user_id, get_student_context,
    import_students_from_csv, list_students_by_class, update_student_admin,
)

router = APIRouter(prefix="/students", tags=["Students"])

class PushTokenUpdate(BaseModel):
    token: str

@router.put("/me/push-token")
async def api_update_push_token(
    data: PushTokenUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.expo_push_token = data.token
    await db.commit()
    return {"message": "Token updated"}
admin_dep = Depends(require_role(Role.ADMIN))

@router.post("/import/trombi/{class_id}", dependencies=[admin_dep])
async def api_import_trombi(
    class_id: UUID,
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    count = await import_students_from_csv(db, current_user, class_id, file)
    return {"message": f"Successfully imported {count} students"}

@router.post("", response_model=StudentResponse, dependencies=[admin_dep])
async def api_create_student(
    data: StudentCreateAdmin,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await create_student_admin(db, current_user, data)

@router.get("/class/{class_id}", response_model=List[StudentResponse], dependencies=[admin_dep])
async def api_get_students_by_class(
    class_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await list_students_by_class(db, current_user, class_id)

@router.put("/{student_id}", response_model=StudentResponse, dependencies=[admin_dep])
async def api_update_student(
    student_id: UUID,
    data: StudentUpdateAdmin,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await update_student_admin(db, current_user, student_id, data)

@router.delete("/{student_id}", dependencies=[admin_dep])
async def api_delete_student(
    student_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await delete_student_admin(db, current_user, student_id)
    return {"message": "Student deleted"}

@router.get("/me", response_model=StudentResponse)
async def api_get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await get_student_by_user_id(db, current_user.id)

def _schedule_responses(rows: list) -> List[ScheduleResponse]:
    return [ScheduleResponse.model_validate(s) for s in rows]


@router.get("/me/schedules", response_model=List[ScheduleResponse])
async def api_get_my_schedules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full weekly timetable for the logged-in student."""
    student = await get_student_by_user_id(db, current_user.id)
    result = await db.execute(
        select(Schedule)
        .where(Schedule.student_id == student.id)
        .order_by(Schedule.day_of_week.asc(), Schedule.start_time.asc())
    )
    return _schedule_responses(list(result.scalars().all()))


@router.get("/me/context", response_model=StudentContextResponse)
async def api_get_me_context(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    student = await get_student_by_user_id(db, current_user.id)
    ctx = await get_student_context(db, student.id)
    active_mode = ctx.get("current_mode")
    return StudentContextResponse(
        student=StudentResponse.model_validate(student),
        today_schedule=_schedule_responses(ctx["today_schedule"]),
        weekly_schedule=_schedule_responses(ctx["weekly_schedule"]),
        upcoming_exams=[ExamResponse.model_validate(e) for e in ctx["upcoming_exams"]],
        active_projects=[
            ProjectResponse(
                id=p["id"],
                student_id=p["student_id"],
                name=p["name"],
                subject=p["subject"],
                due_date=p["due_date"],
                members=p["members"] if isinstance(p["members"], list) else [],
            )
            for p in ctx["active_projects"]
        ],
        current_mode=ModeSessionResponse.model_validate(active_mode) if active_mode else None,
        has_morning_checkin=bool(ctx.get("has_morning_checkin")),
        has_evening_checkin=bool(ctx.get("has_evening_checkin")),
    )
