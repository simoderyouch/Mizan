from datetime import date, time
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student import Student
from app.services.notification_service import create_notification


def _format_time(value: time) -> str:
    return value.strftime("%H:%M")


def _format_exam_schedule_line(
    *,
    subject: str,
    exam_date: date,
    start_time: time,
    end_time: time,
    room: str,
) -> str:
    date_label = exam_date.strftime("%a %d %b %Y")
    time_label = f"{_format_time(start_time)}–{_format_time(end_time)}"
    room_label = f" · Room {room.strip()}" if room and room.strip() else ""
    return f"{subject} on {date_label} ({time_label}){room_label}"


def build_exam_notification_copy(
    operation: str,
    *,
    subject: str | None = None,
    exam_date: date | None = None,
    start_time: time | None = None,
    end_time: time | None = None,
    room: str | None = None,
    import_count: int | None = None,
) -> tuple[str, str]:
    op = str(operation or "UPDATE").upper().strip()
    has_details = all(
        value is not None
        for value in (subject, exam_date, start_time, end_time)
    )

    if op == "CREATE" and has_details:
        line = _format_exam_schedule_line(
            subject=str(subject),
            exam_date=exam_date,  # type: ignore[arg-type]
            start_time=start_time,  # type: ignore[arg-type]
            end_time=end_time,  # type: ignore[arg-type]
            room=room or "",
        )
        return f"New exam: {subject}", f"Your class added an exam — {line}."

    if op == "IMPORT":
        count_label = f" ({import_count} entries)" if import_count and import_count > 0 else ""
        return (
            "Exams imported",
            f"Your class imported new exams{count_label}. Open your calendar to review dates and times.",
        )

    if op == "DELETE":
        if has_details:
            line = _format_exam_schedule_line(
                subject=str(subject),
                exam_date=exam_date,  # type: ignore[arg-type]
                start_time=start_time,  # type: ignore[arg-type]
                end_time=end_time,  # type: ignore[arg-type]
                room=room or "",
            )
            return "Exam removed", f"An exam was removed from your schedule — {line}."
        return "Exam removed", "An exam was removed from your class schedule."

    if op == "UPDATE" and has_details:
        line = _format_exam_schedule_line(
            subject=str(subject),
            exam_date=exam_date,  # type: ignore[arg-type]
            start_time=start_time,  # type: ignore[arg-type]
            end_time=end_time,  # type: ignore[arg-type]
            room=room or "",
        )
        return f"Exam updated: {subject}", f"Exam details changed — {line}."

    if op == "UPDATE":
        return "Exam updated", "An exam in your class schedule was updated. Check room and time."

    return "Class exams updated", "Your class exam schedule changed."


async def notify_class_students_exam_change(
    db: AsyncSession,
    class_id: UUID,
    *,
    operation: str,
    subject: str | None = None,
    exam_date: date | None = None,
    start_time: time | None = None,
    end_time: time | None = None,
    room: str | None = None,
    import_count: int | None = None,
) -> int:
    title, body = build_exam_notification_copy(
        operation,
        subject=subject,
        exam_date=exam_date,
        start_time=start_time,
        end_time=end_time,
        room=room,
        import_count=import_count,
    )
    result = await db.execute(select(Student.id).where(Student.class_id == class_id))
    student_ids = list(result.scalars().all())
    sent = 0
    for student_id in student_ids:
        notification = await create_notification(
            db,
            student_id=student_id,
            title=title,
            body=body,
            notification_type="exam",
            payload={
                "class_id": str(class_id),
                "content_type": "EXAM",
                "operation": str(operation or "").upper().strip(),
                "source": "class_admin",
                "daily_cap_exempt": True,
            },
        )
        if notification:
            sent += 1
    return sent


def build_project_notification_copy(
    operation: str,
    *,
    name: str | None = None,
    subject: str | None = None,
    due_date: date | None = None,
    members: list[str] | None = None,
) -> tuple[str, str]:
    op = str(operation or "UPDATE").upper().strip()
    date_label = due_date.strftime("%a %d %b %Y") if due_date else "soon"
    team = ""
    if members:
        team = f" Team: {', '.join(members[:6])}."

    if op == "CREATE" and name:
        subj = f" ({subject})" if subject else ""
        return (
            f"New project: {name}",
            f"Your class added {name}{subj} — due {date_label}.{team}",
        )
    if op == "UPDATE" and name:
        return (
            f"Project updated: {name}",
            f"{name} was updated — due {date_label}.{team}",
        )
    if op == "DELETE" and name:
        return f"Project removed: {name}", f"{name} was removed from your class projects."
    return "Class projects updated", "Your class project list changed."


async def notify_class_students_project_change(
    db: AsyncSession,
    class_id: UUID,
    *,
    operation: str,
    name: str | None = None,
    subject: str | None = None,
    due_date: date | None = None,
    members: list[str] | None = None,
) -> int:
    title, body = build_project_notification_copy(
        operation,
        name=name,
        subject=subject,
        due_date=due_date,
        members=members,
    )
    result = await db.execute(select(Student.id).where(Student.class_id == class_id))
    student_ids = list(result.scalars().all())
    sent = 0
    for student_id in student_ids:
        notification = await create_notification(
            db,
            student_id=student_id,
            title=title,
            body=body,
            notification_type="project",
            payload={
                "class_id": str(class_id),
                "content_type": "PROJECT",
                "operation": str(operation or "").upper().strip(),
                "source": "class_admin",
                "daily_cap_exempt": True,
            },
        )
        if notification:
            sent += 1
    return sent
