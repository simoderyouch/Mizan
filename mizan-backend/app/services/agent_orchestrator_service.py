import asyncio
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.agent_run import AgentDecision, AgentRun
from app.models.notification import Notification
from app.models.task import Task
from app.services.context_builder import build_agent_context
from app.services.agent_policy import (
    ALLOWED_ACTIONS as _ALLOWED_ACTIONS,
    ALLOWED_MODES as _ALLOWED_MODES,
    deterministic_decision as _deterministic_decision,
    parse_decision as _parse_decision,
)
from app.services.agent_contract_service import (
    adapt_task_for_level,
    create_action_contract,
    get_adaptive_level,
    process_due_contract_followups,
)
from app.services.notification_service import create_notification

settings = get_settings()
DEFAULT_CHAT_COOLDOWN_MINUTES = 20
DEFAULT_TASK_DEDUP_HOURS = 2


def _extract_chat_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                text_value = item.strip()
            elif isinstance(item, dict):
                text_value = str(item.get("text", "")).strip()
            else:
                text_value = str(getattr(item, "text", "")).strip()
            if text_value:
                parts.append(text_value)
        return " ".join(parts).strip()
    return str(content or "").strip()


def _is_chat_event(event_type: str) -> bool:
    normalized = str(event_type or "").upper()
    return normalized.endswith("TEXT_CHAT_MESSAGE") or normalized.endswith("VOICE_CHAT_MESSAGE")


def _is_metadata_update_event(event_type: str) -> bool:
    normalized = str(event_type or "").upper()
    return normalized.endswith("_METADATA_UPDATED")


def _is_periodic_scan_event(event_type: str) -> bool:
    return str(event_type or "").upper() == "PERIODIC_SCAN"


def _is_manual_force_event(event_type: str) -> bool:
    normalized = str(event_type or "").upper()
    return normalized.startswith("MANUAL_FORCE_")


def _build_metadata_review_message(event_type: str, event_payload: dict | None) -> tuple[str, str, str, dict]:
    metadata_type = ""
    operation = ""
    if isinstance(event_payload, dict):
        metadata_type = str(event_payload.get("metadata_type", "")).strip().upper()
        operation = str(event_payload.get("operation", "")).strip().upper()

    if not metadata_type:
        normalized_event = str(event_type or "").upper()
        metadata_type = normalized_event.replace("_METADATA_UPDATED", "") or "ACADEMIC"

    type_label = {
        "EXAM": "Exams",
        "PROJECT": "Projects",
        "SCHEDULE": "Schedule",
    }.get(metadata_type, "Academic data")

    operation_label = {
        "CREATE": "added",
        "UPDATE": "updated",
        "DELETE": "removed",
        "IMPORT": "imported",
    }.get(operation, "updated")

    title = f"{type_label} updated"
    body = (
        f"Your {type_label.lower()} were {operation_label}. "
        "Mizan reviewed your context and no urgent action is needed right now."
    )
    notification_type = f"metadata_{metadata_type.lower()}"
    payload = {
        "trigger": event_type,
        "metadata_type": metadata_type,
        "operation": operation,
        "status": "reviewed_no_urgent_action",
    }
    return title, body, notification_type, payload


def _build_periodic_review_message() -> tuple[str, str, str, dict]:
    return (
        "Background wellbeing scan completed",
        "Mizan checked your latest context. No urgent intervention is needed right now.",
        "periodic_scan",
        {"trigger": "PERIODIC_SCAN", "status": "reviewed_no_urgent_action"},
    )


def _has_primary_user_visible_artifact(artifacts: dict[str, Any]) -> bool:
    visible_artifact_keys = (
        "notification_id",
        "task_id",
        "contract_id",
        "mode_notification_id",
        "mode_task_id",
        "mode_contract_id",
        "followup_notification_id",
    )
    return any(bool(artifacts.get(key)) for key in visible_artifact_keys)


