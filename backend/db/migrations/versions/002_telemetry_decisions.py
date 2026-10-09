"""002_telemetry_decisions

Revision ID: 002_telemetry_decisions
Revises: 001_initial_schema
Create Date: 2026-10-08 21:04:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002_telemetry_decisions"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. telemetry_points table
    op.create_table(
        "telemetry_points",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "asset_id",
            sa.String(length=64),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("metric_name", sa.String(length=64), nullable=False),
        sa.Column("value", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(length=20), nullable=False),
        sa.Column(
            "quality",
            sa.String(length=20),
            nullable=False,
            server_default="good",
        ),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "source_adapter",
            sa.String(length=100),
            nullable=False,
            server_default="rest",
        ),
        sa.Column("diagnostic_code", sa.String(length=50), nullable=True),
    )
    op.create_index(
        "ix_telemetry_points_asset_id", "telemetry_points", ["asset_id"]
    )
    op.create_index(
        "ix_telemetry_points_metric_name", "telemetry_points", ["metric_name"]
    )
    op.create_index(
        "ix_telemetry_points_observed_at", "telemetry_points", ["observed_at"]
    )
    op.create_index(
        "ix_telemetry_asset_metric_observed",
        "telemetry_points",
        ["asset_id", "metric_name", "observed_at"],
    )

    # 2. asset_current_state table
    op.create_table(
        "asset_current_state",
        sa.Column(
            "asset_id",
            sa.String(length=64),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "operational_status",
            sa.String(length=30),
            nullable=False,
            server_default="offline",
        ),
        sa.Column("active_power_kw", sa.Float(), nullable=True),
        sa.Column("energy_kwh", sa.Float(), nullable=True),
        sa.Column("soc_percent", sa.Float(), nullable=True),
        sa.Column("health_percent", sa.Float(), nullable=True),
        sa.Column("temperature_celsius", sa.Float(), nullable=True),
        sa.Column("wind_speed_ms", sa.Float(), nullable=True),
        sa.Column("voltage_v", sa.Float(), nullable=True),
        sa.Column("frequency_hz", sa.Float(), nullable=True),
        sa.Column(
            "telemetry_quality",
            sa.String(length=20),
            nullable=False,
            server_default="missing",
        ),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("raw_metrics", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # 3. decision_cycles table
    op.create_table(
        "decision_cycles",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "site_id",
            sa.Integer(),
            sa.ForeignKey("sites.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="started",
        ),
        sa.Column("input_snapshot_hash", sa.String(length=64), nullable=False),
        sa.Column("cycle_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cycle_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Float(), nullable=True),
        sa.Column("health_summary", sa.JSON(), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
    )
    op.create_index("ix_decision_cycles_site_id", "decision_cycles", ["site_id"])
    op.create_index(
        "ix_decision_cycles_cycle_started_at",
        "decision_cycles",
        ["cycle_started_at"],
    )

    # 4. decision_logs table
    op.create_table(
        "decision_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "cycle_id",
            sa.String(length=36),
            sa.ForeignKey("decision_cycles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "site_id",
            sa.Integer(),
            sa.ForeignKey("sites.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "target_asset_id",
            sa.String(length=64),
            sa.ForeignKey("assets.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("decision_type", sa.String(length=30), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("setpoint_kw", sa.Float(), nullable=True),
        sa.Column("allocated_kwh", sa.Float(), nullable=True),
        sa.Column("allocated_value_inr", sa.Float(), nullable=True),
        sa.Column(
            "actor",
            sa.String(length=100),
            nullable=False,
            server_default="system:optimizer",
        ),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column(
            "confidence",
            sa.Float(),
            nullable=False,
            server_default=sa.text("1.0"),
        ),
        sa.Column("expected_savings_inr", sa.Float(), nullable=True),
        sa.Column("carbon_impact_kg", sa.Float(), nullable=True),
        sa.Column("context_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_decision_logs_cycle_id", "decision_logs", ["cycle_id"])
    op.create_index(
        "ix_decision_logs_target_asset_id", "decision_logs", ["target_asset_id"]
    )
    op.create_index(
        "ix_decision_logs_decision_type", "decision_logs", ["decision_type"]
    )
    op.create_index("ix_decision_logs_created_at", "decision_logs", ["created_at"])

    # 5. decision_alternatives table
    op.create_table(
        "decision_alternatives",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "cycle_id",
            sa.String(length=36),
            sa.ForeignKey("decision_cycles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("candidate_id", sa.String(length=64), nullable=False),
        sa.Column("strategy_description", sa.String(length=255), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("cost_component", sa.Float(), nullable=False),
        sa.Column("carbon_component", sa.Float(), nullable=False),
        sa.Column(
            "is_selected",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("rejected_reason", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_decision_alternatives_cycle_id",
        "decision_alternatives",
        ["cycle_id"],
    )

    # 6. control_commands table
    op.create_table(
        "control_commands",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("idempotency_key", sa.String(length=64), nullable=False),
        sa.Column(
            "decision_id",
            sa.String(length=36),
            sa.ForeignKey("decision_logs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "target_asset_id",
            sa.String(length=64),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("requested_setpoint", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=20), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column("originating_actor", sa.String(length=100), nullable=False),
        sa.Column("adapter_response", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_control_commands_idempotency_key",
        "control_commands",
        ["idempotency_key"],
        unique=True,
    )
    op.create_index(
        "ix_control_commands_decision_id", "control_commands", ["decision_id"]
    )
    op.create_index(
        "ix_control_commands_target_asset_id",
        "control_commands",
        ["target_asset_id"],
    )
    op.create_index(
        "ix_control_commands_asset_status",
        "control_commands",
        ["target_asset_id", "status"],
    )


def downgrade() -> None:
    op.drop_table("control_commands")
    op.drop_table("decision_alternatives")
    op.drop_table("decision_logs")
    op.drop_table("decision_cycles")
    op.drop_table("asset_current_state")
    op.drop_table("telemetry_points")
