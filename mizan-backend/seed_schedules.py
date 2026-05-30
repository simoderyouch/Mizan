#!/usr/bin/env python3
"""
Seed demo schedule, exam, and project rows into the database.

Examples:
  python seed_schedules.py --email student@example.com
  python seed_schedules.py --all
  python seed_schedules.py --all --no-replace   # skip delete; may duplicate rows
"""
from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.student import Student
from app.models.user import User
from app.services.schedule_seed_service import seed_schedules_for_students


async def run(email: str | None, seed_all: bool, replace: bool) -> None:
    async with AsyncSessionLocal() as db:
        if seed_all:
            rows = (await db.execute(select(Student.id, User.email).join(User, Student.user_id == User.id))).all()
            if not rows:
                raise SystemExit("No students found.")
            student_ids = [row[0] for row in rows]
            emails = [row[1] for row in rows]
        else:
            if not email:
                raise SystemExit("--email is required unless --all is used")
            row = (
                await db.execute(
                    select(Student.id, User.email)
                    .join(User, Student.user_id == User.id)
                    .where(User.email == email)
                )
            ).first()
            if not row:
                raise SystemExit(f"No student for email: {email}")
            student_ids = [row[0]]
            emails = [row[1]]

        totals = await seed_schedules_for_students(db, student_ids, replace=replace)
        await db.commit()

        for addr in emails:
            print(f"  • {addr}")
        print(
            f"\nDone — {totals['students']} student(s): "
            f"{totals['schedules']} schedule slots, "
            f"{totals['exams']} exams, "
            f"{totals['projects']} projects."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo timetable into the database")
    parser.add_argument("--email", help="Student login email")
    parser.add_argument("--all", action="store_true", help="Seed every student profile")
    parser.add_argument(
        "--no-replace",
        action="store_true",
        help="Do not delete existing schedule/exam/project rows first",
    )
    args = parser.parse_args()
    asyncio.run(run(args.email, args.all, replace=not args.no_replace))


if __name__ == "__main__":
    main()
