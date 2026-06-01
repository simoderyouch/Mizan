# app/services/analytics_service.py
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import List
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checkin import EveningCheckin, MorningCheckin
from app.models.goal import Goal, GoalProgress
from app.models.institution import Class, Filiere, Promotion, School
from app.models.mode_session import ModeSession
from app.models.student import Exam, Project, Schedule, Student
from app.models.user import User
from app.schemas.analytics import (
    AdminClassHealth,
    AdminClassRiskSummary,
    AdminDashboardResponse,
    AdminKpi,
    AdminRiskSummary,
    InstitutionalStat,
    ModeDistribution,
    MoodGraphPoint,
    PlatformTrendPoint,
    StudentDashboard,
    WeeklyReport,
)
from app.core.permissions import admin_scoped_school_id
from app.services.checkin_service import (
    has_evening_checkin_today,
    has_morning_checkin_today,
)
from app.services.context_builder import build_agent_context
from app.services.mode_service import get_current_mode


async def get_mood_graph(db: AsyncSession, student_id: UUID, days: int = 30) -> List[MoodGraphPoint]:
    start_date = date.today() - timedelta(days=days)
    
    result = await db.execute(
        select(MorningCheckin)
        .where(and_(MorningCheckin.student_id == student_id, MorningCheckin.date >= start_date))
        .order_by(MorningCheckin.date)
    )
    checkins = result.scalars().all()
    
    return [
        MoodGraphPoint(date=c.date, mood_score=float(c.mood_score), sleep_hours=c.sleep_hours)
        for c in checkins
    ]


async def get_mode_distribution(db: AsyncSession, student_id: UUID, days: int = 7) -> List[ModeDistribution]:
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    
    result = await db.execute(
        select(ModeSession).where(
            and_(ModeSession.student_id == student_id, ModeSession.started_at >= start_date)
        )
    )
    sessions = result.scalars().all()
    
    totals = {}
    for s in sessions:
        if s.ended_at is None:
            duration = int((now - s.started_at).total_seconds() / 60)
        else:
            duration = s.duration_minutes or 0
            
        mode_str = s.mode.value if hasattr(s.mode, 'value') else str(s.mode)
        totals[mode_str] = totals.get(mode_str, 0) + duration
        
    total_time = sum(totals.values())
    
    distribution = []
    for mode, duration in totals.items():
        if duration > 0:
            percentage = round((duration / total_time * 100), 2) if total_time > 0 else 0.0
            distribution.append(ModeDistribution(mode=mode, total_minutes=duration, percentage=percentage))
            
    return distribution


async def get_weekly_report(db: AsyncSession, student_id: UUID) -> WeeklyReport:
    """Last 7 calendar days (today and the six before), aligned with mood trend and demo seed."""
    today = date.today()
    week_end = today
    week_start = today - timedelta(days=6)
    
    morning_res = await db.execute(
        select(MorningCheckin).where(
            and_(MorningCheckin.student_id == student_id, MorningCheckin.date >= week_start, MorningCheckin.date <= week_end)
        )
    )
    mornings = morning_res.scalars().all()
    
    evening_res = await db.execute(
        select(EveningCheckin).where(
            and_(EveningCheckin.student_id == student_id, EveningCheckin.date >= week_start, EveningCheckin.date <= week_end)
        )
    )
    evenings = evening_res.scalars().all()
    
    total_checkins = len(mornings) + len(evenings)
    
    avg_mood = 0.0
    all_moods = [m.mood_score for m in mornings] + [e.mood_score for e in evenings]
    if all_moods:
        avg_mood = sum(all_moods) / len(all_moods)
        
    avg_sleep = 0.0
    if mornings:
        avg_sleep = sum(m.sleep_hours for m in mornings) / len(mornings)
        
    stress_level = "LOW"
    if avg_mood <= 2.0 and len(all_moods) > 0:
        stress_level = "HIGH"
    elif avg_mood <= 3.5 and len(all_moods) > 0:
        stress_level = "MEDIUM"
        
    goals_res = await db.execute(select(Goal).where(Goal.student_id == student_id, Goal.is_active == True))
    goals = goals_res.scalars().all()
    goal_ids = [g.id for g in goals]

    progresses = []
    if goal_ids:
        prog_res = await db.execute(
            select(GoalProgress).where(
                and_(
                    GoalProgress.goal_id.in_(goal_ids),
                    GoalProgress.date >= week_start,
                    GoalProgress.date <= week_end,
                )
            )
        )
        progresses = prog_res.scalars().all()
    
    prog_map = {}
    for p in progresses:
        prog_map[p.goal_id] = prog_map.get(p.goal_id, 0.0) + p.value
        
    goals_achieved = sum(1 for g in goals if prog_map.get(g.id, 0.0) >= g.target_value)
    
    mode_distribution = await get_mode_distribution(db, student_id, days=7)
    
    return WeeklyReport(
        week_start=week_start,
        week_end=week_end,
        avg_mood=round(avg_mood, 2),
        avg_sleep=round(avg_sleep, 2),
        total_checkins=total_checkins,
        goals_achieved=goals_achieved,
        mode_distribution=mode_distribution,
        stress_level=stress_level
    )


