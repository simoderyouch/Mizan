import json
import re
from loguru import logger

from mistralai.client import Mistral

from app.core.config import get_settings
from app.services.safety_service import (
    SAFE_SUPPORT_RESPONSE,
    SAFETY_LEVEL_HIGH,
    assess_text_safety,
)

settings = get_settings()


def _mistral_configured() -> bool:
    return bool((settings.MISTRAL_API_KEY or "").strip())


def normalize_daily_plan_text(raw: str, max_lines: int = 3, max_words: int = 5) -> str:
    """Dashboard focus card: at most three short bullets (~5 words each)."""
    lines: list[str] = []
    for chunk in raw.replace("\r", "").split("\n"):
        line = re.sub(r"^[\d\-*•.)]+\s*", "", chunk.strip())
        if not line:
            continue
        words = line.split()
        if len(words) > max_words:
            line = " ".join(words[:max_words])
        lines.append(line)
        if len(lines) >= max_lines:
            break
    return "\n".join(lines)


def _compute_stress_level(stress: dict) -> str:
    score = 0
    if stress.get("has_exam_tomorrow"):
        score += 2
    if stress.get("has_exam_this_week"):
        score += 1
    score += min(int(stress.get("overdue_projects", 0)), 3)
    score += min(int(stress.get("consecutive_low_mood_days", 0)), 3)
    if score >= 5:
        return "HIGH"
    if score >= 3:
        return "MEDIUM"
    return "LOW"


def _build_goal_overview(goals: list[dict]) -> str:
    if not goals:
        return "No active goals."
    lines = []
    for goal in goals:
        target = goal.get("target_value", 0)
        progress = goal.get("today_progress", 0)
        remaining = max(0.0, target - progress)
        unit = goal.get("unit", "")
        lines.append(
            f"- {goal.get('title', 'Goal')}: {progress}/{target} {unit} today (remaining {remaining} {unit})"
        )
    return "\n".join(lines)


import json


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

async def generate_advanced_ritual_report(context: dict, ritual_type: str, data: dict, mode: str) -> dict:
    safety_assessment = assess_text_safety(data.get("input_text", ""))
    if safety_assessment.is_high_risk:
        return {
            "executive_summary": SAFE_SUPPORT_RESPONSE,
            "detailed_action_plan": [
                "Contact a trusted person, school counselor, teacher, family member, or close friend now.",
                "If you may hurt yourself or you are in immediate danger, contact local emergency services immediately.",
                "Pause academic tasks until you are with someone who can support you safely.",
            ],
            "detected_risks": ["serious_distress_signal"],
            "safety_level": SAFETY_LEVEL_HIGH,
            "safety_action": safety_assessment.action,
        }

    if not _mistral_configured():
        mood = data.get("mood_score", "Unknown")
        sleep = data.get("sleep_hours")
        sleep_text = f" and {sleep}h sleep" if sleep not in (None, "", "Unknown") else ""
        return {
            "executive_summary": f"{ritual_type.title()} check-in saved locally with mood {mood}{sleep_text}.",
            "detailed_action_plan": [
                "Choose one realistic priority for the next study block.",
                "Schedule one short recovery pause before the day gets crowded.",
                "Review the plan at the next check-in and adjust the load.",
            ],
            "detected_risks": [],
        }

    client = Mistral(api_key=settings.MISTRAL_API_KEY)
    
    schedule = context.get("today_schedule", [])
    schedule_text = "\n".join([f"- {s['subject']} ({s['start_time']} - {s['end_time']}) in {s['room']} with {s['professor']}" for s in schedule])
    exams = context.get("upcoming_exams", [])
    exams_text = "\n".join([f"- {e['subject']} on {e['exam_date']} (in {e['days_until']} days)" for e in exams])
    projects = context.get("upcoming_projects", [])
    projects_text = "\n".join([f"- {p['name']} ({p['subject']}) due on {p['due_date']} (in {p['days_until']} days)" for p in projects])
    goals = context.get("active_goals", [])
    goals_text = _build_goal_overview(goals)
    stress = context.get("stress_indicators", {})
    stress_level = _compute_stress_level(stress)

    user_input = data.get("input_text", "")
    sleep = data.get("sleep_hours", "Unknown")
    mood = data.get("mood_score", "Unknown")

    prompt = f"""You are Mizan, an empathetic AI student wellbeing assistant.
You are performing a {ritual_type} check-in report. The student interacted via {mode}.

Context:
- Schedule: {schedule_text if schedule_text else "None"}
- Exams: {exams_text if exams_text else "None"}
- Projects: {projects_text if projects_text else "None"}
- Stress Level: {stress_level}

Check-in Data:
- Mood: {mood}/5
- Sleep: {sleep} hours (if morning)
- Conversation snippet: {user_input if user_input else "No voice transcription available."}

Generate a deeply structured wellbeing report in JSON format.
You must output ONLY valid JSON using the following schema exactly:
{{
  "executive_summary": "A 1-paragraph highly personalized message addressing the student's mood, stress, and schedule. Must be in English.",
  "detailed_action_plan": [
    "string: Actionable step 1",
    "string: Actionable step 2",
    "string: Actionable step 3"
  ],
  "detected_risks": [
    "string: Risk 1 (e.g., Burnout risk due to low sleep)",
    "string: Risk 2"
  ]
}}
"""

    try:
        response = await client.chat.complete_async(
            model=settings.MISTRAL_MODEL,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}],
        )
        raw_json = _extract_chat_response_text(response) or "{}"
        return json.loads(raw_json)
    except Exception as e:
        logger.error(f"Mistral API failed during ritual report: {e}")
        return {
            "executive_summary": f"Your check-in is saved, but AI analysis is temporarily unavailable. Take care of yourself.",
            "detailed_action_plan": ["Take a short recovery break.", "Try your check-in again later if needed."],
            "detected_risks": []
        }


