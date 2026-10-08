import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from backend.config import Settings, get_settings
from backend.db.repositories.decision_repo import DecisionRepository
from backend.models.base import utc_now
from backend.models.config import BatteryConfig, BuildingConfig, VNMSharingRule
from backend.models.decision_log import DecisionCycleStatus
from backend.models.telemetry import EnergySnapshot
from backend.services.decision_manager import DecisionCycleResult, DecisionManager

logger = logging.getLogger("surya.scheduler")


class DecisionScheduler:
    """
    Background worker orchestrating recurring decision cycles with concurrency lock protection,
    graceful lifecycle management, and operational health diagnostics.
    Conforms to SURYA spec Section 10 and Section 13.
    """

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        settings: Optional[Settings] = None,
        snapshot_provider: Optional[Callable[[], Optional[EnergySnapshot]]] = None,
        broadcast_callback: Optional[Callable[[str, Dict[str, Any]], Any]] = None,
    ) -> None:
        self.session_factory = session_factory
        self.settings = settings or get_settings()
        self.snapshot_provider = snapshot_provider
        self.broadcast_callback = broadcast_callback

        self._lock = asyncio.Lock()
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._shutdown_event = asyncio.Event()

        # Operational state and diagnostics
        self.site_id: int = 1
        self.closed_loop_enabled: bool = False
        self.emergency_stop_active: bool = False

        self.last_cycle_started_at: Optional[datetime] = None
        self.last_cycle_completed_at: Optional[datetime] = None
        self.last_cycle_status: Optional[DecisionCycleStatus] = None
        self.last_cycle_duration_ms: Optional[float] = None
        self.last_cycle_id: Optional[str] = None
        self.last_error: Optional[str] = None

        self.total_cycles_executed: int = 0
        self.total_cycles_failed: int = 0
        self.consecutive_failures: int = 0

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def is_locked(self) -> bool:
        return self._lock.locked()

    def set_emergency_stop(self, active: bool) -> None:
        """Sets emergency stop flag preventing automated closed-loop writes."""
        self.emergency_stop_active = active
        logger.warning(
            "Emergency Stop state changed: active=%s",
            active,
            extra={"event": "emergency_stop_toggle", "active": active},
        )

    def set_closed_loop(self, enabled: bool) -> None:
        """Enables or disables automated control command writes to adapters."""
        self.closed_loop_enabled = enabled
        logger.info(
            "Closed-loop automated control: enabled=%s",
            enabled,
            extra={"event": "closed_loop_toggle", "enabled": enabled},
        )

    async def execute_cycle(
        self,
        site_id: Optional[int] = None,
        snapshot: Optional[EnergySnapshot] = None,
        building_configs: Optional[List[BuildingConfig]] = None,
        battery_configs: Optional[Dict[str, BatteryConfig]] = None,
        vnm_rules: Optional[List[VNMSharingRule]] = None,
    ) -> Optional[DecisionCycleResult]:
        """
        Executes a single decision cycle under mutual exclusion lock.
        If a cycle is already in progress, execution is safely skipped.
        """
        if self._lock.locked():
            logger.warning(
                "Skipping cycle trigger: previous decision cycle still in progress",
                extra={"event": "cycle_lock_contention", "site_id": site_id or self.site_id},
            )
            return None

        async with self._lock:
            target_site_id = site_id or self.site_id
            start_ts = utc_now()
            start_time = time.perf_counter()
            self.last_cycle_started_at = start_ts

            snap = snapshot
            if snap is None and self.snapshot_provider:
                snap = self.snapshot_provider()

            async with self.session_factory() as session:
                async with session.begin():
                    manager = DecisionManager(session=session)
                    try:
                        result = await manager.run_decision_cycle(
                            site_id=target_site_id,
                            snapshot=snap,
                            closed_loop_enabled=self.closed_loop_enabled,
                            emergency_stop_active=self.emergency_stop_active,
                            w_cost=self.settings.COST_WEIGHT,
                            w_carbon=self.settings.CARBON_WEIGHT,
                            building_configs=building_configs,
                            battery_configs=battery_configs,
                            vnm_rules=vnm_rules,
                        )

                        self.last_cycle_completed_at = utc_now()
                        self.last_cycle_status = result.status
                        self.last_cycle_duration_ms = result.duration_ms
                        self.last_cycle_id = result.cycle_id
                        self.last_error = None
                        self.consecutive_failures = 0
                        self.total_cycles_executed += 1

                        if self.broadcast_callback:
                            try:
                                payload = {
                                    "cycle_id": result.cycle_id,
                                    "status": result.status.value,
                                    "duration_ms": result.duration_ms,
                                    "decisions_count": len(result.decisions),
                                    "commands_count": len(result.commands),
                                }
                                res = self.broadcast_callback("full_cycle", payload)
                                if asyncio.iscoroutine(res):
                                    await res
                            except Exception as bc_err:
                                logger.error("Broadcast callback failed: %s", bc_err)

                        return result

                    except Exception as exc:
                        duration_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
                        self.last_cycle_completed_at = utc_now()
                        self.last_cycle_status = DecisionCycleStatus.FAILED
                        self.last_cycle_duration_ms = duration_ms
                        self.last_error = str(exc)
                        self.consecutive_failures += 1
                        self.total_cycles_failed += 1

                        logger.exception(
                            "Decision cycle failed: %s",
                            exc,
                            extra={"event": "cycle_failure", "site_id": target_site_id},
                        )

                        # Record failure in repository
                        try:
                            dec_repo = DecisionRepository(session)
                            if self.last_cycle_id:
                                await dec_repo.update_cycle(
                                    cycle_id=self.last_cycle_id,
                                    status=DecisionCycleStatus.FAILED,
                                    duration_ms=duration_ms,
                                    reason=f"Cycle unhandled failure: {str(exc)}",
                                )
                        except Exception:
                            pass

                        return None

    async def _loop(self) -> None:
        """Background periodic execution loop."""
        interval_secs = self.settings.DECISION_CYCLE_SECONDS
        logger.info(
            "DecisionScheduler background loop started (cadence: %ds)",
            interval_secs,
            extra={"event": "scheduler_loop_started", "interval_seconds": interval_secs},
        )

        while not self._shutdown_event.is_set():
            try:
                await self.execute_cycle()
            except Exception as e:
                logger.error("Unexpected error in scheduler loop: %s", e)

            try:
                await asyncio.wait_for(
                    self._shutdown_event.wait(), timeout=interval_secs
                )
            except asyncio.TimeoutError:
                pass

        logger.info(
            "DecisionScheduler background loop exited cleanly",
            extra={"event": "scheduler_loop_stopped"},
        )

    def start(self) -> None:
        """Starts the background scheduler task."""
        if self._running:
            return
        self._running = True
        self._shutdown_event.clear()
        self._task = asyncio.create_task(self._loop(), name="decision-scheduler-loop")

    async def stop(self) -> None:
        """Gracefully halts the background scheduler and awaits ongoing cycle completion."""
        if not self._running:
            return
        logger.info("Stopping DecisionScheduler...")
        self._running = False
        self._shutdown_event.set()
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=5.0)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                self._task.cancel()
            self._task = None

    def get_health_status(self) -> Dict[str, Any]:
        """
        Returns scheduler health diagnostics conforming to Section 13 /health/scheduler.
        """
        next_cycle_seconds = None
        if self._running and self.last_cycle_completed_at:
            elapsed = (
                utc_now() - self.last_cycle_completed_at
            ).total_seconds()
            next_cycle_seconds = max(
                0.0, self.settings.DECISION_CYCLE_SECONDS - elapsed
            )

        return {
            "is_running": self._running,
            "is_locked": self._lock.locked(),
            "closed_loop_enabled": self.closed_loop_enabled,
            "emergency_stop_active": self.emergency_stop_active,
            "decision_cycle_seconds": self.settings.DECISION_CYCLE_SECONDS,
            "last_cycle_started_at": (
                self.last_cycle_started_at.isoformat()
                if self.last_cycle_started_at
                else None
            ),
            "last_cycle_completed_at": (
                self.last_cycle_completed_at.isoformat()
                if self.last_cycle_completed_at
                else None
            ),
            "last_cycle_status": (
                self.last_cycle_status.value
                if self.last_cycle_status
                else None
            ),
            "last_cycle_duration_ms": self.last_cycle_duration_ms,
            "last_cycle_id": self.last_cycle_id,
            "consecutive_failures": self.consecutive_failures,
            "total_cycles_executed": self.total_cycles_executed,
            "total_cycles_failed": self.total_cycles_failed,
            "last_error": self.last_error,
            "next_cycle_in_seconds": (
                round(next_cycle_seconds, 1)
                if next_cycle_seconds is not None
                else None
            ),
        }
