from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.services.notification_realtime import notification_connections


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


async def create_notification(
    db: AsyncSession,
    *,
    student_id: UUID,
    title: str,
    body: str,
    notification_type: str = "info",
    payload: dict | None = None,
) -> Notification:
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
    await notification_connections.send_to_student(
        student_id,
        {"type": "notification.created", "notification": notification_to_payload(notification)},
    )
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
