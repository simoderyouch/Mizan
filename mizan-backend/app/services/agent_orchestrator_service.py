import asyncio
import json
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.agent_contract import AgentActionContract
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
    build_personalized_contract_text,
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
        "organise",
        "organize",
        "priorit",
    )
    help_tokens = (
        "help",
        "help me",
        "need help",
        "aide",
        "aide moi",
        "aide-moi",
        "j'ai besoin",
        "besoin d'aide",
        "soutien",
        "support",
        "stuck",
        "overwhelmed",
        "stressed",
        "stress",
        "anxious",
        "anxiety",
        "burnout",
        "exhausted",
        "tired",
        "can't cope",
        "cannot cope",
        "too much",
        "débord",
        "déborde",
        "panique",
        "anxieux",
        "angoiss",
        "fatigu",
        "épuis",
    )
    severe_tokens = (
        "burnout",
        "can't go on",
        "cannot go on",
        "breaking down",
        "désespér",
        "plus capable",
        "trop de pression",
    )
    project_tokens = (
        "project",
        "projects",
        "projet",
        "projets",
        "assignment",
        "assignments",
        "deliverable",
        "deadline",
        "tp",
        "stage",
        "pfe",
        "memoire",
        "mémoire",
        "travail de groupe",
        "group work",
    )
    exam_tokens = (
        "exam",
        "exams",
        "examen",
        "examens",
        "partiel",
        "partiels",
        "test",
        "quiz",
        "contrôle",
        "controle",
    )
    requested_project_focus = any(token in lowered for token in project_tokens)
    requested_exam_focus = any(token in lowered for token in exam_tokens)
    return {
        "message": message,
        "requested_planning_or_next_step": any(token in lowered for token in planning_tokens),
        "requested_help_or_distress": any(token in lowered for token in help_tokens),
        "severe_distress": any(token in lowered for token in severe_tokens),
        "requested_project_focus": requested_project_focus,
        "requested_exam_focus": requested_exam_focus,
        "requested_work_focus": requested_project_focus or requested_exam_focus,
    }


def _format_short_date(iso_date: str) -> str:
    try:
        parsed = date.fromisoformat(str(iso_date)[:10])
        return parsed.strftime("%a %d %b")
    except (TypeError, ValueError):
        return str(iso_date)


def _normalize_focus_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _message_mentions_label(message: str, label: str) -> bool:
    msg = _normalize_focus_text(message)
    lab = _normalize_focus_text(label)
    if not msg or not lab:
        return False
    if len(lab) >= 3 and lab in msg:
        return True
    return any(len(word) >= 4 and word in msg for word in lab.split())


def _collect_academic_labels(context: dict) -> list[str]:
    labels: list[str] = []
    for exam in context.get("upcoming_exams") or []:
        subject = str(exam.get("subject", "")).strip()
        if subject:
            labels.append(subject)
    for project in context.get("upcoming_projects") or []:
        for field in ("name", "subject"):
            value = str(project.get(field, "")).strip()
            if value:
                labels.append(value)
    for task in context.get("today_tasks") or []:
        title = str(task.get("title", "")).strip()
        if title:
            labels.append(title)
    for slot in context.get("today_schedule") or []:
        subject = str(slot.get("subject", "")).strip()
        if subject:
            labels.append(subject)
    return labels


def _message_has_academic_hint(message: str, context: dict) -> bool:
    msg = _normalize_focus_text(message)
    topic_tokens = (
        "project",
        "projet",
        "exam",
        "examen",
        "assignment",
        "devoir",
        "homework",
        "deadline",
        "tp",
        "stage",
        "memoire",
        "deliverable",
    )
    if any(token in msg for token in topic_tokens):
        return True
    return any(_message_mentions_label(message, label) for label in _collect_academic_labels(context))


def _message_topic_priority(message: str) -> str | None:
    """When the student says 'project' or 'exam' without a course name, prefer that work type."""
    msg = _normalize_focus_text(message)
    wants_project = any(
        token in msg
        for token in (
            "project",
            "projet",
            "assignment",
            "deliverable",
            "deadline",
            "tp",
            "stage",
            "pfe",
            "memoire",
            "group work",
        )
    )
    wants_exam = any(
        token in msg
        for token in ("exam", "examen", "partiel", "partiels", "quiz", "test", "controle", "contrôle")
    )
    if wants_project and not wants_exam:
        return "project"
    if wants_exam and not wants_project:
        return "exam"
    return None


