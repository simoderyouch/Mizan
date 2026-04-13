import json

ALLOWED_ACTIONS = {
    "NONE",
    "SEND_NOTIFICATION",
    "CREATE_TASK",
    "SEND_AND_CREATE",
    "PROPOSE_MODE_SWITCH",
    "SEND_RESOURCE_NUDGE",
    "ESCALATE_WELLBEING",
}

ALLOWED_MODES = {"REVISION", "EXAMEN", "PROJET", "REPOS", "SPORT", "COURS"}


def parse_decision(raw_text: str) -> dict:
    payload = json.loads(raw_text)
    action = str(payload.get("action", "NONE")).upper().strip()
    if action not in ALLOWED_ACTIONS:
        action = "NONE"

    suggested_mode = str(payload.get("suggested_mode", "")).upper().strip()
    if suggested_mode not in ALLOWED_MODES:
        suggested_mode = ""

    confidence = payload.get("confidence")
    try:
        confidence_value = float(confidence) if confidence is not None else None
    except (TypeError, ValueError):
        confidence_value = None

    resource_index_raw = payload.get("resource_index", 0)
    try:
        resource_index = int(resource_index_raw)
    except (TypeError, ValueError):
        resource_index = 0

    return {
        "action": action,
        "thought": str(payload.get("thought", "")).strip()[:1000],
        "notification_title": str(payload.get("notification_title", "")).strip()[:160],
        "notification_body": str(payload.get("notification_body", "")).strip()[:1500],
        "task_title": str(payload.get("task_title", "")).strip()[:180],
        "task_description": str(payload.get("task_description", "")).strip()[:1200],
        "suggested_mode": suggested_mode,
        "resource_index": resource_index,
        "confidence": confidence_value,
    }


