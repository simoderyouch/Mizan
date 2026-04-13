from app.services.agent_policy import deterministic_decision, parse_decision


def test_parse_decision_sanitizes_unknown_action_and_mode() -> None:
    decision = parse_decision(
        '{"action":"unsupported","thought":"x","suggested_mode":"invalid","resource_index":"abc","confidence":"0.7"}'
    )
    assert decision["action"] == "NONE"
    assert decision["suggested_mode"] == ""
    assert decision["resource_index"] == 0
    assert decision["confidence"] == 0.7


def test_deterministic_decision_exam_tomorrow_after_18_without_revision() -> None:
    context = {
        "scan_data": {"current_hour": 19},
        "stress_indicators": {
            "has_exam_tomorrow": True,
            "has_revision_session_today": False,
            "has_morning_checkin_today": True,
            "heavy_course_load": False,
            "morning_courses_count": 1,
            "last_mood_yesterday": 3,
        },
    }
    decision = deterministic_decision(context)
    assert decision["action"] == "SEND_AND_CREATE"
    assert decision["suggested_mode"] == "REVISION"


def test_deterministic_decision_pause_nudge_for_heavy_day_and_low_mood_yesterday() -> None:
    context = {
        "scan_data": {"current_hour": 11},
        "stress_indicators": {
            "has_exam_tomorrow": False,
            "has_revision_session_today": False,
            "has_morning_checkin_today": True,
            "heavy_course_load": True,
            "morning_courses_count": 2,
            "last_mood_yesterday": 2,
        },
    }
    decision = deterministic_decision(context)
    assert decision["action"] == "SEND_NOTIFICATION"
    assert "pause" in decision["notification_title"].lower()


def test_deterministic_decision_immediate_support_for_low_current_mood() -> None:
    context = {
        "scan_data": {"current_hour": 9},
        "last_checkin": {"mood_score": 1},
        "stress_indicators": {
            "has_exam_tomorrow": False,
            "has_revision_session_today": False,
            "has_morning_checkin_today": True,
            "heavy_course_load": False,
            "morning_courses_count": 0,
            "last_mood_yesterday": 4,
            "current_mood_score": 1,
        },
    }
    decision = deterministic_decision(context)
    assert decision["action"] == "SEND_RESOURCE_NUDGE"


def test_deterministic_decision_checkin_silence_nudge_on_busy_day() -> None:
    context = {
        "scan_data": {"current_hour": 10},
        "stress_indicators": {
            "has_exam_tomorrow": False,
            "has_revision_session_today": False,
            "has_morning_checkin_today": False,
            "heavy_course_load": True,
            "morning_courses_count": 2,
            "last_mood_yesterday": None,
        },
    }
    decision = deterministic_decision(context)
    assert decision["action"] == "SEND_NOTIFICATION"
    assert "check-in" in decision["notification_title"].lower()


def test_deterministic_decision_none_when_context_is_stable() -> None:
    context = {
        "scan_data": {"current_hour": 14},
        "stress_indicators": {
            "has_exam_tomorrow": False,
            "has_revision_session_today": True,
            "has_morning_checkin_today": True,
            "heavy_course_load": False,
            "morning_courses_count": 1,
            "last_mood_yesterday": 4,
            "has_exam_this_week": False,
        },
    }
    decision = deterministic_decision(context)
    assert decision["action"] == "NONE"


def test_deterministic_decision_metadata_exam_create_triggers_exam_action() -> None:
    context = {
        "scan_data": {"current_hour": 10, "today_mode_sessions": []},
        "stress_indicators": {
            "has_exam_tomorrow": False,
            "has_revision_session_today": False,
            "has_morning_checkin_today": True,
            "heavy_course_load": False,
            "morning_courses_count": 0,
            "last_mood_yesterday": 4,
            "overdue_projects": 0,
            "consecutive_low_mood_days": 0,
            "pending_tasks_today": 0,
        },
        "event": {
            "type": "EXAM_METADATA_UPDATED",
            "payload": {"metadata_type": "EXAM", "operation": "CREATE"},
        },
    }
    decision = deterministic_decision(context)
    assert decision["action"] == "SEND_AND_CREATE"
    assert decision["notification_type"] == "metadata_exam_major"
    assert decision["notification_cooldown_hours"] == 0


def test_deterministic_decision_low_sleep_triggers_recovery_action() -> None:
    context = {
        "scan_data": {"current_hour": 9, "today_mode_sessions": []},
        "last_checkin": {"mood_score": 3, "sleep_hours": 4.5},
        "stress_indicators": {
            "has_exam_tomorrow": False,
            "has_revision_session_today": False,
            "has_morning_checkin_today": True,
            "heavy_course_load": False,
            "morning_courses_count": 1,
            "last_mood_yesterday": 3,
            "overdue_projects": 0,
            "consecutive_low_mood_days": 1,
            "pending_tasks_today": 2,
        },
    }
    decision = deterministic_decision(context)
    assert decision["action"] == "SEND_AND_CREATE"
    assert decision["suggested_mode"] == "REPOS"
