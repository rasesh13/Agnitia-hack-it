from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import require_viewer_or_above
from backend.db.database import get_db
from backend.models.base import utc_now
from backend.models.schemas import ExportStatsResponse
from backend.models.user import User
from backend.services.export_service import ExportService

router = APIRouter(prefix="/api/v1/export", tags=["Reporting & Export"])


@router.get(
    "/csv",
    summary="Download energy optimization & decision audit report in CSV format",
    response_class=Response,
)
async def export_csv(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_viewer_or_above)],
    site_id: int = Query(1, description="Site identifier"),
    from_dt: Optional[datetime] = Query(None, description="Start ISO datetime filter"),
    to_dt: Optional[datetime] = Query(None, description="End ISO datetime filter"),
) -> Response:
    """
    Exports decision log, energy allocations, financial savings, and telemetry
    quality disclosures in RFC 4180-compliant CSV format with explanatory metadata.
    """
    service = ExportService(session)
    csv_content = await service.generate_csv_report(
        site_id=site_id,
        from_dt=from_dt,
        to_dt=to_dt,
    )
    timestamp_str = utc_now().strftime("%Y%m%d_%H%M%S")
    filename = f"surya_report_site_{site_id}_{timestamp_str}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Report-Site-Id": str(site_id),
        },
    )


@router.get(
    "/pdf",
    summary="Download executive energy optimization summary report in PDF format",
    response_class=Response,
)
async def export_pdf(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_viewer_or_above)],
    site_id: int = Query(1, description="Site identifier"),
    from_dt: Optional[datetime] = Query(None, description="Start ISO datetime filter"),
    to_dt: Optional[datetime] = Query(None, description="End ISO datetime filter"),
) -> Response:
    """
    Exports executive PDF summary containing KPI summaries, optimization category breakdown,
    recent decision audit trail, tariffs, and formal data-quality disclosures.
    """
    service = ExportService(session)
    pdf_bytes = await service.generate_pdf_report(
        site_id=site_id,
        from_dt=from_dt,
        to_dt=to_dt,
    )
    timestamp_str = utc_now().strftime("%Y%m%d_%H%M%S")
    filename = f"surya_report_site_{site_id}_{timestamp_str}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Report-Site-Id": str(site_id),
        },
    )


@router.get(
    "/stats",
    response_model=ExportStatsResponse,
    summary="Get aggregated executive export metrics and quality disclosures",
)
async def export_stats(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_viewer_or_above)],
    site_id: int = Query(1, description="Site identifier"),
    from_dt: Optional[datetime] = Query(None, description="Start ISO datetime filter"),
    to_dt: Optional[datetime] = Query(None, description="End ISO datetime filter"),
) -> ExportStatsResponse:
    """
    Retrieves summary report statistics including financial savings, carbon reductions,
    energy allocations, active tariffs, and data-completeness metrics.
    """
    service = ExportService(session)
    stats = await service.get_export_stats(
        site_id=site_id,
        from_dt=from_dt,
        to_dt=to_dt,
    )
    return ExportStatsResponse.model_validate(stats)
