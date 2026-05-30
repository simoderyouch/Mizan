"""Shared demo timetable / exams / projects for DB seed scripts."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time, timedelta
from typing import Any


@dataclass(frozen=True)
class DemoScheduleSlot:
    subject: str
    day_of_week: str
    start_time: time
    end_time: time
    room: str
    professor: str


@dataclass(frozen=True)
class DemoExamSlot:
    subject: str
    days_from_monday: int
    weeks_offset: int
    start_time: time
    end_time: time
    room: str


@dataclass(frozen=True)
class DemoProjectSlot:
    name: str
    subject: str
    days_from_today: int
    members: dict[str, Any]


# Full week grid (English weekday names — matches check-in context queries)
DEMO_WEEKLY_SCHEDULE: tuple[DemoScheduleSlot, ...] = (
    DemoScheduleSlot("Algorithms", "Monday", time(9, 0), time(10, 30), "B204", "Dr. Benali"),
    DemoScheduleSlot("English", "Monday", time(11, 0), time(12, 0), "A112", "Ms. Carter"),
    DemoScheduleSlot("Database Systems", "Tuesday", time(8, 30), time(10, 0), "Lab 3", "Prof. Idrissi"),
    DemoScheduleSlot("Statistics", "Tuesday", time(14, 0), time(15, 30), "C101", "Dr. Amrani"),
    DemoScheduleSlot("Software Engineering", "Wednesday", time(10, 0), time(12, 0), "B310", "Dr. Fassi"),
    DemoScheduleSlot("Networks", "Thursday", time(9, 0), time(10, 30), "Lab 1", "Prof. Alaoui"),
    DemoScheduleSlot("Professional Ethics", "Thursday", time(15, 0), time(16, 0), "A205", "Dr. Naciri"),
    DemoScheduleSlot("Web Development", "Friday", time(8, 0), time(10, 0), "Lab 2", "Dr. Berrada"),
    DemoScheduleSlot("Project Workshop", "Friday", time(14, 0), time(17, 0), "Incubator", "Mentor team"),
    DemoScheduleSlot("Optional Lab", "Saturday", time(10, 0), time(12, 0), "Lab 4", "TA staff"),
)

DEMO_EXAMS: tuple[DemoExamSlot, ...] = (
    DemoExamSlot("Database Systems", days_from_monday=2, weeks_offset=0, start_time=time(9, 0), end_time=time(11, 0), room="Amphi A"),
    DemoExamSlot("Networks", days_from_monday=4, weeks_offset=0, start_time=time(10, 0), end_time=time(12, 0), room="C201"),
    DemoExamSlot("Algorithms", days_from_monday=2, weeks_offset=1, start_time=time(14, 0), end_time=time(16, 0), room="Amphi B"),
)

DEMO_PROJECTS: tuple[DemoProjectSlot, ...] = (
    DemoProjectSlot("API prototype", "Software Engineering", 1, {"team": ["You", "Sara", "Youssef"]}),
    DemoProjectSlot("UX research report", "Web Development", 7, {"team": ["You", "Lina"]}),
    DemoProjectSlot("Capstone milestone 1", "Project Workshop", 11, {"team": ["Team Mizan"]}),
)


def monday_of_week(anchor: date | None = None) -> date:
    d = anchor or date.today()
    return d - timedelta(days=d.weekday())


def exam_date_for_slot(slot: DemoExamSlot, anchor: date | None = None) -> date:
    mon = monday_of_week(anchor)
    return mon + timedelta(days=slot.days_from_monday + 7 * slot.weeks_offset)


def project_due_for_slot(slot: DemoProjectSlot, anchor: date | None = None) -> date:
    return (anchor or date.today()) + timedelta(days=slot.days_from_today)
