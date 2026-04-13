import argparse
import asyncio
from datetime import date, time, timedelta

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.checkin import EveningCheckin, MorningCheckin
from app.models.student import Student
from app.models.user import User


def _parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("--date must be in YYYY-MM-DD format") from exc


def _parse_time(value: str) -> time:
    try:
        hour_str, minute_str = value.split(":")
        parsed = time(hour=int(hour_str), minute=int(minute_str))
        return parsed
    except Exception as exc:
        raise ValueError("time must be in HH:MM format (24h)") from exc


async def reset_checkins(
    student_email: str,
    days_back: int,
    target_date: date | None,
    morning_time: time | None,
    evening_time: time | None,
) -> None:
    async with AsyncSessionLocal() as db:  # type: AsyncSession
        student_res = await db.execute(
            select(Student)
            .join(User, Student.user_id == User.id)
            .where(User.email == student_email)
        )
        student = student_res.scalars().first()
        if not student:
            raise ValueError(f"Student not found for email: {student_email}")

        if target_date is None and days_back < 1:
            raise ValueError("--days-back must be >= 1")

        today = date.today()
        new_date = target_date or (today - timedelta(days=days_back))

        morning_rows = (
            await db.execute(
                select(MorningCheckin).where(
                    and_(MorningCheckin.student_id == student.id, MorningCheckin.date == today)
                )
            )
        ).scalars().all()
        evening_rows = (
            await db.execute(
                select(EveningCheckin).where(
                    and_(EveningCheckin.student_id == student.id, EveningCheckin.date == today)
                )
            )
        ).scalars().all()

        for row in morning_rows:
            row.date = new_date
            if getattr(row, "checkin_time", None):
                if morning_time:
                    row.checkin_time = row.checkin_time.replace(
                        year=new_date.year,
                        month=new_date.month,
                        day=new_date.day,
                        hour=morning_time.hour,
                        minute=morning_time.minute,
                        second=0,
                        microsecond=0,
                    )
                else:
                    day_delta = (row.date - today).days if target_date else -days_back
                    row.checkin_time = row.checkin_time + timedelta(days=day_delta)

        for row in evening_rows:
            row.date = new_date
            if getattr(row, "checkin_time", None):
                if evening_time:
                    row.checkin_time = row.checkin_time.replace(
                        year=new_date.year,
                        month=new_date.month,
                        day=new_date.day,
                        hour=evening_time.hour,
                        minute=evening_time.minute,
                        second=0,
                        microsecond=0,
                    )
                else:
                    day_delta = (new_date - today).days if target_date else -days_back
                    row.checkin_time = row.checkin_time + timedelta(days=day_delta)

        await db.commit()

        print(
            f"Done. Shifted Morning: {len(morning_rows)}, "
            f"Evening: {len(evening_rows)} "
            f"from {today.isoformat()} to {new_date.isoformat()} "
            f"(no delete)"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Hide today's check-ins without deleting data")
    parser.add_argument("--email", required=True, help="Student user email")
    parser.add_argument(
        "--days-back",
        type=int,
        default=1,
        help="How many days to move today's check-ins backward (default: 1)",
    )
    parser.add_argument("--date", type=str, help="Exact target date, format YYYY-MM-DD")
    parser.add_argument("--morning-time", type=str, help="Set morning checkin_time, format HH:MM")
    parser.add_argument("--evening-time", type=str, help="Set evening checkin_time, format HH:MM")
    args = parser.parse_args()

    target_date = _parse_date(args.date) if args.date else None
    morning_time = _parse_time(args.morning_time) if args.morning_time else None
    evening_time = _parse_time(args.evening_time) if args.evening_time else None

    asyncio.run(
        reset_checkins(
            args.email,
            days_back=args.days_back,
            target_date=target_date,
            morning_time=morning_time,
            evening_time=evening_time,
        )
    )


if __name__ == "__main__":
    main()