def _to_non_negative_int(value: Any, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed >= 0 else default


def _extract_chat_signals(event_payload: dict | None) -> dict:
    if not isinstance(event_payload, dict):
        return {"message": "", "requested_planning_or_next_step": False}
    message = str(event_payload.get("message", "")).strip()
    lowered = message.lower()
    planning_tokens = (
        "plan",
        "planing",
        "planning",
        "next step",
        "next steps",
        "what should i do",
        "what do i do",
        "what is my plan",
        "today plan",
        "plan for today",
        "create task",
        "tasks for today",
        "organize my day",
        "programme",
        "planifier",
    )
    return {
        "message": message,
        "requested_planning_or_next_step": any(token in lowered for token in planning_tokens),
    }


def _chat_intent_decision(context: dict, chat_signals: dict) -> dict | None:
    if not chat_signals.get("requested_planning_or_next_step"):
        return None
    stress = context.get("stress_indicators", {})
    has_exam_tomorrow = bool(stress.get("has_exam_tomorrow", False))
    has_exam_this_week = bool(stress.get("has_exam_this_week", False))
    suggested_mode = "EXAMEN" if has_exam_tomorrow else "REVISION" if has_exam_this_week else "PROJET"
    return {
        "action": "SEND_AND_CREATE",
        "thought": "User explicitly requested planning/next steps in chat. Triggering concrete action plan with task creation.",
        "confidence": 1.0,
        "cooldown_bypass": True,
        "suggested_mode": suggested_mode,
        "notification_title": "Action plan ready",
        "notification_body": "You asked for a plan. We created a concrete focus action and recommended the best mode to execute it.",
        "task_title": "Today plan: one focused execution block",
        "task_description": "Execute one focused block now on your top academic priority, then take a short recovery break.",
    }


async def _chat_intervention_cooldown_active(
    db: AsyncSession, *, student_id, minutes: int = 45
) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    result = await db.execute(
        select(AgentRun).where(
            and_(
                AgentRun.student_id == student_id,
                AgentRun.trigger_type.in_(["TEXT_CHAT_MESSAGE", "VOICE_CHAT_MESSAGE"]),
                AgentRun.created_at >= cutoff,
                AgentRun.status == "success",
            )
        )
    )
    return result.scalars().first() is not None


async def _llm_decision(context: dict, event_type: str) -> dict:
    from mistralai.client import Mistral

    client = Mistral(api_key=settings.MISTRAL_API_KEY)
    stress = context.get("stress_indicators", {})
    scan_data = context.get("scan_data", {})
    resources_count = len(context.get("recommended_resources", []))
    prompt = f"""You are a constrained ReAct planner for student wellbeing.
Output JSON only with keys:
action, thought, confidence, notification_title, notification_body, task_title, task_description, suggested_mode, resource_index

Allowed actions:
- NONE
- SEND_NOTIFICATION
- CREATE_TASK
- SEND_AND_CREATE
- PROPOSE_MODE_SWITCH
- SEND_RESOURCE_NUDGE
- ESCALATE_WELLBEING

Allowed suggested_mode values: REVISION, EXAMEN, PROJET, REPOS, SPORT, COURS

Decision rules:
- If (has_exam_tomorrow=true) AND (has_revision_session_today=false) AND (current_hour > 18)
  => SEND_AND_CREATE with suggested_mode=REVISION and a focus task.
- If (current_mood_score <= 2)
  => SEND_RESOURCE_NUDGE with supportive notification and one tiny actionable step.
- If (heavy_course_load=true) AND (last_mood_yesterday <= 2)
  => SEND_NOTIFICATION pause nudge.
- If (has_morning_checkin_today=false) AND (heavy_course_load=true OR morning_courses_count>=2)
  => SEND_NOTIFICATION check-in reminder.
- Else NONE.

Event: {event_type}
Stress indicators:
- has_exam_tomorrow={stress.get('has_exam_tomorrow', False)}
- has_exam_this_week={stress.get('has_exam_this_week', False)}
- overdue_projects={stress.get('overdue_projects', 0)}
- consecutive_low_mood_days={stress.get('consecutive_low_mood_days', 0)}
- pending_tasks_today={stress.get('pending_tasks_today', 0)}
- has_revision_session_today={stress.get('has_revision_session_today', False)}
- has_morning_checkin_today={stress.get('has_morning_checkin_today', False)}
- heavy_course_load={stress.get('heavy_course_load', False)}
- last_mood_yesterday={stress.get('last_mood_yesterday', None)}
- current_mood_score={stress.get('current_mood_score', None)}
- morning_courses_count={stress.get('morning_courses_count', 0)}
- recommended_resources_count={resources_count}

Scan data:
- current_time={scan_data.get('current_time')}
- current_hour={scan_data.get('current_hour')}
- today_sessions={scan_data.get('today_mode_sessions')}
- upcoming_exams={scan_data.get('upcoming_exams')}
"""
    response = await asyncio.to_thread(
        client.chat.complete,
        model=settings.MISTRAL_MODEL,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}],
    )
    choices = getattr(response, "choices", None)
    if not choices:
        return {"action": "NONE", "thought": "No model response.", "confidence": None}
    message = getattr(choices[0], "message", None)
    raw_text = _extract_chat_text(getattr(message, "content", "") if message is not None else "")
    return _parse_decision(raw_text or "{}")


