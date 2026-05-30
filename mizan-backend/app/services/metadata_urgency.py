"""Urgent agent decisions when admin adds class content with a close deadline."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any


EXAM_URGENT_DAYS = 14
PROJECT_URGENT_DAYS = 21


def _parse_iso_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def days_until(target: date, *, today: date | None = None) -> int:
    ref = today or date.today()
    return (target - ref).days


def is_urgent_metadata_update(metadata_type: str, operation: str, content_details: dict | None) -> bool:
    if not content_details:
        return False
    op = str(operation or "").upper().strip()
    if op not in {"CREATE", "IMPORT", "UPDATE"}:
        return False

    mtype = str(metadata_type or "").upper().strip()
    if mtype == "EXAM":
        exam_date = _parse_iso_date(content_details.get("exam_date"))
        if exam_date is None:
            return op in {"CREATE", "IMPORT"}
        return days_until(exam_date) <= EXAM_URGENT_DAYS
    if mtype == "PROJECT":
        due_date = _parse_iso_date(content_details.get("due_date"))
        if due_date is None:
            return op in {"CREATE", "IMPORT"}
        return days_until(due_date) <= PROJECT_URGENT_DAYS
    return False


def build_urgent_metadata_force_decision(
    metadata_type: str,
    operation: str,
    content_details: dict | None,
) -> dict | None:
    if not is_urgent_metadata_update(metadata_type, operation, content_details):
        return None

    details = content_details or {}
    op = str(operation or "").upper().strip()
    mtype = str(metadata_type or "").upper().strip()
    base = {
        "confidence": 1.0,
        "cooldown_bypass": True,
        "allow_duplicate_tasks": True,
        "task_dedup_hours": 0,
        "notification_cooldown_hours": 0,
        "skip_extra_mode_task": True,
    }

    if mtype == "EXAM":
        subject = str(details.get("subject") or "Exam").strip() or "Exam"
        exam_date = _parse_iso_date(details.get("exam_date"))
        days = days_until(exam_date) if exam_date else 0
        when = "tomorrow" if days <= 1 else f"in {days} days" if days >= 0 else "soon"
        date_label = exam_date.strftime("%a %d %b") if exam_date else "soon"
        room = str(details.get("room") or "").strip()
        room_bit = f" (room {room})" if room else ""
        return {
            **base,
            "action": "SEND_AND_CREATE",
            "thought": (
                f"Admin {op.lower()} exam {subject} ({date_label}) — deadline {when}; "
                "immediate student action required."
            ),
            "suggested_mode": "EXAMEN" if days <= 2 else "REVISION",
            "notification_title": f"Urgent: {subject} exam {when}",
            "notification_body": (
                f"Your class added/updated {subject} — exam {date_label}{room_bit}. "
                "Mizan created a prep task on your list now."
            ),
            "task_title": f"{subject} · urgent exam prep (40 min)",
            "task_description": (
                f"40-minute focused block on {subject} (exam {when}, {date_label}). "
                "Pick one topic list and finish one practice set."
            ),
            "notification_type": "metadata_exam_urgent",
        }

    if mtype == "PROJECT":
        name = str(details.get("name") or "Project").strip() or "Project"
        subject = str(details.get("subject") or "").strip()
        label = f"{name} ({subject})" if subject else name
        due_date = _parse_iso_date(details.get("due_date"))
        days = days_until(due_date) if due_date else 0
        when = "tomorrow" if days <= 1 else f"in {days} days" if days >= 0 else "soon"
        date_label = due_date.strftime("%a %d %b") if due_date else "soon"
        members = details.get("members") or []
        team = ""
        if isinstance(members, list) and members:
            team = f" Team: {', '.join(str(m) for m in members[:5])}."
        return {
            **base,
            "action": "SEND_AND_CREATE",
            "thought": (
                f"Admin {op.lower()} project {label} (due {date_label}) — "
                "close deadline; immediate sprint required."
            ),
            "suggested_mode": "PROJET",
            "notification_title": f"Urgent: {name} due {when}",
            "notification_body": (
                f"New/updated project {label} — due {date_label}.{team} "
                "Mizan added a milestone sprint to your tasks."
            ),
            "task_title": f"{name} · urgent project sprint (45 min)",
            "task_description": (
                f"45-minute sprint on {label} (due {when}). Ship one visible deliverable "
                "(section, diagram, or commit)."
            ),
            "notification_type": "metadata_project_urgent",
        }

    return None
