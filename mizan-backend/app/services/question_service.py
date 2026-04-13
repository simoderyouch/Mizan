import asyncio
import json
import re
from typing import Literal

from mistralai.client import Mistral

from app.core.config import get_settings

settings = get_settings()

CheckinPeriod = Literal["MORNING", "EVENING"]
CheckinMode = Literal["qcm", "voice"]
AnswerType = Literal["text", "number", "scale", "time_hours", "single_choice", "multi_choice", "boolean", "voice_text"]
TargetField = Literal["mood_score", "sleep_hours", "plan_completed", "notes", "context"]

ALLOWED_TYPES = {"text", "number", "scale", "time_hours", "single_choice", "multi_choice", "boolean", "voice_text"}
ALLOWED_TARGET_FIELDS = {"mood_score", "sleep_hours", "plan_completed", "notes", "context"}
QCM_SCALE_MIN = 1
QCM_SCALE_MAX = 10


def _extract_message_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                if item.strip():
                    parts.append(item.strip())
                continue
            if isinstance(item, dict):
                text = str(item.get("text", "")).strip()
            else:
                text = str(getattr(item, "text", "")).strip()
            if text:
                parts.append(text)
        return " ".join(parts).strip()
    return str(content or "").strip()


def _extract_chat_response_text(response) -> str:
    choices = getattr(response, "choices", None)
    if not choices:
        return ""
    message = getattr(choices[0], "message", None)
    if message is None:
        return ""
    return _extract_message_text(getattr(message, "content", ""))


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", (value or "").strip().lower())
    slug = re.sub(r"_+", "_", slug).strip("_")
    return slug or "question"


def _append_required_targets(period: CheckinPeriod, questions: list[dict], student_name: str) -> list[dict]:
    targets = {q.get("target_field") for q in questions}
    if period == "MORNING":
        if "mood_score" not in targets:
            questions.append(
                {
                    "id": "mood_score_check",
                    "text": f"{student_name}, how would you rate your mood this morning?",
                    "answer_type": "scale",
                    "required": True,
                    "min_value": QCM_SCALE_MIN,
                    "max_value": QCM_SCALE_MAX,
                    "step": 1,
                    "target_field": "mood_score",
                }
            )
        if "sleep_hours" not in targets:
            questions.append(
                {
                    "id": "sleep_hours_check",
                    "text": "How many hours did you sleep last night?",
                    "answer_type": "time_hours",
                    "required": True,
                    "min_value": 0,
                    "max_value": 16,
                    "step": 0.5,
                    "target_field": "sleep_hours",
                }
            )
    else:
        if "plan_completed" not in targets:
            questions.append(
                {
                    "id": "plan_completed_check",
                    "text": "Did you mostly complete your plan for today?",
                    "answer_type": "boolean",
                    "required": True,
                    "target_field": "plan_completed",
                }
            )
        if "mood_score" not in targets:
            questions.append(
                {
                    "id": "mood_score_check",
                    "text": "How is your mood this evening?",
                    "answer_type": "scale",
                    "required": True,
                    "min_value": QCM_SCALE_MIN,
                    "max_value": QCM_SCALE_MAX,
                    "step": 1,
                    "target_field": "mood_score",
                }
            )
        if "notes" not in targets:
            questions.append(
                {
                    "id": "day_notes",
                    "text": "Would you like to note an important point from your day?",
                    "answer_type": "text",
                    "required": False,
                    "target_field": "notes",
                }
            )
    return questions