def _fallback_decision(context: dict, decision: dict) -> dict:
    action = str(decision.get("action", "NONE")).upper()
    if action in _ALLOWED_ACTIONS:
        return decision
    return _deterministic_decision(context)


def _safe_llm_decision(context: dict, llm_decision: dict) -> dict:
    stress = context.get("stress_indicators", {})
    low_mood_days = int(stress.get("consecutive_low_mood_days", 0) or 0)
    if low_mood_days >= 3:
        return _deterministic_decision(context)
    return _fallback_decision(context, llm_decision)


async def _choose_decision(context: dict, event_type: str) -> dict:
    return await _choose_decision_with_payload(context, event_type, None)


async def _choose_decision_with_payload(
    context: dict, event_type: str, event_payload: dict | None
) -> dict:
    chat_signals = _extract_chat_signals(event_payload)
    enriched_context = {
        **context,
        "chat_signals": chat_signals,
        "event": {"type": event_type, "payload": event_payload or {}},
    }

    if _is_metadata_update_event(event_type) or _is_periodic_scan_event(event_type):
        return _deterministic_decision(enriched_context)

    if isinstance(event_payload, dict):
        forced_decision = event_payload.get("force_decision")
        if isinstance(forced_decision, dict):
            return _fallback_decision(enriched_context, forced_decision)

    chat_decision = _chat_intent_decision(enriched_context, chat_signals)
    if chat_decision:
        return chat_decision

    if not settings.MISTRAL_API_KEY:
        return _deterministic_decision(enriched_context)
    try:
        llm_decision = await _llm_decision(enriched_context, event_type)
    except Exception:
        return _deterministic_decision(enriched_context)
    return _safe_llm_decision(enriched_context, llm_decision)


async def _create_agent_task_if_missing(
    db: AsyncSession,
    student_id,
    title: str,
    description: str | None,
    force_create: bool = False,
    dedup_hours: int = DEFAULT_TASK_DEDUP_HOURS,
) -> Task | None:
    if not title:
        return None
    today = date.today()
    if not force_create:
        dedup_since = datetime.now(timezone.utc) - timedelta(hours=max(0, dedup_hours))
        existing_result = await db.execute(
            select(Task).where(
                and_(
                    Task.student_id == student_id,
                    Task.due_date == today,
                    Task.title == title,
                    Task.status != "done",
                    Task.created_at >= dedup_since,
                )
            )
        )
        if existing_result.scalars().first():
            return None

    task = Task(
        student_id=student_id,
        title=title,
        description=description or None,
        due_date=today,
        source="agent",
        status="pending",
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    await create_notification(
        db,
        student_id=student_id,
        title="Mizan: New Task Created",
        body=f"Your assistant added a new task: {task.title}",
        notification_type="task",
        payload={"task_id": str(task.id), "source": "agent", "origin": "background_brain"},
    )

    return task


async def _has_recent_notification(
    db: AsyncSession, *, student_id, notification_type: str, cooldown_hours: int
) -> bool:
    cooldown_since = datetime.now(timezone.utc) - timedelta(hours=cooldown_hours)
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.student_id == student_id,
                Notification.type == notification_type,
                Notification.created_at >= cooldown_since,
            )
        )
    )
    return result.scalars().first() is not None


