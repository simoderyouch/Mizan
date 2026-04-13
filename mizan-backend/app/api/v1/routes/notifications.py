from uuid import UUID

from fastapi import APIRouter, Depends, Query, WebSocket, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, get_db
from app.core.dependencies import get_current_user
from app.core.security import decode_token
from app.models.user import User
from app.schemas.notification import NotificationReadUpdate, NotificationResponse
from app.services.notification_realtime import notification_connections
from app.services.notification_service import (
    list_notifications,
    mark_all_notifications_read,
    mark_notification_read,
    notification_to_payload,
)
from app.services.student_service import get_student_by_user_id

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _extract_websocket_token(websocket: WebSocket) -> str:
    query_token = (websocket.query_params.get("token") or "").strip()
    if query_token:
        return query_token
    auth_header = (websocket.headers.get("authorization") or "").strip()
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    return ""


async def _authenticate_websocket_user(websocket: WebSocket) -> User | None:
    token = _extract_websocket_token(websocket)
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return None
    try:
        payload = decode_token(token)
        user_id = payload.get("user_id")
        if not user_id:
            raise JWTError("user_id missing")
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return None

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unknown user")
            return None
        return user


@router.get("/", response_model=list[NotificationResponse])
async def api_list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_by_user_id(db, current_user.id)
    return await list_notifications(db, student_id=student.id, unread_only=unread_only, limit=limit)


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def api_mark_notification_read(
    notification_id: UUID,
    payload: NotificationReadUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_by_user_id(db, current_user.id)
    return await mark_notification_read(
        db,
        student_id=student.id,
        notification_id=notification_id,
        is_read=payload.is_read,
    )


@router.post("/read-all", status_code=status.HTTP_200_OK)
async def api_mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_by_user_id(db, current_user.id)
    count = await mark_all_notifications_read(db, student_id=student.id)
    
    # Broadcast update via WebSocket
    await notification_connections.send_to_student(
        student.id,
        {"type": "notification.all_read", "updated_count": count}
    )
    
    return {"updated_count": count}


@router.websocket("/ws")
async def api_notifications_ws(websocket: WebSocket):
    current_user = await _authenticate_websocket_user(websocket)
    if not current_user:
        return

    async with AsyncSessionLocal() as db:
        student = await get_student_by_user_id(db, current_user.id)

    await websocket.accept()
    await notification_connections.connect(student.id, websocket)
    try:
        async with AsyncSessionLocal() as db:
            recent = await list_notifications(db, student_id=student.id, unread_only=False, limit=20)
            await websocket.send_json(
                {
                    "type": "notification.snapshot",
                    "notifications": [notification_to_payload(item) for item in recent],
                }
            )

        while True:
            packet = await websocket.receive()
            packet_type = packet.get("type")
            if packet_type == "websocket.disconnect":
                break
            text = (packet.get("text") or "").strip().lower()
            if text == "ping":
                await websocket.send_json({"type": "pong"})
    finally:
        notification_connections.disconnect(student.id, websocket)
