from datetime import datetime
from typing import Sequence
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.institution import Class, Filiere, Promotion
from app.models.student import Project, Student
from app.models.user import Role, User
from app.schemas.class_content import ProjectCreate, ProjectUpdate
from app.services.file_service import validate_csv_file
from app.utils.project_members import normalize_project_members
from app.utils.csv_parser import parse_project_csv


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


async def create_project_for_class(db: AsyncSession, current_user: User, class_id: UUID, data: ProjectCreate) -> int:
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))
    student_ids = await _get_class_student_ids(db, class_id)
    if not student_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Class has no students")

    for student_id in student_ids:
        db.add(
            Project(
                student_id=student_id,
                name=data.name,
                subject=data.subject,
                due_date=data.due_date,
                members=normalize_project_members(data.members),
            )
        )

    await db.commit()
    return len(student_ids)


async def list_projects_by_class(db: AsyncSession, current_user: User, class_id: UUID) -> list[dict]:
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))
    result = await db.execute(
        select(Project)
        .join(Student, Project.student_id == Student.id)
        .where(Student.class_id == class_id)
        .order_by(Project.due_date.asc(), Project.name.asc())
    )
    rows = list(result.scalars().all())
    
    # Deduplicate based on (name, subject, due_date)
    unique_projects = []
    seen = set()
    for row in rows:
        key = (row.name, row.subject, row.due_date)
        if key not in seen:
            seen.add(key)
            unique_projects.append({
                "id": row.id,
                "student_id": row.student_id,
                "name": row.name,
                "subject": row.subject,
                "due_date": row.due_date,
                "members": normalize_project_members(row.members),
            })
            
    return unique_projects


async def update_project_entry(
    db: AsyncSession,
    current_user: User,
    class_id: UUID,
    project_id: UUID,
    data: ProjectUpdate,
    apply_to_class: bool = True,
) -> int:
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))

    target_result = await db.execute(
        select(Project)
        .join(Student, Project.student_id == Student.id)
        .where(and_(Project.id == project_id, Student.class_id == class_id))
    )
    target = target_result.scalars().first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project entry not found")

    query = select(Project).where(Project.id == target.id)
    if apply_to_class:
        class_student_ids = await _get_class_student_ids(db, class_id)
        query = select(Project).where(
            and_(
                Project.student_id.in_(class_student_ids),
                Project.name == target.name,
                Project.subject == target.subject,
                Project.due_date == target.due_date,
            )
        )

    rows = (await db.execute(query)).scalars().all()
    for row in rows:
        if data.name is not None:
            row.name = data.name
        if data.subject is not None:
            row.subject = data.subject
        if data.due_date is not None:
            row.due_date = data.due_date
        if data.members is not None:
            row.members = normalize_project_members(data.members)

    await db.commit()
    return len(rows)


async def delete_project_entry(
    db: AsyncSession,
    current_user: User,
    class_id: UUID,
    project_id: UUID,
    apply_to_class: bool = True,
) -> int:
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))

    target_result = await db.execute(
        select(Project)
        .join(Student, Project.student_id == Student.id)
        .where(and_(Project.id == project_id, Student.class_id == class_id))
    )
    target = target_result.scalars().first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project entry not found")

    query = select(Project).where(Project.id == target.id)
    if apply_to_class:
        class_student_ids = await _get_class_student_ids(db, class_id)
        query = select(Project).where(
            and_(
                Project.student_id.in_(class_student_ids),
                Project.name == target.name,
                Project.subject == target.subject,
                Project.due_date == target.due_date,
            )
        )

    rows = (await db.execute(query)).scalars().all()
    for row in rows:
        await db.delete(row)

    await db.commit()
    return len(rows)


async def import_projects_from_csv(
    db: AsyncSession,
    current_user: User,
    class_id: UUID,
    file: UploadFile,
    replace_existing: bool = False,
) -> int:
    validate_csv_file(file)
    _ensure_admin_scope(current_user, await _get_school_id_for_class(db, class_id))
    rows = await parse_project_csv(file)

    student_ids = await _get_class_student_ids(db, class_id)
    if not student_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Class has no students")

    if replace_existing:
        existing = await db.execute(select(Project).where(Project.student_id.in_(student_ids)))
        for row in existing.scalars().all():
            await db.delete(row)

    count = 0
    for row in rows:
        due_date_obj = datetime.strptime(row.get("due_date", "2000-01-01"), "%Y-%m-%d").date()

        for student_id in student_ids:
            db.add(
                Project(
                    student_id=student_id,
                    name=row.get("name", ""),
                    subject=row.get("subject", ""),
                    due_date=due_date_obj,
                    members=normalize_project_members(row.get("members", [])),
                )
            )
            count += 1

    await db.commit()
    return count