def _fallback_questions(context: dict, period: CheckinPeriod, mode: CheckinMode) -> list[dict]:
    student_name = (context.get("student") or {}).get("name") or "Student"
    stress = context.get("stress_indicators", {})
    exams = context.get("upcoming_exams", [])
    projects = context.get("upcoming_projects", [])

    if mode == "voice":
        base = [
            {
                "id": "voice_state",
                "text": f"{student_name}, how are you feeling right now?",
                "answer_type": "voice_text",
                "required": True,
                "target_field": "mood_score",
            },
            {
                "id": "voice_context",
                "text": "What is affecting your studies the most right now?",
                "answer_type": "voice_text",
                "required": True,
                "target_field": "context",
            },
            {
                "id": "voice_notes",
                "text": "Is there anything important you want to share?",
                "answer_type": "voice_text",
                "required": False,
                "target_field": "notes",
            },
        ]
        if period == "MORNING":
            base.insert(
                1,
                {
                    "id": "voice_sleep",
                    "text": "How was your sleep in terms of quality and duration?",
                    "answer_type": "voice_text",
                    "required": True,
                    "target_field": "sleep_hours",
                },
            )
        else:
            base.insert(
                1,
                {
                    "id": "voice_plan",
                    "text": "Did you make progress on your plan today?",
                    "answer_type": "voice_text",
                    "required": True,
                    "target_field": "plan_completed",
                },
            )
        if stress.get("has_exam_tomorrow") or exams:
            base.append(
                {
                    "id": "voice_exam_pressure",
                    "text": "How do you feel about your upcoming exams?",
                    "answer_type": "voice_text",
                    "required": False,
                    "target_field": "context",
                }
            )
        if projects:
            base.append(
                {
                    "id": "voice_project_status",
                    "text": "Where do you currently stand on your priority projects?",
                    "answer_type": "voice_text",
                    "required": False,
                    "target_field": "context",
                }
            )
        return base[:8]

    questions = []
    if period == "MORNING":
        questions.extend(
            [
                {
                    "id": "mood_score",
                    "text": f"{student_name}, how do you feel this morning?",
                    "answer_type": "scale",
                    "required": True,
                    "min_value": QCM_SCALE_MIN,
                    "max_value": QCM_SCALE_MAX,
                    "step": 1,
                    "target_field": "mood_score",
                },
                {
                    "id": "sleep_hours",
                    "text": "How many hours did you sleep last night?",
                    "answer_type": "time_hours",
                    "required": True,
                    "min_value": 0,
                    "max_value": 16,
                    "step": 0.5,
                    "target_field": "sleep_hours",
                },
                {
                    "id": "energy_level",
                    "text": "What is your current energy level?",
                    "answer_type": "scale",
                    "required": False,
                    "min_value": QCM_SCALE_MIN,
                    "max_value": QCM_SCALE_MAX,
                    "step": 1,
                    "target_field": "context",
                },
            ]
        )
    else:
        questions.extend(
            [
                {
                    "id": "plan_completed",
                    "text": "Did you mostly complete your plan for today?",
                    "answer_type": "boolean",
                    "required": True,
                    "target_field": "plan_completed",
                },
                {
                    "id": "mood_score",
                    "text": "How do you feel this evening?",
                    "answer_type": "scale",
                    "required": True,
                    "min_value": QCM_SCALE_MIN,
                    "max_value": QCM_SCALE_MAX,
                    "step": 1,
                    "target_field": "mood_score",
                },
                {
                    "id": "notes",
                    "text": "Is there an important event worth noting?",
                    "answer_type": "text",
                    "required": False,
                    "target_field": "notes",
                },
            ]
        )

    if stress.get("has_exam_tomorrow"):
        questions.append(
            {
                "id": "exam_stress",
                "text": "What is your current exam-related stress level?",
                "answer_type": "scale",
                "required": False,
                "min_value": QCM_SCALE_MIN,
                "max_value": QCM_SCALE_MAX,
                "step": 1,
                "target_field": "context",
            }
        )
    if projects:
        questions.append(
            {
                "id": "project_priority",
                "text": "Which subject feels most important today?",
                "answer_type": "single_choice",
                "required": False,
                "options": [str(p.get("name", "Project")) for p in projects[:5]],
                "target_field": "context",
            }
        )

    return questions[:8]


