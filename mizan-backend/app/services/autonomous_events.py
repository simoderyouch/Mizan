from dataclasses import dataclass
from datetime import date, datetime, timezone
import hashlib
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.agent_orchestrator_service import run_react_cycle


@dataclass(frozen=True)
class AutonomousEvent:
    event_type: str
    student_id: UUID
    idempotency_key: str
    payload: dict | None = None


def build_checkin_event(period: str, *, student_id: UUID, checkin_date: date) -> AutonomousEvent:
    normalized_period = period.upper().strip()
    event_type = f"{normalized_period}_CHECKIN_SUBMITTED"
    idempotency_key = f"{normalized_period}:{student_id}:{checkin_date.isoformat()}"
    return AutonomousEvent(
        event_type=event_type,
        student_id=student_id,
        idempotency_key=idempotency_key,
        payload={"period": normalized_period, "date": checkin_date.isoformat()},
    )


def build_chat_event(channel: str, *, student_id: UUID, message: str) -> AutonomousEvent:
    normalized_channel = channel.upper().strip()
    now = datetime.now(timezone.utc)
    cleaned_message = str(message or "").strip()
    fingerprint_source = cleaned_message if cleaned_message else "empty"
    fingerprint = hashlib.sha1(fingerprint_source.encode("utf-8")).hexdigest()[:12]
    event_type = f"{normalized_channel}_CHAT_MESSAGE"
    idempotency_key = f"{event_type}:{student_id}:{int(now.timestamp() * 1000)}:{fingerprint}"
    return AutonomousEvent(
        event_type=event_type,
        student_id=student_id,
        idempotency_key=idempotency_key,
        payload={
            "channel": normalized_channel,
            "message": cleaned_message[:500],
            "timestamp": now.isoformat(),
        },
    )


def build_periodic_scan_event(student_id: UUID) -> AutonomousEvent:
    event_type = "PERIODIC_SCAN"
    # Idempotency key changes every 4 hours to allow periodic runs
    now_ts = int(date.today().toordinal())  # Same for the whole day by default, but let's make it more granular if needed
    # Actually, let's use a 5-minute window to match the new scheduler frequency
    import time
    window = int(time.time() / (5 * 60))
    idempotency_key = f"periodic:{student_id}:{window}"
    return AutonomousEvent(
        event_type=event_type,
        student_id=student_id,
        idempotency_key=idempotency_key,
        payload={"window": window},
    )


def build_metadata_update_event(
    *,
    student_id: UUID,
    metadata_type: str,
    operation: str,
    class_id: UUID,
) -> AutonomousEvent:
    now = datetime.now(timezone.utc)
    normalized_type = str(metadata_type or "GENERIC").upper().strip()
    normalized_operation = str(operation or "UPDATED").upper().strip()
    event_type = f"{normalized_type}_METADATA_UPDATED"
    idempotency_key = (
        f"{event_type}:{normalized_operation}:{class_id}:{student_id}:{int(now.timestamp() * 1000)}"
    )
    return AutonomousEvent(
        event_type=event_type,
        student_id=student_id,
        idempotency_key=idempotency_key,
        payload={
            "metadata_type": normalized_type,
            "operation": normalized_operation,
            "class_id": str(class_id),
            "timestamp": now.isoformat(),
        },
    )


async def publish_autonomous_event(db: AsyncSession, event: AutonomousEvent) -> None:
    await run_react_cycle(db, event)
