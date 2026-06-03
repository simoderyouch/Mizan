"""Static fixtures for staging / demo sample data (not used in production runtime)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time, timedelta
from typing import Any


@dataclass(frozen=True)
class ScheduleSlot:
    subject: str
    day_of_week: str
    start_time: time
    end_time: time
    room: str
    professor: str


@dataclass(frozen=True)
class ExamSlot:
    subject: str
    days_from_monday: int
    weeks_offset: int
    start_time: time
    end_time: time
    room: str


@dataclass(frozen=True)
class ProjectSlot:
    name: str
    subject: str
    days_from_today: int
    members: dict[str, Any]


WEEKLY_SCHEDULE: tuple[ScheduleSlot, ...] = (
    ScheduleSlot("Algorithms", "Monday", time(9, 0), time(10, 30), "B204", "Dr. Benali"),
    ScheduleSlot("English", "Monday", time(11, 0), time(12, 0), "A112", "Ms. Carter"),
    ScheduleSlot("Database Systems", "Tuesday", time(8, 30), time(10, 0), "Lab 3", "Prof. Idrissi"),
    ScheduleSlot("Statistics", "Tuesday", time(14, 0), time(15, 30), "C101", "Dr. Amrani"),
    ScheduleSlot("Software Engineering", "Wednesday", time(10, 0), time(12, 0), "B310", "Dr. Fassi"),
    ScheduleSlot("Networks", "Thursday", time(9, 0), time(10, 30), "Lab 1", "Prof. Alaoui"),
    ScheduleSlot("Professional Ethics", "Thursday", time(15, 0), time(16, 0), "A205", "Dr. Naciri"),
    ScheduleSlot("Web Development", "Friday", time(8, 0), time(10, 0), "Lab 2", "Dr. Berrada"),
    ScheduleSlot("Project Workshop", "Friday", time(14, 0), time(17, 0), "Incubator", "Mentor team"),
)

EXAM_SLOTS: tuple[ExamSlot, ...] = (
    ExamSlot("Database Systems", 2, 0, time(9, 0), time(11, 0), "Amphi A"),
    ExamSlot("Networks", 4, 0, time(10, 0), time(12, 0), "C201"),
    ExamSlot("Algorithms", 2, 1, time(14, 0), time(16, 0), "Amphi B"),
)

PROJECT_SLOTS: tuple[ProjectSlot, ...] = (
    ProjectSlot("API prototype", "Software Engineering", 1, {"team": ["You", "Sara", "Youssef"]}),
    ProjectSlot("UX research report", "Web Development", 7, {"team": ["You", "Lina"]}),
    ProjectSlot("Capstone milestone 1", "Project Workshop", 11, {"team": ["Team Mizan"]}),
)


def monday_of_week(anchor: date | None = None) -> date:
    d = anchor or date.today()
    return d - timedelta(days=d.weekday())


def exam_date_for_slot(slot: ExamSlot, anchor: date | None = None) -> date:
    return monday_of_week(anchor) + timedelta(days=slot.days_from_monday + 7 * slot.weeks_offset)


def project_due_for_slot(slot: ProjectSlot, anchor: date | None = None) -> date:
    return (anchor or date.today()) + timedelta(days=slot.days_from_today)


SCHOOL_NAME = "ENSET Mohammedia"
SCHOOL_IDENTIFIER = "ENSET-M"

GLOBAL_ADMIN_EMAIL = "admin@mizan.ai"
SCHOOL_ADMIN_EMAIL = "admin@enset.ma"


@dataclass(frozen=True)
class StudentPersona:
    email: str
    first_name: str
    last_name: str
    filiere: str  # "GL" or "IA"
    cne_suffix: str
    scenario: str
    moods_7d: tuple[int, ...]  # 1–5 scale, oldest → today
    sleep_7d: tuple[float, ...]
    plan_completion: tuple[bool, ...]


STUDENT_PERSONAS: tuple[StudentPersona, ...] = (
    StudentPersona(
        email="nizar@enset.ma",
        first_name="Nizar",
        last_name="Alaoui",
        filiere="GL",
        cne_suffix="NIZAR01",
        scenario="Exam pressure and poor sleep — agent should nudge recovery and focus mode.",
        moods_7d=(4, 3, 2, 3, 2, 2, 2),
        sleep_7d=(6.0, 5.5, 4.5, 5.0, 4.0, 3.5, 4.0),
        plan_completion=(True, False, False, False, False, False, False),
    ),
    StudentPersona(
        email="yassine@enset.ma",
        first_name="Yassine",
        last_name="Bennani",
        filiere="GL",
        cne_suffix="YASS01",
        scenario="Balanced week — good sleep, stable mood, productive modes.",
        moods_7d=(4, 4, 5, 5, 4, 5, 5),
        sleep_7d=(7.5, 8.0, 7.5, 8.0, 8.0, 8.5, 8.0),
        plan_completion=(True, True, True, True, True, True, True),
    ),
    StudentPersona(
        email="meriem@enset.ma",
        first_name="Meriem",
        last_name="Toumi",
        filiere="IA",
        cne_suffix="MER01",
        scenario="Early-week burnout then recovery — mood trend improves over 7 days.",
        moods_7d=(1, 2, 2, 3, 4, 4, 5),
        sleep_7d=(4.5, 5.0, 5.5, 6.5, 7.0, 7.5, 8.0),
        plan_completion=(False, False, False, True, True, True, True),
    ),
)
