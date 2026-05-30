"""Insert demo schedule / exam / project rows for students."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student import Exam, Project, Schedule, Student
from app.services.demo_schedule_data import (
    DEMO_EXAMS,
    DEMO_PROJECTS,
    DEMO_WEEKLY_SCHEDULE,
    exam_date_for_slot,
    project_due_for_slot,
)


async def clear_student_schedule_content(db: AsyncSession, student_id: UUID) -> None:
    await db.execute(delete(Schedule).where(Schedule.student_id == student_id))
    await db.execute(delete(Exam).where(Exam.student_id == student_id))
    await db.execute(delete(Project).where(Project.student_id == student_id))


async def seed_student_schedule_content(
    db: AsyncSession,
    student_id: UUID,
    *,
    replace: bool = True,
) -> dict[str, int]:
    """
    Add demo weekly timetable, exams, and projects for one student.
    Returns counts of rows created.
    """
    if replace:
        await clear_student_schedule_content(db, student_id)

    schedule_rows = [
        Schedule(
            student_id=student_id,
            subject=slot.subject,
            day_of_week=slot.day_of_week,
            start_time=slot.start_time,
            end_time=slot.end_time,
            room=slot.room,
            professor=slot.professor,
        )
        for slot in DEMO_WEEKLY_SCHEDULE
    ]
    exam_rows = [
        Exam(
            student_id=student_id,
            subject=slot.subject,
            exam_date=exam_date_for_slot(slot),
            start_time=slot.start_time,
            end_time=slot.end_time,
            room=slot.room,
        )
        for slot in DEMO_EXAMS
    ]
    project_rows = [
        Project(
            student_id=student_id,
            name=slot.name,
            subject=slot.subject,
            due_date=project_due_for_slot(slot),
            members=slot.members,
        )
        for slot in DEMO_PROJECTS
    ]

    db.add_all(schedule_rows)
    db.add_all(exam_rows)
    db.add_all(project_rows)

    return {
        "schedules": len(schedule_rows),
        "exams": len(exam_rows),
        "projects": len(project_rows),
    }


async def seed_schedules_for_students(
    db: AsyncSession,
    student_ids: list[UUID],
    *,
    replace: bool = True,
) -> dict[str, int]:
    totals = {"schedules": 0, "exams": 0, "projects": 0, "students": 0}
    for student_id in student_ids:
        counts = await seed_student_schedule_content(db, student_id, replace=replace)
        totals["schedules"] += counts["schedules"]
        totals["exams"] += counts["exams"]
        totals["projects"] += counts["projects"]
        totals["students"] += 1
    return totals
