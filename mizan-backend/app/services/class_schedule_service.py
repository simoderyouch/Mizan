from datetime import datetime
from typing import Sequence
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.institution import Class, Filiere, Promotion
from app.models.student import Schedule, Student
from app.models.user import Role, User
from app.schemas.class_content import ScheduleCreate, ScheduleUpdate
from app.services.file_service import validate_csv_file
from app.utils.csv_parser import parse_schedule_csv
from app.utils.weekday import normalize_weekday
from app.services.class_schedule_sync import sync_schedules_to_all_students_in_class


async def _auto_sync_class_schedules(
    db: AsyncSession,
    current_user: User,
    class_id: UUID,
) -> int:
    """Copy class timetable slots to every student in the class (idempotent)."""
    templates = await list_schedules_by_class(db, current_user, class_id)
    return await sync_schedules_to_all_students_in_class(db, class_id, templates)


async def _get_school_id_for_class(db: AsyncSession, class_id: UUID) -> UUID:
    result = await db.execute(
        select(Filiere.school_id)
        .select_from(Class)
        .join(Promotion, Class.promotion_id == Promotion.id)
        .join(Filiere, Promotion.filiere_id == Filiere.id)
        .where(Class.id == class_id)
    )
    school_id = result.scalar()
    if not school_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    return school_id


def _ensure_admin_scope(current_user: User, target_school_id: UUID) -> None:
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    if current_user.school_id and current_user.school_id != target_school_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")


async def _get_class_student_ids(db: AsyncSession, class_id: UUID) -> Sequence[UUID]:
    result = await db.execute(select(Student.id).where(Student.class_id == class_id))
    return result.scalars().all()


async def create_schedule_for_class(db: AsyncSession, current_user: User, class_id: UUID, data: ScheduleCreate) -> int:
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))
    student_ids = await _get_class_student_ids(db, class_id)
    if not student_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Class has no students")

    day = normalize_weekday(data.day_of_week)
    # Seed one row, then auto-sync copies to every student in the class.
    db.add(
        Schedule(
            student_id=student_ids[0],
            subject=data.subject,
            day_of_week=day,
            start_time=data.start_time,
            end_time=data.end_time,
            room=data.room,
            professor=data.professor,
        )
    )

    await db.flush()
    synced = await _auto_sync_class_schedules(db, current_user, class_id)
    await db.commit()
    return len(student_ids) + synced


async def list_schedules_by_class(db: AsyncSession, current_user: User, class_id: UUID) -> list[Schedule]:
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))
    result = await db.execute(
        select(Schedule)
        .join(Student, Schedule.student_id == Student.id)
        .where(Student.class_id == class_id)
        .order_by(Schedule.day_of_week.asc(), Schedule.start_time.asc())
    )
    schedules = list(result.scalars().all())
    
    # Deduplicate based on (subject, day_of_week, start_time, end_time, room, professor)
    unique_schedules = []
    seen = set()
    for s in schedules:
        key = (s.subject, s.day_of_week, s.start_time, s.end_time, s.room, s.professor)
        if key not in seen:
            seen.add(key)
            unique_schedules.append(s)
            
    return unique_schedules


async def update_schedule_entry(
    db: AsyncSession,
    current_user: User,
    class_id: UUID,
    schedule_id: UUID,
    data: ScheduleUpdate,
    apply_to_class: bool = True,
) -> int:
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))

    target_result = await db.execute(
        select(Schedule)
        .join(Student, Schedule.student_id == Student.id)
        .where(and_(Schedule.id == schedule_id, Student.class_id == class_id))
    )
    target = target_result.scalars().first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule entry not found")

    query = select(Schedule).where(Schedule.id == target.id)
    if apply_to_class:
        class_student_ids = await _get_class_student_ids(db, class_id)
        query = select(Schedule).where(
            and_(
                Schedule.student_id.in_(class_student_ids),
                Schedule.subject == target.subject,
                Schedule.day_of_week == target.day_of_week,
                Schedule.start_time == target.start_time,
                Schedule.end_time == target.end_time,
                Schedule.room == target.room,
                Schedule.professor == target.professor,
            )
        )

    rows = (await db.execute(query)).scalars().all()
    for row in rows:
        if data.subject is not None:
            row.subject = data.subject
        if data.day_of_week is not None:
            row.day_of_week = normalize_weekday(data.day_of_week)
        if data.start_time is not None:
            row.start_time = data.start_time
        if data.end_time is not None:
            row.end_time = data.end_time
        if data.room is not None:
            row.room = data.room
        if data.professor is not None:
            row.professor = data.professor

    if apply_to_class:
        await db.flush()
        await _auto_sync_class_schedules(db, current_user, class_id)

    await db.commit()
    return len(rows)


async def delete_schedule_entry(
    db: AsyncSession,
    current_user: User,
    class_id: UUID,
    schedule_id: UUID,
    apply_to_class: bool = True,
) -> int:
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))

    target_result = await db.execute(
        select(Schedule)
        .join(Student, Schedule.student_id == Student.id)
        .where(and_(Schedule.id == schedule_id, Student.class_id == class_id))
    )
    target = target_result.scalars().first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule entry not found")

    query = select(Schedule).where(Schedule.id == target.id)
    if apply_to_class:
        class_student_ids = await _get_class_student_ids(db, class_id)
        query = select(Schedule).where(
            and_(
                Schedule.student_id.in_(class_student_ids),
                Schedule.subject == target.subject,
                Schedule.day_of_week == target.day_of_week,
                Schedule.start_time == target.start_time,
                Schedule.end_time == target.end_time,
                Schedule.room == target.room,
                Schedule.professor == target.professor,
            )
        )

    rows = (await db.execute(query)).scalars().all()
    for row in rows:
        await db.delete(row)

    await db.commit()
    return len(rows)


async def import_schedule_from_csv(
    db: AsyncSession,
    current_user: User,
    class_id: UUID,
    file: UploadFile,
    replace_existing: bool = False,
) -> int:
    await validate_csv_file(file)
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))
    rows = await parse_schedule_csv(file)

    student_ids = await _get_class_student_ids(db, class_id)
    if not student_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Class has no students")

    if replace_existing:
        existing = await db.execute(select(Schedule).where(Schedule.student_id.in_(student_ids)))
        for row in existing.scalars().all():
            await db.delete(row)

    seed_student_id = student_ids[0]
    slots = 0
    for row in rows:
        start_time_obj = datetime.strptime(row.get("start_time", "00:00"), "%H:%M").time()
        end_time_obj = datetime.strptime(row.get("end_time", "00:00"), "%H:%M").time()
        day = normalize_weekday(row.get("day_of_week", ""))
        db.add(
            Schedule(
                student_id=seed_student_id,
                subject=row.get("subject", ""),
                day_of_week=day,
                start_time=start_time_obj,
                end_time=end_time_obj,
                room=row.get("room", ""),
                professor=row.get("professor", ""),
            )
        )
        slots += 1

    await db.flush()
    synced = await _auto_sync_class_schedules(db, current_user, class_id)
    await db.commit()
    return slots * len(student_ids) + synced


async def sync_class_schedules_to_students(
    db: AsyncSession,
    current_user: User,
    class_id: UUID,
) -> dict[str, int]:
    """Manual repair: backfill missing per-student copies (also runs automatically on changes)."""
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))
    student_count = len(await _get_class_student_ids(db, class_id))
    templates = await list_schedules_by_class(db, current_user, class_id)
    added = await sync_schedules_to_all_students_in_class(db, class_id, templates)
    await db.commit()
    return {"students": student_count, "template_slots": len(templates), "rows_added": added}
