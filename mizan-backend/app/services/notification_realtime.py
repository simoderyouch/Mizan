from collections import defaultdict
from uuid import UUID

from fastapi import WebSocket


class NotificationConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, student_id: UUID, websocket: WebSocket) -> None:
        self._connections[str(student_id)].add(websocket)

    def disconnect(self, student_id: UUID, websocket: WebSocket) -> None:
        key = str(student_id)
        sockets = self._connections.get(key)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(key, None)

    async def send_to_student(self, student_id: UUID, payload: dict) -> None:
        key = str(student_id)
        sockets = list(self._connections.get(key, set()))
        stale: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except Exception:
                stale.append(socket)
        for socket in stale:
            self.disconnect(student_id, socket)


notification_connections = NotificationConnectionManager()
