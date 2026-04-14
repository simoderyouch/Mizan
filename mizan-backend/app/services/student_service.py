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
from app.utils.project_members import normalize_project_members
from app.utils.csv_parser import parse_trombi_csv


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
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    if current_user.school_id and current_user.school_id != target_school_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")


async def import_students_from_csv(db: AsyncSession, current_user: User, class_id: UUID, file: UploadFile) -> int:
    validate_csv_file(file) 
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

    if data.class_id is not None and data.class_id != student.class_id:
        _ensure_admin_scope(current_user, await _get_school_id_for_class(db, data.class_id))
        await _verify_class_exists(db, data.class_id)
        student.class_id = data.class_id

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

    await db.commit()
    return await _get_student_with_relations_by_id(db, student_id)


async def delete_student_admin(db: AsyncSession, current_user: User, student_id: UUID) -> None:
    _ensure_admin_scope(current_user, await _get_school_id_for_student(db, student_id))
    student = await _get_student_with_relations_by_id(db, student_id)
    user = student.user
    await db.delete(student)
    if user:
        await db.delete(user)
    await db.commit()


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
    day_name = today.strftime("%A")
    upcoming_limit = today + timedelta(days=3)

    student_result = await db.execute(select(Student).where(Student.id == student_id))
    student = student_result.scalars().first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    schedule_result = await db.execute(
        select(Schedule).where(and_(Schedule.student_id == student_id, Schedule.day_of_week == day_name))
    )
    schedules = schedule_result.scalars().all()

    exam_result = await db.execute(
        select(Exam).where(and_(Exam.student_id == student_id, Exam.exam_date >= today, Exam.exam_date <= upcoming_limit))
    )
    exams = exam_result.scalars().all()

    project_result = await db.execute(
        select(Project).where(and_(Project.student_id == student_id, Project.due_date >= today))
    )
    projects = project_result.scalars().all()

    mode_result = await db.execute(
        select(ModeSession).where(and_(ModeSession.student_id == student_id, ModeSession.ended_at.is_(None)))
    )
    active_mode = mode_result.scalars().first()

    return {
        "student": student,
        "today_schedule": schedules,
        "upcoming_exams": exams,
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
