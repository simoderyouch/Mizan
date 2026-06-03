"""
Populate an empty database with realistic sample data for staging demos and UX review.

Idempotent guard: skips if any User exists unless force=True.
"""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.checkin import EveningCheckin, MorningCheckin
from app.models.goal import Goal, GoalProgress
from app.models.institution import Class, Filiere, Promotion, School, VerificationStatus
from app.models.mode_session import Mode, ModeSession
from app.models.notification import Notification
from app.models.student import Exam, Project, Schedule, Student
from app.models.task import Task
from app.models.user import Role, User
from app.seed.fixtures import (
    EXAM_SLOTS,
    GLOBAL_ADMIN_EMAIL,
    PROJECT_SLOTS,
    SCHOOL_ADMIN_EMAIL,
    SCHOOL_IDENTIFIER,
    SCHOOL_NAME,
    STUDENT_PERSONAS,
    WEEKLY_SCHEDULE,
    StudentPersona,
    exam_date_for_slot,
    project_due_for_slot,
)
from app.services.resource_service import seed_default_resources

logger = logging.getLogger(__name__)


def _password_hash() -> str:
    raw = os.environ.get("SAMPLE_DATA_PASSWORD", "").strip()
    if not raw or len(raw) < 8:
        raise ValueError(
            "Set SAMPLE_DATA_PASSWORD (min 8 characters) before seeding sample data."
        )
    return hash_password(raw)


async def _user_count(db: AsyncSession) -> int:
    return int(await db.scalar(select(func.count()).select_from(User)) or 0)


async def _clear_student_academic_content(db: AsyncSession, student_id: UUID) -> None:
    await db.execute(delete(Schedule).where(Schedule.student_id == student_id))
    await db.execute(delete(Exam).where(Exam.student_id == student_id))
    await db.execute(delete(Project).where(Project.student_id == student_id))


async def _seed_schedules_for_student(db: AsyncSession, student_id: UUID) -> None:
    for slot in WEEKLY_SCHEDULE:
        db.add(
            Schedule(
                student_id=student_id,
                subject=slot.subject,
                day_of_week=slot.day_of_week,
                start_time=slot.start_time,
                end_time=slot.end_time,
                room=slot.room,
                professor=slot.professor,
            )
        )
    anchor = date.today()
    for slot in EXAM_SLOTS:
        db.add(
            Exam(
                student_id=student_id,
                subject=slot.subject,
                exam_date=exam_date_for_slot(slot, anchor),
                start_time=slot.start_time,
                end_time=slot.end_time,
                room=slot.room,
            )
        )
    for slot in PROJECT_SLOTS:
        db.add(
            Project(
                student_id=student_id,
                name=slot.name,
                subject=slot.subject,
                due_date=project_due_for_slot(slot, anchor),
                members=slot.members,
            )
        )


async def _seed_student_persona(
    db: AsyncSession,
    persona: StudentPersona,
    class_id: UUID,
    school_id: UUID,
    password_hash: str,
    today: date,
    now: datetime,
) -> Student:
    user = User(
        email=persona.email,
        password_hash=password_hash,
        is_active=True,
        role=Role.STUDENT,
        school_id=school_id,
    )
    db.add(user)
    await db.flush()

    student = Student(
        user_id=user.id,
        class_id=class_id,
        first_name=persona.first_name,
        last_name=persona.last_name,
        cne=f"CNE-{persona.cne_suffix}",
        phone="+212600000000",
    )
    db.add(student)
    await db.flush()

    goal_focus = Goal(
        student_id=student.id,
        title="Deep work",
        target_value=4.0,
        unit="hours",
        is_active=True,
    )
    goal_sleep = Goal(
        student_id=student.id,
        title="Sleep minimum",
        target_value=7.0,
        unit="hours",
        is_active=True,
    )
    db.add_all([goal_focus, goal_sleep])
    await db.flush()

    for i in range(7):
        day = today - timedelta(days=6 - i)
        mood = max(1, min(5, persona.moods_7d[i]))
        sleep = persona.sleep_7d[i]
        completed = persona.plan_completion[i]
        checkin_dt = (now - timedelta(days=6 - i)).replace(
            hour=8, minute=0, second=0, microsecond=0
        )
        evening_dt = (now - timedelta(days=6 - i)).replace(
            hour=20, minute=0, second=0, microsecond=0
        )

        db.add(
            GoalProgress(goal_id=goal_focus.id, date=day, value=round(sleep / 2, 1), note="Focus log")
        )
        db.add(GoalProgress(goal_id=goal_sleep.id, date=day, value=sleep, note="Sleep log"))

        risks = ["Burnout risk", "Exam pressure"] if mood <= 2 else []
        db.add(
            MorningCheckin(
                student_id=student.id,
                date=day,
                sleep_hours=sleep,
                mood_score=mood,
                mode="qcm",
                executive_summary=f"{persona.scenario} — morning day {i + 1}.",
                detailed_action_plan={"steps": ["Review schedule", "Pick one priority task"]},
                detected_risks=risks,
                checkin_time=checkin_dt,
            )
        )
        db.add(
            EveningCheckin(
                student_id=student.id,
                date=day,
                plan_completed=completed,
                mood_score=mood,
                notes="End of day reflection.",
                mode="qcm",
                executive_summary=f"{persona.scenario} — evening day {i + 1}.",
                detailed_action_plan={"steps": ["Wind down", "Prepare tomorrow"]},
                detected_risks=["Low energy"] if sleep < 6 else [],
                checkin_time=evening_dt,
            )
        )

    await _clear_student_academic_content(db, student.id)
    await _seed_schedules_for_student(db, student.id)

    last_mood = max(1, min(5, persona.moods_7d[-1]))
    db.add(
        Task(
            student_id=student.id,
            title="Review Networks chapter 4",
            due_date=today + timedelta(days=1),
            source="agent",
            status="pending" if last_mood <= 3 else "done",
        )
    )

    if persona.email == "nizar@enset.ma":
        db.add(
            Notification(
                student_id=student.id,
                type="exam_reminder",
                title="Database exam tomorrow",
                body="Your Database Systems exam is scheduled for tomorrow morning.",
                payload={"subject": "Database Systems"},
                is_read=False,
            )
        )
        db.add(
            Notification(
                student_id=student.id,
                type="wellbeing_nudge",
                title="Take a short break",
                body="Sleep has been under 6h — consider a 15-minute reset before revision.",
                is_read=False,
            )
        )
    elif persona.email == "yassine@enset.ma":
        started = now - timedelta(hours=2)
        db.add(
            ModeSession(
                student_id=student.id,
                mode=Mode.REVISION.value,
                started_at=started,
                ended_at=now - timedelta(minutes=30),
                duration_minutes=90,
            )
        )

    return student