def _normalize_question(raw: dict, idx: int, mode: CheckinMode) -> dict | None:
    if not isinstance(raw, dict):
        return None
    text = str(raw.get("text", "")).strip()
    if not text:
        return None

    answer_type = str(raw.get("answer_type", "voice_text" if mode == "voice" else "text")).strip()
    if answer_type not in ALLOWED_TYPES:
        answer_type = "voice_text" if mode == "voice" else "text"

    qid = _slugify(str(raw.get("id") or f"q_{idx+1}"))
    required = bool(raw.get("required", True))
    target_field = str(raw.get("target_field") or "").strip() or None
    if target_field and target_field not in ALLOWED_TARGET_FIELDS:
        target_field = None

    options = raw.get("options")
    if not isinstance(options, list):
        options = None
    else:
        options = [str(o).strip() for o in options if str(o).strip()]
        options = options or None

    def _to_float(name: str) -> float | None:
        value = raw.get(name)
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    question = {
        "id": qid,
        "text": text,
        "answer_type": answer_type,
        "required": required,
        "target_field": target_field,
    }
    min_value = _to_float("min_value")
    max_value = _to_float("max_value")
    step = _to_float("step")
    if min_value is not None:
        question["min_value"] = min_value
    if max_value is not None:
        question["max_value"] = max_value
    if step is not None:
        question["step"] = step
    if options:
        question["options"] = options
    if mode == "qcm" and question["answer_type"] == "scale":
        question["min_value"] = float(QCM_SCALE_MIN)
        question["max_value"] = float(QCM_SCALE_MAX)
        question["step"] = 1.0
    return question


def _validate_questions(period: CheckinPeriod, mode: CheckinMode, questions: list[dict], context: dict) -> list[dict]:
    validated = []
    for idx, item in enumerate(questions[:8]):
        normalized = _normalize_question(item, idx, mode)
        if normalized:
            validated.append(normalized)

    student_name = (context.get("student") or {}).get("name") or "Student"
    if mode == "qcm":
        validated = _append_required_targets(period, validated, student_name)
    return validated if validated else _fallback_questions(context, period, mode)


async def generate_personalized_questions(context: dict, period: CheckinPeriod, mode: CheckinMode) -> list[dict]:
    fallback = _fallback_questions(context, period, mode)
    student = context.get("student", {})
    schedule = context.get("today_schedule", [])
    exams = context.get("upcoming_exams", [])
    projects = context.get("upcoming_projects", [])
    stress = context.get("stress_indicators", {})

    schedule_text = "\n".join(
        [f"- {s['subject']} ({s['start_time']} - {s['end_time']})" for s in schedule]
    ) or "No classes today"
    exams_text = "\n".join(
        [f"- {e['subject']} in {e['days_until']} day(s)" for e in exams[:6]]
    ) or "No upcoming exams"
    projects_text = "\n".join(
        [f"- {p['name']} in {p['days_until']} day(s)" for p in projects[:6]]
    ) or "No upcoming projects"

    prompt = f"""You are Mizan, a student coach.
Create PERSONALIZED and DYNAMIC check-in questions (variable count) in English.

Context:
- Period: {period}
- Mode: {mode}
- Student: {student.get('name', 'Student')} | Program: {student.get('filiere', 'N/A')} | Class: {student.get('class', 'N/A')}
- Classes:
{schedule_text}
- Exams:
{exams_text}
- Projects:
{projects_text}
- Stress:
{stress}

Rules:
- Return strict JSON only: {{ "questions": [...] }}
- Between 3 and 8 questions.
- Question fields: id, text, answer_type, required, target_field, min_value, max_value, step, options.
- Allowed answer_type: text, number, scale, time_hours, single_choice, multi_choice, boolean, voice_text.
- Allowed target_field: mood_score, sleep_hours, plan_completed, notes, context.
- If mode=qcm, include essential targets:
  - MORNING: mood_score + sleep_hours
  - EVENING: mood_score + plan_completed (notes optional but recommended)
- For mode=qcm, every question with answer_type=scale must use min_value=1 and max_value=10.
- If mode=voice, answer_type must be voice_text for all questions.
- Questions must be natural, short, and directly usable in UI.
- All question texts and all option labels must be in English.
"""

    client = Mistral(api_key=settings.MISTRAL_API_KEY)
    response = await asyncio.to_thread(
        client.chat.complete,
        model=settings.MISTRAL_MODEL,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}],
    )
    raw_content = _extract_chat_response_text(response) or "{}"
    payload = json.loads(raw_content)
    questions = payload.get("questions", []) if isinstance(payload, dict) else []
    if not isinstance(questions, list):
        return fallback
    return _validate_questions(period, mode, questions, context)
