# app/services/checkin_service.py
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checkin import EveningCheckin, MorningCheckin
from app.models.student import Exam, Project, Schedule
from app.schemas.checkin import CheckinAnswer, CheckinQuestion, EveningCheckinCreate, MorningCheckinCreate
from app.services.autonomous_events import build_checkin_event, publish_autonomous_event
from app.services.agent_service import generate_advanced_ritual_report
from app.services.context_builder import build_agent_context
from app.services.question_service import generate_personalized_questions


def _compute_morning_streak(checkin_dates: set[date], today: date) -> int:
    streak = 0
    cursor = today
    while cursor in checkin_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _to_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value: Any) -> int | None:
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def _to_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        v = value.strip().lower()
        if v in {"true", "yes", "oui", "1", "done"}:
            return True
        if v in {"false", "no", "non", "0"}:
            return False
    return None


def _normalize_qcm_mood_to_5_scale(raw_score: int, min_value: float | None, max_value: float | None) -> int:
    min_bound = int(min_value) if min_value is not None else 1
    max_bound = int(max_value) if max_value is not None else 5
    bounded = max(min_bound, min(max_bound, raw_score))
    if max_bound <= 5:
        return max(1, min(5, bounded))
    span = max_bound - min_bound
    if span <= 0:
        return max(1, min(5, bounded))
    normalized = (bounded - min_bound) / span
    mapped = int(round(1 + (normalized * 4)))
    return max(1, min(5, mapped))


def _normalize_dynamic_answers(
    question_set: list[CheckinQuestion] | None,
    responses: list[CheckinAnswer] | None,
) -> tuple[dict[str, Any], list[dict]]:
    if not question_set or not responses:
        return {}, []

    questions_by_id = {q.id: q for q in question_set}
    response_map = {r.question_id: r.value for r in responses}
    answer_records: list[dict] = []
    extracted: dict[str, Any] = {}

    for question in question_set:
        raw_value = response_map.get(question.id)
        if raw_value is None:
            continue
        answer_records.append({"question_id": question.id, "value": raw_value})

        target = question.target_field
        if not target:
            continue

        if target == "mood_score":
            parsed = _to_int(raw_value)
            if parsed is not None:
                extracted["mood_score"] = _normalize_qcm_mood_to_5_scale(
                    parsed,
                    question.min_value,
                    question.max_value,
                )
        elif target == "sleep_hours":
            parsed = _to_float(raw_value)
            if parsed is not None:
                extracted["sleep_hours"] = max(0.0, min(16.0, round(parsed, 2)))
        elif target == "plan_completed":
            parsed = _to_bool(raw_value)
            if parsed is not None:
                extracted["plan_completed"] = parsed
        elif target == "notes":
            if isinstance(raw_value, list):
                text_value = ", ".join([str(item).strip() for item in raw_value if str(item).strip()])
            else:
                text_value = str(raw_value).strip()
            if text_value:
                extracted["notes"] = text_value
        elif target == "context":
            existing = str(extracted.get("context", "")).strip()
            current = str(raw_value).strip()
            if current:
                extracted["context"] = f"{existing}\n{current}".strip() if existing else current

    return extracted, answer_records


async def get_morning_briefing(db: AsyncSession, student_id: UUID) -> dict:
    today = date.today()
    day_name = today.strftime("%A")
    three_days_later = today + timedelta(days=3)
    five_days_later = today + timedelta(days=5)

    schedule_res = await db.execute(
        select(Schedule).where(and_(Schedule.student_id == student_id, Schedule.day_of_week == day_name))
    )
    schedules = schedule_res.scalars().all()

    exam_res = await db.execute(
        select(Exam).where(and_(Exam.student_id == student_id, Exam.exam_date >= today, Exam.exam_date <= three_days_later))
    )
    exams = exam_res.scalars().all()

    project_res = await db.execute(
        select(Project).where(and_(Project.student_id == student_id, Project.due_date >= today, Project.due_date <= five_days_later))
    )
    projects = project_res.scalars().all()

    evening_res = await db.execute(
        select(EveningCheckin)
        .where(EveningCheckin.student_id == student_id)
        .order_by(desc(EveningCheckin.date))
        .limit(1)
    )
    last_evening = evening_res.scalars().first()
    last_evening_mood = last_evening.mood_score if last_evening else None
    has_morning_today = await has_morning_checkin_today(db, student_id)
    has_evening_today = await has_evening_checkin_today(db, student_id)

    suggested_mode = "REVISION"
    if any(e.exam_date <= today + timedelta(days=1) for e in exams):
        suggested_mode = "EXAMEN"
    elif any(p.due_date <= today + timedelta(days=2) for p in projects):
        suggested_mode = "PROJET"
    elif last_evening_mood is not None and last_evening_mood <= 2:
        suggested_mode = "REPOS"

    priority_items = []
    for exam in exams[:2]:
        priority_items.append(f"Exam: {exam.subject} ({(exam.exam_date - today).days} day(s) left)")
    for project in projects[:2]:
        priority_items.append(f"Project: {project.name} ({(project.due_date - today).days} day(s) left)")

    wellbeing_alert = "NONE"
    if last_evening_mood is not None and last_evening_mood <= 2:
        wellbeing_alert = "HIGH"
    elif last_evening_mood is not None and last_evening_mood == 3:
        wellbeing_alert = "MEDIUM"

    return {
        "today_schedule": schedules,
        "upcoming_exams": exams,
        "upcoming_projects": projects,
        "last_evening_mood": last_evening_mood,
        "suggested_mode": suggested_mode,
        "priority_items": priority_items,
        "wellbeing_alert": wellbeing_alert,
        "checkin_status": {
            "has_morning_today": has_morning_today,
            "has_evening_today": has_evening_today,
        },
    }