async def get_student_dashboard(db: AsyncSession, student_id: UUID) -> StudentDashboard:
    from app.utils.weekday import matches_today_weekday

    context = await build_agent_context(db, student_id)
    today = date.today()

    student_res = await db.execute(select(Student).where(Student.id == student_id))
    student = student_res.scalars().first()

    has_morning = await has_morning_checkin_today(db, student_id)
    has_evening = await has_evening_checkin_today(db, student_id)
    mood_trend = await get_mood_graph(db, student_id, days=7)

    active_goals_count = len(context.get("active_goals", []))

    schedule_res = await db.execute(
        select(Schedule).where(Schedule.student_id == student_id).order_by(Schedule.start_time.asc())
    )
    all_schedules = list(schedule_res.scalars().all())
    weekly_schedule = all_schedules
    today_schedule = [s for s in all_schedules if matches_today_weekday(s.day_of_week, today)]

    exam_res = await db.execute(
        select(Exam)
        .where(and_(Exam.student_id == student_id, Exam.exam_date >= today))
        .order_by(Exam.exam_date.asc(), Exam.start_time.asc())
    )
    upcoming_exams = list(exam_res.scalars().all())

    current_mode = None
    if context.get("current_mode"):
        cm = context["current_mode"]
        started_dt = datetime.fromisoformat(cm["started_at"]) if isinstance(cm["started_at"], str) else cm["started_at"]
        current_mode = {
            "id": uuid.uuid4(),
            "student_id": student_id,
            "mode": cm["mode"],
            "started_at": started_dt,
            "ended_at": None,
            "duration_minutes": cm["duration_so_far_minutes"]
        }
    
    return StudentDashboard(
        student=student,
        current_mode=current_mode,
        has_morning_checkin=has_morning,
        has_evening_checkin=has_evening,
        active_goals_count=active_goals_count,
        upcoming_exams=upcoming_exams,
        today_schedule=today_schedule,
        weekly_schedule=weekly_schedule,
        mood_trend=mood_trend,
    )


