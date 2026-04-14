import asyncio
import json
import re
from datetime import date, datetime, timezone
from typing import List
from uuid import UUID

from fastapi import HTTPException, status
from mistralai.client import Mistral
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.task import Task
from app.schemas.task import TaskBulkCreate, TaskSuggestionItem, TaskStatus, TaskUpdate
from app.services.notification_service import create_notification

settings = get_settings()


def _clean_text(value: str) -> str:
    return " ".join((value or "").split()).strip()


def _strip_markdown(value: str) -> str:
    text = value or ""
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", text)  # links
    text = re.sub(r"[*_`>#~]", "", text)  # basic markdown symbols
    return _clean_text(text)


def _extract_message_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str) and item.strip():
                parts.append(item.strip())
            elif isinstance(item, dict):
                text = str(item.get("text", "")).strip()
                if text:
                    parts.append(text)
            else:
                text = str(getattr(item, "text", "")).strip()
                if text:
                    parts.append(text)
        return " ".join(parts).strip()
    return str(content or "").strip()


def _extract_chat_response_text(response) -> str:
    choices = getattr(response, "choices", None)
    if not choices:
        return ""
    message = getattr(choices[0], "message", None)
    if message is None:
        return ""
    return _extract_message_text(getattr(message, "content", ""))


def _fallback_suggestions(user_message: str, assistant_message: str) -> list[TaskSuggestionItem]:
    combined = f"{assistant_message}\n{user_message}"
    lowered = combined.lower()
    task_intent_markers = [
        "study plan",
        "revision plan",
        "plan d'etude",
        "plan d'étude",
        "organize plan",
        "organize my plan",
        "organiser mon plan",
        "organise mon plan",
        "next step",
        "next steps",
        "prochaines etapes",
        "prochaines étapes",
        "todo",
        "to-do",
        "tasks",
        "taches",
        "tâches",
        "task",
        "deadline",
        "study session",
        "action plan",
        "what should i do",
        "help me plan",
        "give me tasks",
        "donne-moi un plan",
        "donne moi un plan",
    ]
    if not any(marker in lowered for marker in task_intent_markers):
        return []

    raw_lines = [line.strip() for line in re.split(r"[\n\r]", combined) if line.strip()]
    parsed: list[TaskSuggestionItem] = []
    seen: set[str] = set()
    for line in raw_lines:
        normalized = re.sub(r"^[-*•\d\.\)\s]+", "", line).strip()
        normalized = _strip_markdown(normalized)
        if len(normalized) < 14:
            continue
        if len(normalized.split()) < 3:
            continue
        if len(normalized) > 180:
            normalized = normalized[:177].rstrip() + "..."
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        parsed.append(TaskSuggestionItem(title=normalized))
        if len(parsed) >= 5:
            break
    return parsed


def _is_general_support_message(user_message: str) -> bool:
    lowered = (user_message or "").lower()
    support_markers = [
        "anxious",
        "anxiety",
        "stressed",
        "stress",
        "overwhelmed",
        "sad",
        "tired",
        "lonely",
        "demotivated",
        "motivation",
        "how are you",
        "thanks",
        "thank you",
        "explain",
        "what is",
        "why",
    ]
    return any(marker in lowered for marker in support_markers)


def _has_explicit_task_request(user_message: str) -> bool:
    lowered = (user_message or "").lower()
    explicit_markers = [
        "give me a plan",
        "make me a plan",
        "study plan",
        "revision plan",
        "plan d'etude",
        "plan d'étude",
        "next steps",
        "prochaines etapes",
        "prochaines étapes",
        "what should i do",
        "tasks for today",
        "todo list",
        "to-do list",
        "organize my day",
        "organize my plan",
        "organize plan",
        "organiser mon plan",
        "organise mon plan",
        "help me plan",
        "break it into tasks",
        "give me tasks",
        "give me task",
        "give me task and plan",
        "give me tasks and plan",
        "plan for my project",
        "plan for my projects",
        "organize my project",
        "organize my projects",
        "donne-moi un plan",
        "donne moi un plan",
        "donne-moi des taches",
        "donne-moi des tâches",
    ]
    return any(marker in lowered for marker in explicit_markers)


def _assistant_has_actionable_steps(assistant_message: str) -> bool:
    text = _strip_markdown((assistant_message or "").strip().lower())
    if not text:
        return False
    lines = [line.strip() for line in re.split(r"[\n\r]+", text) if line.strip()]
    if len(lines) < 2:
        return False
    actionable_verbs = (
        "review",
        "revise",
        "solve",
        "practice",
        "plan",
        "organize",
        "summarize",
        "read",
        "write",
        "prepare",
        "complete",
        "finish",
        "start",
        "work on",
        "do ",
        "revoir",
        "resoudre",
        "résoudre",
        "organiser",
        "prepare",
        "préparer",
        "completer",
        "compléter",
    )
    bullet_like = 0
    for line in lines:
        normalized = re.sub(r"^[-*•\d\.\)\s]+", "", line).strip()
        normalized = _strip_markdown(normalized)
        if len(normalized.split()) < 3:
            continue
        if any(normalized.startswith(v) for v in actionable_verbs):
            bullet_like += 1
        elif any(f" {v}" in normalized for v in (" next step", " task", " tâches", " taches")):
            bullet_like += 1
    return bullet_like >= 2


