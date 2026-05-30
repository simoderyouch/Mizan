from app.services.agent_policy import deterministic_decision, parse_decision
from app.services.agent_orchestrator_service import (
    _build_priority_focus_from_context,
    _chat_help_intent_decision,
    _conversation_from_payload,
    _format_conversation_transcript,
    _sanitize_chat_llm_decision,
)


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


def test_chat_help_intent_triggers_send_and_create() -> None:
    context = {
        "upcoming_exams": [
            {"subject": "Python", "exam_date": "2026-06-03", "days_until": 4, "room": "A1"}
        ],
        "stress_indicators": {
            "has_exam_tomorrow": False,
            "consecutive_low_mood_days": 0,
            "current_mood_score": 4,
        },
    }
    signals = {"requested_help_or_distress": True, "severe_distress": False}
    decision = _chat_help_intent_decision(context, signals)
    assert decision is not None
    assert decision["action"] == "SEND_AND_CREATE"
    assert decision.get("cooldown_bypass") is True
    assert "Python" in decision["task_title"]
    assert decision.get("task_dedup_hours") == 8


def test_build_priority_focus_uses_nearest_exam() -> None:
    focus = _build_priority_focus_from_context(
        {
            "upcoming_exams": [
                {"subject": "Algorithms", "exam_date": "2026-06-20", "days_until": 21, "room": "B"},
                {"subject": "Python", "exam_date": "2026-06-03", "days_until": 4, "room": "A1"},
            ],
            "stress_indicators": {},
        }
    )
    assert "Python" in focus["task_title"]
    assert focus["suggested_mode"] in {"EXAMEN", "REVISION"}


def test_build_priority_focus_prefers_project_when_message_says_project() -> None:
    focus = _build_priority_focus_from_context(
        {
            "upcoming_exams": [
                {"subject": "Python", "exam_date": "2026-06-03", "days_until": 4, "room": "A1"},
            ],
            "upcoming_projects": [
                {
                    "name": "Web App",
                    "subject": "GL",
                    "due_date": "2026-06-15",
                    "days_until": 16,
                },
            ],
            "stress_indicators": {},
        },
        message="I need help with my project deadline this week",
    )
    assert "Web App" in focus["task_title"]
    assert "Python" not in focus["task_title"]
    assert focus["focus_kind"] == "project"


def test_build_priority_focus_respects_message_subject_over_nearest_exam() -> None:
    focus = _build_priority_focus_from_context(
        {
            "upcoming_exams": [
                {"subject": "Algorithms", "exam_date": "2026-06-20", "days_until": 21, "room": "B"},
                {"subject": "Python", "exam_date": "2026-06-03", "days_until": 4, "room": "A1"},
            ],
            "stress_indicators": {},
        },
        message="I'm stressed about the Algorithms exam next week",
    )
    assert "Algorithms" in focus["task_title"]
    assert "Python" not in focus["task_title"]


def test_sanitize_chat_llm_preserves_planner_task_title() -> None:
    decision = _sanitize_chat_llm_decision(
        {
            "action": "SEND_AND_CREATE",
            "task_title": "Web App · project sprint (40 min)",
            "thought": "Student asked about project.",
        }
    )
    assert decision["task_title"] == "Web App · project sprint (40 min)"
    assert decision.get("allow_duplicate_tasks") is True


def test_sanitize_chat_llm_keeps_none_without_forcing_task() -> None:
    decision = _sanitize_chat_llm_decision({"action": "NONE", "thought": "Small talk."})
    assert decision["action"] == "NONE"


def test_conversation_from_payload_and_transcript() -> None:
    payload = {
        "message": "Help with my project",
        "conversation_history": [
            {"role": "user", "content": "I have a project due"},
            {"role": "assistant", "content": "Let's focus on one milestone."},
        ],
    }
    history = _conversation_from_payload(payload)
    assert len(history) == 2
    transcript = _format_conversation_transcript(history, payload["message"])
    assert "project" in transcript.lower()


def test_chat_help_intent_severe_triggers_escalation() -> None:
    context = {
        "stress_indicators": {
            "current_mood_score": 2,
            "consecutive_low_mood_days": 4,
        }
    }
    signals = {"requested_help_or_distress": True, "severe_distress": True}
    decision = _chat_help_intent_decision(context, signals)
    assert decision is not None
    assert decision["action"] == "ESCALATE_WELLBEING"


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