async def get_admin_dashboard(db: AsyncSession, current_user: User) -> AdminDashboardResponse:
    today = date.today()
    week_ago = today - timedelta(days=7)
    in_48h = today + timedelta(days=2)
    scoped_school_id = admin_scoped_school_id(current_user)

    school_stmt = select(func.count()).select_from(School)
    filiere_stmt = select(func.count()).select_from(Filiere)
    promotion_stmt = select(func.count()).select_from(Promotion).join(Filiere, Promotion.filiere_id == Filiere.id)
    classes_stmt = (
        select(func.count()).select_from(Class)
        .join(Promotion, Class.promotion_id == Promotion.id)
        .join(Filiere, Promotion.filiere_id == Filiere.id)
    )
    students_stmt = (
        select(func.count()).select_from(Student)
        .join(Class, Student.class_id == Class.id)
        .join(Promotion, Class.promotion_id == Promotion.id)
        .join(Filiere, Promotion.filiere_id == Filiere.id)
    )
    activated_stmt = (
        select(func.count())
        .select_from(Student)
        .join(User, User.id == Student.user_id)
        .join(Class, Student.class_id == Class.id)
        .join(Promotion, Class.promotion_id == Promotion.id)
        .join(Filiere, Promotion.filiere_id == Filiere.id)
        .where(User.is_active == True)
    )

    if scoped_school_id:
        school_stmt = school_stmt.where(School.id == scoped_school_id)
        filiere_stmt = filiere_stmt.where(Filiere.school_id == scoped_school_id)
        promotion_stmt = promotion_stmt.where(Filiere.school_id == scoped_school_id)
        classes_stmt = classes_stmt.where(Filiere.school_id == scoped_school_id)
        students_stmt = students_stmt.where(Filiere.school_id == scoped_school_id)
        activated_stmt = activated_stmt.where(Filiere.school_id == scoped_school_id)

    schools_count = (await db.execute(school_stmt)).scalar() or 0
    filieres_count = (await db.execute(filiere_stmt)).scalar() or 0
    promotions_count = (await db.execute(promotion_stmt)).scalar() or 0
    classes_count = (await db.execute(classes_stmt)).scalar() or 0
    students_count = (await db.execute(students_stmt)).scalar() or 0
    activated_students_count = (await db.execute(activated_stmt)).scalar() or 0

    classes_query = (
        select(Class, Promotion, Filiere, School)
        .join(Promotion, Promotion.id == Class.promotion_id)
        .join(Filiere, Filiere.id == Promotion.filiere_id)
        .join(School, School.id == Filiere.school_id)
    )
    if scoped_school_id:
        classes_query = classes_query.where(Filiere.school_id == scoped_school_id)
    classes_rows = (await db.execute(classes_query)).all()

    scoped_student_ids = (
        await db.execute(
            select(Student.id)
            .join(Class, Student.class_id == Class.id)
            .join(Promotion, Class.promotion_id == Promotion.id)
            .join(Filiere, Promotion.filiere_id == Filiere.id)
            .where(Filiere.school_id == scoped_school_id) if scoped_school_id else select(Student.id)
        )
    ).scalars().all()
    scoped_student_ids_list = list(scoped_student_ids)

    if scoped_student_ids_list:
        morning_checkin_today_count = (
            await db.execute(
                select(func.count()).select_from(MorningCheckin).where(
                    and_(MorningCheckin.date == today, MorningCheckin.student_id.in_(scoped_student_ids_list))
                )
            )
        ).scalar() or 0
        evening_checkin_today_count = (
            await db.execute(
                select(func.count()).select_from(EveningCheckin).where(
                    and_(EveningCheckin.date == today, EveningCheckin.student_id.in_(scoped_student_ids_list))
                )
            )
        ).scalar() or 0
    else:
        morning_checkin_today_count = 0
        evening_checkin_today_count = 0

    kpis = AdminKpi(
        schools_count=schools_count,
        filieres_count=filieres_count,
        promotions_count=promotions_count,
        classes_count=classes_count,
        students_count=students_count,
        activated_students_count=activated_students_count,
        morning_checkin_today_count=int(morning_checkin_today_count),
        evening_checkin_today_count=int(evening_checkin_today_count),
    )

    class_health: list[AdminClassHealth] = []
    for class_obj, promotion_obj, filiere_obj, school_obj in classes_rows:
        class_students = (
            await db.execute(select(Student.id).where(Student.class_id == class_obj.id))
        ).scalars().all()
        total_students = len(class_students)
        if total_students == 0:
            class_health.append(
                AdminClassHealth(
                    class_id=str(class_obj.id),
                    class_name=class_obj.name,
                    filiere_name=filiere_obj.name,
                    promotion_name=promotion_obj.name,
                    students_count=0,
                    activated_students_count=0,
                    schedule_coverage_pct=0.0,
                    exams_coverage_pct=0.0,
                    projects_coverage_pct=0.0,
                    morning_checkin_today_pct=0.0,
                    low_mood_students_7d=0,
                    avg_mood_7d=0.0,
                    school_name=school_obj.name,
                )
            )
            continue

        student_ids = list(class_students)
        activated_count = (
            await db.execute(
                select(func.count())
                .select_from(Student)
                .join(User, User.id == Student.user_id)
                .where(and_(Student.id.in_(student_ids), User.is_active == True))
            )
        ).scalar() or 0
        schedule_students = (
            await db.execute(
                select(func.count(func.distinct(Schedule.student_id))).where(Schedule.student_id.in_(student_ids))
            )
        ).scalar() or 0
        exams_students = (
            await db.execute(
                select(func.count(func.distinct(Exam.student_id))).where(Exam.student_id.in_(student_ids))
            )
        ).scalar() or 0
        projects_students = (
            await db.execute(
                select(func.count(func.distinct(Project.student_id))).where(Project.student_id.in_(student_ids))
            )
        ).scalar() or 0
        morning_today_students = (
            await db.execute(
                select(func.count(func.distinct(MorningCheckin.student_id))).where(
                    and_(MorningCheckin.student_id.in_(student_ids), MorningCheckin.date == today)
                )
            )
        ).scalar() or 0
        low_mood_students = (
            await db.execute(
                select(func.count(func.distinct(MorningCheckin.student_id))).where(
                    and_(
                        MorningCheckin.student_id.in_(student_ids),
                        MorningCheckin.date >= week_ago,
                        MorningCheckin.mood_score <= 2,
                    )
                )
            )
        ).scalar() or 0
        avg_mood = (
            await db.execute(
                select(func.avg(MorningCheckin.mood_score)).where(
                    and_(MorningCheckin.student_id.in_(student_ids), MorningCheckin.date >= week_ago)
                )
            )
        ).scalar()

        class_health.append(
            AdminClassHealth(
                class_id=str(class_obj.id),
                class_name=class_obj.name,
                filiere_name=filiere_obj.name,
                promotion_name=promotion_obj.name,
                students_count=total_students,
                activated_students_count=int(activated_count),
                schedule_coverage_pct=round((schedule_students / total_students) * 100, 2),
                exams_coverage_pct=round((exams_students / total_students) * 100, 2),
                projects_coverage_pct=round((projects_students / total_students) * 100, 2),
                morning_checkin_today_pct=round((morning_today_students / total_students) * 100, 2),
                low_mood_students_7d=int(low_mood_students),
                avg_mood_7d=float(round(avg_mood, 2)) if avg_mood else 0.0,
                school_name=school_obj.name,
            )
        )

    risk_summary = AdminRiskSummary()
    class_risk_summary: list[AdminClassRiskSummary] = []
    if scoped_student_ids_list:
        student_rows = (
            await db.execute(
                select(Student, Class, Filiere, School)
                .join(Class, Student.class_id == Class.id)
                .join(Promotion, Class.promotion_id == Promotion.id)
                .join(Filiere, Promotion.filiere_id == Filiere.id)
                .join(School, Filiere.school_id == School.id)
                .where(Student.id.in_(scoped_student_ids_list))
            )
        ).all()

        avg_mood_rows = (
            await db.execute(
                select(MorningCheckin.student_id, func.avg(MorningCheckin.mood_score))
                .where(and_(MorningCheckin.student_id.in_(scoped_student_ids_list), MorningCheckin.date >= week_ago))
                .group_by(MorningCheckin.student_id)
            )
        ).all()
        avg_mood_map = {
            student_id: float(round(avg_mood, 2))
            for student_id, avg_mood in avg_mood_rows
            if avg_mood is not None
        }

        overdue_rows = (
            await db.execute(
                select(Project.student_id, func.count(Project.id))
                .where(and_(Project.student_id.in_(scoped_student_ids_list), Project.due_date < today))
                .group_by(Project.student_id)
            )
        ).all()
        overdue_projects_map = {
            student_id: int(overdue_count)
            for student_id, overdue_count in overdue_rows
            if overdue_count
        }

        exams_soon_rows = (
            await db.execute(
                select(Exam.student_id)
                .where(and_(Exam.student_id.in_(scoped_student_ids_list), Exam.exam_date >= today, Exam.exam_date <= in_48h))
                .distinct()
            )
        ).scalars().all()
        has_exam_soon_set = set(exams_soon_rows)

        class_risk_map: dict[str, dict] = {}
        for student_obj, class_obj, filiere_obj, school_obj in student_rows:
            avg_mood_7d = avg_mood_map.get(student_obj.id, 0.0)
            overdue_projects = overdue_projects_map.get(student_obj.id, 0)
            has_exam_within_48h = student_obj.id in has_exam_soon_set
            has_low_mood_signal = avg_mood_7d > 0 and avg_mood_7d <= 2.5

            if has_low_mood_signal:
                risk_summary.low_mood_students_7d += 1
            if overdue_projects > 0:
                risk_summary.students_with_overdue_projects += 1
            if has_exam_within_48h:
                risk_summary.students_with_exam_within_48h += 1

            class_key = str(class_obj.id)
            if class_key not in class_risk_map:
                class_risk_map[class_key] = {
                    "class_id": class_key,
                    "class_name": class_obj.name,
                    "filiere_name": filiere_obj.name,
                    "school_name": school_obj.name,
                    "low_mood_students_7d": 0,
                    "students_with_overdue_projects": 0,
                    "students_with_exam_within_48h": 0,
                }
            if has_low_mood_signal:
                class_risk_map[class_key]["low_mood_students_7d"] += 1
            if overdue_projects > 0:
                class_risk_map[class_key]["students_with_overdue_projects"] += 1
            if has_exam_within_48h:
                class_risk_map[class_key]["students_with_exam_within_48h"] += 1

        class_risk_summary = [
            AdminClassRiskSummary(**item)
            for item in class_risk_map.values()
            if (
                item["low_mood_students_7d"] > 0
                or item["students_with_overdue_projects"] > 0
                or item["students_with_exam_within_48h"] > 0
            )
        ]
        class_risk_summary.sort(
            key=lambda item: (
                -item.low_mood_students_7d,
                -item.students_with_overdue_projects,
                -item.students_with_exam_within_48h,
                item.class_name,
            )
        )

    # Platform Trends (last 7 days)
    trends_query = (
        select(
            MorningCheckin.date, 
            func.count(MorningCheckin.id).label("count"), 
            func.avg(MorningCheckin.mood_score).label("avg_mood")
        )
        .where(MorningCheckin.date >= week_ago)
        .group_by(MorningCheckin.date)
        .order_by(MorningCheckin.date)
    )
    if scoped_school_id:
        trends_query = trends_query.where(MorningCheckin.student_id.in_(scoped_student_ids_list))
    
    trends_rows = (await db.execute(trends_query)).all()
    platform_trends = [
        PlatformTrendPoint(
            date=row.date,
            checkin_count=int(row.count),
            avg_mood=round(float(row.avg_mood), 2) if row.avg_mood else 0.0
        )
        for row in trends_rows
    ]

    # Institutional Stats (Aggregated from class health)
    from typing import Any
    inst_map: dict[str, dict[str, Any]] = {}
    for ch in class_health:
        s_name = ch.school_name or "Unknown"
        if s_name not in inst_map:
            inst_map[s_name] = {
                "school_id": "",
                "students_count": 0,
                "activated_count": 0,
                "mood_sum": 0.0,
                "engagement_sum": 0.0,
                "class_count": 0,
                "at_risk_count": 0
            }
        
        inst_map[s_name]["students_count"] += ch.students_count
        inst_map[s_name]["activated_count"] += ch.activated_students_count
        inst_map[s_name]["mood_sum"] += float(ch.avg_mood_7d)
        inst_map[s_name]["engagement_sum"] += float(ch.morning_checkin_today_pct)
        inst_map[s_name]["class_count"] += 1
        inst_map[s_name]["at_risk_count"] += ch.low_mood_students_7d

    institutional_stats = []
    for name, data in inst_map.items():
        # Quick lookup for school_id (inefficient but safe for now)
        s_obj = (await db.execute(select(School).where(School.name == name))).scalars().first()
        
        institutional_stats.append(
            InstitutionalStat(
                school_id=str(s_obj.id) if s_obj else "",
                school_name=name,
                students_count=data["students_count"],
                active_students_pct=float(round((data["activated_count"] / data["students_count"]) * 100, 2)) if data["students_count"] > 0 else 0.0,
                avg_mood=float(round(data["mood_sum"] / data["class_count"], 2)) if data["class_count"] > 0 else 0.0,
                engagement_pct=float(round(data["engagement_sum"] / data["class_count"], 2)) if data["class_count"] > 0 else 0.0,
                at_risk_count=data["at_risk_count"]
            )
        )

    return {
        "kpis": kpis,
        "classes_health": class_health,
        "risk_students": [],
        "risk_summary": risk_summary,
        "class_risk_summary": class_risk_summary,
        "platform_trends": platform_trends,
        "institutional_stats": institutional_stats
    }