async def _send_notification_with_cooldown(
    db: AsyncSession,
    *,
    student_id,
    title: str,
    body: str,
    notification_type: str,
    payload: dict | None,
    cooldown_hours: int,
    bypass_cooldown: bool = False,
):
    if not bypass_cooldown:
        if await _has_recent_notification(
            db,
            student_id=student_id,
            notification_type=notification_type,
            cooldown_hours=cooldown_hours,
        ):
            return None
    return await create_notification(
        db,
        student_id=student_id,
        title=title,
        body=body,
        notification_type=notification_type,
        payload=payload,
    )


def _pick_resource(context: dict, resource_index: int) -> dict[str, Any] | None:
    resources = context.get("recommended_resources", [])
    if not resources:
        return None
    idx = max(0, min(resource_index, len(resources) - 1))
    selected = resources[idx]
    return selected if isinstance(selected, dict) else None


def _derive_mode_suggestion(context: dict, decision: dict) -> str:
    explicit = str(decision.get("suggested_mode", "")).upper().strip()
    if explicit in _ALLOWED_MODES:
        return explicit

    stress = context.get("stress_indicators", {})
    has_exam_tomorrow = bool(stress.get("has_exam_tomorrow", False))
    low_mood_days = int(stress.get("consecutive_low_mood_days", 0) or 0)
    projects = context.get("upcoming_projects", [])
    if low_mood_days >= 2:
        return "REPOS"
    if has_exam_tomorrow:
        return "EXAMEN"
    if any(int(p.get("days_until", 99) or 99) <= 2 for p in projects if isinstance(p, dict)):
        return "PROJET"
    return "REVISION"


def _suggestion_reason(mode: str) -> str:
    reasons = {
        "EXAMEN": "upcoming exam pressure",
        "REVISION": "current academic priorities",
        "PROJET": "near project deadlines",
        "REPOS": "recent wellbeing signals",
        "SPORT": "energy reset need",
        "COURS": "class session alignment",
    }
    return reasons.get(mode, "your current context")


async def _execute_mode_switch_suggestion(
    db: AsyncSession, *, student_id, context: dict, decision: dict, bypass_cooldown: bool = False
):
    mode = _derive_mode_suggestion(context, decision)
    reason = _suggestion_reason(mode)
    notif = await _send_notification_with_cooldown(
        db,
        student_id=student_id,
        title=decision.get("notification_title") or f"Suggested mode: {mode}",
        body=decision.get("notification_body")
        or f"Switch to {mode} mode now based on {reason}.",
        notification_type=str(decision.get("notification_type", "mode")).strip() or "mode",
        payload={"trigger": "agent", "suggested_mode": mode, "reason": reason},
        cooldown_hours=_to_non_negative_int(decision.get("notification_cooldown_hours"), 2),
        bypass_cooldown=bypass_cooldown,
    )
    return mode, notif


async def _execute_resource_nudge(
    db: AsyncSession, *, student_id, context: dict, decision: dict, bypass_cooldown: bool = False
):
    resource = _pick_resource(context, int(decision.get("resource_index", 0) or 0))
    if not resource:
        return None

    title = str(resource.get("title", "Recommended wellbeing resource")).strip() or "Recommended wellbeing resource"
    resource_type = str(resource.get("type", "RESOURCE"))
    url = str(resource.get("url", "")).strip()
    guidance = str(resource.get("ai_instruction", "")).strip()
    body = f"{resource_type}: {title}"
    if guidance:
        body = f"{body}. {guidance}"
    if url:
        body = f"{body} Link: {url}"

    notif = await _send_notification_with_cooldown(
        db,
        student_id=student_id,
        title=decision.get("notification_title") or "Targeted support resource",
        body=decision.get("notification_body") or body,
        notification_type=str(decision.get("notification_type", "wellbeing")).strip() or "wellbeing",
        payload={"trigger": "agent", "resource": resource},
        cooldown_hours=_to_non_negative_int(decision.get("notification_cooldown_hours"), 3),
        bypass_cooldown=bypass_cooldown,
    )
    return notif


