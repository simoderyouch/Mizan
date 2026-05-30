import time
from uuid import uuid4
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from typing import Literal
from app.core.rate_limit import limiter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.agent_run import AgentRun
from app.models.agent_contract import AgentActionContract
from app.models.notification import Notification
from app.models.user import User
from app.services.autonomous_events import (
    AutonomousEvent,
    build_chat_event,
    publish_autonomous_event,
)
from app.services.agent_contract_service import (
    complete_action_contract,
    list_action_contracts,
    process_due_contract_followups,
    respond_action_contract,
    trigger_label_for,
)
from app.services.agent_orchestrator_service import summarize_agent_run_for_client
from app.services.agent_orchestrator_service import summarize_agent_run_for_client
from app.services.agent_service import chat_with_agent, generate_daily_plan
from app.services.context_builder import build_agent_context
from app.services.student_service import get_student_by_user_id

router = APIRouter(prefix="/agent", tags=["Agent"])


class PlanRequest(BaseModel):
    sleep_hours: float = Field(ge=0, le=16)
    mood_score: int = Field(ge=1, le=5)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=24)


class AgentActionSummary(BaseModel):
    run_id: str | None = None
    status: str | None = None
    action: str | None = None
    took_action: bool = False
    skipped: bool = False
    message: str | None = None
    skip_reason: str | None = None
    actions: list[str] = Field(default_factory=list)
    notification_id: str | None = None
    task_id: str | None = None
    contract_id: str | None = None
    thought: str | None = None


class ChatResponse(BaseModel):
    response: str
    safety_level: str | None = None
    safety_action: str | None = None
    agent_action: AgentActionSummary | None = None


class AgentTestTriggerRequest(BaseModel):
    event_type: str = Field(default="MANUAL_TEST", min_length=3, max_length=60)
    note: str = Field(default="", max_length=300)


class AgentTestDecisionResponse(BaseModel):
    id: str
    action: str
    thought: str | None
    confidence: float | None
    result: dict | None
    created_at: str


class AgentTestRunResponse(BaseModel):
    id: str
    trigger_type: str
    idempotency_key: str
    status: str
    reasoning_summary: str | None
    created_at: str
    decisions: list[AgentTestDecisionResponse]


class AgentTestTriggerResponse(BaseModel):
    run: AgentTestRunResponse


class AgentContractResponse(BaseModel):
    id: str
    student_id: str
    run_id: str
    task_id: str | None
    task_title: str | None = None
    contract_text: str
    adaptive_level: str
    status: str
    due_at: str
    followup_at: str
    responded_at: str | None
    completed_at: str | None
    followup_sent_at: str | None
    decline_reason: str | None = None
    trigger_type: str | None = None
    trigger_label: str | None = None
    created_at: str


class AgentContractRespondRequest(BaseModel):
    accepted: bool = True
    decline_reason: str | None = Field(default=None, max_length=40)


class AgentContractCompleteRequest(BaseModel):
    from_pending: bool = False


class ProcessFollowupsResponse(BaseModel):
    sent: int


