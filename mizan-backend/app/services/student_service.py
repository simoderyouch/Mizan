# Student profile management — activation, linking to class, trombinoscope CSV parsing
# app/services/student_service.py
from datetime import date, timedelta
from typing import Any, Dict
from uuid import UUID
from app.services.file_service import validate_csv_file
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select, and_
from sqlalchemy.orm import load_only, selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.institution import Class, Filiere, Promotion
from app.models.mode_session import ModeSession
from app.models.student import Exam, Project, Schedule, Student
from app.models.user import Role, User
from app.schemas.student import StudentCreateAdmin, StudentUpdateAdmin
from app.core.permissions import ensure_admin_school_scope
from app.utils.project_members import normalize_project_members
from app.utils.csv_parser import parse_trombi_csv
from app.utils.weekday import matches_today_weekday

_WEEKDAY_ORDER = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def _weekday_sort_key(day_of_week: str) -> int:
    return _WEEKDAY_ORDER.get((day_of_week or "").strip().lower(), 99)


async def _verify_class_exists(db: AsyncSession, class_id: UUID) -> None:
    result = await db.execute(select(Class).where(Class.id == class_id))
    if not result.scalars().first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")


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


async def _get_school_id_for_student(db: AsyncSession, student_id: UUID) -> UUID:
    result = await db.execute(
        select(Filiere.school_id)
        .select_from(Student)
        .join(Class, Student.class_id == Class.id)
        .join(Promotion, Class.promotion_id == Promotion.id)
        .join(Filiere, Promotion.filiere_id == Filiere.id)
        .where(Student.id == student_id)
    )
    school_id = result.scalar()
    if not school_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return school_id


def _ensure_admin_scope(current_user: User, target_school_id: UUID) -> None:
    ensure_admin_school_scope(current_user, target_school_id)


async def import_students_from_csv(db: AsyncSession, current_user: User, class_id: UUID, file: UploadFile) -> int:
    await validate_csv_file(file)
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))
    await _verify_class_exists(db, class_id)
    rows = await parse_trombi_csv(file)
    count = 0
    
    new_student_data = []
    for row in rows:
        email = row.get("email")
        if not email:
            continue
        existing_user_result = await db.execute(select(User).where(User.email == email))
        if existing_user_result.scalars().first():
            continue

        user = User(email=email, role=Role.STUDENT, is_active=False)
        db.add(user)
        await db.flush()
        
        student = Student(
            user_id=user.id,
            class_id=class_id,
            first_name=row.get("prenom", ""),
            last_name=row.get("nom", ""),
            cne=row.get("cne", ""),
            phone=row.get("telephone"),
            photo_url=row.get("photo_url")
        )
        db.add(student)
        await db.flush()
        new_student_data.append((student.id, class_id))
        count += 1
        
    await db.commit()

    if new_student_data:
        from app.services.class_content_autonomy import sync_class_content_to_new_student
        for sid, cid in new_student_data:
            await sync_class_content_to_new_student(db, sid, cid, current_user)
        await db.commit()

    return count


def _enrich_student(student: Student) -> Student:
    class_name = student.class_.name if student.class_ else None
    filiere_name = (
        student.class_.promotion.filiere.name
        if student.class_ and student.class_.promotion and student.class_.promotion.filiere
        else None
    )
    setattr(student, "class_name", class_name)
    setattr(student, "filiere_name", filiere_name)
    setattr(student, "email", student.user.email if student.user else None)
    return student


async def _get_student_with_relations_by_id(db: AsyncSession, student_id: UUID) -> Student:
    result = await db.execute(
        select(Student)
        .options(
            selectinload(Student.user),
            selectinload(Student.class_).selectinload(Class.promotion).selectinload(Promotion.filiere),
        )
        .where(Student.id == student_id)
    )
    student = result.scalars().first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return _enrich_student(student)


async def create_student_admin(db: AsyncSession, current_user: User, data: StudentCreateAdmin) -> Student:
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, data.class_id))
    await _verify_class_exists(db, data.class_id)

    user_result = await db.execute(select(User).where(User.email == data.email))
    existing_user = user_result.scalars().first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User with this email already exists")

    cne_result = await db.execute(select(Student).where(Student.cne == data.cne))
    if cne_result.scalars().first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student with this CNE already exists")

    user = User(email=data.email, role=Role.STUDENT, is_active=False)
    db.add(user)
    await db.flush()

    student = Student(
        user_id=user.id,
        class_id=data.class_id,
        first_name=data.first_name,
        last_name=data.last_name,
        cne=data.cne,
        phone=data.phone,
        photo_url=data.photo_url,
    )
    db.add(student)
    await db.commit()

    # Sync class content to the new student
    from app.services.class_content_autonomy import sync_class_content_to_new_student
    await sync_class_content_to_new_student(db, student.id, data.class_id, current_user)
    from app.services.class_project_service import refresh_class_project_member_rosters

    await refresh_class_project_member_rosters(db, data.class_id)
    await db.commit()

    return await _get_student_with_relations_by_id(db, student.id)