async def _execute_escalation(
    db: AsyncSession,
    *,
    student_id,
    decision: dict,
    bypass_cooldown: bool = False,
    allow_duplicate_tasks: bool = False,
):
    notification_type = str(decision.get("notification_type", "warning")).strip() or "warning"
    followup_notification_type = (
        str(decision.get("followup_notification_type", "wellbeing")).strip() or "wellbeing"
    )
    notification_cooldown_hours = _to_non_negative_int(decision.get("notification_cooldown_hours"), 6)
    followup_cooldown_hours = _to_non_negative_int(decision.get("followup_cooldown_hours"), 8)

    notif = await _send_notification_with_cooldown(
        db,
        student_id=student_id,
        title=decision.get("notification_title") or "High-priority wellbeing support",
        body=decision.get("notification_body")
        or "Sustained low mood detected. Start with a short recovery routine and reach out for support if needed.",
        notification_type=notification_type,
        payload={"trigger": "agent", "severity": "high"},
        cooldown_hours=notification_cooldown_hours,
        bypass_cooldown=bypass_cooldown,
    )
    task = await _create_agent_task_if_missing(
        db,
        student_id,
        title=decision.get("task_title") or "Urgent wellbeing reset + one academic win",
        description=decision.get("task_description")
        or "Take a 20-minute reset, hydrate, and complete one short priority task.",
        force_create=allow_duplicate_tasks,
    )
    followup_notif = await _send_notification_with_cooldown(
        db,
        student_id=student_id,
        title=str(decision.get("followup_notification_title", "Support follow-up")).strip()
        or "Support follow-up",
        body=str(
            decision.get(
                "followup_notification_body",
                "If the pressure remains high tonight, contact a trusted peer/mentor and reduce cognitive load for 30 minutes.",
            )
        ).strip()
        or "If the pressure remains high tonight, contact a trusted peer/mentor and reduce cognitive load for 30 minutes.",
        notification_type=followup_notification_type,
        payload={"trigger": "agent", "severity": "high", "step": "follow_up"},
        cooldown_hours=followup_cooldown_hours,
        bypass_cooldown=bypass_cooldown,
    )
    return notif, task, followup_notif


async def _default_send_notification(
    db: AsyncSession, *, student_id, event_type: str, decision: dict, bypass_cooldown: bool = False
):
    return await _send_notification_with_cooldown(
        db,
        student_id=student_id,
        title=decision.get("notification_title") or "Wellbeing nudge",
        body=decision.get("notification_body")
        or "Take a short reset break and come back to one priority task.",
        notification_type=str(decision.get("notification_type", "wellbeing")).strip() or "wellbeing",
        payload={"trigger": event_type},
        cooldown_hours=_to_non_negative_int(decision.get("notification_cooldown_hours"), 2),
        bypass_cooldown=bypass_cooldown,
    )


async def _default_create_task(
    db: AsyncSession,
    *,
    student_id,
    decision: dict,
    adaptive_level: str,
    allow_duplicate_tasks: bool = False,
):
    title, description = adapt_task_for_level(
        decision.get("task_title") or "Recovery routine and one focus sprint",
        decision.get("task_description")
        or "Do a short recovery routine, then complete one focused study sprint.",
        adaptive_level,
    )
    task_dedup_hours = _to_non_negative_int(decision.get("task_dedup_hours"), DEFAULT_TASK_DEDUP_HOURS)
    return await _create_agent_task_if_missing(
        db,
        student_id,
        title=title,
        description=description,
        force_create=allow_duplicate_tasks,
        dedup_hours=task_dedup_hours,
    )


def _mode_focus_task(mode: str) -> tuple[str, str]:
    if mode == "EXAMEN":
        return (
            "Exam prep sprint (45 min)",
            "Switch to EXAMEN mode and complete one 45-minute revision sprint on the nearest exam topics.",
        )
    if mode == "PROJET":
        return (
            "Project progress sprint (45 min)",
            "Switch to PROJET mode and finish one concrete project milestone in 45 minutes.",
        )
    if mode == "REPOS":
        return (
            "Recovery block (20 min) + soft restart",
            "Take a 20-minute recovery break, then do a low-pressure 20-minute restart task.",
        )
    return (
        "Focused revision sprint (40 min)",
        "Switch to REVISION mode and complete one 40-minute focused study block.",
    )