def _format_chat_transcript(conversation_history: list[dict] | None, student_message: str) -> str:
    lines: list[str] = []
    for turn in conversation_history or []:
        role = str(turn.get("role", "user")).strip().lower()
        content = str(turn.get("content", "")).strip()
        if not content:
            continue
        speaker = "Student" if role == "user" else "Mizan"
        lines.append(f"{speaker}: {content}")
    if student_message.strip():
        lines.append(f"Student (latest): {student_message.strip()}")
    return "\n".join(lines) if lines else f"Student (latest): {student_message.strip()}"


async def chat_with_agent(
    context: dict,
    student_message: str,
    *,
    conversation_history: list[dict] | None = None,
) -> dict:
    safety_assessment = assess_text_safety(student_message)
    if safety_assessment.is_high_risk:
        return {
            "response": SAFE_SUPPORT_RESPONSE,
            "safety_level": SAFETY_LEVEL_HIGH,
            "safety_action": safety_assessment.action,
        }

    if not _mistral_configured():
        student = context.get("student", {})
        name = student.get("name", "there")
        tasks = context.get("today_tasks", [])
        task_hint = ""
        if tasks:
            first_task = tasks[0].get("title", "your first task")
            task_hint = f" A good next step is to protect 25 minutes for: {first_task}."
        return {
            "response": (
                f"Hi {name}. I can still help with a local response while the AI provider is not configured."
                " Keep the next step small: pick one priority, time-box it, then take a short pause."
                f"{task_hint}"
            ),
            "safety_level": "none",
        }

    client = Mistral(api_key=settings.MISTRAL_API_KEY)

    import json

    student = context.get("student", {})
    student_name = student.get("name", "a student")
    context_bundle = {
        "student": student,
        "today_schedule": context.get("today_schedule", []),
        "upcoming_exams": context.get("upcoming_exams", []),
        "upcoming_projects": context.get("upcoming_projects", []),
        "active_goals": context.get("active_goals", []),
        "today_tasks": context.get("today_tasks", []),
        "recommended_resources": context.get("recommended_resources", []),
        "stress_indicators": context.get("stress_indicators", {}),
        "current_mode": context.get("current_mode"),
        "last_checkin": context.get("last_checkin"),
        "scan_data": context.get("scan_data"),
    }
    context_json = json.dumps(context_bundle, ensure_ascii=False, default=str, indent=2)
    messages: list[dict[str, str]] = [
        {
            "role": "user",
            "content": (
                f"You are Mizan, an empathetic student wellbeing coach for {student_name}.\n\n"
                f"Full student context (JSON — use exact data, never invent subjects):\n{context_json}\n\n"
                "Instructions: read the conversation thread; stay on the topic they care about "
                "(project vs exam vs wellbeing). Be concise (under 200 words). No emojis. "
                "Do not list tasks, to-dos, or a study plan unless the student explicitly asks for one."
            ),
        }
    ]
    for turn in (conversation_history or [])[-20:]:
        role = str(turn.get("role", "")).strip().lower()
        content = str(turn.get("content", "")).strip()
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})
    if not messages or messages[-1].get("content") != student_message.strip():
        messages.append({"role": "user", "content": student_message.strip()})

    try:
        response = await client.chat.complete_async(
            model=settings.MISTRAL_MODEL,
            messages=messages,
        )
        return {
            "response": _extract_chat_response_text(response),
            "safety_level": "none",
        }
    except Exception as e:
        logger.error(f"Mistral API failed during chat: {e}")
        return {
            "response": "I'm currently experiencing high traffic and couldn't process your message. Please try again in a moment.",
            "safety_level": "none",
        }


async def generate_daily_plan(context: dict, sleep_hours: float, mood_score: int) -> str:
    if not _mistral_configured():
        recovery = "Add a 20-minute recovery break before heavy work." if sleep_hours < 6 or mood_score <= 2 else "Keep one intentional break between focus blocks."
        return "\n".join(
            [
                "Start with one 30-minute priority focus block.",
                recovery,
                "End the day by checking what should move to tomorrow.",
            ]
        )

    client = Mistral(api_key=settings.MISTRAL_API_KEY)
    
    stress_level = _compute_stress_level(context.get("stress_indicators", {}))
    student = context.get("student", {})
    name = student.get("name", "Student")
    
    prompt = f"""You are Mizan, an empathetic wellbeing coach. 
Context for {name}:
- Sleep: {sleep_hours}h
- Mood: {mood_score}/5
- Stress Level: {stress_level}

Create a daily plan with EXACTLY three bullet points.
CRITICAL RULE: Each point MUST be at most 5 words. No subtitles, no explanations, no long sentences.
You MUST respond with ONLY a valid JSON object in this format:
{{"plan": ["point 1", "point 2", "point 3"]}}"""

    try:
        response = await client.chat.complete_async(
            model=settings.MISTRAL_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        raw_text = _extract_chat_response_text(response)
        try:
            data = json.loads(raw_text)
            plan_list = data.get("plan", [])
            if isinstance(plan_list, list) and plan_list:
                return normalize_daily_plan_text("\n".join(str(p) for p in plan_list))
        except Exception:
            pass
        return normalize_daily_plan_text(raw_text.strip())
    except Exception as e:
        logger.error(f"Mistral API failed during daily plan: {e}")
        return normalize_daily_plan_text(
            "Start with a priority task.\nTake regular breaks.\nReview tomorrow before ending day."
        )
