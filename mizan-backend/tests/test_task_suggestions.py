import asyncio

from app.services.task_service import (
    _has_explicit_task_request,
    _is_casual_message,
    suggest_tasks_from_chat,
)


def test_casual_greetings_are_detected() -> None:
    assert _is_casual_message("hey") is True
    assert _is_casual_message("Hey Mizan!") is True
    assert _is_casual_message("good morning") is True
    assert _is_casual_message("thanks") is True


def test_explicit_task_request_is_detected() -> None:
    assert _has_explicit_task_request("give me tasks for tonight") is True
    assert _has_explicit_task_request("help me plan my revision") is True
    assert _has_explicit_task_request("what should i do today") is True


def test_suggest_tasks_skips_casual_chat() -> None:
    assistant = (
        "Hi! Here is what you could do today:\n"
        "- Review chapter 3\n"
        "- Start the math assignment\n"
        "- Prepare for tomorrow's exam"
    )
    suggestions = asyncio.run(
        suggest_tasks_from_chat("Nizar", "hey", assistant)
    )
    assert suggestions == []


def test_suggest_tasks_skips_actionable_reply_without_user_request() -> None:
    assistant = (
        "Focus on these steps:\n"
        "1. Review your notes\n"
        "2. Complete problem set 4"
    )
    suggestions = asyncio.run(
        suggest_tasks_from_chat(
            "Nizar",
            "I'm feeling a bit overwhelmed about math",
            assistant,
        )
    )
    assert suggestions == []


def test_suggest_tasks_allows_explicit_request() -> None:
    assistant = (
        "Tonight:\n"
        "- Review chapter 3 for 25 minutes\n"
        "- Finish exercises 1-5"
    )
    suggestions = asyncio.run(
        suggest_tasks_from_chat(
            "Nizar",
            "give me tasks for tonight",
            assistant,
        )
    )
    assert len(suggestions) >= 1
