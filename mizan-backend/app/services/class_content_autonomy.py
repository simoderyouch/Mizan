from uuid import UUID

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.student import Student
from app.services.autonomous_events import build_metadata_update_event, publish_autonomous_event


async def trigger_class_metadata_update_events(
    *,
    class_id: UUID,
    metadata_type: str,
    operation: str,
) -> int:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Student.id).where(Student.class_id == class_id))
        student_ids = list(result.scalars().all())

        for student_id in student_ids:
            event = build_metadata_update_event(
                student_id=student_id,
                metadata_type=metadata_type,
                operation=operation,
                class_id=class_id,
            )
            await publish_autonomous_event(db, event)

    return len(student_ids)
