from datetime import datetime
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.api.deps import require_viewer_or_above
from backend.db.database import get_db
from backend.db.repositories.decision_repo import DecisionRepository
from backend.models.decision_log import DecisionLog, DecisionType
from backend.models.schemas import (
    DecisionCycleRead,
    DecisionLogRead,
    DecisionStatsResponse,
)
from backend.models.user import User

router = APIRouter(prefix="/api/v1/decisions", tags=["Decisions & Optimization Audit"])


@router.get(
    "",
    response_model=List[DecisionLogRead],
    summary="Query paginated decision audit log",
)
async def list_decisions(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_viewer_or_above)],
    site_id: int = Query(1, description="Site identifier"),
    limit: int = Query(50, ge=1, le=200, description="Items per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    decision_type: Optional[DecisionType] = Query(None, description="Filter by decision type"),
    from_dt: Optional[datetime] = Query(None, description="Start ISO datetime filter"),
    to_dt: Optional[datetime] = Query(None, description="End ISO datetime filter"),
) -> List[DecisionLogRead]:
    """
    Retrieves paginated decision log history for a site, with optional filtering
    by decision type (dispatch, battery, vnm_allocation, load_shift, reliability)
    and datetime range.
    """
    repo = DecisionRepository(session)
    decisions = await repo.get_decisions(
        site_id=site_id,
        limit=limit,
        offset=offset,
        decision_type=decision_type,
        from_dt=from_dt,
        to_dt=to_dt,
    )
    return [DecisionLogRead.model_validate(d) for d in decisions]


@router.get(
    "/latest",
    response_model=DecisionCycleRead,
    summary="Get latest completed optimization cycle",
)
async def get_latest_cycle(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_viewer_or_above)],
    site_id: int = Query(1, description="Site identifier"),
) -> DecisionCycleRead:
    """
    Retrieves the most recent decision cycle for a site, including all selected
    decisions and considered alternatives with rejection rationales.
    """
    repo = DecisionRepository(session)
    cycle = await repo.get_latest_cycle(site_id)
    if cycle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "CYCLE_NOT_FOUND",
                "message": f"No decision cycles found for site {site_id}",
            },
        )
    return DecisionCycleRead.model_validate(cycle)


@router.get(
    "/stats",
    response_model=DecisionStatsResponse,
    summary="Get aggregated decision impact statistics",
)
async def get_decision_statistics(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_viewer_or_above)],
    site_id: int = Query(1, description="Site identifier"),
    from_dt: Optional[datetime] = Query(None, description="Start ISO datetime filter"),
    to_dt: Optional[datetime] = Query(None, description="End ISO datetime filter"),
) -> DecisionStatsResponse:
    """
    Aggregates financial savings (INR), carbon emissions reductions (kg),
    and energy allocations (kWh) grouped by decision type.
    """
    repo = DecisionRepository(session)
    stats = await repo.get_decision_stats(
        site_id=site_id,
        from_dt=from_dt,
        to_dt=to_dt,
    )
    return DecisionStatsResponse.model_validate(stats)


@router.get(
    "/{decision_id}",
    response_model=DecisionLogRead,
    summary="Get specific decision log detail",
)
async def get_decision(
    decision_id: str,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_viewer_or_above)],
) -> DecisionLogRead:
    """
    Retrieves detailed information for a specific decision log, including associated
    control commands and execution status.
    """
    query = (
        select(DecisionLog)
        .where(DecisionLog.id == decision_id)
        .options(selectinload(DecisionLog.commands))
    )
    result = await session.execute(query)
    decision = result.scalar_one_or_none()

    if decision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "DECISION_NOT_FOUND",
                "message": f"Decision log with ID '{decision_id}' was not found",
            },
        )
    return DecisionLogRead.model_validate(decision)
