from datetime import datetime, time, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

import httpx
from app.core.config import get_settings
from app.models.notification import Notification
from app.models.student import Student
from app.services.notification_realtime import notification_connections

settings = get_settings()

DAILY_CAPPED_NOTIFICATION_TYPES = {
    "wellbeing",
    "task",
    "mode",
    "low_mood_resource",
    "sleep_low",
    "project_overdue",
    "exam_load_stabilization",
    "critical_stabilization",
    "sport_reset",
    "periodic_scan",
    "metadata_exam_major",
    "metadata_exam_minor",
    "metadata_project_major",
    "metadata_project_minor",
    "metadata_schedule_major",
    "metadata_schedule_minor",
}

AUTOMATED_NOTIFICATION_TYPES = frozenset(
    {
        "wellbeing",
        "task",
        "mode",
        "low_mood_resource",
        "sleep_low",
        "project_overdue",
        "exam_load_stabilization",
        "critical_stabilization",
        "sport_reset",
        "periodic_scan",
        "critical_wellbeing",
        "critical_wellbeing_followup",
        "critical_fatigue",
        "critical_fatigue_followup",
    }
)

CAP_EXEMPT_NOTIFICATION_TYPES = {
    "critical_wellbeing",
    "critical_wellbeing_followup",
    "critical_fatigue",
    "critical_fatigue_followup",
    "safety",
    "emergency",
    "exam",
    "project",
    "info",
    "metadata_exam_urgent",
    "metadata_project_urgent",
}


def notification_to_payload(notification: Notification) -> dict:
    return {
        "id": str(notification.id),
        "student_id": str(notification.student_id),
        "type": notification.type,
        "title": notification.title,
        "body": notification.body,
        "payload": notification.payload,
        "is_read": notification.is_read,
        "read_at": notification.read_at.isoformat() if notification.read_at else None,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
    }


def is_daily_cap_exempt(notification_type: str) -> bool:
    normalized = (notification_type or "").strip().lower()
    return normalized in CAP_EXEMPT_NOTIFICATION_TYPES or normalized.startswith("critical_")


def should_apply_daily_cap(notification_type: str, payload: dict | None = None) -> bool:
    normalized = (notification_type or "").strip().lower()
    if is_daily_cap_exempt(normalized):
        return False
    payload = payload or {}
    if payload.get("daily_cap_exempt") is True:
        return False
    if payload.get("trigger") == "agent":
        return True
    if normalized == "task":
        return payload.get("source") in {"agent", "chat"} or bool(payload.get("contract_id"))
    return normalized in DAILY_CAPPED_NOTIFICATION_TYPES


def _effective_cooldown_hours(notification_type: str, requested_hours: int) -> int:
    normalized = (notification_type or "").strip().lower()
    if is_daily_cap_exempt(normalized):
        return max(requested_hours, settings.CRITICAL_NOTIFICATION_COOLDOWN_HOURS)
    if normalized == "task":
        return max(requested_hours, settings.AGENT_TASK_NOTIFICATION_COOLDOWN_HOURS)
    return max(0, requested_hours)


def _is_automated_notification_type(notification_type: str) -> bool:
    normalized = (notification_type or "").strip().lower()
    return normalized in AUTOMATED_NOTIFICATION_TYPES or normalized.startswith("critical_")


async def _automated_notification_rate_limited(db: AsyncSession, *, student_id: UUID) -> bool:
    hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    result = await db.execute(
        select(Notification).where(
            and_(Notification.student_id == student_id, Notification.created_at >= hour_ago)
        )
    )
    automated = sum(
        1 for row in result.scalars().all() if _is_automated_notification_type(row.type or "")
    )
    return automated >= max(1, settings.AGENT_NOTIFICATION_MAX_PER_HOUR)


async def _critical_notification_daily_limited(db: AsyncSession, *, student_id: UUID) -> bool:
    today = datetime.now(timezone.utc).date()
    start_at = datetime.combine(today, time.min, tzinfo=timezone.utc)
    result = await db.execute(
        select(Notification).where(
            and_(Notification.student_id == student_id, Notification.created_at >= start_at)
        )
    )
    critical_count = sum(
        1 for row in result.scalars().all() if (row.type or "").strip().lower().startswith("critical_")
    )
    return critical_count >= max(1, settings.CRITICAL_NOTIFICATION_MAX_PER_DAY)


