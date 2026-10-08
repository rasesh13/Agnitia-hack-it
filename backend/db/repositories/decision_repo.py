from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.base import utc_now
from backend.models.decision_log import (
    CommandStatus,
    ControlCommand,
    DecisionAlternative,
    DecisionCycle,
    DecisionCycleStatus,
    DecisionLog,
    DecisionType,
)


class DecisionRepository:
    """
    Asynchronous repository for persisting and querying decision cycles,
    selected decisions, considered alternatives, and control commands.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_cycle(
        self,
        cycle_id: str,
        site_id: int,
        input_snapshot_hash: str,
        health_summary: Optional[Dict[str, Any]] = None,
        started_at: Optional[datetime] = None,
    ) -> DecisionCycle:
        """
        Creates and persists a new DecisionCycle in STARTED state.
        """
        cycle = DecisionCycle(
            id=cycle_id,
            site_id=site_id,
            status=DecisionCycleStatus.STARTED,
            input_snapshot_hash=input_snapshot_hash,
            cycle_started_at=started_at or utc_now(),
            health_summary=health_summary,
        )
        self.session.add(cycle)
        await self.session.flush()
        return cycle

    async def update_cycle(
        self,
        cycle_id: str,
        status: DecisionCycleStatus,
        duration_ms: float,
        reason: Optional[str] = None,
        health_summary: Optional[Dict[str, Any]] = None,
        completed_at: Optional[datetime] = None,
    ) -> Optional[DecisionCycle]:
        """
        Updates cycle lifecycle status, duration, and completion timestamp.
        """
        query = select(DecisionCycle).where(DecisionCycle.id == cycle_id)
        result = await self.session.execute(query)
        cycle = result.scalar_one_or_none()
        if not cycle:
            return None

        cycle.status = status
        cycle.duration_ms = duration_ms
        cycle.reason = reason
        if health_summary is not None:
            cycle.health_summary = health_summary
        cycle.cycle_completed_at = completed_at or utc_now()

        await self.session.flush()
        return cycle

    async def get_cycle(self, cycle_id: str) -> Optional[DecisionCycle]:
        """
        Retrieves a decision cycle with eager-loaded decisions and alternatives.
        """
        query = (
            select(DecisionCycle)
            .where(DecisionCycle.id == cycle_id)
            .options(
                selectinload(DecisionCycle.decisions),
                selectinload(DecisionCycle.alternatives),
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_latest_cycle(self, site_id: int) -> Optional[DecisionCycle]:
        """
        Retrieves the most recent completed or degraded decision cycle for a site.
        """
        query = (
            select(DecisionCycle)
            .where(DecisionCycle.site_id == site_id)
            .order_by(desc(DecisionCycle.cycle_started_at))
            .options(
                selectinload(DecisionCycle.decisions),
                selectinload(DecisionCycle.alternatives),
            )
            .limit(1)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def save_decisions(self, decisions: List[DecisionLog]) -> List[DecisionLog]:
        """
        Persists a collection of selected DecisionLog records.
        """
        if not decisions:
            return []
        self.session.add_all(decisions)
        await self.session.flush()
        return decisions

    async def save_alternatives(
        self, alternatives: List[DecisionAlternative]
    ) -> List[DecisionAlternative]:
        """
        Persists a collection of rejected DecisionAlternative records.
        """
        if not alternatives:
            return []
        self.session.add_all(alternatives)
        await self.session.flush()
        return alternatives

    async def save_commands(
        self, commands: List[ControlCommand]
    ) -> List[ControlCommand]:
        """
        Persists a collection of ControlCommand records.
        """
        if not commands:
            return []
        self.session.add_all(commands)
        await self.session.flush()
        return commands

    async def update_command_status(
        self,
        command_id: str,
        status: CommandStatus,
        adapter_response: Optional[Dict[str, Any]] = None,
    ) -> Optional[ControlCommand]:
        """
        Updates the execution status and adapter feedback for a control command.
        """
        query = select(ControlCommand).where(ControlCommand.id == command_id)
        result = await self.session.execute(query)
        cmd = result.scalar_one_or_none()
        if not cmd:
            return None

        cmd.status = status
        if adapter_response is not None:
            cmd.adapter_response = adapter_response
        await self.session.flush()
        return cmd

    async def get_decisions(
        self,
        site_id: int,
        limit: int = 50,
        offset: int = 0,
        decision_type: Optional[DecisionType] = None,
        from_dt: Optional[datetime] = None,
        to_dt: Optional[datetime] = None,
    ) -> List[DecisionLog]:
        """
        Queries paginated decision history filtered by type and date range.
        """
        query = select(DecisionLog).where(DecisionLog.site_id == site_id)
        if decision_type is not None:
            query = query.where(DecisionLog.decision_type == decision_type)
        if from_dt is not None:
            query = query.where(DecisionLog.created_at >= from_dt)
        if to_dt is not None:
            query = query.where(DecisionLog.created_at <= to_dt)

        query = (
            query.order_by(desc(DecisionLog.created_at))
            .limit(limit)
            .offset(offset)
            .options(selectinload(DecisionLog.commands))
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_decision_stats(
        self,
        site_id: int,
        from_dt: Optional[datetime] = None,
        to_dt: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Aggregates summary statistics for decision audit reporting.
        """
        query = select(
            DecisionLog.decision_type,
            func.count(DecisionLog.id).label("count"),
            func.sum(DecisionLog.allocated_kwh).label("total_kwh"),
            func.sum(DecisionLog.expected_savings_inr).label("total_savings_inr"),
            func.sum(DecisionLog.carbon_impact_kg).label("total_carbon_kg"),
        ).where(DecisionLog.site_id == site_id)

        if from_dt is not None:
            query = query.where(DecisionLog.created_at >= from_dt)
        if to_dt is not None:
            query = query.where(DecisionLog.created_at <= to_dt)

        query = query.group_by(DecisionLog.decision_type)
        result = await self.session.execute(query)
        rows = result.all()

        stats_by_type = {}
        total_decisions = 0
        total_savings = 0.0
        total_carbon = 0.0

        for r in rows:
            t_name = (
                r.decision_type.value
                if hasattr(r.decision_type, "value")
                else str(r.decision_type)
            )
            cnt = r.count or 0
            kwh = round(r.total_kwh or 0.0, 2)
            sav = round(r.total_savings_inr or 0.0, 2)
            carb = round(r.total_carbon_kg or 0.0, 2)

            stats_by_type[t_name] = {
                "count": cnt,
                "total_kwh": kwh,
                "total_savings_inr": sav,
                "total_carbon_kg": carb,
            }
            total_decisions += cnt
            total_savings += sav
            total_carbon += carb

        return {
            "site_id": site_id,
            "total_decisions": total_decisions,
            "total_savings_inr": round(total_savings, 2),
            "total_carbon_reduction_kg": round(total_carbon, 2),
            "by_type": stats_by_type,
        }
