from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.db.database import get_db
from backend.models.base import utc_now

router = APIRouter(tags=["Health & Diagnostics"])

# Global scheduler reference for health inspection
_scheduler_instance: Any = None


def set_global_scheduler(scheduler: Any) -> None:
    """Registers the background scheduler instance for diagnostic health queries."""
    global _scheduler_instance
    _scheduler_instance = scheduler


def get_global_scheduler() -> Any:
    """Returns the registered global scheduler instance."""
    return _scheduler_instance


@router.get("/health", summary="Basic Liveness Probe")
async def health_liveness() -> Dict[str, Any]:
    """
    Returns immediate 200 OK if the process is alive.
    Conforms to SURYA spec Section 13.
    """
    return {
        "status": "ok",
        "service": "surya-backend",
        "timestamp": utc_now().isoformat(),
    }


@router.get("/health/ready", summary="Comprehensive Readiness Probe")
async def health_readiness(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Validates database connectivity, configuration readiness, and system health.
    Conforms to SURYA spec Section 13.
    """
    settings = get_settings()
    health_details = {
        "database": "unknown",
        "environment": settings.ENVIRONMENT,
        "scheduler_enabled": settings.SCHEDULER_ENABLED,
    }

    try:
        # Check DB connectivity
        result = await db.execute(text("SELECT 1"))
        if result.scalar() == 1:
            health_details["database"] = "healthy"
        else:
            health_details["database"] = "unresponsive"
    except Exception as exc:
        health_details["database"] = f"error: {str(exc)}"
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "DATABASE_UNAVAILABLE",
                "message": "Database readiness check failed",
                "details": health_details,
            },
        ) from exc

    return {
        "status": "ready",
        "timestamp": utc_now().isoformat(),
        "components": health_details,
    }


@router.get("/health/scheduler", summary="Scheduler Operational Diagnostics")
async def health_scheduler() -> Dict[str, Any]:
    """
    Returns background cycle status, timing, lock state, and failure metrics.
    Conforms to SURYA spec Section 13.
    """
    scheduler = get_global_scheduler()
    if scheduler is None:
        return {
            "status": "idle",
            "message": "Background scheduler is not registered or running in this process",
            "timestamp": utc_now().isoformat(),
        }

    status_data = scheduler.get_health_status()
    return {
        "status": "healthy" if status_data.get("consecutive_failures", 0) == 0 else "degraded",
        "timestamp": utc_now().isoformat(),
        "scheduler": status_data,
    }