async def list_students_by_class(db: AsyncSession, current_user: User, class_id: UUID) -> list[Student]:
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))
    await _verify_class_exists(db, class_id)
    result = await db.execute(
        select(Student)
        .options(
            selectinload(Student.user),
            selectinload(Student.class_).selectinload(Class.promotion).selectinload(Promotion.filiere),
        )
        .where(Student.class_id == class_id)
    )
    return [_enrich_student(s) for s in list(result.scalars().all())]


async def update_student_admin(db: AsyncSession, current_user: User, student_id: UUID, data: StudentUpdateAdmin) -> Student:
    _ensure_admin_scope(current_user, await _get_school_id_for_student(db, student_id))
    student = await _get_student_with_relations_by_id(db, student_id)

    class_changed = False
    if data.class_id is not None and data.class_id != student.class_id:
        _ensure_admin_scope(current_user, await _get_school_id_for_class(db, data.class_id))
        await _verify_class_exists(db, data.class_id)
        student.class_id = data.class_id
        class_changed = True

    if data.first_name is not None:
        student.first_name = data.first_name
    if data.last_name is not None:
        student.last_name = data.last_name
    if data.phone is not None:
        student.phone = data.phone
    if data.photo_url is not None:
        student.photo_url = data.photo_url

    if data.cne is not None and data.cne != student.cne:
        existing_cne = await db.execute(select(Student).where(and_(Student.cne == data.cne, Student.id != student_id)))
        if existing_cne.scalars().first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student with this CNE already exists")
        student.cne = data.cne

    if class_changed:
        from app.services.class_content_autonomy import sync_class_content_to_new_student

        await sync_class_content_to_new_student(db, student.id, student.class_id, current_user)
        from app.services.class_project_service import refresh_class_project_member_rosters

        await refresh_class_project_member_rosters(db, student.class_id)

    await db.commit()
    return await _get_student_with_relations_by_id(db, student_id)


async def delete_student_admin(db: AsyncSession, current_user: User, student_id: UUID) -> None:
    _ensure_admin_scope(current_user, await _get_school_id_for_student(db, student_id))
    student = await _get_student_with_relations_by_id(db, student_id)
    class_id = student.class_id
    user = student.user
    await db.delete(student)
    if user:
        await db.delete(user)
    await db.commit()
    if class_id:
        from app.services.class_project_service import refresh_class_project_member_rosters

        await refresh_class_project_member_rosters(db, class_id)


async def get_student_by_user_id(db: AsyncSession, user_id: UUID) -> Student:
    result = await db.execute(
        select(Student)
        .options(
            selectinload(Student.user),
            selectinload(Student.class_).selectinload(Class.promotion).selectinload(Promotion.filiere)
        )
        .where(Student.user_id == user_id)
    )
    student = result.scalars().first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
    return _enrich_student(student)


async def get_student_basic_by_user_id(db: AsyncSession, user_id: UUID) -> Student:
    result = await db.execute(
        select(Student)
        .options(load_only(Student.id, Student.first_name, Student.last_name))
        .where(Student.user_id == user_id)
    )
    student = result.scalars().first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
    return student


async def get_student_context(db: AsyncSession, student_id: UUID) -> Dict[str, Any]:
    today = date.today()

    student_result = await db.execute(select(Student).where(Student.id == student_id))
    student = student_result.scalars().first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    weekly_result = await db.execute(select(Schedule).where(Schedule.student_id == student_id))
    weekly_schedules = sorted(
        weekly_result.scalars().all(),
        key=lambda s: (_weekday_sort_key(s.day_of_week), s.start_time),
    )
    schedules = [s for s in weekly_schedules if matches_today_weekday(s.day_of_week, today)]

    exam_result = await db.execute(
        select(Exam)
        .where(and_(Exam.student_id == student_id, Exam.exam_date >= today))
        .order_by(Exam.exam_date.asc(), Exam.start_time.asc())
    )
    exams = exam_result.scalars().all()

    project_result = await db.execute(
        select(Project)
        .where(and_(Project.student_id == student_id, Project.due_date >= today))
        .order_by(Project.due_date.asc())
    )
    projects = project_result.scalars().all()

    mode_result = await db.execute(
        select(ModeSession).where(and_(ModeSession.student_id == student_id, ModeSession.ended_at.is_(None)))
    )
    active_mode = mode_result.scalars().first()

    from app.services.checkin_service import has_evening_checkin_today, has_morning_checkin_today

    has_morning = await has_morning_checkin_today(db, student_id)
    has_evening = await has_evening_checkin_today(db, student_id)

    return {
        "student": student,
        "today_schedule": schedules,
        "weekly_schedule": weekly_schedules,
        "upcoming_exams": exams,
        "has_morning_checkin": has_morning,
        "has_evening_checkin": has_evening,
        "active_projects": [
            {
                "id": project.id,
                "student_id": project.student_id,
                "name": project.name,
                "subject": project.subject,
                "due_date": project.due_date,
                "members": normalize_project_members(project.members),
            }
            for project in projects
        ],
        "current_mode": active_mode
    }
