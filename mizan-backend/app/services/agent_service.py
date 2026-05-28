import json
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


async def chat_with_agent(context: dict, student_message: str) -> dict:
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

    student = context.get("student", {})
    student_name = student.get("name", "a student")
    schedule = context.get("today_schedule", [])
    exams = context.get("upcoming_exams", [])
    projects = context.get("upcoming_projects", [])
    goals = context.get("active_goals", [])
    tasks = context.get("today_tasks", [])
    resources = context.get("recommended_resources", [])
    stress = context.get("stress_indicators", {})
    current_mode = context.get("current_mode")
    stress_level = _compute_stress_level(stress)

    schedule_text = "\n".join(
        [f"- {s['subject']} ({s['start_time']} - {s['end_time']})" for s in schedule]
    ) or "No classes today."
    exam_count = len(exams)
    exam_text = "\n".join(
        [f"- {e['subject']} in {e['days_until']} day(s)" for e in exams[:12]]
    ) or "No upcoming exams."
    project_count = len(projects)
    project_text = "\n".join(
        [f"- {p['name']} due in {p['days_until']} day(s)" for p in projects[:12]]
    ) or "No upcoming projects."
    goal_text = _build_goal_overview(goals[:5])
    task_text = "\n".join(
        [f"- [{t.get('status', 'pending')}] {t.get('title', 'Task')}" for t in tasks[:8]]
    ) or "No tasks for today yet."
    resource_text = "\n".join(
        [
            f"- {r.get('title', 'Resource')} ({r.get('type', 'RESOURCE')}, trigger={r.get('mood_trigger', 'general')}): {r.get('url', '')} | guidance: {r.get('ai_instruction', '')}"
            for r in resources[:5]
        ]
    ) or "No specific resources available."
    mode_text = (
        f"{current_mode['mode']} started at {current_mode['started_at']} ({current_mode['duration_so_far_minutes']} min)"
        if current_mode
        else "No active mode"
    )

    prompt = f"""You are Mizan, an empathetic student wellbeing coach.
You are chatting with {student_name}.

Context:
Today schedule:
{schedule_text}

Upcoming exams:
{exam_text}

Upcoming projects:
{project_text}

Active goals:
{goal_text}

Today's tasks:
{task_text}

Recommended resources:
{resource_text}

Stress indicators:
- exam tomorrow: {stress.get('has_exam_tomorrow', False)}
- exam this week: {stress.get('has_exam_this_week', False)}
- overdue projects: {stress.get('overdue_projects', 0)}
- consecutive low mood days: {stress.get('consecutive_low_mood_days', 0)}
- stress level: {stress_level}
- current mode: {mode_text}
- upcoming exams count: {exam_count}
- upcoming projects count: {project_count}

Student message:
{student_message}

Instructions:
- Primary role: mental wellbeing support for a student, not a task generator.
- Be concise, supportive, and actionable.
- First answer the user's direct question naturally.
- Give concrete next steps with time-boxing when relevant.
- If stress signals are medium/high, include one recovery step and one academic step.
- When useful, suggest switching work mode (REVISION / EXAMEN / PROJET / REPOS / SPORT / COURS).
- Keep response under 200 words.
- Do not create a plan or task list unless the user explicitly asks for planning, tasks, next steps, or organization.
- For general chat, emotional support, motivation, or conceptual questions, do not output a task list.
- Do not use emojis.
- Prefer one strong recommendation over many shallow suggestions.
- Do not restate the full "Today's tasks" list unless the user explicitly asks for the list.
- If task context is needed, mention at most one priority task in one short sentence.
- Use current mode context and propose a mode switch only when it clearly helps.
- When useful, suggest one relevant recommended resource with a short reason (do not dump multiple links).
- Respond in English only.
- If the user asks for counts (e.g., how many exams), use exact numbers from context and never guess.
"""

    try:
        response = await client.chat.complete_async(
            model=settings.MISTRAL_MODEL,
            messages=[{"role": "user", "content": prompt}],
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

Create a well-structured, motivational daily plan for the student. Provide exactly three concise bullet points in English."""

    try:
        response = await client.chat.complete_async(
            model=settings.MISTRAL_MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        return _extract_chat_response_text(response)
    except Exception as e:
        logger.error(f"Mistral API failed during daily plan: {e}")
        return "1. Start with a priority task.\n2. Take regular breaks.\n3. End the day by checking what should move to tomorrow."
