import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from app.services.notification_service import (
    _effective_cooldown_hours,
    has_recent_notification,
    should_apply_daily_cap,
)


def test_critical_types_use_minimum_cooldown_from_settings() -> None:
    hours = _effective_cooldown_hours("critical_fatigue", 2)
    assert hours >= 12


def test_automated_notification_type_detection() -> None:
    from app.services.notification_service import _is_automated_notification_type

    assert _is_automated_notification_type("critical_fatigue") is True
    assert _is_automated_notification_type("info") is False


def test_should_apply_daily_cap_still_false_for_critical() -> None:
    assert should_apply_daily_cap("critical_wellbeing", {}) is False


def test_has_recent_notification_uses_title_when_provided() -> None:
    student_id = uuid4()
    recent = MagicMock()
    recent.title = "Urgent recovery required"

    result = MagicMock()
    result.scalars.return_value.first.return_value = recent

    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)

    found = asyncio.run(
        has_recent_notification(
            db,
            student_id=student_id,
            notification_type="critical_fatigue",
            cooldown_hours=12,
            title="Urgent recovery required",
        )
    )
    assert found is True
    db.execute.assert_awaited()
