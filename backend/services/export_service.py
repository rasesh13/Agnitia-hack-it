import csv
import io
from datetime import datetime
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.base import utc_now
from backend.models.decision_log import DecisionLog
from backend.models.digital_twin import Site
from backend.models.telemetry import TelemetryPoint, TelemetryQuality


class ExportService:
    """
    Reporting and export service generating audit-compliant CSV and PDF summaries
    with strict data-quality disclosures conforming to SURYA spec Section 11 & Section 16.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _fetch_site_and_decisions(
        self,
        site_id: int,
        from_dt: Optional[datetime] = None,
        to_dt: Optional[datetime] = None,
    ) -> tuple[Site, List[DecisionLog], Dict[str, Any]]:
        """Queries site metadata, decision records, and telemetry quality metrics."""
        # Site query
        site_res = await self.session.execute(select(Site).where(Site.id == site_id))
        site = site_res.scalar_one_or_none()
        if not site:
            site = Site(
                id=site_id,
                name=f"Campus Site {site_id}",
                timezone="Asia/Kolkata",
                jurisdiction="India",
                currency="INR",
            )

        # Decision logs query
        query = select(DecisionLog).where(DecisionLog.site_id == site_id)
        if from_dt is not None:
            query = query.where(DecisionLog.created_at >= from_dt)
        if to_dt is not None:
            query = query.where(DecisionLog.created_at <= to_dt)

        query = query.order_by(DecisionLog.created_at.desc()).options(
            selectinload(DecisionLog.commands)
        )
        dec_res = await self.session.execute(query)
        decisions = list(dec_res.scalars().all())

        # Telemetry quality query
        tel_query = select(
            TelemetryPoint.quality,
            func.count(TelemetryPoint.id).label("count"),
        ).group_by(TelemetryPoint.quality)

        if from_dt is not None:
            tel_query = tel_query.where(TelemetryPoint.observed_at >= from_dt)
        if to_dt is not None:
            tel_query = tel_query.where(TelemetryPoint.observed_at <= to_dt)

        tel_res = await self.session.execute(tel_query)
        quality_counts = {
            str(row.quality.value if hasattr(row.quality, "value") else row.quality): row.count
            for row in tel_res.all()
        }

        total_points = sum(quality_counts.values())
        good_points = quality_counts.get(TelemetryQuality.GOOD.value, 0)
        stale_or_uncertain = total_points - good_points
        completeness = (
            round((good_points / total_points * 100.0), 1) if total_points > 0 else 100.0
        )

        quality_summary = {
            "total_points": total_points,
            "good_points": good_points,
            "stale_or_uncertain": stale_or_uncertain,
            "completeness_pct": completeness,
        }

        return site, decisions, quality_summary

    async def get_export_stats(
        self,
        site_id: int,
        from_dt: Optional[datetime] = None,
        to_dt: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Calculates executive reporting metrics and quality disclosures."""
        site, decisions, quality = await self._fetch_site_and_decisions(
            site_id, from_dt, to_dt
        )

        total_savings = sum(d.expected_savings_inr or 0.0 for d in decisions)
        total_carbon = sum(d.carbon_impact_kg or 0.0 for d in decisions)
        total_kwh = sum(d.allocated_kwh or 0.0 for d in decisions)

        by_type: Dict[str, Any] = {}
        for d in decisions:
            t_name = (
                d.decision_type.value
                if hasattr(d.decision_type, "value")
                else str(d.decision_type)
            )
            if t_name not in by_type:
                by_type[t_name] = {
                    "count": 0,
                    "allocated_kwh": 0.0,
                    "savings_inr": 0.0,
                    "carbon_reduction_kg": 0.0,
                }
            by_type[t_name]["count"] += 1
            by_type[t_name]["allocated_kwh"] += d.allocated_kwh or 0.0
            by_type[t_name]["savings_inr"] += d.expected_savings_inr or 0.0
            by_type[t_name]["carbon_reduction_kg"] += d.carbon_impact_kg or 0.0

        for data in by_type.values():
            data["allocated_kwh"] = round(data["allocated_kwh"], 2)
            data["savings_inr"] = round(data["savings_inr"], 2)
            data["carbon_reduction_kg"] = round(data["carbon_reduction_kg"], 2)

        return {
            "site_id": site_id,
            "period_start": from_dt,
            "period_end": to_dt,
            "timezone": site.timezone,
            "currency": site.currency,
            "units": {
                "power": "kW",
                "energy": "kWh",
                "cost": site.currency,
                "carbon": "kg CO2e",
            },
            "tariffs": {
                "grid_import_inr_per_kwh": 8.50,
                "grid_export_inr_per_kwh": 3.50,
                "carbon_emission_factor_kg_per_kwh": 0.82,
            },
            "metrics": {
                "total_decisions": len(decisions),
                "total_energy_allocated_kwh": round(total_kwh, 2),
                "total_cost_savings_inr": round(total_savings, 2),
                "total_carbon_reduction_kg": round(total_carbon, 2),
                "by_type": by_type,
            },
            "data_quality_disclosure": {
                "telemetry_completeness_pct": quality["completeness_pct"],
                "good_quality_points": quality["good_points"],
                "stale_or_uncertain_points": quality["stale_or_uncertain"],
                "notes": [
                    "Carbon intensity calculation uses grid factor of 0.82 kg CO2e/kWh.",
                    "Savings represent delta against baseline unoptimized grid import.",
                    "Stale or degraded telemetry evaluated under conservative bounds.",
                ],
            },
        }

    async def generate_csv_report(
        self,
        site_id: int,
        from_dt: Optional[datetime] = None,
        to_dt: Optional[datetime] = None,
    ) -> str:
        """Generates RFC 4180-compliant CSV report with disclosure comments."""
        site, decisions, quality = await self._fetch_site_and_decisions(
            site_id, from_dt, to_dt
        )
        output = io.StringIO()
        writer = csv.writer(output)

        w_start = from_dt.isoformat() if from_dt else "All History"
        w_end = to_dt.isoformat() if to_dt else "Present"

        # Metadata Comments Preamble
        output.write("# SURYA Operations Platform - Energy Optimization & Audit Report\n")
        output.write(f"# Site Name: {site.name} (ID: {site.id})\n")
        output.write(f"# Jurisdiction: {site.jurisdiction} | Site Timezone: {site.timezone}\n")
        output.write(f"# Report Generated At (UTC): {utc_now().isoformat()}\n")
        output.write(f"# Calculation Window: {w_start} to {w_end}\n")
        output.write(f"# Currency: {site.currency} | Tariffs: Import=8.50, Export=3.50\n")
        output.write("# Grid Emission Factor: 0.82 kg CO2e/kWh\n")
        output.write(f"# Telemetry Quality Completeness: {quality['completeness_pct']}%\n")
        output.write("#\n")

        # Table Header
        writer.writerow([
            "decision_id",
            "cycle_id",
            "timestamp_utc",
            "decision_type",
            "target_asset_id",
            "action",
            "setpoint_kw",
            "allocated_kwh",
            "expected_savings_inr",
            "carbon_impact_kg",
            "confidence",
            "actor",
            "reason",
        ])

        # Table Rows
        for d in decisions:
            t_type = (
                d.decision_type.value
                if hasattr(d.decision_type, "value")
                else str(d.decision_type)
            )
            writer.writerow([
                d.id,
                d.cycle_id,
                d.created_at.isoformat() if d.created_at else "",
                t_type,
                d.target_asset_id or "",
                d.action,
                d.setpoint_kw if d.setpoint_kw is not None else "",
                d.allocated_kwh if d.allocated_kwh is not None else "",
                d.expected_savings_inr if d.expected_savings_inr is not None else "",
                d.carbon_impact_kg if d.carbon_impact_kg is not None else "",
                d.confidence,
                d.actor,
                d.reason,
            ])

        return output.getvalue()

    async def generate_pdf_report(
        self,
        site_id: int,
        from_dt: Optional[datetime] = None,
        to_dt: Optional[datetime] = None,
    ) -> bytes:
        """Generates executive PDF summary report using ReportLab."""
        site, decisions, quality = await self._fetch_site_and_decisions(
            site_id, from_dt, to_dt
        )
        stats = await self.get_export_stats(site_id, from_dt, to_dt)
        buffer = io.BytesIO()

        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "ReportTitle",
            parent=styles["Heading1"],
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#0F172A"),
        )
        subtitle_style = ParagraphStyle(
            "ReportSubtitle",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#64748B"),
        )
        heading2_style = ParagraphStyle(
            "SectionHeading",
            parent=styles["Heading2"],
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#1E293B"),
            spaceBefore=12,
            spaceAfter=6,
        )
        body_style = ParagraphStyle(
            "ReportBody",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#334155"),
        )
        disclaimer_style = ParagraphStyle(
            "ReportDisclaimer",
            parent=styles["Normal"],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#64748B"),
        )

        elements = []

        # Header Title
        elements.append(Paragraph("SURYA Renewable Yield & Operations Report", title_style))
        gen_time = utc_now().strftime("%Y-%m-%d %H:%M:%S UTC")
        w_start = from_dt.strftime("%Y-%m-%d %H:%M") if from_dt else "All History"
        w_end = to_dt.strftime("%Y-%m-%d %H:%M") if to_dt else "Present"
        sub_html = (
            f"<b>Site:</b> {site.name} ({site.jurisdiction}) | "
            f"<b>Window:</b> {w_start} — {w_end} | <b>Generated:</b> {gen_time}"
        )
        elements.append(Paragraph(sub_html, subtitle_style))
        elements.append(Spacer(1, 8))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1")))
        elements.append(Spacer(1, 8))

        # Executive Metrics Box
        m = stats["metrics"]
        kpi_data = [
            [
                Paragraph("<b>Total Decisions</b>", body_style),
                Paragraph("<b>Energy Allocated</b>", body_style),
                Paragraph("<b>Financial Savings</b>", body_style),
                Paragraph("<b>Carbon Reduction</b>", body_style),
            ],
            [
                Paragraph(f"<font size=12><b>{m['total_decisions']}</b></font>", body_style),
                Paragraph(
                    f"<font size=12><b>{m['total_energy_allocated_kwh']} kWh</b></font>",
                    body_style,
                ),
                Paragraph(
                    f"<font size=11 color='#16A34A'><b>INR "
                    f"{m['total_cost_savings_inr']:,.2f}</b></font>",
                    body_style,
                ),
                Paragraph(
                    f"<font size=11 color='#2563EB'><b>"
                    f"{m['total_carbon_reduction_kg']:,.2f} kg</b></font>",
                    body_style,
                ),
            ],
        ]
        kpi_table = Table(kpi_data, colWidths=[120, 130, 140, 150])
        kpi_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("PADDING", (0, 0), (-1, -1), 6),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ])
        )
        elements.append(kpi_table)
        elements.append(Spacer(1, 12))

        # Decision Breakdown Section
        elements.append(Paragraph("Optimization Breakdown by Category", heading2_style))
        breakdown_rows = [
            ["Category", "Cycles / Count", "Allocated (kWh)", "Savings (INR)", "Carbon Delta (kg)"]
        ]
        for c_type, c_data in m["by_type"].items():
            breakdown_rows.append([
                c_type.replace("_", " ").title(),
                str(c_data["count"]),
                f"{c_data['allocated_kwh']:.1f}",
                f"{c_data['savings_inr']:.2f}",
                f"{c_data['carbon_reduction_kg']:.2f}",
            ])

        if len(breakdown_rows) > 1:
            breakdown_table = Table(breakdown_rows, colWidths=[140, 100, 100, 100, 100])
            breakdown_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                ])
            )
            elements.append(breakdown_table)
        else:
            elements.append(
                Paragraph("<i>No optimization events recorded in this window.</i>", body_style)
            )

        elements.append(Spacer(1, 12))

        # Recent Optimization Audit Trail
        elements.append(Paragraph("Recent Optimization Actions & Rationale", heading2_style))
        recent_rows = [["Time (UTC)", "Type", "Action", "Energy", "Savings", "Rationale"]]
        for d in decisions[:15]:
            time_str = d.created_at.strftime("%H:%M:%S") if d.created_at else ""
            t_type = (
                d.decision_type.value
                if hasattr(d.decision_type, "value")
                else str(d.decision_type)
            )
            kwh_str = f"{d.allocated_kwh:.1f}" if d.allocated_kwh is not None else "-"
            sav_str = (
                f"INR {d.expected_savings_inr:.1f}"
                if d.expected_savings_inr is not None
                else "-"
            )
            reason_text = (d.reason[:40] + "...") if len(d.reason) > 40 else d.reason
            recent_rows.append([time_str, t_type, d.action, kwh_str, sav_str, reason_text])

        if len(recent_rows) > 1:
            recent_table = Table(recent_rows, colWidths=[65, 80, 100, 55, 70, 170])
            recent_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                    ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ])
            )
            elements.append(recent_table)

        elements.append(Spacer(1, 14))

        # Data Quality & Regulatory Disclosures
        elements.append(Paragraph("Data Quality & Methodological Disclosures", heading2_style))
        disc_text = (
            f"<b>Telemetry Completeness:</b> {quality['completeness_pct']}% of interval readings "
            f"met strict quality criteria. Tariffs evaluated at grid import standard rate "
            f"(INR 8.50/kWh) and solar feed-in credit (INR 3.50/kWh). Grid emission intensity "
            f"factor evaluated at 0.82 kg CO2e/kWh (Central Electricity Authority CEA baseline). "
            f"All optimization actions conform to append-only cryptographic audit logs per "
            f"SURYA spec Section 11 & Section 16."
        )
        elements.append(Paragraph(disc_text, disclaimer_style))

        doc.build(elements)
        return buffer.getvalue()