def _title_references_project(title: str, context: dict) -> bool:
    cleaned = _normalize_focus_text(title)
    if not cleaned:
        return False
    if "project" in cleaned or "projet" in cleaned:
        return True
    for project in context.get("upcoming_projects") or []:
        for field in ("name", "subject"):
            label = _normalize_focus_text(str(project.get(field, "")))
            if len(label) >= 3 and label in cleaned:
                return True
    return False


def _title_references_exam(title: str, context: dict) -> bool:
    cleaned = _normalize_focus_text(title)
    if not cleaned:
        return False
    if "exam" in cleaned or "examen" in cleaned or "prep" in cleaned:
        return True
    for exam in context.get("upcoming_exams") or []:
        label = _normalize_focus_text(str(exam.get("subject", "")))
        if len(label) >= 3 and label in cleaned:
            return True
    return False


def _chat_signals_want_autonomous_action(chat_signals: dict) -> bool:
    return bool(
        chat_signals.get("requested_help_or_distress")
        or chat_signals.get("requested_planning_or_next_step")
        or chat_signals.get("requested_work_focus")
    )


def _decision_references_context(title: str, context: dict) -> bool:
    cleaned = _normalize_focus_text(title)
    if not cleaned:
        return False
    for label in _collect_academic_labels(context):
        lab = _normalize_focus_text(label)
        if len(lab) >= 4 and lab in cleaned:
            return True
    return False


def _title_aligns_with_message(title: str, message: str, context: dict) -> bool:
    """Task title must match what the student asked for (project vs exam vs named course)."""
    topic = _message_topic_priority(message)
    if topic == "project":
        return _title_references_project(title, context)
    if topic == "exam":
        return _title_references_exam(title, context)

    if not _message_has_academic_hint(message, context):
        return True
    for label in _collect_academic_labels(context):
        if _message_mentions_label(message, label) and _message_mentions_label(title, label):
            return True
    return False


def _pick_exam_for_message(exams: list, message: str):
    if not exams:
        return None
    if message:
        mentioned = [
            exam
            for exam in exams
            if _message_mentions_label(message, str(exam.get("subject", "")))
        ]
        if mentioned:
            return min(mentioned, key=lambda item: int(item.get("days_until", 999)))
    return min(exams, key=lambda item: int(item.get("days_until", 999)))


def _pick_project_for_message(projects: list, message: str):
    if not projects:
        return None
    if message:
        mentioned = []
        for project in projects:
            name = str(project.get("name", "")).strip()
            subject = str(project.get("subject", "")).strip()
            if (name and _message_mentions_label(message, name)) or (
                subject and _message_mentions_label(message, subject)
            ):
                mentioned.append(project)
        if mentioned:
            return min(mentioned, key=lambda item: int(item.get("days_until", 999)))
    return min(projects, key=lambda item: int(item.get("days_until", 999)))


def _focus_payload_from_exam(target: dict) -> dict:
    subject = str(target.get("subject", "Exam")).strip() or "Exam"
    days_until = int(target.get("days_until", 0))
    when_label = "tomorrow" if days_until <= 1 else f"in {days_until} days"
    date_label = _format_short_date(str(target.get("exam_date", "")))
    suggested_mode = "EXAMEN" if days_until <= 2 else "REVISION"
    minutes = 25 if days_until <= 3 else 40
    room = str(target.get("room", "")).strip()
    room_bit = f" (room {room})" if room else ""
    return {
        "suggested_mode": suggested_mode,
        "skip_extra_mode_task": True,
        "task_title": f"{subject} · exam prep ({minutes} min)",
        "task_description": (
            f"Focused {minutes}-minute block on {subject} — exam {when_label} ({date_label}){room_bit}. "
            "Pick one chapter or exercise set and finish it without switching apps."
        ),
        "notification_title": f"Prep block: {subject}",
        "notification_body": (
            f"Mizan added a {minutes}-minute prep task for {subject} (exam {when_label}, {date_label})."
        ),
        "focus_kind": "exam",
        "focus_subject": subject,
    }