def _forced_decision_for_event(event_type: str) -> dict | None:
    if event_type == "FORCE_HIGH_STRESS_EXAM_CRUNCH":
        return {
            "action": "SEND_AND_CREATE",
            "thought": "Forced high-stress scenario: exam crunch with overload signs.",
            "notification_title": "High stress: exam crunch plan",
            "notification_body": "Pressure is high before exams. Take a 10-minute reset, then one protected EXAMEN focus block.",
            "notification_type": "mode",
            "task_title": "Stress reset + 30-min exam sprint",
            "task_description": "Do a 10-minute calming reset, then one 30-minute focused exam sprint with no distractions.",
            "suggested_mode": "EXAMEN",
            "task_dedup_hours": 0,
            "notification_cooldown_hours": 0,
            "confidence": 1.0,
        }
    if event_type == "FORCE_HIGH_STRESS_BURNOUT_RISK":
        return {
            "action": "ESCALATE_WELLBEING",
            "thought": "Forced high-stress scenario: burnout risk and persistent distress.",
            "notification_title": "High stress alert: burnout risk",
            "notification_body": "Sustained overload detected. Prioritize recovery and reduce load now — Mizan queued an urgent plan.",
            "notification_type": "critical_wellbeing",
            "followup_notification_type": "critical_wellbeing_followup",
            "task_title": "Burnout prevention protocol",
            "task_description": "Take a 20-minute recovery block, pause non-urgent work, and complete one minimal priority task.",
            "notification_cooldown_hours": 0,
            "followup_cooldown_hours": 0,
            "confidence": 1.0,
        }
    if event_type == "FORCE_HIGH_STRESS_OVERDUE_SPIRAL":
        return {
            "action": "PROPOSE_MODE_SWITCH",
            "thought": "Forced high-stress scenario: overdue tasks spiral with urgency.",
            "notification_title": "Stabilize workload now",
            "notification_body": "Too many overdue items. Switch to PROJET mode and clear one high-impact milestone.",
            "notification_type": "mode",
            "suggested_mode": "PROJET",
            "notification_cooldown_hours": 0,
            "confidence": 1.0,
        }
    if event_type == "FORCE_AFTER_LUNCH_RESET":
        return {
            "action": "SEND_AND_CREATE",
            "thought": "Forced validation scenario: post-lunch energy dip intervention.",
            "notification_title": "After-lunch reset",
            "notification_body": "Energy dip detected after lunch. Reset for 10 minutes, then start one short REVISION sprint.",
            "notification_type": "info",
            "task_title": "Post-lunch reset + 25-min focus sprint",
            "task_description": "Take 10 minutes to reset after lunch, then complete one 25-minute focused task.",
            "suggested_mode": "REVISION",
            "task_dedup_hours": 0,
            "notification_cooldown_hours": 0,
            "confidence": 1.0,
        }
    if event_type == "FORCE_MODE_SWITCH":
        return {
            "action": "PROPOSE_MODE_SWITCH",
            "thought": "Forced validation scenario: mode switch suggestion.",
            "notification_title": "Suggested mode: EXAMEN",
            "notification_body": "Switch to EXAMEN mode now for focused preparation — a sprint task was added.",
            "notification_type": "mode",
            "suggested_mode": "EXAMEN",
            "notification_cooldown_hours": 0,
            "confidence": 1.0,
        }
    if event_type == "FORCE_RESOURCE_NUDGE":
        return {
            "action": "SEND_RESOURCE_NUDGE",
            "thought": "Forced validation scenario: resource auto-delivery.",
            "notification_title": "Targeted support resource",
            "notification_body": "Mizan selected one wellbeing resource matched to your current context.",
            "notification_type": "low_mood_resource",
            "resource_index": 0,
            "notification_cooldown_hours": 0,
            "confidence": 1.0,
        }
    if event_type == "FORCE_ESCALATION":
        return {
            "action": "ESCALATE_WELLBEING",
            "thought": "Forced validation scenario: persistent low-mood escalation.",
            "notification_title": "High-priority wellbeing support",
            "notification_body": "Escalation: prioritize recovery now. A commitment and follow-up were scheduled.",
            "notification_type": "critical_wellbeing",
            "followup_notification_type": "critical_wellbeing_followup",
            "task_title": "Urgent wellbeing reset + one academic win",
            "task_description": "Complete a short wellbeing reset then one focused sprint.",
            "notification_cooldown_hours": 0,
            "followup_cooldown_hours": 0,
            "confidence": 1.0,
        }
    if event_type == "FORCE_CHECKIN_REMINDER":
        return {
            "action": "SEND_NOTIFICATION",
            "thought": "Forced validation scenario: missing check-in reminder on a busy day.",
            "notification_title": "Morning check-in reminder",
            "notification_body": "You have not checked in today. A 2-minute check-in helps Mizan adapt your plan.",
            "notification_type": "info",
            "notification_cooldown_hours": 0,
            "confidence": 1.0,
        }
    return None


