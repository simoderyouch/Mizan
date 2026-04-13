from datetime import datetime
from typing import Sequence
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.institution import Class, Filiere, Promotion
from app.models.student import Exam, Student
from app.models.user import Role, User
from app.schemas.class_content import ExamCreate, ExamUpdate
from app.services.file_service import validate_csv_file
from app.utils.csv_parser import parse_exam_csv


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


async def create_exam_for_class(db: AsyncSession, current_user: User, class_id: UUID, data: ExamCreate) -> int:
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))
    student_ids = await _get_class_student_ids(db, class_id)
    if not student_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Class has no students")

    for student_id in student_ids:
        db.add(
            Exam(
                student_id=student_id,
                subject=data.subject,
                exam_date=data.exam_date,
                start_time=data.start_time,
                end_time=data.end_time,
                room=data.room,
            )
        )

    await db.commit()
    return len(student_ids)


async def list_exams_by_class(db: AsyncSession, current_user: User, class_id: UUID) -> list[Exam]:
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))
    result = await db.execute(
        select(Exam)
        .join(Student, Exam.student_id == Student.id)
        .where(Student.class_id == class_id)
        .order_by(Exam.exam_date.asc(), Exam.start_time.asc())
    )
    exams = list(result.scalars().all())
    
    # Deduplicate based on (subject, exam_date, start_time, end_time, room)
    unique_exams = []
    seen = set()
    for e in exams:
        key = (e.subject, e.exam_date, e.start_time, e.end_time, e.room)
        if key not in seen:
            seen.add(key)
            unique_exams.append(e)
            
    return unique_exams


async def update_exam_entry(
    db: AsyncSession,
    current_user: User,
    class_id: UUID,
    exam_id: UUID,
    data: ExamUpdate,
    apply_to_class: bool = True,
) -> int:
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))

    target_result = await db.execute(
        select(Exam)
        .join(Student, Exam.student_id == Student.id)
        .where(and_(Exam.id == exam_id, Student.class_id == class_id))
    )
    target = target_result.scalars().first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam entry not found")

    query = select(Exam).where(Exam.id == target.id)
    if apply_to_class:
        class_student_ids = await _get_class_student_ids(db, class_id)
        query = select(Exam).where(
            and_(
                Exam.student_id.in_(class_student_ids),
                Exam.subject == target.subject,
                Exam.exam_date == target.exam_date,
                Exam.start_time == target.start_time,
                Exam.end_time == target.end_time,
                Exam.room == target.room,
            )
        )

    rows = (await db.execute(query)).scalars().all()
    for row in rows:
        if data.subject is not None:
            row.subject = data.subject
        if data.exam_date is not None:
            row.exam_date = data.exam_date
        if data.start_time is not None:
            row.start_time = data.start_time
        if data.end_time is not None:
            row.end_time = data.end_time
        if data.room is not None:
            row.room = data.room

    await db.commit()
    return len(rows)


async def delete_exam_entry(
    db: AsyncSession,
    current_user: User,
    class_id: UUID,
    exam_id: UUID,
    apply_to_class: bool = True,
) -> int:
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))

    target_result = await db.execute(
        select(Exam)
        .join(Student, Exam.student_id == Student.id)
        .where(and_(Exam.id == exam_id, Student.class_id == class_id))
    )
    target = target_result.scalars().first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam entry not found")

    query = select(Exam).where(Exam.id == target.id)
    if apply_to_class:
        class_student_ids = await _get_class_student_ids(db, class_id)
        query = select(Exam).where(
            and_(
                Exam.student_id.in_(class_student_ids),
                Exam.subject == target.subject,
                Exam.exam_date == target.exam_date,
                Exam.start_time == target.start_time,
                Exam.end_time == target.end_time,
                Exam.room == target.room,
            )
        )

    rows = (await db.execute(query)).scalars().all()
    for row in rows:
        await db.delete(row)

    await db.commit()
    return len(rows)


async def import_exams_from_csv(
    db: AsyncSession,
    current_user: User,
    class_id: UUID,
    file: UploadFile,
    replace_existing: bool = False,
) -> int:
    validate_csv_file(file)
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))
    rows = await parse_exam_csv(file)

    student_ids = await _get_class_student_ids(db, class_id)
    if not student_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Class has no students")

    if replace_existing:
        existing = await db.execute(select(Exam).where(Exam.student_id.in_(student_ids)))
        for row in existing.scalars().all():
            await db.delete(row)

    count = 0
    for row in rows:
        exam_date_obj = datetime.strptime(row.get("exam_date", "2000-01-01"), "%Y-%m-%d").date()
        start_time_obj = datetime.strptime(row.get("start_time", "00:00"), "%H:%M").time()
        end_time_obj = datetime.strptime(row.get("end_time", "00:00"), "%H:%M").time()

        for student_id in student_ids:
            db.add(
                Exam(
                    student_id=student_id,
                    subject=row.get("subject", ""),
                    exam_date=exam_date_obj,
                    start_time=start_time_obj,
                    end_time=end_time_obj,
                    room=row.get("room", ""),
                )
            )
            count += 1

    await db.commit()
    return count