def _focus_payload_from_project(target: dict, *, overdue: int) -> dict:
    name = str(target.get("name", "Project")).strip() or "Project"
    subject = str(target.get("subject", "")).strip()
    label = f"{name} ({subject})" if subject else name
    days_until = int(target.get("days_until", 0))
    due_label = _format_short_date(str(target.get("due_date", "")))
    urgency = "overdue — " if overdue > 0 and days_until <= 0 else ""
    return {
        "suggested_mode": "PROJET",
        "skip_extra_mode_task": True,
        "task_title": f"{name} · project sprint (40 min)",
        "task_description": (
            f"{urgency}Ship one visible deliverable for {label} (due {due_label}) in 40 minutes — "
            "e.g. a section, diagram, or commit."
        ),
        "notification_title": f"Project sprint: {name}",
        "notification_body": f"Mizan prioritized {label} (due {due_label}) with a concrete 40-minute sprint.",
        "focus_kind": "project",
        "focus_subject": name,
    }


def _focus_payload_from_pending_task(target: dict) -> dict:
    title = str(target.get("title", "Task")).strip() or "Task"
    return {
        "suggested_mode": "REVISION",
        "skip_extra_mode_task": True,
        "task_title": f"Finish: {title[:70]}",
        "task_description": (
            f"Complete your existing task «{title}» in one 30-minute protected block before starting anything new."
        ),
        "notification_title": f"Your list: {title[:50]}",
        "notification_body": f"You already have «{title}» — Mizan set that as your immediate priority.",
        "focus_kind": "pending_task",
        "focus_subject": title,
    }


def _focus_payload_from_schedule(slot: dict) -> dict:
    subject = str(slot.get("subject", "Course")).strip() or "Course"
    start = str(slot.get("start_time", "")).strip()
    return {
        "suggested_mode": "COURS",
        "skip_extra_mode_task": True,
        "task_title": f"{subject} · review today's class (20 min)",
        "task_description": (
            f"Review notes from {subject} ({start} today): write 5 bullet takeaways and one question to clarify."
        ),
        "notification_title": f"After class: {subject}",
        "notification_body": f"Based on today's schedule, start with a short review of {subject}.",
        "focus_kind": "course",
        "focus_subject": subject,
    }


def _build_priority_focus_from_context(context: dict, message: str = "") -> dict:
    """Pick one priority from real data; respect what the student said in chat/voice."""
    stress = context.get("stress_indicators", {})
    exams = list(context.get("upcoming_exams") or [])
    projects = list(context.get("upcoming_projects") or [])
    today_tasks = list(context.get("today_tasks") or [])
    schedule = list(context.get("today_schedule") or [])
    message = str(message or "").strip()
    overdue = int(stress.get("overdue_projects", 0) or 0)

    pending_manual = [
        t
        for t in today_tasks
        if str(t.get("status", "")).lower() != "done" and str(t.get("source", "")).lower() != "agent"
    ]

    topic = _message_topic_priority(message)

    if message:
        for task in pending_manual:
            title = str(task.get("title", "")).strip()
            if title and _message_mentions_label(message, title):
                return _focus_payload_from_pending_task(task)

        if topic == "project" and projects:
            return _focus_payload_from_project(
                _pick_project_for_message(projects, message), overdue=overdue
            )

        if topic == "exam" and exams:
            return _focus_payload_from_exam(_pick_exam_for_message(exams, message))

        project = _pick_project_for_message(projects, message)
        if project:
            name = str(project.get("name", "")).strip()
            subject = str(project.get("subject", "")).strip()
            if (name and _message_mentions_label(message, name)) or (
                subject and _message_mentions_label(message, subject)
            ):
                return _focus_payload_from_project(project, overdue=overdue)

        exam = _pick_exam_for_message(exams, message)
        if exam and _message_mentions_label(message, str(exam.get("subject", ""))):
            return _focus_payload_from_exam(exam)

        for slot in schedule:
            subject = str(slot.get("subject", "")).strip()
            if subject and _message_mentions_label(message, subject):
                return _focus_payload_from_schedule(slot)

    # General help/plan (no subject named): finish existing work before inventing new exam prep
    if message and not _message_has_academic_hint(message, context) and pending_manual:
        return _focus_payload_from_pending_task(pending_manual[0])

    if topic == "project" and projects:
        return _focus_payload_from_project(
            _pick_project_for_message(projects, message), overdue=overdue
        )

    if topic == "exam" and exams:
        return _focus_payload_from_exam(_pick_exam_for_message(exams, message))

    if projects and not exams:
        return _focus_payload_from_project(
            _pick_project_for_message(projects, message), overdue=overdue
        )

    if exams:
        return _focus_payload_from_exam(_pick_exam_for_message(exams, message))

    if projects:
        return _focus_payload_from_project(
            _pick_project_for_message(projects, message), overdue=overdue
        )

    if pending_manual:
        return _focus_payload_from_pending_task(pending_manual[0])

    if schedule:
        return _focus_payload_from_schedule(schedule[0])

    return {
        "suggested_mode": "REPOS",
        "skip_extra_mode_task": True,
        "task_title": "Recovery + one small study step (20 min)",
        "task_description": "10-minute reset (walk, water), then 20 minutes on the smallest academic step you can finish today.",
        "notification_title": "Small step to restart",
        "notification_body": "Mizan added a short recovery + study task to help you restart gently.",
        "focus_kind": "recovery",
        "focus_subject": "",
    }


