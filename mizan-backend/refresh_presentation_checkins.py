"""Shift demo students' check-in and goal-progress dates into the last 7 days.

Run on production when weekly metrics show zeros because seed data aged out:
  python refresh_presentation_checkins.py
"""
import asyncio
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.checkin import EveningCheckin, MorningCheckin
from app.models.goal import Goal, GoalProgress
from app.models.student import Student
from app.models.user import User

DEMO_EMAILS = (
    "nizar@enset.ma",
    "yassine@enset.ma",
    "meriem@enset.ma",
)


async def refresh_presentation_checkins() -> None:
    today = date.today()
    async with AsyncSessionLocal() as db:
        for email in DEMO_EMAILS:
            user_res = await db.execute(select(User).where(User.email == email))
            user = user_res.scalars().first()
            if not user:
                print(f"Skip {email}: user not found")
                continue

            student_res = await db.execute(select(Student).where(Student.user_id == user.id))
            student = student_res.scalars().first()
            if not student:
                print(f"Skip {email}: student profile not found")
                continue

            morning_res = await db.execute(
                select(MorningCheckin)
                .where(MorningCheckin.student_id == student.id)
                .order_by(MorningCheckin.date.asc())
            )
            mornings = list(morning_res.scalars().all())
            evening_res = await db.execute(
                select(EveningCheckin)
                .where(EveningCheckin.student_id == student.id)
                .order_by(EveningCheckin.date.asc())
            )
            evenings = list(evening_res.scalars().all())

            old_dates = sorted({c.date for c in mornings} | {c.date for c in evenings})
            if not old_dates:
                print(f"Skip {email}: no check-ins")
                continue

            date_map = {
                old: today - timedelta(days=len(old_dates) - 1 - idx)
                for idx, old in enumerate(old_dates)
            }

            for checkin in mornings + evenings:
                new_d = date_map[checkin.date]
                if checkin.checkin_time:
                    t = checkin.checkin_time
                    if t.tzinfo is None:
                        t = t.replace(tzinfo=timezone.utc)
                    checkin.checkin_time = t.replace(
                        year=new_d.year, month=new_d.month, day=new_d.day
                    )
                checkin.date = new_d

            goals_res = await db.execute(select(Goal).where(Goal.student_id == student.id))
            goal_ids = [g.id for g in goals_res.scalars().all()]
            if goal_ids:
                prog_res = await db.execute(
                    select(GoalProgress).where(GoalProgress.goal_id.in_(goal_ids))
                )
                for progress in prog_res.scalars().all():
                    if progress.date in date_map:
                        progress.date = date_map[progress.date]

            print(f"Refreshed {email}: {len(old_dates)} days → {date_map[old_dates[0]]} … {date_map[old_dates[-1]]}")

        await db.commit()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(refresh_presentation_checkins())
