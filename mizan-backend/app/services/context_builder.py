# Builds the structured prompt context for Mistral AI from schedule, exams, mood, and history
# app/services/context_builder.py
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checkin import MorningCheckin
from app.models.goal import Goal, GoalProgress
from app.models.institution import Class, Filiere, Promotion
from app.models.mode_session import ModeSession
from app.models.resource import WellbeingResource
from app.models.student import Exam, Project, Schedule, Student
from app.models.task import Task
from app.utils.project_members import normalize_project_members


async def build_agent_context(db: AsyncSession, student_id: UUID) -> dict:
    today = date.today()
    now = datetime.now(timezone.utc)
    day_name = today.strftime("%A")
    tomorrow = today + timedelta(days=1)
    next_week = today + timedelta(days=7)

    student_res = await db.execute(
        select(Student, Class, Promotion, Filiere)
        .join(Class, Student.class_id == Class.id)
        .join(Promotion, Class.promotion_id == Promotion.id)
        .join(Filiere, Promotion.filiere_id == Filiere.id)
        .where(Student.id == student_id)
    )
    student_row = student_res.first()
    
    if not student_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    student_obj, class_obj, promo_obj, filiere_obj = student_row

    sched_res = await db.execute(
        select(Schedule).where(and_(Schedule.student_id == student_id, Schedule.day_of_week == day_name))
    )
    schedule_rows = list(sched_res.scalars().all())
    morning_courses_count = sum(1 for s in schedule_rows if s.start_time.hour < 12)
    today_schedule = [
        {
            "subject": s.subject,
            "start_time": s.start_time.strftime("%H:%M"),
            "end_time": s.end_time.strftime("%H:%M"),
            "room": s.room,
            "professor": s.professor
        }
        for s in schedule_rows
    ]

    exam_res = await db.execute(
        select(Exam)
        .where(and_(Exam.student_id == student_id, Exam.exam_date >= today))
        .order_by(Exam.exam_date.asc(), Exam.start_time.asc())
    )
    upcoming_exams = []
    has_exam_tomorrow = False
    has_exam_this_week = False
    
    for e in exam_res.scalars().all():
        days_until = (e.exam_date - today).days
        upcoming_exams.append({
            "subject": e.subject,
            "exam_date": e.exam_date.isoformat(),
            "days_until": days_until,
            "room": e.room
        })
        if e.exam_date == tomorrow:
            has_exam_tomorrow = True
        if e.exam_date <= next_week:
            has_exam_this_week = True

    proj_res = await db.execute(
        select(Project)
        .where(and_(Project.student_id == student_id, Project.due_date >= today))
        .order_by(Project.due_date.asc())
    )
    upcoming_projects = [
        {
            "name": p.name,
            "subject": p.subject,
            "due_date": p.due_date.isoformat(),
            "days_until": (p.due_date - today).days,
            "members": normalize_project_members(p.members),
        }
        for p in proj_res.scalars().all()
    ]

    overdue_res = await db.execute(
        select(func.count()).select_from(Project).where(and_(Project.student_id == student_id, Project.due_date < today))
    )
    overdue_projects_count = overdue_res.scalar() or 0

    mode_res = await db.execute(
        select(ModeSession).where(and_(ModeSession.student_id == student_id, ModeSession.ended_at.is_(None)))
    )
    active_mode = mode_res.scalars().first()
    current_mode_data = None
    if active_mode:
        duration_so_far = int((now - active_mode.started_at).total_seconds() / 60)
        current_mode_data = {
            "mode": active_mode.mode.value if hasattr(active_mode.mode, 'value') else str(active_mode.mode),
            "started_at": active_mode.started_at.isoformat(),
            "duration_so_far_minutes": duration_so_far
        }

    mode_today_res = await db.execute(
        select(ModeSession).where(
            and_(
                ModeSession.student_id == student_id,
                func.date(ModeSession.started_at) == today,
            )
        )
    )
    mode_sessions_today = list(mode_today_res.scalars().all())
    mode_sessions_today_data = [
        {
            "mode": m.mode.value if hasattr(m.mode, "value") else str(m.mode),
            "started_at": m.started_at.isoformat(),
            "ended_at": m.ended_at.isoformat() if m.ended_at else None,
            "duration_minutes": m.duration_minutes,
        }
        for m in mode_sessions_today
    ]
    has_revision_session_today = any(
        (m.get("mode") == "REVISION") for m in mode_sessions_today_data
    )

    checkin_res = await db.execute(
        select(MorningCheckin).where(MorningCheckin.student_id == student_id).order_by(desc(MorningCheckin.date)).limit(14)
    )
    recent_checkins = list(checkin_res.scalars().all())
    
    last_checkin_data = None
    if recent_checkins:
        last_c = recent_checkins[0]
        last_checkin_data = {
            "mood_score": last_c.mood_score,
            "sleep_hours": last_c.sleep_hours,
            "date": last_c.date.isoformat()
        }

    consecutive_low_mood = 0
    for c in recent_checkins:
        if c.mood_score <= 2:
            consecutive_low_mood += 1
        else:
            break

    yesterday = today - timedelta(days=1)
    yesterday_checkin_res = await db.execute(
        select(MorningCheckin)
        .where(and_(MorningCheckin.student_id == student_id, MorningCheckin.date == yesterday))
        .limit(1)
    )
    yesterday_checkin = yesterday_checkin_res.scalars().first()
    last_mood_yesterday = int(yesterday_checkin.mood_score) if yesterday_checkin else None

    morning_checkin_today_res = await db.execute(
        select(MorningCheckin)
        .where(and_(MorningCheckin.student_id == student_id, MorningCheckin.date == today))
        .limit(1)
    )
    has_morning_checkin_today = morning_checkin_today_res.scalars().first() is not None

    goal_res = await db.execute(
        select(Goal).where(and_(Goal.student_id == student_id, Goal.is_active == True))
    )
    active_goals = list(goal_res.scalars().all())
    
    active_goals_data = []
    if active_goals:
        goal_ids = [g.id for g in active_goals]
        prog_res = await db.execute(
            select(GoalProgress).where(and_(GoalProgress.goal_id.in_(goal_ids), GoalProgress.date == today))
        )
        progresses = prog_res.scalars().all()
        prog_map = {p.goal_id: 0.0 for p in progresses}
        for p in progresses:
            prog_map[p.goal_id] += p.value

        for g in active_goals:
            active_goals_data.append({
                "title": g.title,
                "target_value": g.target_value,
                "unit": g.unit,
                "today_progress": prog_map.get(g.id, 0.0)
            })

    task_res = await db.execute(
        select(Task).where(and_(Task.student_id == student_id, Task.due_date == today)).order_by(Task.created_at.desc())
    )
    today_tasks = list(task_res.scalars().all())
    tasks_today_data = [
        {
            "id": str(t.id),
            "title": t.title,
            "status": t.status,
            "source": t.source,
        }
        for t in today_tasks
    ]
    pending_tasks_count = sum(1 for t in today_tasks if t.status != "done")
    heavy_course_load = len(today_schedule) >= 4

    resource_triggers: list[str] = []
    if has_exam_tomorrow or has_exam_this_week:
        resource_triggers.append("performance")
    if consecutive_low_mood >= 2:
        resource_triggers.extend(["anxiete", "stress"])
    if pending_tasks_count >= 3:
        resource_triggers.append("motivation")
    if last_checkin_data and last_checkin_data.get("mood_score") is not None:
        mood_score = int(last_checkin_data["mood_score"])
        if mood_score <= 2:
            resource_triggers.extend(["anxiete", "stress"])
        elif mood_score == 3:
            resource_triggers.append("motivation")
        else:
            resource_triggers.append("performance")
    if not resource_triggers:
        resource_triggers = ["motivation", "performance"]
    unique_triggers = list(dict.fromkeys(resource_triggers))

    resource_res = await db.execute(
        select(WellbeingResource)
        .where(WellbeingResource.mood_trigger.in_(unique_triggers))
        .order_by(WellbeingResource.created_at.desc())
        .limit(5)
    )
    recommended_resources = [
        {
            "title": r.title,
            "category": r.category,
            "type": r.type.value if hasattr(r.type, "value") else str(r.type),
            "url": r.url,
            "mood_trigger": r.mood_trigger,
            "ai_instruction": r.ai_instruction,
        }
        for r in resource_res.scalars().all()
    ]

    return {
        "student": {
            "name": f"{student_obj.first_name} {student_obj.last_name}",
            "filiere": filiere_obj.name,
            "promotion": promo_obj.name,
            "class": class_obj.name
        },
        "today_schedule": today_schedule,
        "scan_data": {
            "current_time": now.isoformat(),
            "current_hour": now.hour,
            "today_day_name": day_name,
            "morning_courses_count": morning_courses_count,
            "had_course_this_morning": morning_courses_count > 0,
            "last_mood_yesterday": last_mood_yesterday,
            "today_mode_sessions": mode_sessions_today_data,
            "upcoming_exams": upcoming_exams,
        },
        "upcoming_exams": upcoming_exams,
        "upcoming_projects": upcoming_projects,
        "current_mode": current_mode_data,
        "last_checkin": last_checkin_data,
        "active_goals": active_goals_data,
        "today_tasks": tasks_today_data,
        "recommended_resources": recommended_resources,
        "stress_indicators": {
            "has_exam_tomorrow": has_exam_tomorrow,
            "has_exam_this_week": has_exam_this_week,
            "overdue_projects": overdue_projects_count,
            "consecutive_low_mood_days": consecutive_low_mood,
            "current_mood_score": int(last_checkin_data["mood_score"])
            if last_checkin_data and last_checkin_data.get("mood_score") is not None
            else None,
            "pending_tasks_today": pending_tasks_count,
            "has_revision_session_today": has_revision_session_today,
            "has_morning_checkin_today": has_morning_checkin_today,
            "heavy_course_load": heavy_course_load,
            "last_mood_yesterday": last_mood_yesterday,
            "morning_courses_count": morning_courses_count,
        }
    }