def _apply_contextual_focus(
    decision: dict, context: dict, *, prefix: str, message: str = ""
) -> dict:
    focus = _build_priority_focus_from_context(context, message=message)
    merged = {**decision, **focus}
    merged["task_dedup_hours"] = 8
    merged["notification_cooldown_hours"] = 0
    if prefix == "help":
        merged.setdefault(
            "thought",
            f"Student asked for help — prioritized {focus.get('focus_kind')}: {focus.get('focus_subject') or 'recovery'}.",
        )
    else:
        merged.setdefault(
            "thought",
            f"Planning request — next focus: {focus.get('focus_subject') or focus.get('focus_kind')}.",
        )
    return merged


_GENERIC_TASK_TITLE_MARKERS = (
    "help sprint",
    "focus block",
    "one protected",
    "today plan",
    "focused execution",
    "recovery + short",
    "urgent reset",
    "25-minute focus",
    "one small win",
    "post-lunch reset",
)


def _task_title_is_generic(title: str) -> bool:
    cleaned = str(title or "").strip().lower()
    if not cleaned or len(cleaned) < 10:
        return True
    return any(marker in cleaned for marker in _GENERIC_TASK_TITLE_MARKERS)


_CHAT_CONTEXT_KEYS = (
    "student",
    "today_schedule",
    "upcoming_exams",
    "upcoming_projects",
    "today_tasks",
    "active_goals",
    "current_mode",
    "last_checkin",
    "stress_indicators",
    "scan_data",
    "recommended_resources",
)


def _conversation_from_payload(event_payload: dict | None) -> list[dict]:
    if not isinstance(event_payload, dict):
        return []
    raw = event_payload.get("conversation_history") or event_payload.get("history") or []
    turns: list[dict] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role", "")).strip().lower()
        content = str(item.get("content", "")).strip()
        if role in {"user", "assistant"} and content:
            turns.append({"role": role, "content": content[:2000]})
    return turns[-24:]


def _format_conversation_transcript(history: list[dict], current_message: str) -> str:
    lines: list[str] = []
    for turn in history:
        role = str(turn.get("role", "user")).strip().lower()
        content = str(turn.get("content", "")).strip()
        if not content:
            continue
        speaker = "Student" if role == "user" else "Mizan"
        lines.append(f"{speaker}: {content}")
    latest = str(current_message or "").strip()
    if latest and (not lines or not lines[-1].endswith(latest)):
        lines.append(f"Student (latest): {latest}")
    return "\n".join(lines) if lines else (f"Student (latest): {latest}" if latest else "(empty)")


def _format_full_context_for_llm(context: dict) -> str:
    bundle = {key: context[key] for key in _CHAT_CONTEXT_KEYS if key in context}
    return json.dumps(bundle, ensure_ascii=False, default=str, indent=2)


def _sanitize_chat_llm_decision(decision: dict) -> dict:
    """Validate planner JSON only — no rule-based overrides of titles or actions."""
    action = str(decision.get("action", "NONE")).upper()
    if action not in _ALLOWED_ACTIONS:
        return {
            "action": "NONE",
            "thought": str(decision.get("thought") or "Planner returned an invalid action."),
            "confidence": decision.get("confidence"),
        }
    cleaned = {**decision, "action": action}
    if action != "NONE":
        cleaned["cooldown_bypass"] = True
        cleaned["allow_duplicate_tasks"] = True
        cleaned["task_dedup_hours"] = 0
        cleaned["notification_cooldown_hours"] = 0
        cleaned.setdefault("skip_extra_mode_task", True)
    return cleaned


