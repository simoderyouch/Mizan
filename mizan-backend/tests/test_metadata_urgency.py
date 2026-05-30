from datetime import date, timedelta

from app.services.metadata_urgency import (
    build_urgent_metadata_force_decision,
    is_urgent_metadata_update,
)


def test_urgent_exam_within_14_days() -> None:
    exam_date = (date.today() + timedelta(days=5)).isoformat()
    details = {"subject": "Algorithms", "exam_date": exam_date}
    assert is_urgent_metadata_update("EXAM", "CREATE", details)
    decision = build_urgent_metadata_force_decision("EXAM", "CREATE", details)
    assert decision is not None
    assert decision["action"] == "SEND_AND_CREATE"
    assert "Algorithms" in decision["task_title"]
    assert decision.get("allow_duplicate_tasks") is True


def test_urgent_project_within_21_days() -> None:
    due = (date.today() + timedelta(days=10)).isoformat()
    details = {"name": "Web App", "subject": "GL", "due_date": due, "members": ["Yassine"]}
    assert is_urgent_metadata_update("PROJECT", "CREATE", details)
    decision = build_urgent_metadata_force_decision("PROJECT", "CREATE", details)
    assert decision is not None
    assert "Web App" in decision["task_title"]
    assert "Yassine" in decision["notification_body"]


def test_non_urgent_exam_far_out() -> None:
    exam_date = (date.today() + timedelta(days=60)).isoformat()
    details = {"subject": "Math", "exam_date": exam_date}
    assert not is_urgent_metadata_update("EXAM", "CREATE", details)
    assert build_urgent_metadata_force_decision("EXAM", "CREATE", details) is None