async def seed_sample_database(*, force: bool = False) -> dict[str, str | int]:
    """
    Seed full sample dataset. Returns summary dict for logging.
    Raises ValueError if password missing or DB already has users (unless force).
    """
    password_hash = _password_hash()
    today = date.today()
    now = datetime.now(timezone.utc)
    summary: dict[str, str | int] = {}

    async with AsyncSessionLocal() as db:
        count = await _user_count(db)
        if count > 0 and not force:
            logger.info("Sample seed skipped: database already has %s user(s).", count)
            return {"skipped": True, "users": count}

        if force and count > 0:
            logger.warning("Force seed requested but not implemented — would wipe data. Skipping.")
            raise ValueError(
                "Force re-seed is not supported. Use a fresh database or destroy the environment first."
            )

        await seed_default_resources(db)

        global_admin = User(
            email=GLOBAL_ADMIN_EMAIL,
            password_hash=password_hash,
            is_active=True,
            role=Role.ADMIN,
            school_id=None,
        )
        db.add(global_admin)
        await db.flush()

        school = School(
            name=SCHOOL_NAME,
            official_identifier=SCHOOL_IDENTIFIER,
            contact_phone="+212523322220",
            verification_status=VerificationStatus.VERIFIED,
        )
        db.add(school)
        await db.flush()

        school_admin = User(
            email=SCHOOL_ADMIN_EMAIL,
            password_hash=password_hash,
            is_active=True,
            role=Role.ADMIN,
            school_id=school.id,
        )
        db.add(school_admin)

        f_gl = Filiere(name="Génie Logiciel", school_id=school.id)
        f_ia = Filiere(name="Intelligence Artificielle", school_id=school.id)
        db.add_all([f_gl, f_ia])
        await db.flush()

        p_gl = Promotion(filiere_id=f_gl.id, name="Promo 2027")
        p_ia = Promotion(filiere_id=f_ia.id, name="Promo 2027")
        db.add_all([p_gl, p_ia])
        await db.flush()

        c_gl = Class(promotion_id=p_gl.id, name="GL — Groupe 1", academic_year="2025/2026")
        c_ia = Class(promotion_id=p_ia.id, name="IA — Groupe 1", academic_year="2025/2026")
        db.add_all([c_gl, c_ia])
        await db.flush()

        class_by_track = {"GL": c_gl.id, "IA": c_ia.id}
        students_seeded = 0
        for persona in STUDENT_PERSONAS:
            await _seed_student_persona(
                db,
                persona,
                class_by_track[persona.filiere],
                school.id,
                password_hash,
                today,
                now,
            )
            students_seeded += 1

        await db.commit()

        summary = {
            "skipped": False,
            "school": SCHOOL_NAME,
            "students": students_seeded,
            "global_admin": GLOBAL_ADMIN_EMAIL,
            "school_admin": SCHOOL_ADMIN_EMAIL,
        }
        logger.info("Sample database seeded: %s", summary)
        return summary