def _serialize_run(run: AgentRun) -> AgentTestRunResponse:
    decisions = sorted(list(run.decisions or []), key=lambda item: item.created_at)
    return AgentTestRunResponse(
        id=str(run.id),
        trigger_type=run.trigger_type,
        idempotency_key=run.idempotency_key,
        status=run.status,
        reasoning_summary=run.reasoning_summary,
        created_at=run.created_at.isoformat(),
        decisions=[
            AgentTestDecisionResponse(
                id=str(item.id),
                action=item.action,
                thought=item.thought,
                confidence=item.confidence,
                result=item.result,
                created_at=item.created_at.isoformat(),
            )
            for item in decisions
        ],
    )


def _serialize_contract(contract: AgentActionContract) -> AgentContractResponse:
    trigger_type = contract.run.trigger_type if getattr(contract, "run", None) else None
    task_title = contract.task.title if getattr(contract, "task", None) else None
    return AgentContractResponse(
        id=str(contract.id),
        student_id=str(contract.student_id),
        run_id=str(contract.run_id),
        task_id=str(contract.task_id) if contract.task_id else None,
        task_title=task_title,
        contract_text=contract.contract_text,
        adaptive_level=contract.adaptive_level,
        status=contract.status,
        due_at=contract.due_at.isoformat(),
        followup_at=contract.followup_at.isoformat(),
        responded_at=contract.responded_at.isoformat() if contract.responded_at else None,
        completed_at=contract.completed_at.isoformat() if contract.completed_at else None,
        followup_sent_at=contract.followup_sent_at.isoformat() if contract.followup_sent_at else None,
        decline_reason=contract.decline_reason,
        trigger_type=trigger_type,
        trigger_label=trigger_label_for(trigger_type),
        created_at=contract.created_at.isoformat(),
    )


