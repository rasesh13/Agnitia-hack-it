from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import require_admin, require_operator_or_admin
from backend.api.rate_limit import rate_limiter
from backend.api.routes_health import get_global_scheduler
from backend.db.database import get_db
from backend.models.base import utc_now
from backend.models.config import AuditEvent
from backend.models.decision_log import CommandStatus, ControlCommand
from backend.models.schemas import (
    CommandAcknowledgeRequest,
    ControlCommandRead,
    EmergencyStopRequest,
    EmergencyStopResponse,
    ForceCycleRequest,
    ForceCycleResponse,
)
from backend.models.user import User
from backend.services.decision_manager import DecisionManager

router = APIRouter(prefix="/api/v1/control", tags=["Control & Execution"])


@router.post(
    "/force-cycle",
    response_model=ForceCycleResponse,
    summary="Trigger immediate optimization cycle (Operator/Admin)",
)
async def force_cycle(
    request: Request,
    payload: ForceCycleRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_operator_or_admin)],
) -> ForceCycleResponse:
    """
    Manually triggers an immediate optimization cycle for the site.
    Rate-limited to prevent control-loop thrashing.
    """
    rate_limiter.check(
        request,
        key_prefix="control_force_cycle",
        max_requests=10,
        window_seconds=60,
    )

    scheduler = get_global_scheduler()
    if scheduler is not None:
        result = await scheduler.execute_cycle(site_id=payload.site_id)
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "CYCLE_LOCKED",
                    "message": "A decision cycle is currently in progress. Please retry shortly.",
                },
            )
        return ForceCycleResponse(
            cycle_id=result.cycle_id,
            site_id=payload.site_id,
            status=result.status.value,
            duration_ms=result.duration_ms,
            decisions_count=len(result.decisions),
            commands_count=len(result.commands),
        )

    # Fallback if standalone/test execution without background scheduler
    manager = DecisionManager(session=session)
    result = await manager.run_decision_cycle(site_id=payload.site_id)
    await session.commit()

    return ForceCycleResponse(
        cycle_id=result.cycle_id,
        site_id=payload.site_id,
        status=result.status.value,
        duration_ms=result.duration_ms,
        decisions_count=len(result.decisions),
        commands_count=len(result.commands),
    )


@router.post(
    "/commands/{command_id}/acknowledge",
    response_model=ControlCommandRead,
    summary="Acknowledge or update control command execution status",
)
async def acknowledge_command(
    command_id: str,
    payload: CommandAcknowledgeRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_operator_or_admin)],
) -> ControlCommandRead:
    """
    Updates the execution status and adapter feedback for a control command.
    """
    query = select(ControlCommand).where(ControlCommand.id == command_id)
    result = await session.execute(query)
    cmd = result.scalar_one_or_none()

    if cmd is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "COMMAND_NOT_FOUND",
                "message": f"Control command with ID '{command_id}' was not found",
            },
        )

    old_status = cmd.status.value
    cmd.status = CommandStatus(payload.status)
    if payload.adapter_response is not None:
        cmd.adapter_response = payload.adapter_response

    audit = AuditEvent(
        event_type="COMMAND_ACKNOWLEDGE",
        user_id=current_user.id,
        actor=current_user.email,
        action=f"SET_STATUS_{payload.status.upper()}",
        resource_type="ControlCommand",
        resource_id=command_id,
        details={
            "old_status": old_status,
            "new_status": cmd.status.value,
            "reason": payload.reason,
            "adapter_response": payload.adapter_response,
        },
    )
    session.add(audit)
    await session.commit()
    await session.refresh(cmd)
    return ControlCommandRead.model_validate(cmd)


@router.post(
    "/emergency-stop",
    response_model=EmergencyStopResponse,
    summary="Engage or disengage campus emergency stop (Admin only)",
)
async def emergency_stop(
    payload: EmergencyStopRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
) -> EmergencyStopResponse:
    """
    Engages or releases campus-wide emergency stop. When engaged:
    - All automated battery and load control commands are frozen/zeroed.
    - Closed-loop writes to physical adapters are inhibited.
    - An immutable audit trail event is recorded.
    """
    scheduler = get_global_scheduler()
    if scheduler is not None:
        scheduler.set_emergency_stop(payload.active)

    audit = AuditEvent(
        event_type="EMERGENCY_STOP",
        user_id=current_user.id,
        actor=current_user.email,
        action="ENGAGE_EMERGENCY_STOP" if payload.active else "RELEASE_EMERGENCY_STOP",
        resource_type="CampusControl",
        resource_id="site_1",
        details={"active": payload.active, "reason": payload.reason},
    )
    session.add(audit)
    await session.commit()

    action_text = "engaged" if payload.active else "released"
    return EmergencyStopResponse(
        emergency_stop_active=payload.active,
        message=f"Campus emergency stop has been successfully {action_text}.",
        timestamp=utc_now(),
    )
