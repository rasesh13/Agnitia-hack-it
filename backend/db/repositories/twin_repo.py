from datetime import datetime
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.digital_twin import Asset, Site
from backend.models.telemetry import AssetCurrentState, TelemetryPoint


class TwinRepository:
    """
    Async database repository for Digital Twin state persistence, query, and historical telemetry.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_site(self, site_id: int) -> Optional[Site]:
        """Fetches site metadata with related assets preloaded."""
        stmt = (
            select(Site)
            .where(Site.id == site_id)
            .options(selectinload(Site.assets))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_site_assets(self, site_id: int, active_only: bool = True) -> List[Asset]:
        """Retrieves all assets configured under a specific site."""
        stmt = select(Asset).where(Asset.site_id == site_id)
        if active_only:
            stmt = stmt.where(Asset.is_active.is_(True))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_asset_state(self, asset_id: str) -> Optional[AssetCurrentState]:
        """Fetches the latest authoritative twin state for a given asset ID."""
        stmt = (
            select(AssetCurrentState)
            .where(AssetCurrentState.asset_id == asset_id)
            .options(selectinload(AssetCurrentState.asset))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_asset_states(
        self, site_id: Optional[int] = None
    ) -> List[AssetCurrentState]:
        """Fetches all latest asset states, optionally filtered by site."""
        stmt = select(AssetCurrentState).options(selectinload(AssetCurrentState.asset))
        if site_id is not None:
            stmt = stmt.join(Asset).where(Asset.site_id == site_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def upsert_asset_state(self, state: AssetCurrentState) -> AssetCurrentState:
        """Upserts a single asset's current state."""
        existing = await self.get_asset_state(state.asset_id)
        if existing:
            existing.operational_status = state.operational_status
            existing.active_power_kw = state.active_power_kw
            existing.energy_kwh = state.energy_kwh
            existing.soc_percent = state.soc_percent
            existing.health_percent = state.health_percent
            existing.temperature_celsius = state.temperature_celsius
            existing.wind_speed_ms = state.wind_speed_ms
            existing.voltage_v = state.voltage_v
            existing.frequency_hz = state.frequency_hz
            existing.telemetry_quality = state.telemetry_quality
            existing.observed_at = state.observed_at
            existing.received_at = state.received_at
            existing.raw_metrics = state.raw_metrics
            await self.session.flush()
            return existing
        else:
            self.session.add(state)
            await self.session.flush()
            return state

    async def bulk_upsert_asset_states(self, states: List[AssetCurrentState]) -> None:
        """Efficiently updates current state records for multiple assets."""
        for state in states:
            await self.upsert_asset_state(state)

    async def add_telemetry_points(self, points: List[TelemetryPoint]) -> None:
        """Appends interval telemetry readings for historical persistence."""
        if points:
            self.session.add_all(points)
            await self.session.flush()

    async def get_telemetry_series(
        self,
        asset_id: str,
        metric_name: str,
        start_time: datetime,
        end_time: datetime,
    ) -> List[TelemetryPoint]:
        """Queries historical interval telemetry records within a time range."""
        stmt = (
            select(TelemetryPoint)
            .where(
                TelemetryPoint.asset_id == asset_id,
                TelemetryPoint.metric_name == metric_name,
                TelemetryPoint.observed_at >= start_time,
                TelemetryPoint.observed_at <= end_time,
            )
            .order_by(TelemetryPoint.observed_at.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
