# Pydantic schemas for analytics — WeeklyReport, MoodGraph, SleepGraph, ModeDistribution
# app/schemas/analytics.py
from datetime import date
from typing import List, Optional

from pydantic import BaseModel

from app.schemas.mode import ModeSessionResponse
from app.schemas.student import ExamResponse, ScheduleResponse, StudentResponse


class MoodGraphPoint(BaseModel):
    date: date
    mood_score: float
    sleep_hours: float


class ModeDistribution(BaseModel):
    mode: str
    total_minutes: int
    percentage: float


class WeeklyReport(BaseModel):
    week_start: date
    week_end: date
    avg_mood: float
    avg_sleep: float
    total_checkins: int
    goals_achieved: int
    mode_distribution: List[ModeDistribution]
    stress_level: str


class StudentDashboard(BaseModel):
    student: StudentResponse
    current_mode: Optional[ModeSessionResponse] = None
    has_morning_checkin: bool
    has_evening_checkin: bool
    active_goals_count: int
    upcoming_exams: List[ExamResponse]
    today_schedule: List[ScheduleResponse]
    mood_trend: List[MoodGraphPoint]


class AdminKpi(BaseModel):
    schools_count: int
    filieres_count: int
    promotions_count: int
    classes_count: int
    students_count: int
    activated_students_count: int
    morning_checkin_today_count: int
    evening_checkin_today_count: int


class AdminClassHealth(BaseModel):
    class_id: str
    class_name: str
    filiere_name: str
    promotion_name: str
    students_count: int
    activated_students_count: int
    schedule_coverage_pct: float
    exams_coverage_pct: float
    projects_coverage_pct: float
    morning_checkin_today_pct: float
    low_mood_students_7d: int
    avg_mood_7d: float = 0.0
    school_name: Optional[str] = None


class AdminRiskStudent(BaseModel):
    student_id: str
    full_name: str
    class_name: str
    filiere_name: str
    avg_mood_7d: float
    overdue_projects: int
    has_exam_within_48h: bool
    school_name: Optional[str] = None


class PlatformTrendPoint(BaseModel):
    date: date
    checkin_count: int
    avg_mood: float


class InstitutionalStat(BaseModel):
    school_id: str
    school_name: str
    students_count: int
    active_students_pct: float
    avg_mood: float
    engagement_pct: float
    at_risk_count: int = 0


class AdminDashboardResponse(BaseModel):
    kpis: AdminKpi
    classes_health: List[AdminClassHealth]
    risk_students: List[AdminRiskStudent] = []
    platform_trends: List[PlatformTrendPoint] = []
    institutional_stats: List[InstitutionalStat] = []