async def get_personalized_checkin_questions(
    db: AsyncSession,
    student_id: UUID,
    period: Literal["MORNING", "EVENING"],
    mode: Literal["qcm", "voice"],
) -> list[dict]:
    context = await build_agent_context(db, student_id)
    return await generate_personalized_questions(context, period, mode)


async def has_morning_checkin_today(db: AsyncSession, student_id: UUID) -> bool:
    today = date.today()
    res = await db.execute(
        select(MorningCheckin).where(and_(MorningCheckin.student_id == student_id, MorningCheckin.date == today))
    )
    return res.scalars().first() is not None


async def has_evening_checkin_today(db: AsyncSession, student_id: UUID) -> bool:
    today = date.today()
    res = await db.execute(
        select(EveningCheckin).where(and_(EveningCheckin.student_id == student_id, EveningCheckin.date == today))
    )
    return res.scalars().first() is not None


async def create_morning_checkin(db: AsyncSession, student_id: UUID, data: MorningCheckinCreate) -> MorningCheckin:
    today = date.today()

    context = await build_agent_context(db, student_id)

    extracted, answer_records = _normalize_dynamic_answers(data.question_set, data.responses)
    mood_score = extracted.get("mood_score", data.mood_score if data.mood_score is not None else 3)
    sleep_hours = extracted.get("sleep_hours", data.sleep_hours if data.sleep_hours is not None else 7.0)
    contextual_text = extracted.get("notes") or extracted.get("context") or ""

    report = {}
    if not data.executive_summary:
        report = await generate_advanced_ritual_report(
            context,
            "Morning",
            {"sleep_hours": sleep_hours, "mood_score": mood_score, "input_text": contextual_text},
            data.mode
        )

    existing_checkin_result = await db.execute(
        select(MorningCheckin)
        .where(and_(MorningCheckin.student_id == student_id, MorningCheckin.date == today))
        .order_by(desc(MorningCheckin.checkin_time))
        .limit(1)
    )
    checkin = existing_checkin_result.scalars().first()

    if checkin:
        checkin.sleep_hours = sleep_hours
        checkin.mood_score = mood_score
        checkin.mode = data.mode
        checkin.question_set = [q.model_dump() for q in data.question_set] if data.question_set else None
        checkin.question_answers = answer_records or None
        checkin.executive_summary = data.executive_summary or report.get("executive_summary", "")
        checkin.detailed_action_plan = data.detailed_action_plan or report.get("detailed_action_plan", [])
        checkin.detected_risks = data.detected_risks or report.get("detected_risks", [])
        checkin.checkin_time = datetime.now(timezone.utc)
    else:
        checkin = MorningCheckin(
            student_id=student_id,
            date=today,
            sleep_hours=sleep_hours,
            mood_score=mood_score,
            mode=data.mode,
            question_set=[q.model_dump() for q in data.question_set] if data.question_set else None,
            question_answers=answer_records or None,
            executive_summary=data.executive_summary or report.get("executive_summary", ""),
            detailed_action_plan=data.detailed_action_plan or report.get("detailed_action_plan", []),
            detected_risks=data.detected_risks or report.get("detected_risks", []),
        )
        db.add(checkin)
    await db.commit()
    await db.refresh(checkin)
    await publish_autonomous_event(
        db,
        build_checkin_event("MORNING", student_id=student_id, checkin_date=checkin.date),
    )
    return checkin