async def _execute_primary_action(
    db: AsyncSession,
    *,
    student_id,
    run_id,
    context: dict,
    event_type: str,
    decision: dict,
    adaptive_level: str,
):
    action = decision.get("action", "NONE")
    manual_force_event = _is_manual_force_event(event_type)
    bypass_cooldown = manual_force_event or bool(decision.get("cooldown_bypass"))
    allow_duplicate_tasks = manual_force_event or bool(decision.get("allow_duplicate_tasks"))
    artifacts: dict[str, Any] = {"action": action}
    actions_done: list[str] = []

    if action == "SEND_NOTIFICATION":
        notif = await _default_send_notification(
            db,
            student_id=student_id,
            event_type=event_type,
            decision=decision,
            bypass_cooldown=bypass_cooldown,
        )
        actions_done.append("notification" if notif else "notification_skipped_cooldown")
        artifacts["notification_id"] = str(notif.id) if notif else None
        return actions_done, artifacts

    if action == "CREATE_TASK":
        task = await _default_create_task(
            db,
            student_id=student_id,
            decision=decision,
            adaptive_level=adaptive_level,
            allow_duplicate_tasks=allow_duplicate_tasks,
        )
        actions_done.append("task" if task else "task_skipped_duplicate")
        artifacts["task_id"] = str(task.id) if task else None
        if task:
            contract = await create_action_contract(
                db,
                student_id=student_id,
                run_id=run_id,
                task_id=task.id,
                contract_text="Commit to completing this task in one focused block.",
                adaptive_level=adaptive_level,
            )
            if contract:
                actions_done.append("action_contract")
                artifacts["contract_id"] = str(contract.id)
            else:
                actions_done.append("action_contract_skipped_recent_duplicate")
        return actions_done, artifacts

    if action == "SEND_AND_CREATE":
        notif = await _default_send_notification(
            db,
            student_id=student_id,
            event_type=event_type,
            decision=decision,
            bypass_cooldown=bypass_cooldown,
        )
        task = await _default_create_task(
            db,
            student_id=student_id,
            decision=decision,
            adaptive_level=adaptive_level,
            allow_duplicate_tasks=allow_duplicate_tasks,
        )
        actions_done.append("notification" if notif else "notification_skipped_cooldown")
        actions_done.append("task" if task else "task_skipped_duplicate")
        artifacts["notification_id"] = str(notif.id) if notif else None
        artifacts["task_id"] = str(task.id) if task else None
        if task:
            contract = await create_action_contract(
                db,
                student_id=student_id,
                run_id=run_id,
                task_id=task.id,
                contract_text="Commit to this recovery + focus sequence now.",
                adaptive_level=adaptive_level,
            )
            if contract:
                actions_done.append("action_contract")
                artifacts["contract_id"] = str(contract.id)
            else:
                actions_done.append("action_contract_skipped_recent_duplicate")

        suggested_mode = str(decision.get("suggested_mode", "")).upper().strip()
        if suggested_mode in _ALLOWED_MODES:
            # SEND_AND_CREATE already includes a primary actionable notification.
            # Skip extra mode notification here to avoid bursty duplicate messages.
            mode_notif = None
            focus_title, focus_desc = _mode_focus_task(suggested_mode)
            mode_task = await _create_agent_task_if_missing(
                db,
                student_id,
                title=focus_title,
                description=focus_desc,
                force_create=allow_duplicate_tasks,
                dedup_hours=DEFAULT_TASK_DEDUP_HOURS,
            )
            actions_done.append("mode_suggestion_suppressed")
            actions_done.append("mode_focus_task" if mode_task else "mode_focus_task_skipped_duplicate")
            artifacts["suggested_mode"] = suggested_mode
            artifacts["mode_notification_id"] = str(mode_notif.id) if mode_notif else None
            artifacts["mode_task_id"] = str(mode_task.id) if mode_task else None
        return actions_done, artifacts

    if action == "PROPOSE_MODE_SWITCH":
        mode, notif = await _execute_mode_switch_suggestion(
            db,
            student_id=student_id,
            context=context,
            decision=decision,
            bypass_cooldown=bypass_cooldown,
        )
        focus_title, focus_desc = _mode_focus_task(mode)
        focus_task = await _create_agent_task_if_missing(
            db,
            student_id,
            title=focus_title,
            description=focus_desc,
            force_create=allow_duplicate_tasks,
            dedup_hours=DEFAULT_TASK_DEDUP_HOURS,
        )
        actions_done.append("mode_suggestion" if notif else "mode_suggestion_skipped_cooldown")
        actions_done.append("mode_focus_task" if focus_task else "mode_focus_task_skipped_duplicate")
        artifacts["suggested_mode"] = mode
        artifacts["notification_id"] = str(notif.id) if notif else None
        artifacts["task_id"] = str(focus_task.id) if focus_task else None
        if focus_task:
            contract = await create_action_contract(
                db,
                student_id=student_id,
                run_id=run_id,
                task_id=focus_task.id,
                contract_text=f"Commit to your {mode} focus block.",
                adaptive_level=adaptive_level,
            )
            if contract:
                actions_done.append("action_contract")
                artifacts["contract_id"] = str(contract.id)
            else:
                actions_done.append("action_contract_skipped_recent_duplicate")
        return actions_done, artifacts

    if action == "SEND_RESOURCE_NUDGE":
        notif = await _execute_resource_nudge(
            db,
            student_id=student_id,
            context=context,
            decision=decision,
            bypass_cooldown=bypass_cooldown,
        )
        resource = _pick_resource(context, int(decision.get("resource_index", 0) or 0))
        resource_task = None
        if resource:
            resource_title = str(resource.get("title", "Wellbeing resource")).strip() or "Wellbeing resource"
            resource_task = await _create_agent_task_if_missing(
                db,
                student_id,
                title=f"Apply one technique from: {resource_title}",
                description="Spend 15 minutes applying one concrete technique from the suggested resource.",
                force_create=allow_duplicate_tasks,
                dedup_hours=DEFAULT_TASK_DEDUP_HOURS,
            )
        actions_done.append("resource_nudge" if notif else "resource_nudge_skipped_cooldown")
        actions_done.append("resource_task" if resource_task else "resource_task_skipped_duplicate")
        artifacts["notification_id"] = str(notif.id) if notif else None
        artifacts["task_id"] = str(resource_task.id) if resource_task else None
        if resource_task:
            contract = await create_action_contract(
                db,
                student_id=student_id,
                run_id=run_id,
                task_id=resource_task.id,
                contract_text="Commit to trying one technique from the suggested resource.",
                adaptive_level=adaptive_level,
            )
            if contract:
                actions_done.append("action_contract")
                artifacts["contract_id"] = str(contract.id)
            else:
                actions_done.append("action_contract_skipped_recent_duplicate")
        return actions_done, artifacts

    if action == "ESCALATE_WELLBEING":
        notif, task, followup_notif = await _execute_escalation(
            db,
            student_id=student_id,
            decision=decision,
            bypass_cooldown=bypass_cooldown,
            allow_duplicate_tasks=allow_duplicate_tasks,
        )
        actions_done.append("escalation_notification" if notif else "escalation_skipped_cooldown")
        actions_done.append("escalation_task" if task else "escalation_task_skipped_duplicate")
        actions_done.append(
            "escalation_followup_notification"
            if followup_notif
            else "escalation_followup_skipped_cooldown"
        )
        artifacts["notification_id"] = str(notif.id) if notif else None
        artifacts["task_id"] = str(task.id) if task else None
        artifacts["followup_notification_id"] = str(followup_notif.id) if followup_notif else None
        if task:
            contract = await create_action_contract(
                db,
                student_id=student_id,
                run_id=run_id,
                task_id=task.id,
                contract_text="Commit to this urgent reset plan now. Keep the scope small but immediate.",
                adaptive_level=adaptive_level,
            )
            if contract:
                actions_done.append("action_contract")
                artifacts["contract_id"] = str(contract.id)
            else:
                actions_done.append("action_contract_skipped_recent_duplicate")
        return actions_done, artifacts

    return actions_done, artifacts


