from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.student import Student
from app.services.autonomous_events import build_metadata_update_event, publish_autonomous_event


async def trigger_class_metadata_update_events(
    *,
    class_id: UUID,
    metadata_type: str,
    operation: str,
) -> int:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Student.id).where(Student.class_id == class_id))
        student_ids = list(result.scalars().all())

        for student_id in student_ids:
            event = build_metadata_update_event(
                student_id=student_id,
                metadata_type=metadata_type,
                operation=operation,
                class_id=class_id,
            )
            await publish_autonomous_event(db, event)

    return len(student_ids)


async def sync_class_content_to_new_student(
    db: AsyncSession,
    student_id: UUID,
    class_id: UUID,
    current_user: Any,
) -> None:
    """
    Copies current class content (schedules, exams, projects) to a new student.
    Used when a student is added to a class.
    """
    from app.services.class_schedule_service import list_schedules_by_class
    from app.services.class_exam_service import list_exams_by_class
    from app.services.class_project_service import list_projects_by_class
    from app.models.student import Schedule, Exam, Project

    # 1. Sync Schedules
    schedules = await list_schedules_by_class(db, current_user, class_id)
    for s in schedules:
        db.add(Schedule(
            student_id=student_id,
            subject=s.subject,
            day_of_week=s.day_of_week,
            start_time=s.start_time,
            end_time=s.end_time,
            room=s.room,
            professor=s.professor
        ))

    # 2. Sync Exams
    exams = await list_exams_by_class(db, current_user, class_id)
    for e in exams:
        db.add(Exam(
            student_id=student_id,
            subject=e.subject,
            exam_date=e.exam_date,
            start_time=e.start_time,
            end_time=e.end_time,
            room=e.room
        ))

    # 3. Sync Projects
    projects = await list_projects_by_class(db, current_user, class_id)
    for p in projects:
        db.add(Project(
            student_id=student_id,
            name=p["name"],
            subject=p["subject"],
            due_date=p["due_date"],
            members=p["members"]
        ))

    # Trigger events for the autonomy system
    for mtype in ["SCHEDULE", "EXAM", "PROJECT"]:
        event = build_metadata_update_event(
            student_id=student_id,
            metadata_type=mtype,
            operation="SYNC",
            class_id=class_id,
        )
        await publish_autonomous_event(db, event)
