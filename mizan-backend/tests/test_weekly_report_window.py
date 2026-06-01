from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.services import analytics_service


def _mock_db(mornings, evenings, goals, progresses):
    morning_result = MagicMock()
    morning_result.scalars.return_value.all.return_value = mornings
    evening_result = MagicMock()
    evening_result.scalars.return_value.all.return_value = evenings
    goals_result = MagicMock()
    goals_result.scalars.return_value.all.return_value = goals
    prog_result = MagicMock()
    prog_result.scalars.return_value.all.return_value = progresses

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[morning_result, evening_result, goals_result, prog_result]
    )
    return db


@pytest.mark.asyncio
async def test_weekly_report_uses_rolling_seven_days(monkeypatch):
    fixed_today = date(2026, 5, 30)
    monkeypatch.setattr(analytics_service.date, "today", classmethod(lambda cls: fixed_today))

    student_id = uuid4()
    in_window = fixed_today - timedelta(days=3)

    mornings = [
        SimpleNamespace(mood_score=4, sleep_hours=7.0),
    ]
    evenings = [
        SimpleNamespace(mood_score=4),
    ]
    goal_id = uuid4()
    goals = [SimpleNamespace(id=goal_id, target_value=7)]
    progresses = [SimpleNamespace(goal_id=goal_id, value=7.5)]

    db = _mock_db(mornings, evenings, goals, progresses)

    async def fake_mode_distribution(db, student_id, days=7):
        return []

    monkeypatch.setattr(analytics_service, "get_mode_distribution", fake_mode_distribution)

    report = await analytics_service.get_weekly_report(db, student_id)

    assert report.week_start == fixed_today - timedelta(days=6)
    assert report.week_end == fixed_today
    assert report.total_checkins == 2
    assert report.avg_mood == 4.0
    assert report.avg_sleep == 7.0
    assert report.goals_achieved == 1