async def _record_decision(
    db: AsyncSession, *, run_id, event_payload: dict | None, decision: dict
) -> AgentDecision:
    row = AgentDecision(
        run_id=run_id,
        action=decision.get("action", "NONE"),
        thought=str(decision.get("thought", "")).strip(),
        confidence=decision.get("confidence"),
        payload={"event": event_payload or {}, "decision": decision},
        result=None,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def _finalize_run(
    db: AsyncSession,
    *,
    run: AgentRun,
    decision_row: AgentDecision,
    thought: str,
    actions_done: list[str],
    artifacts: dict,
) -> AgentRun:
    run.status = "success" if actions_done else "skipped"
    run.reasoning_summary = thought
    decision_row.result = {"actions": actions_done, **artifacts}
    await db.commit()
    await db.refresh(run)
    return run


async def run_react_cycle(db: AsyncSession, event) -> AgentRun:
    existing_result = await db.execute(
        select(AgentRun).where(AgentRun.idempotency_key == event.idempotency_key)
    )
    existing = existing_result.scalars().first()
    if existing:
        return existing

    run = AgentRun(
        student_id=event.student_id,
        trigger_type=event.event_type,
        idempotency_key=event.idempotency_key,
        status="skipped",
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    context = await build_agent_context(db, event.student_id)
    adaptive_level = await get_adaptive_level(db, event.student_id)
    context["adaptive_level"] = adaptive_level
    followups_sent = await process_due_contract_followups(db, student_id=event.student_id, limit=20)
    decision = await _choose_decision_with_payload(context, event.event_type, event.payload)
    cooldown_bypass = bool(decision.get("cooldown_bypass"))
    if (
        _is_chat_event(event.event_type)
        and not cooldown_bypass
        and str(decision.get("action", "NONE")).upper() != "ESCALATE_WELLBEING"
        and await _chat_intervention_cooldown_active(
            db, student_id=event.student_id, minutes=DEFAULT_CHAT_COOLDOWN_MINUTES
        )
    ):
        decision = {
            "action": "NONE",
            "thought": "Chat intervention cooldown active; skipping repeated autonomous action for this message.",
            "confidence": 1.0,
        }
    thought = decision.get("thought", "")

    decision_row = await _record_decision(
        db,
        run_id=run.id,
        event_payload=event.payload,
        decision={**decision, "adaptive_level": adaptive_level},
    )
    actions_done, artifacts = await _execute_primary_action(
        db,
        student_id=event.student_id,
        run_id=run.id,
        context=context,
        event_type=event.event_type,
        decision=decision,
        adaptive_level=adaptive_level,
    )
    should_send_metadata_review = _is_metadata_update_event(event.event_type) and (
        (not actions_done) or (not _has_primary_user_visible_artifact(artifacts))
    )
    should_send_periodic_review = _is_periodic_scan_event(event.event_type) and (
        (not actions_done) or (not _has_primary_user_visible_artifact(artifacts))
    )
    if should_send_metadata_review:
        info_title, info_body, info_type, info_payload = _build_metadata_review_message(
            event.event_type, event.payload
        )
        info_notif = await _send_notification_with_cooldown(
            db,
            student_id=event.student_id,
            title=info_title,
            body=info_body,
            notification_type=info_type,
            payload=info_payload,
            cooldown_hours=0,
        )
        if info_notif:
            actions_done.append("metadata_review_notification")
            artifacts["metadata_review_notification_id"] = str(info_notif.id)
        else:
            artifacts["metadata_review_notification_id"] = None
    if should_send_periodic_review:
        info_title, info_body, info_type, info_payload = _build_periodic_review_message()
        info_notif = await _send_notification_with_cooldown(
            db,
            student_id=event.student_id,
            title=info_title,
            body=info_body,
            notification_type=info_type,
            payload=info_payload,
            cooldown_hours=0,
        )
        if info_notif:
            actions_done.append("periodic_review_notification")
            artifacts["periodic_review_notification_id"] = str(info_notif.id)
        else:
            artifacts["periodic_review_notification_id"] = None
    if followups_sent:
        actions_done.append(f"contract_followups_sent:{followups_sent}")
        artifacts["contract_followups_sent"] = followups_sent
    artifacts["adaptive_level"] = adaptive_level
    return await _finalize_run(
        db,
        run=run,
        decision_row=decision_row,
        thought=thought,
        actions_done=actions_done,
        artifacts=artifacts,
    )
