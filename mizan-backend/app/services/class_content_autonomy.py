from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.student import Student
from app.services.autonomous_events import build_metadata_update_event, publish_autonomous_event
from app.services.metadata_urgency import (
    build_urgent_metadata_force_decision,
    is_urgent_metadata_update,
)


async def trigger_class_metadata_update_events(
    *,
    class_id: UUID,
    metadata_type: str,
    operation: str,
    content_details: dict | None = None,
) -> dict:
    force_decision = build_urgent_metadata_force_decision(
        metadata_type, operation, content_details
    )
    urgent = is_urgent_metadata_update(metadata_type, operation, content_details)
    actions_taken = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Student.id).where(Student.class_id == class_id))
        student_ids = list(result.scalars().all())

        for student_id in student_ids:
            event = build_metadata_update_event(
                student_id=student_id,
                metadata_type=metadata_type,
                operation=operation,
                class_id=class_id,
                content_details=content_details,
                force_decision=force_decision,
            )
            run = await publish_autonomous_event(db, event)
            if run and run.status == "success":
                for decision in run.decisions or []:
                    result_payload = decision.result if isinstance(decision.result, dict) else {}
                    if result_payload.get("task_id") or result_payload.get("notification_id"):
                        actions_taken += 1
                        break

    return {
        "students": len(student_ids),
        "urgent": urgent,
        "actions_taken": actions_taken,
    }


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
    from app.services.class_project_service import class_project_member_names, list_projects_by_class
    from app.models.student import Schedule, Exam, Project
    from app.utils.weekday import normalize_weekday

    # 1. Sync Schedules
    schedules = await list_schedules_by_class(db, current_user, class_id)
    for s in schedules:
        db.add(Schedule(
            student_id=student_id,
            subject=s.subject,
            day_of_week=normalize_weekday(s.day_of_week),
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

    # 3. Sync Projects (class-wide team = full roster)
    projects = await list_projects_by_class(db, current_user, class_id)
    roster = await class_project_member_names(db, class_id)
    for p in projects:
        db.add(Project(
            student_id=student_id,
            name=p["name"],
            subject=p["subject"],
            due_date=p["due_date"],
            members=roster,
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
