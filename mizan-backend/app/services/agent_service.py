# app/services/agent_service.py
import asyncio

from mistralai.client import Mistral

from app.core.config import get_settings

settings = get_settings()


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

    response = await asyncio.to_thread(
        client.chat.complete,
        model=settings.MISTRAL_MODEL,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}],
    )
    
    try:
        raw_json = _extract_chat_response_text(response) or "{}"
        return json.loads(raw_json)
    except Exception as e:
        # Fallback empty json if parsing fails
        return {
            "executive_summary": "Oops, an error occurred while generating your report. Take care of yourself.",
            "detailed_action_plan": ["Take a short break and try again later."],
            "detected_risks": []
        }


async def chat_with_agent(context: dict, student_message: str) -> str:
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

    response = await asyncio.to_thread(
        client.chat.complete,
        model=settings.MISTRAL_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    return _extract_chat_response_text(response)


async def generate_daily_plan(context: dict, sleep_hours: float, mood_score: int) -> str:
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

    response = await asyncio.to_thread(
        client.chat.complete,
        model=settings.MISTRAL_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    return _extract_chat_response_text(response)