def _to_int(value, default: int = 0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_float(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _extract_event_metadata(context: dict) -> tuple[str, str]:
    event = context.get("event") or {}
    event_type = str(event.get("type", "")).upper().strip()
    event_payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
    metadata_type = str(event_payload.get("metadata_type", "")).upper().strip()
    operation = str(event_payload.get("operation", "")).upper().strip()
    if (not metadata_type) and event_type.endswith("_METADATA_UPDATED"):
        metadata_type = event_type.replace("_METADATA_UPDATED", "")
    return metadata_type, operation


def deterministic_decision(context: dict) -> dict:
    stress = context.get("stress_indicators", {})
    scan_data = context.get("scan_data", {})
    last_checkin = context.get("last_checkin") or {}
    today_mode_sessions = scan_data.get("today_mode_sessions") or []
    has_exam_tomorrow = bool(stress.get("has_exam_tomorrow", False))
    has_revision_session_today = bool(stress.get("has_revision_session_today", False))
    has_morning_checkin_today = bool(stress.get("has_morning_checkin_today", False))
    heavy_course_load = bool(stress.get("heavy_course_load", False))
    last_mood_yesterday_raw = stress.get("last_mood_yesterday")
    current_mood_raw = stress.get("current_mood_score", last_checkin.get("mood_score"))
    current_hour = int(scan_data.get("current_hour", 0) or 0)
    morning_courses_count = int(stress.get("morning_courses_count", 0) or 0)
    consecutive_low_mood_days = int(stress.get("consecutive_low_mood_days", 0) or 0)
    pending_tasks_today = int(stress.get("pending_tasks_today", 0) or 0)
    overdue_projects = int(stress.get("overdue_projects", 0) or 0)
    sleep_hours = _to_float(last_checkin.get("sleep_hours"))
    had_sport_session_today = any(
        str(item.get("mode", "")).upper() == "SPORT"
        for item in today_mode_sessions
        if isinstance(item, dict)
    )
    metadata_type, metadata_operation = _extract_event_metadata(context)

    last_mood_yesterday = None
    if last_mood_yesterday_raw is not None:
        parsed_yesterday_mood = _to_int(last_mood_yesterday_raw, default=-1)
        last_mood_yesterday = parsed_yesterday_mood if parsed_yesterday_mood >= 0 else None

    current_mood = None
    if current_mood_raw is not None:
        parsed_current_mood = _to_int(current_mood_raw, default=-1)
        current_mood = parsed_current_mood if parsed_current_mood >= 0 else None

    # Rule 0: react to all metadata updates with explicit major/minor intervention
    if metadata_type == "EXAM":
        if metadata_operation in {"CREATE", "IMPORT", "DELETE"}:
            return {
                "action": "SEND_AND_CREATE",
                "thought": "Major exam metadata update detected. Triggering immediate exam adaptation action.",
                "confidence": 1.0,
                "suggested_mode": "EXAMEN",
                "notification_title": "Exams changed: adapt now",
                "notification_body": "Your exam data changed. Recheck priorities now and start one protected exam focus block.",
                "task_title": "Update exam plan (30 min)",
                "task_description": "Review upcoming exams, adjust today priorities, and complete one focused exam block.",
                "notification_type": "metadata_exam_major",
                "notification_cooldown_hours": 0,
            }
        return {
            "action": "SEND_NOTIFICATION",
            "thought": "Minor exam metadata update detected. Sending direct awareness nudge.",
            "confidence": 1.0,
            "notification_title": "Exam details updated",
            "notification_body": "An exam detail was updated. Verify room/time and adjust your next study block.",
            "notification_type": "metadata_exam_minor",
            "notification_cooldown_hours": 0,
        }

    if metadata_type == "PROJECT":
        if metadata_operation in {"CREATE", "IMPORT", "DELETE"}:
            return {
                "action": "SEND_AND_CREATE",
                "thought": "Major project metadata update detected. Triggering project execution action.",
                "confidence": 1.0,
                "suggested_mode": "PROJET",
                "notification_title": "Projects changed: execute next step",
                "notification_body": "Your project data changed. Clarify next milestone now and start one concrete project sprint.",
                "task_title": "Project milestone sprint (40 min)",
                "task_description": "Identify the most urgent project milestone and execute one focused 40-minute sprint.",
                "notification_type": "metadata_project_major",
                "notification_cooldown_hours": 0,
            }
        return {
            "action": "SEND_NOTIFICATION",
            "thought": "Minor project metadata update detected. Sending awareness nudge.",
            "confidence": 1.0,
            "notification_title": "Project details updated",
            "notification_body": "A project detail was updated. Recheck members, deadline, and next deliverable.",
            "notification_type": "metadata_project_minor",
            "notification_cooldown_hours": 0,
        }

    if metadata_type == "SCHEDULE":
        if metadata_operation in {"CREATE", "IMPORT", "DELETE"}:
            return {
                "action": "PROPOSE_MODE_SWITCH",
                "thought": "Major schedule metadata update detected. Triggering schedule alignment mode switch.",
                "confidence": 1.0,
                "suggested_mode": "COURS",
                "notification_title": "Schedule changed: realign your day",
                "notification_body": "Your schedule changed. Re-align your day plan now to avoid stress later.",
                "notification_type": "metadata_schedule_major",
                "notification_cooldown_hours": 0,
            }
        return {
            "action": "SEND_NOTIFICATION",
            "thought": "Minor schedule metadata update detected. Sending awareness nudge.",
            "confidence": 1.0,
            "notification_title": "Schedule updated",
            "notification_body": "A schedule detail was updated. Double-check your next class timing.",
            "notification_type": "metadata_schedule_minor",
            "notification_cooldown_hours": 0,
        }

    # Rule 1: critical stress (low mood streak + exam pressure) => immediate escalation
    if (
        current_mood is not None
        and current_mood <= 2
        and has_exam_tomorrow
        and consecutive_low_mood_days >= 3
    ):
        return {
            "action": "ESCALATE_WELLBEING",
            "thought": "Critical state detected: exam tomorrow with sustained low mood. Triggering urgent support and reduced-load plan.",
            "confidence": 1.0,
            "notification_title": "Urgent support before tomorrow's exams",
            "notification_body": "You are under high pressure with low mood. Pause now for a short reset, then do one protected exam sprint only.",
            "task_title": "Urgent exam triage + recovery (30 min)",
            "task_description": "Do 10 minutes of calming reset, then one 20-minute focused block on the nearest exam topic.",
            "notification_type": "critical_wellbeing",
            "notification_cooldown_hours": 2,
            "followup_notification_type": "critical_wellbeing_followup",
            "followup_cooldown_hours": 4,
        }

    # Rule 1b: no sleep + sustained distress => immediate escalation
    if (
        current_mood is not None
        and current_mood <= 2
        and consecutive_low_mood_days >= 4
        and sleep_hours is not None
        and sleep_hours <= 5.0
    ):
        return {
            "action": "ESCALATE_WELLBEING",
            "thought": "Severe fatigue + prolonged low mood detected. Triggering urgent stabilization support.",
            "confidence": 1.0,
            "notification_title": "Urgent recovery required",
            "notification_body": "You are low on sleep and under sustained stress. Start with recovery now before continuing work.",
            "task_title": "Recovery-first protocol (30 min)",
            "task_description": "Take 20 minutes to recover (hydration + breathing + no screen), then do one short 10-minute restart task.",
            "notification_type": "critical_fatigue",
            "notification_cooldown_hours": 2,
            "followup_notification_type": "critical_fatigue_followup",
            "followup_cooldown_hours": 4,
        }

    # Rule 1c: no sleep warning => actionable rest + protected focus
    if sleep_hours is not None and sleep_hours <= 5.5:
        return {
            "action": "SEND_AND_CREATE",
            "thought": "Low sleep detected. Triggering fatigue-aware action block.",
            "confidence": 1.0,
            "suggested_mode": "REPOS",
            "notification_title": "Low sleep detected: protect your energy",
            "notification_body": "Your sleep was low. Take a short recovery block first, then do one short priority sprint.",
            "task_title": "Recovery + short focus block",
            "task_description": "Take 15 minutes to recover, then complete one 20-minute high-priority task.",
            "notification_type": "sleep_low",
            "notification_cooldown_hours": 3,
        }

    # Rule 2: exam tomorrow + no revision today + late day => suggest revision + focus task
    if has_exam_tomorrow and (not has_revision_session_today) and current_hour > 18:
        return {
            "action": "SEND_AND_CREATE",
            "thought": "Exam tomorrow detected after 18:00 with no revision session today. Triggering revision-focus intervention.",
            "confidence": 1.0,
            "suggested_mode": "REVISION",
            "notification_title": "Switch to REVISION now",
            "notification_body": "You have an exam tomorrow and no revision session logged today. Start a short REVISION focus block now.",
            "task_title": "45-min exam focus sprint",
            "task_description": "Switch to REVISION mode and complete one 45-minute focused review block on tomorrow's exam topics.",
        }

    # Rule 3: workload pressure + exam week => immediate stabilization
    if has_exam_tomorrow and pending_tasks_today >= 8:
        return {
            "action": "SEND_AND_CREATE",
            "thought": "Exam pressure with high pending load detected. Triggering short stabilization sprint.",
            "confidence": 1.0,
            "suggested_mode": "EXAMEN",
            "notification_title": "Too much load before exams: stabilize now",
            "notification_body": "Focus on one exam-critical block now; postpone non-essential tasks for later.",
            "task_title": "Exam triage sprint (30 min)",
            "task_description": "Pick one exam-critical topic and complete a single 30-minute sprint.",
            "notification_type": "exam_load_stabilization",
            "notification_cooldown_hours": 2,
        }

    # Rule 4: overdue projects pressure => direct project intervention
    if overdue_projects >= 1:
        return {
            "action": "SEND_AND_CREATE",
            "thought": "Overdue project pressure detected. Triggering immediate project stabilization action.",
            "confidence": 1.0,
            "suggested_mode": "PROJET",
            "notification_title": "Overdue project detected: act now",
            "notification_body": "Start one short project recovery sprint now to reduce deadline pressure.",
            "task_title": "Overdue recovery sprint (35 min)",
            "task_description": "Work 35 minutes on the most overdue project item and submit one tangible progress update.",
            "notification_type": "project_overdue",
            "notification_cooldown_hours": 3,
        }

    # Rule 5: immediate low mood today => send targeted support now
    if current_mood is not None and current_mood <= 2:
        return {
            "action": "SEND_RESOURCE_NUDGE",
            "thought": "Current morning mood is low (<=2). Sending immediate wellbeing support with an actionable micro-step.",
            "confidence": 1.0,
            "notification_title": "Support is available right now",
            "notification_body": "Your mood is low this morning. Here is a targeted resource and one micro-exercise to reduce pressure.",
            "resource_index": 0,
            "notification_type": "low_mood_resource",
            "notification_cooldown_hours": 3,
        }

    # Rule 6: high course load + low mood yesterday => pause nudge
    if heavy_course_load and last_mood_yesterday is not None and last_mood_yesterday <= 2:
        return {
            "action": "SEND_NOTIFICATION",
            "thought": "Heavy class load with low mood yesterday detected. Sending preventive wellbeing nudge.",
            "confidence": 1.0,
            "notification_title": "Recommended pause break",
            "notification_body": "You have a heavy day and your mood was low yesterday. Take a 10-minute breathing or walking break before resuming.",
        }

    # Rule 7: high pending workload + low mood streak => urgent stabilization nudge
    if current_mood is not None and current_mood <= 2 and consecutive_low_mood_days >= 3 and pending_tasks_today >= 8:
        return {
            "action": "SEND_AND_CREATE",
            "thought": "Low mood streak with high pending workload detected. Triggering immediate stabilization block.",
            "confidence": 1.0,
            "suggested_mode": "REVISION",
            "notification_title": "Stabilize now: one short block only",
            "notification_body": "Your workload is heavy and stress is high. Start one short priority block now, then recover for 10 minutes.",
            "task_title": "Stabilization sprint (25 min)",
            "task_description": "Pick one high-impact pending item and work on it for 25 minutes, then take a 10-minute recovery break.",
            "notification_type": "critical_stabilization",
            "notification_cooldown_hours": 2,
        }

    # Rule 8: suggest sport reset when stress is rising and no sport session happened today
    if (
        (current_mood is not None and current_mood <= 3)
        and (pending_tasks_today >= 6 or has_exam_tomorrow)
        and current_hour >= 16
        and not had_sport_session_today
    ):
        return {
            "action": "PROPOSE_MODE_SWITCH",
            "thought": "Rising stress without sport/reset session detected. Suggesting SPORT mode for short regulation.",
            "confidence": 1.0,
            "suggested_mode": "SPORT",
            "notification_title": "Quick SPORT reset recommended",
            "notification_body": "Do a short movement reset now (10-20 min), then return to one focused block.",
            "notification_type": "sport_reset",
            "notification_cooldown_hours": 4,
        }

    # Rule 9: silence risk => missing morning check-in on a busy day
    if (not has_morning_checkin_today) and (heavy_course_load or morning_courses_count >= 2):
        return {
            "action": "SEND_NOTIFICATION",
            "thought": "Morning check-in missing on a high-load day. Sending check-in reminder nudge.",
            "confidence": 1.0,
            "notification_title": "Morning check-in missing",
            "notification_body": "You have a busy day. Complete your morning check-in to adjust your plan and prevent stress later.",
        }

    return {
        "action": "NONE",
        "thought": "No intervention needed; student context looks stable.",
        "confidence": 1.0,
    }
