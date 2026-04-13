from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_contract import AgentActionContract
from app.models.task import Task
from app.services.notification_service import create_notification

ADAPTIVE_LEVELS = ("standard", "gentle", "micro")
CONTRACT_DEDUP_HOURS = 1


def contract_minutes_for_level(level: str) -> int:
    if level == "micro":
        return 10
    if level == "gentle":
        return 15
    return 20


def normalize_adaptive_level(level: str | None) -> str:
    normalized = str(level or "standard").strip().lower()
    if normalized not in ADAPTIVE_LEVELS:
        return "standard"
    return normalized


def adapt_task_for_level(title: str, description: str | None, level: str) -> tuple[str, str | None]:
    normalized = normalize_adaptive_level(level)
    desc = (description or "").strip() or None
    if normalized == "standard":
        return title, desc
    if normalized == "gentle":
        adapted_title = f"{title} (light)"
        adapted_desc = desc or "Keep this short and realistic. One focused mini-step is enough."
        return adapted_title[:180], adapted_desc
    adapted_title = f"{title} (micro-step)"
    adapted_desc = "Do only a 10-minute starter step. Success = showing up, not perfection."
    return adapted_title[:180], adapted_desc


async def get_adaptive_level(db: AsyncSession, student_id: UUID) -> str:
    result = await db.execute(
        select(AgentActionContract)
        .where(AgentActionContract.student_id == student_id)
        .order_by(desc(AgentActionContract.created_at))
        .limit(20)
    )
    recent = list(result.scalars().all())
    if len(recent) < 3:
        return "standard"

    accepted = [c for c in recent if c.status in {"accepted", "completed"}]
    completed = [c for c in recent if c.status == "completed"]
    if not accepted:
        return "micro"
    completion_rate = len(completed) / len(accepted)
    if completion_rate < 0.3:
        return "micro"
    if completion_rate < 0.6:
        return "gentle"
    return "standard"


async def create_action_contract(
    db: AsyncSession,
    *,
    student_id: UUID,
    run_id: UUID,
    task_id: UUID | None,
    contract_text: str,
    adaptive_level: str,
) -> AgentActionContract | None:
    level = normalize_adaptive_level(adaptive_level)
    normalized_text = contract_text.strip()
    recent_cutoff = datetime.now(timezone.utc) - timedelta(hours=CONTRACT_DEDUP_HOURS)
    recent_result = await db.execute(
        select(AgentActionContract)
        .where(
            and_(
                AgentActionContract.student_id == student_id,
                AgentActionContract.contract_text == normalized_text,
                AgentActionContract.created_at >= recent_cutoff,
            )
        )
        .order_by(desc(AgentActionContract.created_at))
        .limit(1)
    )
    if recent_result.scalars().first():
        return None

    now = datetime.now(timezone.utc)
    minutes = contract_minutes_for_level(level)
    due_at = now + timedelta(minutes=minutes)
    followup_at = due_at
    contract = AgentActionContract(
        student_id=student_id,
        run_id=run_id,
        task_id=task_id,
        contract_text=normalized_text,
        adaptive_level=level,
        status="pending",
        due_at=due_at,
        followup_at=followup_at,
    )
    db.add(contract)
    await db.commit()
    await db.refresh(contract)

    await create_notification(
        db,
        student_id=student_id,
        title="Action contract",
        body=(
            f"{contract.contract_text} Confirm within {minutes} minutes. "
            "Use /agent/contracts to accept/decline."
        ),
        notification_type="task",
        payload={"contract_id": str(contract.id), "adaptive_level": level, "minutes": minutes},
    )
    return contract


async def list_action_contracts(
    db: AsyncSession,
    *,
    student_id: UUID,
    status_filter: str | None = None,
    limit: int = 30,
) -> list[AgentActionContract]:
    normalized_limit = max(1, min(limit, 100))
    query = select(AgentActionContract).where(AgentActionContract.student_id == student_id)
    if status_filter:
        query = query.where(AgentActionContract.status == status_filter)
    query = query.order_by(AgentActionContract.created_at.desc()).limit(normalized_limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def respond_action_contract(
    db: AsyncSession,
    *,
    student_id: UUID,
    contract_id: UUID,
    accepted: bool,
) -> AgentActionContract:
    result = await db.execute(
        select(AgentActionContract).where(
            and_(AgentActionContract.id == contract_id, AgentActionContract.student_id == student_id)
        )
    )
    contract = result.scalars().first()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    contract.status = "accepted" if accepted else "declined"
    contract.responded_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(contract)
    return contract


async def complete_action_contract(
    db: AsyncSession, *, student_id: UUID, contract_id: UUID
) -> AgentActionContract:
    result = await db.execute(
        select(AgentActionContract).where(
            and_(AgentActionContract.id == contract_id, AgentActionContract.student_id == student_id)
        )
    )
    contract = result.scalars().first()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    contract.status = "completed"
    contract.completed_at = datetime.now(timezone.utc)
    if contract.task_id:
        task_result = await db.execute(select(Task).where(Task.id == contract.task_id))
        task = task_result.scalars().first()
        if task and task.status != "done":
            task.status = "done"
            task.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(contract)
    return contract


async def process_due_contract_followups(
    db: AsyncSession, *, student_id: UUID | None = None, limit: int = 30
) -> int:
    now = datetime.now(timezone.utc)
    query = select(AgentActionContract).where(
        and_(
            AgentActionContract.followup_sent_at.is_(None),
            AgentActionContract.followup_at <= now,
            AgentActionContract.status.in_(["pending", "accepted"]),
        )
    )
    if student_id:
        query = query.where(AgentActionContract.student_id == student_id)
    query = query.order_by(AgentActionContract.followup_at.asc()).limit(max(1, min(limit, 200)))
    result = await db.execute(query)
    contracts = list(result.scalars().all())

    sent_count = 0
    for contract in contracts:
        if contract.status == "accepted":
            body = (
                "Follow-up: did you complete your commitment? "
                "Mark it complete in /agent/contracts to improve adaptive guidance."
            )
        else:
            body = (
                "Follow-up: your action contract is still pending. "
                "Accept a smaller step now to reduce future stress."
            )
        await create_notification(
            db,
            student_id=contract.student_id,
            title="Commitment follow-up",
            body=body,
            notification_type="wellbeing",
            payload={"contract_id": str(contract.id), "status": contract.status},
        )
        contract.followup_sent_at = now
        sent_count += 1

    if sent_count:
        await db.commit()
    return sent_count
