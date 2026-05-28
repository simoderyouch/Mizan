import asyncio

from app.services.agent_service import chat_with_agent
from app.services.notification_service import should_apply_daily_cap
from app.services.safety_service import (
    SAFETY_ACTION_HUMAN_SUPPORT,
    SAFETY_LEVEL_HIGH,
    assess_text_safety,
)


def test_safety_detector_flags_serious_distress() -> None:
    assessment = assess_text_safety("I can't continue and I want to die.")

    assert assessment.level == SAFETY_LEVEL_HIGH
    assert assessment.action == SAFETY_ACTION_HUMAN_SUPPORT


def test_safety_detector_allows_normal_study_stress() -> None:
    assessment = assess_text_safety("I am stressed about exams and need a revision plan.")

    assert assessment.level == "none"
    assert assessment.action is None


def test_agent_chat_safety_response_bypasses_normal_ai_path() -> None:
    response = asyncio.run(chat_with_agent({}, "I want to die"))

    assert response["safety_level"] == SAFETY_LEVEL_HIGH
    assert response["safety_action"] == SAFETY_ACTION_HUMAN_SUPPORT
    assert "trusted person" in response["response"]


def test_notification_daily_cap_targets_agent_wellbeing_nudges() -> None:
    assert should_apply_daily_cap("wellbeing", {}) is True
    assert should_apply_daily_cap("task", {"source": "agent"}) is True
    assert should_apply_daily_cap("task", {"source": "manual"}) is False
    assert should_apply_daily_cap("critical_wellbeing", {}) is False
    assert should_apply_daily_cap("safety", {}) is False