async def suggest_tasks_from_chat(student_name: str, user_message: str, assistant_message: str) -> list[TaskSuggestionItem]:
    explicit_request = _has_explicit_task_request(user_message)
    actionable_assistant = _assistant_has_actionable_steps(assistant_message)

    if _is_general_support_message(user_message) and not explicit_request:
        return []

    if not explicit_request and not actionable_assistant:
        return []

    fallback = _fallback_suggestions(user_message, assistant_message)
    if not settings.MISTRAL_API_KEY:
        return fallback

    prompt = f"""You extract concrete student tasks from a tutoring conversation.
Return strict JSON only in this shape:
{{"should_suggest_tasks": true/false, "tasks":[{{"title":"...", "description":"..."}}]}}

Rules:
- English only.
- 0 to 5 tasks.
- Keep each title <= 120 chars and actionable.
- Do not return reminders that are already done.
- Prefer near-term tasks for today/tonight.
- Set "should_suggest_tasks" true when either:
  1) the user explicitly asks for a plan/tasks/next steps, OR
  2) the assistant message already contains concrete actionable steps that can be converted to tasks.
- Set "should_suggest_tasks" to false when the conversation is general discussion, emotional support, explanation, or does not include concrete next actions.
- Be conservative: only suggest tasks when there are clear actionable commitments.

Student: {student_name}
User message: {user_message}
Assistant message: {assistant_message}
"""
    try:
        client = Mistral(api_key=settings.MISTRAL_API_KEY)
        response = await asyncio.to_thread(
            client.chat.complete,
            model=settings.MISTRAL_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        raw = _extract_chat_response_text(response) or "{}"
        payload = json.loads(raw)
        should_suggest = bool(payload.get("should_suggest_tasks", False)) if isinstance(payload, dict) else False
        if not should_suggest:
            return fallback if (explicit_request or actionable_assistant) else []
        items = payload.get("tasks", []) if isinstance(payload, dict) else []
        suggestions: list[TaskSuggestionItem] = []
        seen: set[str] = set()
        for item in items if isinstance(items, list) else []:
            if not isinstance(item, dict):
                continue
            title = _clean_text(str(item.get("title", "")))
            if len(title) < 6:
                continue
            description = _clean_text(str(item.get("description", ""))) or None
            key = title.lower()
            if key in seen:
                continue
            seen.add(key)
            suggestions.append(TaskSuggestionItem(title=title[:180], description=description))
            if len(suggestions) >= 5:
                break
        return suggestions
    except Exception:
        return fallback


async def list_tasks(
    db: AsyncSession,
    student_id: UUID,
    status_filter: TaskStatus | None = None,
    due_date: date | None = None,
) -> List[Task]:
    query = select(Task).where(Task.student_id == student_id)
    if status_filter:
        query = query.where(Task.status == status_filter)
    if due_date:
        query = query.where(Task.due_date == due_date)
    result = await db.execute(query.order_by(Task.due_date.asc(), Task.created_at.desc()))
    return list(result.scalars().all())


async def create_tasks(db: AsyncSession, student_id: UUID, payload: TaskBulkCreate) -> List[Task]:
    created: list[Task] = []
    for item in payload.tasks:
        title = _clean_text(item.title)
        if not title:
            continue
        description = _clean_text(item.description or "") or None
        task = Task(
            student_id=student_id,
            title=title[:180],
            description=description,
            due_date=item.due_date or date.today(),
            source=item.source,
            status="pending",
        )
        db.add(task)
        created.append(task)

    if not created:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid tasks to create")

    await db.commit()
    for task in created:
        await db.refresh(task)
        # Notify student about the new task
        try:
            await create_notification(
                db,
                student_id=student_id,
                title="New Task Created",
                body=f"A new task has been added: {task.title}",
                notification_type="task",
                payload={"task_id": str(task.id), "source": task.source}
            )
        except Exception:
            # Don't fail task creation if notification fails
            pass
    return created


async def update_task_status(db: AsyncSession, student_id: UUID, task_id: UUID, new_status: TaskStatus) -> Task:
    result = await db.execute(select(Task).where(and_(Task.id == task_id, Task.student_id == student_id)))
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    task.status = new_status
    task.completed_at = datetime.now(timezone.utc) if new_status == "done" else None
    await db.commit()
    await db.refresh(task)
    return task


async def update_task(
    db: AsyncSession,
    student_id: UUID,
    task_id: UUID,
    payload: TaskUpdate,
) -> Task:
    result = await db.execute(select(Task).where(and_(Task.id == task_id, Task.student_id == student_id)))
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    changed = False

    if payload.title is not None:
        title = _clean_text(payload.title)
        if not title:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task title cannot be empty")
        task.title = title[:180]
        changed = True

    if payload.description is not None:
        description = _clean_text(payload.description) or None
        task.description = description
        changed = True

    if payload.due_date is not None:
        task.due_date = payload.due_date
        changed = True

    if not changed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No task fields provided for update")

    await db.commit()
    await db.refresh(task)
    return task


async def delete_task(db: AsyncSession, student_id: UUID, task_id: UUID) -> None:
    result = await db.execute(select(Task).where(and_(Task.id == task_id, Task.student_id == student_id)))
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # 1. Dissociate any agent action contracts that reference this task to avoid FK violation
    from app.models.agent_contract import AgentActionContract
    from sqlalchemy import update
    await db.execute(
        update(AgentActionContract)
        .where(AgentActionContract.task_id == task_id)
        .values(task_id=None)
    )

    # 2. Delete the task
    await db.delete(task)
    await db.commit()


async def complete_many_tasks(db: AsyncSession, student_id: UUID, task_ids: list[UUID]) -> int:
    if not task_ids:
        return 0
    result = await db.execute(select(Task).where(and_(Task.student_id == student_id, Task.id.in_(task_ids))))
    tasks = list(result.scalars().all())
    for task in tasks:
        task.status = "done"
        task.completed_at = datetime.now(timezone.utc)
    await db.commit()
    return len(tasks)
