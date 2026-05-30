import argparse
import asyncio
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.checkin import EveningCheckin, MorningCheckin
from app.models.goal import Goal, GoalProgress
from app.models.mode_session import Mode, ModeSession
from app.models.student import Exam, Project, Schedule, Student
from app.models.task import Task
from app.models.user import User
from app.services.demo_schedule_data import DEMO_EXAMS, DEMO_PROJECTS, DEMO_WEEKLY_SCHEDULE, exam_date_for_slot, project_due_for_slot


async def _seed_one_student(db: AsyncSession, student: Student, user: User) -> None:
    goal_ids = (
        await db.execute(select(Goal.id).where(Goal.student_id == student.id))
    ).scalars().all()
    if goal_ids:
        await db.execute(delete(GoalProgress).where(GoalProgress.goal_id.in_(goal_ids)))

    await db.execute(delete(ModeSession).where(ModeSession.student_id == student.id))
    await db.execute(delete(MorningCheckin).where(MorningCheckin.student_id == student.id))
    await db.execute(delete(EveningCheckin).where(EveningCheckin.student_id == student.id))
    await db.execute(delete(Task).where(Task.student_id == student.id))
    await db.execute(delete(Schedule).where(Schedule.student_id == student.id))
    await db.execute(delete(Exam).where(Exam.student_id == student.id))
    await db.execute(delete(Project).where(Project.student_id == student.id))
    await db.execute(delete(Goal).where(Goal.student_id == student.id))

    today = date.today()
    now = datetime.now(timezone.utc)

    schedules = [
        Schedule(
            student_id=student.id,
            subject=slot.subject,
            day_of_week=slot.day_of_week,
            start_time=slot.start_time,
            end_time=slot.end_time,
            room=slot.room,
            professor=slot.professor,
        )
        for slot in DEMO_WEEKLY_SCHEDULE
    ]
    db.add_all(schedules)

    exams = [
        Exam(
            student_id=student.id,
            subject=slot.subject,
            exam_date=exam_date_for_slot(slot, today),
            start_time=slot.start_time,
            end_time=slot.end_time,
            room=slot.room,
        )
        for slot in DEMO_EXAMS
    ]
    db.add_all(exams)

    projects = [
        Project(
            student_id=student.id,
            name=slot.name,
            subject=slot.subject,
            due_date=project_due_for_slot(slot, today),
            members=slot.members,
        )
        for slot in DEMO_PROJECTS
    ]
    db.add_all(projects)

    goals = [
        Goal(student_id=student.id, title="Deep work", target_value=3, unit="hours", is_active=True),
        Goal(student_id=student.id, title="Practice problems", target_value=5, unit="problems", is_active=True),
        Goal(student_id=student.id, title="Sleep hygiene", target_value=8, unit="hours", is_active=True),
    ]
    db.add_all(goals)
    await db.flush()

    progress_rows = []
    for i in range(7):
        day = today - timedelta(days=6 - i)
        progress_rows.extend(
            [
                GoalProgress(goal_id=goals[0].id, date=day, value=1.5 + (i % 3) * 0.5, note="Focus block"),
                GoalProgress(goal_id=goals[1].id, date=day, value=2 + (i % 4), note="Exercise set"),
                GoalProgress(goal_id=goals[2].id, date=day, value=6.5 + (i % 3) * 0.5, note="Sleep tracking"),
            ]
        )
    db.add_all(progress_rows)

    mood_series = [6, 7, 5, 8, 7, 8, 9]
    sleep_series = [6.5, 7.0, 6.0, 7.5, 7.0, 7.5, 8.0]
    morning_rows = []
    evening_rows = []
    for i in range(7):
        day = today - timedelta(days=6 - i)
        mood = mood_series[i]
        morning_rows.append(
            MorningCheckin(
                student_id=student.id,
                date=day,
                sleep_hours=sleep_series[i],
                mood_score=max(1, min(5, round(1 + ((mood - 1) / 9) * 4))),
                mode="qcm",
                executive_summary="Solid start, keep momentum and protect your focus blocks.",
                detailed_action_plan=[
                    "Begin with a 90-minute revision block.",
                    "Review one weak chapter before noon.",
                    "Take a short recovery break after deep work.",
                ],
                detected_risks=[],
                checkin_time=(now - timedelta(days=6 - i)).replace(hour=8, minute=15, second=0, microsecond=0),
            )
        )
        evening_rows.append(
            EveningCheckin(
                student_id=student.id,
                date=day,
                plan_completed=i % 2 == 0,
                mood_score=max(1, min(5, round(1 + ((mood - 1) / 9) * 4))),
                notes="Productive day with manageable stress.",
                mode="qcm",
                executive_summary="Good recovery and steady academic progress.",
                detailed_action_plan=[
                    "Prepare tomorrow priorities before sleeping.",
                    "Keep the first morning session for the hardest topic.",
                ],
                detected_risks=[],
                checkin_time=(now - timedelta(days=6 - i)).replace(hour=20, minute=30, second=0, microsecond=0),
            )
        )
    db.add_all(morning_rows)
    db.add_all(evening_rows)

    tasks = [
        Task(student_id=student.id, title="Review graph algorithms notes", due_date=today, source="manual", status="in_progress"),
        Task(student_id=student.id, title="Solve 3 past exam questions", due_date=today, source="chat", status="pending"),
        Task(student_id=student.id, title="Finalize SQL lab report intro", due_date=today + timedelta(days=1), source="manual", status="pending"),
        Task(
            student_id=student.id,
            title="Recap yesterday weak points",
            due_date=today - timedelta(days=1),
            source="morning_checkin",
            status="done",
            completed_at=now - timedelta(hours=12),
        ),
    ]
    db.add_all(tasks)

    past_modes = [
        (Mode.REVISION, now - timedelta(days=3, hours=2), 90),
        (Mode.PROJET, now - timedelta(days=2, hours=3), 80),
        (Mode.EXAMEN, now - timedelta(days=1, hours=4), 70),
        (Mode.COURS, now - timedelta(days=1, hours=1), 60),
    ]
    for mode, start, duration in past_modes:
        db.add(
            ModeSession(
                student_id=student.id,
                mode=mode,
                started_at=start,
                ended_at=start + timedelta(minutes=duration),
                duration_minutes=duration,
            )
        )

    db.add(
        ModeSession(
            student_id=student.id,
            mode=Mode.REVISION,
            started_at=now - timedelta(minutes=45),
            ended_at=None,
            duration_minutes=None,
        )
    )

    user.is_active = True