async def create_evening_checkin(db: AsyncSession, student_id: UUID, data: EveningCheckinCreate) -> EveningCheckin:
    today = date.today()
    if not await has_morning_checkin_today(db, student_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Morning check-in is required before evening check-in.",
        )

    context = await build_agent_context(db, student_id)

    extracted, answer_records = _normalize_dynamic_answers(data.question_set, data.responses)
    mood_score = extracted.get("mood_score", data.mood_score if data.mood_score is not None else 3)
    plan_completed = extracted.get("plan_completed", data.plan_completed if data.plan_completed is not None else False)
    notes = extracted.get("notes", data.notes)
    contextual_text = extracted.get("context") or notes or ""

    report = {}
    if not data.executive_summary:
        report = await generate_advanced_ritual_report(
            context,
            "Evening",
            {"mood_score": mood_score, "input_text": contextual_text},
            data.mode
        )

    existing_checkin_result = await db.execute(
        select(EveningCheckin)
        .where(and_(EveningCheckin.student_id == student_id, EveningCheckin.date == today))
        .order_by(desc(EveningCheckin.checkin_time))
        .limit(1)
    )
    checkin = existing_checkin_result.scalars().first()

    if checkin:
        checkin.plan_completed = plan_completed
        checkin.mood_score = mood_score
        checkin.notes = notes
        checkin.mode = data.mode
        checkin.question_set = [q.model_dump() for q in data.question_set] if data.question_set else None
        checkin.question_answers = answer_records or None
        checkin.executive_summary = data.executive_summary or report.get("executive_summary", "")
        checkin.detailed_action_plan = data.detailed_action_plan or report.get("detailed_action_plan", [])
        checkin.detected_risks = data.detected_risks or report.get("detected_risks", [])
        checkin.checkin_time = datetime.now(timezone.utc)
    else:
        checkin = EveningCheckin(
            student_id=student_id,
            date=today,
            plan_completed=plan_completed,
            mood_score=mood_score,
            notes=notes,
            mode=data.mode,
            question_set=[q.model_dump() for q in data.question_set] if data.question_set else None,
            question_answers=answer_records or None,
            executive_summary=data.executive_summary or report.get("executive_summary", ""),
            detailed_action_plan=data.detailed_action_plan or report.get("detailed_action_plan", []),
            detected_risks=data.detected_risks or report.get("detected_risks", []),
        )
        db.add(checkin)
    await db.commit()
    await db.refresh(checkin)
    await publish_autonomous_event(
        db,
        build_checkin_event("EVENING", student_id=student_id, checkin_date=checkin.date),
    )
    return checkin


async def get_checkin_history(db: AsyncSession, student_id: UUID, days: int = 7) -> dict:
    start_date = date.today() - timedelta(days=days)

    morning_res = await db.execute(
        select(MorningCheckin)
        .where(and_(MorningCheckin.student_id == student_id, MorningCheckin.date >= start_date))
        .order_by(MorningCheckin.date)
    )
    morning_checkins = list(morning_res.scalars().all())

    evening_res = await db.execute(
        select(EveningCheckin)
        .where(and_(EveningCheckin.student_id == student_id, EveningCheckin.date >= start_date))
        .order_by(EveningCheckin.date)
    )
    evening_checkins = list(evening_res.scalars().all())

    avg_morning_mood = sum(c.mood_score for c in morning_checkins) / len(morning_checkins) if morning_checkins else 0
    avg_evening_mood = sum(c.mood_score for c in evening_checkins) / len(evening_checkins) if evening_checkins else 0
    avg_sleep = sum(c.sleep_hours for c in morning_checkins) / len(morning_checkins) if morning_checkins else 0
    morning_dates = {c.date for c in morning_checkins}
    evening_dates = {c.date for c in evening_checkins}
    morning_streak = _compute_morning_streak(morning_dates, date.today())
    evening_streak = _compute_morning_streak(evening_dates, date.today())
    expected_days = max(1, (date.today() - start_date).days + 1)
    morning_completion_rate = round(min((len(morning_dates) / expected_days) * 100, 100.0), 2)
    evening_completion_rate = round(min((len(evening_dates) / expected_days) * 100, 100.0), 2)

    return {
        "morning_checkins": morning_checkins,
        "evening_checkins": evening_checkins,
        "averages": {
            "morning_mood": round(avg_morning_mood, 2),
            "evening_mood": round(avg_evening_mood, 2),
            "sleep_hours": round(avg_sleep, 2)
        },
        "consistency": {
            "morning_streak_days": morning_streak,
            "evening_streak_days": evening_streak,
            "morning_completion_rate": morning_completion_rate,
            "evening_completion_rate": evening_completion_rate,
        }
    }