async def has_recent_notification(
    db: AsyncSession,
    *,
    student_id: UUID,
    notification_type: str,
    cooldown_hours: int,
    title: str | None = None,
) -> bool:
    hours = _effective_cooldown_hours(notification_type, cooldown_hours)
    if hours <= 0:
        return False
    cooldown_since = datetime.now(timezone.utc) - timedelta(hours=hours)
    conditions = [
        Notification.student_id == student_id,
        Notification.type == notification_type,
        Notification.created_at >= cooldown_since,
    ]
    if title and title.strip():
        conditions.append(Notification.title == title.strip())
    result = await db.execute(select(Notification).where(and_(*conditions)))
    return result.scalars().first() is not None


async def _daily_capped_notification_count(db: AsyncSession, *, student_id: UUID) -> int:
    today = datetime.now(timezone.utc).date()
    start_at = datetime.combine(today, time.min, tzinfo=timezone.utc)
    end_at = datetime.combine(today, time.max, tzinfo=timezone.utc)
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.student_id == student_id,
                Notification.created_at >= start_at,
                Notification.created_at <= end_at,
            )
        )
    )
    return sum(
        1
        for item in result.scalars().all()
        if should_apply_daily_cap(item.type, item.payload)
    )


async def create_notification(
    db: AsyncSession,
    *,
    student_id: UUID,
    title: str,
    body: str,
    notification_type: str = "info",
    payload: dict | None = None,
    cooldown_hours: int | None = None,
    bypass_cooldown: bool = False,
) -> Notification | None:
    normalized_type = (notification_type or "").strip().lower()
    if not bypass_cooldown:
        if _is_automated_notification_type(normalized_type):
            if await _automated_notification_rate_limited(db, student_id=student_id):
                return None
        if is_daily_cap_exempt(normalized_type):
            if await _critical_notification_daily_limited(db, student_id=student_id):
                return None
        if cooldown_hours is not None:
            if await has_recent_notification(
                db,
                student_id=student_id,
                notification_type=notification_type,
                cooldown_hours=cooldown_hours,
                title=title,
            ):
                return None

    if should_apply_daily_cap(notification_type, payload):
        existing_count = await _daily_capped_notification_count(db, student_id=student_id)
        if existing_count >= max(0, settings.DAILY_WELLBEING_NOTIFICATION_CAP):
            return None

    notification = Notification(
        student_id=student_id,
        type=notification_type,
        title=title.strip(),
        body=body.strip(),
        payload=payload,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    
    # Send WebSocket realtime notification
    await notification_connections.send_to_student(
        student_id,
        {"type": "notification.created", "notification": notification_to_payload(notification)},
    )
    
    # Send actual Mobile OS Push Notification
    student_res = await db.execute(select(Student).where(Student.id == student_id))
    student = student_res.scalars().first()
    
    if student and getattr(student, "expo_push_token", None):
        async with httpx.AsyncClient() as client:
            try:
                await client.post(
                    "https://exp.host/--/api/v2/push/send",
                    json={
                        "to": student.expo_push_token,
                        "title": notification.title,
                        "body": notification.body,
                        "data": notification.payload or {},
                        "sound": "default",
                        "channelId": "default"
                    },
                    timeout=5.0
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Push notification failed: {e}")
                
    return notification


async def list_notifications(
    db: AsyncSession,
    *,
    student_id: UUID,
    unread_only: bool = False,
    limit: int = 50,
) -> list[Notification]:
    normalized_limit = max(1, min(limit, 200))
    query = select(Notification).where(Notification.student_id == student_id)
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
    query = query.order_by(Notification.created_at.desc()).limit(normalized_limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def mark_notification_read(
    db: AsyncSession,
    *,
    student_id: UUID,
    notification_id: UUID,
    is_read: bool,
) -> Notification:
    result = await db.execute(
        select(Notification).where(
            and_(Notification.id == notification_id, Notification.student_id == student_id)
        )
    )
    notification = result.scalars().first()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    notification.is_read = is_read
    notification.read_at = datetime.now(timezone.utc) if is_read else None
    await db.commit()
    await db.refresh(notification)
    return notification


async def mark_all_notifications_read(
    db: AsyncSession,
    *,
    student_id: UUID,
) -> int:
    result = await db.execute(
        select(Notification).where(
            and_(Notification.student_id == student_id, Notification.is_read.is_(False))
        )
    )
    unread_notifications = list(result.scalars().all())
    now = datetime.now(timezone.utc)
    for n in unread_notifications:
        n.is_read = True
        n.read_at = now

    await db.commit()
    return len(unread_notifications)
