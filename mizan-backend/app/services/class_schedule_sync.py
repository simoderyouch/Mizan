"""Propagate class timetable rows to every student in the class."""
from __future__ import annotations

from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student import Schedule, Student
from app.utils.weekday import normalize_weekday


def _schedule_key(row: Schedule) -> tuple:
    return (
        row.subject,
        normalize_weekday(row.day_of_week),
        row.start_time,
        row.end_time,
        row.room or "",
        row.professor or "",
    )


async def sync_schedules_to_all_students_in_class(
    db: AsyncSession,
    class_id: UUID,
    templates: Sequence[Schedule],
) -> int:
    """
    Ensure every student in the class has a copy of each template schedule slot.
    Returns number of new schedule rows inserted.
    """
    if not templates:
        return 0

    student_ids = (
        await db.execute(select(Student.id).where(Student.class_id == class_id))
    ).scalars().all()
    if not student_ids:
        return 0

    added = 0
    for student_id in student_ids:
        existing = (
            await db.execute(select(Schedule).where(Schedule.student_id == student_id))
        ).scalars().all()
        existing_keys = {_schedule_key(row) for row in existing}

        for template in templates:
            day = normalize_weekday(template.day_of_week)
            key = (
                template.subject,
                day,
                template.start_time,
                template.end_time,
                template.room or "",
                template.professor or "",
            )
            if key in existing_keys:
                continue
            db.add(
                Schedule(
                    student_id=student_id,
                    subject=template.subject,
                    day_of_week=day,
                    start_time=template.start_time,
                    end_time=template.end_time,
                    room=template.room or "",
                    professor=template.professor or "",
                )
            )
            existing_keys.add(key)
            added += 1

    return added
