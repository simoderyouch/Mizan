import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.agent_run import AgentDecision, AgentRun
from app.models.student import Student
from app.services.autonomous_events import build_periodic_scan_event, publish_autonomous_event

logger = logging.getLogger(__name__)


MINUTES_AFTER_VISIBLE_ACTION = 5
MINUTES_AFTER_ESCALATION = 8
MINUTES_AFTER_NO_VISIBLE_ACTION = 5
MINUTES_AFTER_SKIPPED_RUN = 8


class AutonomousScheduler:
    def __init__(self, interval_minutes: int = 5):
        self.interval_seconds = interval_minutes * 60
        self.is_running = False
        self._task = None

    async def start(self):
        if self.is_running:
            return
        self.is_running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("Autonomous Scheduler started with %d minutes interval", self.interval_seconds // 60)

    async def stop(self):
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Autonomous Scheduler stopped")

    async def _loop(self):
        # Initial wait to let the system stabilize
        await asyncio.sleep(20)

        while self.is_running:
            try:
                logger.info("Starting autonomous periodic scan cycle...")
                await self._run_scan_cycle()
                logger.info("Periodic scan cycle completed. Sleeping for %d seconds", self.interval_seconds)
            except Exception as e:
                logger.exception("Error during autonomous scan cycle: %s", e)

            await asyncio.sleep(self.interval_seconds)

    async def _run_scan_cycle(self):
        async with AsyncSessionLocal() as db:
            # Fetch all student IDs
            result = await db.execute(select(Student.id))
            student_ids = result.scalars().all()

            latest_run_by_student, latest_decision_by_run = await self._load_latest_periodic_scan_state(db)
            now = datetime.now(timezone.utc)
            due_student_ids = []
            deferred_count = 0

            for student_id in student_ids:
                last_run = latest_run_by_student.get(student_id)
                last_decision = latest_decision_by_run.get(last_run.id) if last_run else None
                if self._is_student_due_for_scan(last_run, last_decision, now):
                    due_student_ids.append(student_id)
                else:
                    deferred_count += 1

            logger.info(
                "Found %d students for periodic scan (%d due, %d deferred)",
                len(student_ids),
                len(due_student_ids),
                deferred_count,
            )

            for student_id in due_student_ids:
                try:
                    event = build_periodic_scan_event(student_id)
                    await publish_autonomous_event(db, event)
                    # Small delay between students to avoid LLM rate limits or CPU spikes
                    await asyncio.sleep(1)
                except Exception as e:
                    logger.error("Failed periodic scan for student %s: %s", student_id, e)

    async def _load_latest_periodic_scan_state(
        self, db
    ) -> tuple[dict, dict]:
        latest_runs_result = await db.execute(
            select(AgentRun)
            .where(AgentRun.trigger_type == "PERIODIC_SCAN")
            .distinct(AgentRun.student_id)
            .order_by(AgentRun.student_id, AgentRun.created_at.desc())
        )
        latest_runs = list(latest_runs_result.scalars().all())
        latest_run_by_student = {row.student_id: row for row in latest_runs}

        run_ids = [row.id for row in latest_runs]
        latest_decision_by_run: dict = {}
        if run_ids:
            latest_decisions_result = await db.execute(
                select(AgentDecision)
                .where(AgentDecision.run_id.in_(run_ids))
                .distinct(AgentDecision.run_id)
                .order_by(AgentDecision.run_id, AgentDecision.created_at.desc())
            )
            latest_decisions = list(latest_decisions_result.scalars().all())
            latest_decision_by_run = {row.run_id: row for row in latest_decisions}
        return latest_run_by_student, latest_decision_by_run

    def _has_visible_artifact(self, decision: AgentDecision | None) -> bool:
        if decision is None or not isinstance(decision.result, dict):
            return False
        result = decision.result
        visible_keys = (
            "notification_id",
            "task_id",
            "contract_id",
            "mode_notification_id",
            "mode_task_id",
            "mode_contract_id",
            "followup_notification_id",
            "metadata_review_notification_id",
            "periodic_review_notification_id",
        )
        return any(bool(result.get(key)) for key in visible_keys)

    def _minutes_until_next_scan(self, run: AgentRun | None, decision: AgentDecision | None) -> int:
        if run is None:
            return 0
        if run.status == "skipped":
            return MINUTES_AFTER_SKIPPED_RUN
        if self._has_visible_artifact(decision):
            if decision and str(decision.action).upper() == "ESCALATE_WELLBEING":
                return MINUTES_AFTER_ESCALATION
            return MINUTES_AFTER_VISIBLE_ACTION
        return MINUTES_AFTER_NO_VISIBLE_ACTION

    def _is_student_due_for_scan(
        self, run: AgentRun | None, decision: AgentDecision | None, now: datetime
    ) -> bool:
        minutes = self._minutes_until_next_scan(run, decision)
        if minutes <= 0 or run is None:
            return True
        elapsed = (now - run.created_at).total_seconds() / 60
        return elapsed >= minutes

# Global instance (every 5 minutes)
scheduler = AutonomousScheduler(interval_minutes=5)