async def _llm_chat_decision(
    context: dict, event_type: str, event_payload: dict | None
) -> dict:
    from mistralai.client import Mistral

    client = Mistral(api_key=settings.MISTRAL_API_KEY)
    current_message = ""
    if isinstance(event_payload, dict):
        current_message = str(event_payload.get("message", "")).strip()
    history = _conversation_from_payload(event_payload)
    transcript = _format_conversation_transcript(history, current_message)
    context_json = _format_full_context_for_llm(context)

    prompt = f"""You are Mizan's autonomous action planner for a live chat/voice turn.

Read the FULL student context JSON and the FULL conversation transcript. Decide ONE action for the backend to execute now.

Output JSON only with keys:
action, thought, confidence, notification_title, notification_body, task_title, task_description, suggested_mode, resource_index

Allowed actions: NONE, SEND_NOTIFICATION, CREATE_TASK, SEND_AND_CREATE, PROPOSE_MODE_SWITCH, SEND_RESOURCE_NUDGE, ESCALATE_WELLBEING
Allowed suggested_mode: REVISION, EXAMEN, PROJET, REPOS, SPORT, COURS

Rules:
- Base every field on the conversation + context. If they discuss a project, act on that project — never swap in a different exam.
- Use NONE for thanks/small talk when no notification or task is needed.
- When you create a task, task_title must name the real subject/project from context; task_description = one concrete 25–40 min step.
- notification_title/body must match the same focus as the task.
- Use ESCALATE_WELLBEING only for severe distress signals in context or message.

Event: {event_type}

Student context JSON:
{context_json}

Conversation:
{transcript}
"""
    try:
        response = await asyncio.to_thread(
            client.chat.complete,
            model=settings.MISTRAL_MODEL,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}],
        )
        choices = getattr(response, "choices", None)
        if not choices:
            return {"action": "NONE", "thought": "No model response."}
        message = getattr(choices[0], "message", None)
        raw_text = _extract_chat_text(getattr(message, "content", "") if message is not None else "")
        return _sanitize_chat_llm_decision(_parse_decision(raw_text or "{}"))
    except Exception:
        return {"action": "NONE", "thought": "LLM chat planner failed."}


def _chat_help_intent_decision(context: dict, chat_signals: dict) -> dict | None:
    if not chat_signals.get("requested_help_or_distress"):
        return None
    stress = context.get("stress_indicators", {})
    current_mood = stress.get("current_mood_score")
    low_mood_days = int(stress.get("consecutive_low_mood_days", 0) or 0)
    severe = bool(chat_signals.get("severe_distress")) or (
        current_mood is not None and int(current_mood) <= 2
    ) or low_mood_days >= 3

    if severe:
        base = {
            "action": "ESCALATE_WELLBEING",
            "confidence": 1.0,
            "cooldown_bypass": True,
            "notification_type": "critical_wellbeing",
            "followup_notification_type": "critical_wellbeing_followup",
            "notification_cooldown_hours": 0,
            "followup_cooldown_hours": 0,
        }
        return _apply_contextual_focus(
            base,
            context,
            prefix="help",
            message=str(chat_signals.get("message", "")),
        )

    base = {
        "action": "SEND_AND_CREATE",
        "confidence": 1.0,
        "cooldown_bypass": True,
        "notification_type": "info",
        "notification_cooldown_hours": 0,
    }
    return _apply_contextual_focus(
        base,
        context,
        prefix="help",
        message=str(chat_signals.get("message", "")),
    )


def _chat_intent_decision(context: dict, chat_signals: dict) -> dict | None:
    if not chat_signals.get("requested_planning_or_next_step"):
        return None
    base = {
        "action": "SEND_AND_CREATE",
        "thought": "User explicitly requested planning/next steps in chat.",
        "confidence": 1.0,
        "cooldown_bypass": True,
        "notification_type": "info",
    }
    return _apply_contextual_focus(
        base,
        context,
        prefix="plan",
        message=str(chat_signals.get("message", "")),
    )