def _parse_uuid_or_422(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid UUID") from exc


@router.get("/context")
async def api_get_context(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    return await build_agent_context(db, student.id)


@router.post("/plan")
@limiter.limit("5/minute")
async def api_generate_plan(
    request: Request,
    data: PlanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    student = await get_student_by_user_id(db, current_user.id)
    context = await build_agent_context(db, student.id)
    plan = await generate_daily_plan(context, data.sleep_hours, data.mood_score)
    return {"plan": plan}


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("5/minute")
async def api_chat_agent(
    request: Request,
    data: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_by_user_id(db, current_user.id)
    context = await build_agent_context(db, student.id)
    history = [{"role": t.role, "content": t.content} for t in data.history]
    response_payload = await chat_with_agent(context, data.message, conversation_history=history)
    agent_action: AgentActionSummary | None = None
    if response_payload.get("safety_level") != "high":
        run = await publish_autonomous_event(
            db,
            build_chat_event(
                "TEXT",
                student_id=student.id,
                message=data.message,
                conversation_history=history,
            ),
        )
        agent_action = AgentActionSummary(**summarize_agent_run_for_client(run))
    return ChatResponse(
        response=str(response_payload.get("response", "")),
        safety_level=response_payload.get("safety_level"),
        safety_action=response_payload.get("safety_action"),
        agent_action=agent_action,
    )


@router.get("/contracts", response_model=list[AgentContractResponse])
async def api_list_agent_contracts(
    status: str | None = None,
    limit: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_by_user_id(db, current_user.id)
    contracts = await list_action_contracts(
        db,
        student_id=student.id,
        status_filter=status,
        limit=limit,
    )
    return [_serialize_contract(item) for item in contracts]


@router.post("/contracts/{contract_id}/respond", response_model=AgentContractResponse)
async def api_respond_agent_contract(
    contract_id: str,
    data: AgentContractRespondRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_by_user_id(db, current_user.id)
    contract = await respond_action_contract(
        db,
        student_id=student.id,
        contract_id=_parse_uuid_or_422(contract_id),
        accepted=data.accepted,
        decline_reason=data.decline_reason,
    )
    return _serialize_contract(contract)


@router.post("/contracts/{contract_id}/complete", response_model=AgentContractResponse)
async def api_complete_agent_contract(
    contract_id: str,
    data: AgentContractCompleteRequest = AgentContractCompleteRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_by_user_id(db, current_user.id)
    contract = await complete_action_contract(
        db,
        student_id=student.id,
        contract_id=_parse_uuid_or_422(contract_id),
        from_pending=data.from_pending,
    )
    return _serialize_contract(contract)


@router.get("/test/runs", response_model=list[AgentTestRunResponse])
async def api_list_agent_test_runs(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_by_user_id(db, current_user.id)
    normalized_limit = max(1, min(limit, 100))
    result = await db.execute(
        select(AgentRun)
        .options(selectinload(AgentRun.decisions))
        .where(AgentRun.student_id == student.id)
        .order_by(AgentRun.created_at.desc())
        .limit(normalized_limit)
    )
    runs = list(result.scalars().all())
    return [_serialize_run(run) for run in runs]


@router.post("/test/trigger", response_model=AgentTestTriggerResponse)
async def api_trigger_agent_test_run(
    data: AgentTestTriggerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_by_user_id(db, current_user.id)
    event_type = data.event_type.upper().strip()
    now_ms = int(time.time() * 1000)
    forced_decision = _forced_decision_for_event(event_type)
    event = AutonomousEvent(
        event_type=f"MANUAL_{event_type}",
        student_id=student.id,
        idempotency_key=f"manual:{student.id}:{event_type}:{now_ms}:{uuid4()}",
        payload={
            "note": data.note,
            "source": "manual_validation",
            "forced": bool(forced_decision),
            "force_decision": forced_decision,
        },
    )
    await publish_autonomous_event(db, event)

    run_result = await db.execute(
        select(AgentRun)
        .options(selectinload(AgentRun.decisions))
        .where(AgentRun.idempotency_key == event.idempotency_key)
        .limit(1)
    )
    run = run_result.scalars().first()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Agent run was not persisted",
        )
    return AgentTestTriggerResponse(run=_serialize_run(run))


@router.post("/test/process-followups", response_model=ProcessFollowupsResponse)
async def api_process_followups_for_test(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_by_user_id(db, current_user.id)
    sent = await process_due_contract_followups(db, student_id=student.id, limit=100)
    return ProcessFollowupsResponse(sent=sent)


@router.get("/test/summary")
async def api_agent_test_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_by_user_id(db, current_user.id)
    runs_result = await db.execute(
        select(AgentRun)
        .where(AgentRun.student_id == student.id)
        .order_by(AgentRun.created_at.desc())
        .limit(30)
    )
    notifications_result = await db.execute(
        select(Notification)
        .where(Notification.student_id == student.id)
        .order_by(Notification.created_at.desc())
        .limit(30)
    )
    runs = list(runs_result.scalars().all())
    notifications = list(notifications_result.scalars().all())
    contracts_result = await db.execute(
        select(AgentActionContract)
        .where(AgentActionContract.student_id == student.id)
        .order_by(AgentActionContract.created_at.desc())
        .limit(30)
    )
    contracts = list(contracts_result.scalars().all())
    return {
        "runs_count": len(runs),
        "notifications_count": len(notifications),
        "contracts_count": len(contracts),
        "pending_contracts_count": len([item for item in contracts if item.status in {"pending", "accepted"}]),
        "latest_run": {
            "id": str(runs[0].id),
            "status": runs[0].status,
            "trigger_type": runs[0].trigger_type,
            "created_at": runs[0].created_at.isoformat(),
        }
        if runs
        else None,
        "latest_notification": {
            "id": str(notifications[0].id),
            "type": notifications[0].type,
            "title": notifications[0].title,
            "created_at": notifications[0].created_at.isoformat(),
        }
        if notifications
        else None,
        "latest_contract": {
            "id": str(contracts[0].id),
            "status": contracts[0].status,
            "adaptive_level": contracts[0].adaptive_level,
            "created_at": contracts[0].created_at.isoformat(),
        }
        if contracts
        else None,
    }