async def seed_mock_data(student_email: str | None, seed_all: bool) -> None:
    async with AsyncSessionLocal() as db:  # type: AsyncSession
        pairs: list[tuple[Student, User]] = []
        if seed_all:
            rows = (
                await db.execute(
                    select(Student, User)
                    .join(User, Student.user_id == User.id)
                )
            ).all()
            pairs = [(student, user) for student, user in rows]
            if not pairs:
                raise ValueError("No student profiles found.")
        else:
            if not student_email:
                raise ValueError("--email is required unless --all is used")
            row = (
                await db.execute(
                    select(Student, User)
                    .join(User, Student.user_id == User.id)
                    .where(User.email == student_email)
                )
            ).first()
            if not row:
                raise ValueError(f"Student profile not found for user email: {student_email}")
            pairs = [(row[0], row[1])]

        for student, user in pairs:
            await _seed_one_student(db, student, user)
            print(f"Seeded: {student.first_name} {student.last_name} ({user.email})")

        await db.commit()
        print(f"Mock dashboard data seeded successfully for {len(pairs)} student(s).")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed mock data for a student dashboard validation environment")
    parser.add_argument("--email", help="Student user email")
    parser.add_argument("--all", action="store_true", help="Seed mock data for all students")
    args = parser.parse_args()
    asyncio.run(seed_mock_data(args.email, seed_all=args.all))


if __name__ == "__main__":
    main()