async def _chat_intervention_cooldown_active(
    db: AsyncSession, *, student_id, minutes: int = 45
) -> bool:
    from sqlalchemy.orm import selectinload

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    result = await db.execute(
        select(AgentRun)
        .options(selectinload(AgentRun.decisions))
        .where(
            and_(
                AgentRun.student_id == student_id,
                AgentRun.trigger_type.in_(["TEXT_CHAT_MESSAGE", "VOICE_CHAT_MESSAGE"]),
                AgentRun.created_at >= cutoff,
                AgentRun.status == "success",
            )
        )
        .order_by(AgentRun.created_at.desc())
        .limit(1)
    )
    last_run = result.scalars().first()
    if not last_run:
        return False
    for decision in last_run.decisions or []:
        result_payload = decision.result if isinstance(decision.result, dict) else {}
        if _has_primary_user_visible_artifact(result_payload):
            return True
    return False


async def _llm_decision(
    context: dict, event_type: str, chat_signals: dict | None = None
) -> dict:
    from mistralai.client import Mistral

    client = Mistral(api_key=settings.MISTRAL_API_KEY)
    stress = context.get("stress_indicators", {})
    scan_data = context.get("scan_data", {})
    resources_count = len(context.get("recommended_resources", []))
    context_json = _format_full_context_for_llm(context)

    prompt = f"""You are Mizan's autonomous action planner (ReAct). Reason about the student context, then output JSON only.

Keys: action, thought, confidence, notification_title, notification_body, task_title, task_description, suggested_mode, resource_index

Allowed actions: NONE, SEND_NOTIFICATION, CREATE_TASK, SEND_AND_CREATE, PROPOSE_MODE_SWITCH, SEND_RESOURCE_NUDGE, ESCALATE_WELLBEING
Allowed suggested_mode: REVISION, EXAMEN, PROJET, REPOS, SPORT, COURS

Event: {event_type}

Student context JSON:
{context_json}

Stress indicators:
- has_exam_tomorrow={stress.get('has_exam_tomorrow', False)}
- has_exam_this_week={stress.get('has_exam_this_week', False)}
- overdue_projects={stress.get('overdue_projects', 0)}
- consecutive_low_mood_days={stress.get('consecutive_low_mood_days', 0)}
- pending_tasks_today={stress.get('pending_tasks_today', 0)}
- current_mood_score={stress.get('current_mood_score', None)}
- last_mood_yesterday={stress.get('last_mood_yesterday', None)}
- sleep from last checkin: {context.get('last_checkin', {}).get('sleep_hours') if context.get('last_checkin') else None}

Scan: hour={scan_data.get('current_hour')}, sessions_today={scan_data.get('today_mode_sessions')}
Resources available: {resources_count}
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


def _safe_llm_decision(context: dict, llm_decision: dict, *, event_type: str = "") -> dict:
    """Validate LLM JSON; use rules only for non-chat safety nets."""
    if _is_chat_event(event_type):
        return _fallback_decision(context, llm_decision)
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

    if _is_metadata_update_event(event_type):
        return _deterministic_decision(enriched_context)

    if isinstance(event_payload, dict):
        forced_decision = event_payload.get("force_decision")
        if isinstance(forced_decision, dict):
            return _fallback_decision(enriched_context, forced_decision)

    # Chat / voice: full context + conversation → LLM decides (no rule overrides)
    if _is_chat_event(event_type):
        if not settings.MISTRAL_API_KEY:
            return {"action": "NONE", "thought": "MISTRAL_API_KEY not configured."}
        return await _llm_chat_decision(enriched_context, event_type, event_payload)

    # Check-ins and periodic scans: try LLM when configured
    if not settings.MISTRAL_API_KEY:
        return _deterministic_decision(enriched_context)

    try:
        llm_decision = await _llm_decision(
            enriched_context,
            event_type,
            chat_signals if _is_chat_event(event_type) else None,
        )
    except Exception:
        return _deterministic_decision(enriched_context)

    merged = _safe_llm_decision(enriched_context, llm_decision, event_type=event_type)
    if str(merged.get("action", "NONE")).upper() == "NONE":
        return _deterministic_decision(enriched_context)
    return merged


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

    task_payload: dict[str, Any] = {
        "task_id": str(task.id),
        "source": "agent",
        "origin": "background_brain",
    }
    if force_create:
        task_payload["daily_cap_exempt"] = True
        task_payload["source"] = "manual_validation"
    await create_notification(
        db,
        student_id=student_id,
        title="Mizan: New Task Created",
        body=f"Your assistant added a new task: {task.title}",
        notification_type="task",
        payload=task_payload,
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
    db: AsyncSession,
    *,
    student_id,
    context: dict,
    decision: dict,
    event_type: str,
    bypass_cooldown: bool = False,
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
        payload=_agent_notification_payload(
            event_type, decision, suggested_mode=mode, reason=reason
        ),
        cooldown_hours=_to_non_negative_int(decision.get("notification_cooldown_hours"), 2),
        bypass_cooldown=bypass_cooldown,
    )
    return mode, notif


async def _execute_resource_nudge(
    db: AsyncSession,
    *,
    student_id,
    context: dict,
    decision: dict,
    event_type: str,
    bypass_cooldown: bool = False,
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
        payload=_agent_notification_payload(event_type, decision, resource=resource),
        cooldown_hours=_to_non_negative_int(decision.get("notification_cooldown_hours"), 3),
        bypass_cooldown=bypass_cooldown,
    )
    return notif


async def _execute_escalation(
    db: AsyncSession,
    *,
    student_id,
    decision: dict,
    event_type: str,
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
        payload=_agent_notification_payload(event_type, decision, severity="high"),
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
        payload=_agent_notification_payload(
            event_type, decision, severity="high", step="follow_up"
        ),
        cooldown_hours=followup_cooldown_hours,
        bypass_cooldown=bypass_cooldown,
    )
    return notif, task, followup_notif


def _agent_notification_payload(event_type: str, decision: dict | None = None, **extra: Any) -> dict:
    payload: dict[str, Any] = {"trigger": event_type, **extra}
    if isinstance(decision, dict):
        decision_payload = decision.get("notification_payload")
        if isinstance(decision_payload, dict):
            payload.update(decision_payload)
    if _is_manual_force_event(event_type):
        payload["source"] = "manual_validation"
        payload["daily_cap_exempt"] = True
    elif isinstance(decision, dict) and decision.get("cooldown_bypass"):
        payload["source"] = "chat_intervention"
        payload["daily_cap_exempt"] = True
    elif _is_metadata_update_event(event_type):
        payload["source"] = "class_metadata"
        payload["daily_cap_exempt"] = True
    return payload


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
        payload=_agent_notification_payload(event_type, decision),
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


async def _attach_action_contract(
    db: AsyncSession,
    *,
    student_id,
    run_id,
    task: Task | None,
    decision: dict,
    adaptive_level: str,
    fallback_text: str,
) -> AgentActionContract | None:
    task_title = task.title if task else str(decision.get("task_title", "")).strip() or None
    contract = await create_action_contract(
        db,
        student_id=student_id,
        run_id=run_id,
        task_id=task.id if task else None,
        contract_text=build_personalized_contract_text(
            task_title=task_title,
            thought=str(decision.get("thought", "")),
            fallback=fallback_text,
        ),
        adaptive_level=adaptive_level,
    )
    return contract


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
            contract = await _attach_action_contract(
                db,
                student_id=student_id,
                run_id=run_id,
                task=task,
                decision=decision,
                adaptive_level=adaptive_level,
                fallback_text="Commit to completing this task in one focused block.",
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
            contract = await _attach_action_contract(
                db,
                student_id=student_id,
                run_id=run_id,
                task=task,
                decision=decision,
                adaptive_level=adaptive_level,
                fallback_text="Commit to this recovery + focus sequence now.",
            )
            if contract:
                actions_done.append("action_contract")
                artifacts["contract_id"] = str(contract.id)
            else:
                actions_done.append("action_contract_skipped_recent_duplicate")

        suggested_mode = str(decision.get("suggested_mode", "")).upper().strip()
        skip_extra_mode_task = bool(decision.get("skip_extra_mode_task"))
        if suggested_mode in _ALLOWED_MODES and not skip_extra_mode_task:
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
        elif suggested_mode in _ALLOWED_MODES:
            artifacts["suggested_mode"] = suggested_mode
            actions_done.append("mode_focus_task_skipped_contextual_primary")
        return actions_done, artifacts

    if action == "PROPOSE_MODE_SWITCH":
        mode, notif = await _execute_mode_switch_suggestion(
            db,
            student_id=student_id,
            context=context,
            decision=decision,
            event_type=event_type,
            bypass_cooldown=bypass_cooldown,
        )
        focus_title, focus_desc = _mode_focus_task(mode)
        focus_task = await _create_agent_task_if_missing(
            db,
            student_id,
            title=focus_title,
            description=focus_desc,
            force_create=allow_duplicate_tasks,
            dedup_hours=_to_non_negative_int(decision.get("task_dedup_hours"), DEFAULT_TASK_DEDUP_HOURS),
        )
        actions_done.append("mode_suggestion" if notif else "mode_suggestion_skipped_cooldown")
        actions_done.append("mode_focus_task" if focus_task else "mode_focus_task_skipped_duplicate")
        artifacts["suggested_mode"] = mode
        artifacts["notification_id"] = str(notif.id) if notif else None
        artifacts["task_id"] = str(focus_task.id) if focus_task else None
        if focus_task:
            contract = await _attach_action_contract(
                db,
                student_id=student_id,
                run_id=run_id,
                task=focus_task,
                decision=decision,
                adaptive_level=adaptive_level,
                fallback_text=f"Commit to your {mode} focus block.",
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
            event_type=event_type,
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
            contract = await _attach_action_contract(
                db,
                student_id=student_id,
                run_id=run_id,
                task=resource_task,
                decision=decision,
                adaptive_level=adaptive_level,
                fallback_text="Commit to trying one technique from the suggested resource.",
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
            event_type=event_type,
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
            contract = await _attach_action_contract(
                db,
                student_id=student_id,
                run_id=run_id,
                task=task,
                decision=decision,
                adaptive_level=adaptive_level,
                fallback_text="Commit to this urgent reset plan now. Keep the scope small but immediate.",
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


async def _load_run_with_decisions(db: AsyncSession, run_id) -> AgentRun:
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(AgentRun).options(selectinload(AgentRun.decisions)).where(AgentRun.id == run_id)
    )
    loaded = result.scalars().first()
    if not loaded:
        raise ValueError(f"Agent run {run_id} not found")
    return loaded


async def run_react_cycle(db: AsyncSession, event) -> AgentRun:
    existing_result = await db.execute(
        select(AgentRun).where(AgentRun.idempotency_key == event.idempotency_key)
    )
    existing = existing_result.scalars().first()
    if existing:
        return await _load_run_with_decisions(db, existing.id)

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
    finalized = await _finalize_run(
        db,
        run=run,
        decision_row=decision_row,
        thought=thought,
        actions_done=actions_done,
        artifacts=artifacts,
    )
    return await _load_run_with_decisions(db, finalized.id)


def summarize_agent_run_for_client(run: AgentRun) -> dict:
    """Compact summary for chat/voice API responses."""
    decisions = sorted(list(run.decisions or []), key=lambda row: row.created_at)
    latest = decisions[-1] if decisions else None
    result = latest.result if latest and isinstance(latest.result, dict) else {}
    actions = result.get("actions") if isinstance(result.get("actions"), list) else []
    action = str(latest.action if latest else result.get("action", "NONE")).upper()

    visible = _has_primary_user_visible_artifact(result)
    skipped_only = actions and all("skipped" in str(item) for item in actions)

    summary: dict[str, Any] = {
        "run_id": str(run.id),
        "status": run.status,
        "action": action,
        "took_action": visible,
        "skipped": not visible and action != "NONE",
        "actions": actions,
        "notification_id": result.get("notification_id"),
        "task_id": result.get("task_id"),
        "contract_id": result.get("contract_id"),
        "thought": (latest.thought if latest else run.reasoning_summary) or "",
    }

    if visible:
        parts: list[str] = []
        if result.get("notification_id"):
            parts.append("notification")
        if result.get("task_id"):
            parts.append("task")
        if result.get("contract_id"):
            parts.append("commitment")
        summary["message"] = (
            "Mizan took action: " + ", ".join(parts) + ". Check your bell, Tasks, and Commitments."
        )
    elif action == "NONE" or skipped_only:
        summary["message"] = None
        summary["skip_reason"] = (latest.thought if latest else None) or "No autonomous action needed for this message."
    else:
        summary["message"] = "Mizan reviewed your message but could not deliver a new action right now (daily limit or cooldown)."
        summary["skip_reason"] = "delivery_blocked"

    return summary
