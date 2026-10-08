"""001_initial_schema

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-10-08 20:59:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users table
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("google_sub", sa.String(length=255), nullable=True),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="viewer"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("token_version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_google_sub", "users", ["google_sub"], unique=True)

    # 2. sites table
    op.create_table(
        "sites",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("timezone", sa.String(length=50), nullable=False, server_default="Asia/Kolkata"),
        sa.Column("jurisdiction", sa.String(length=50), nullable=False, server_default="India"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="INR"),
        sa.Column("config_version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # 3. assets table
    op.create_table(
        "assets",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("asset_type", sa.String(length=20), nullable=False),
        sa.Column(
            "site_id",
            sa.Integer(),
            sa.ForeignKey("sites.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "parent_asset_id",
            sa.String(length=64),
            sa.ForeignKey("assets.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("rated_capacity_kw", sa.Float(), nullable=True),
        sa.Column("adapter_mapping", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # 4. building_configs table
    op.create_table(
        "building_configs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "asset_id",
            sa.String(length=64),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column("building_name", sa.String(length=100), nullable=False),
        sa.Column(
            "criticality_tier",
            sa.String(length=20),
            nullable=False,
            server_default="essential",
        ),
        sa.Column(
            "flexible_load_policy",
            sa.String(length=50),
            nullable=True,
            server_default="protected",
        ),
        sa.Column("peak_load_kw", sa.Float(), nullable=False, server_default=sa.text("100.0")),
        sa.Column("operational_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # 5. battery_configs table
    op.create_table(
        "battery_configs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "asset_id",
            sa.String(length=64),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column("min_soc", sa.Float(), nullable=False, server_default=sa.text("10.0")),
        sa.Column("max_soc", sa.Float(), nullable=False, server_default=sa.text("95.0")),
        sa.Column("reserve_floor", sa.Float(), nullable=False, server_default=sa.text("20.0")),
        sa.Column(
            "max_charge_power_kw",
            sa.Float(),
            nullable=False,
            server_default=sa.text("200.0"),
        ),
        sa.Column(
            "max_discharge_power_kw",
            sa.Float(),
            nullable=False,
            server_default=sa.text("200.0"),
        ),
        sa.Column(
            "round_trip_efficiency",
            sa.Float(),
            nullable=False,
            server_default=sa.text("0.92"),
        ),
        sa.Column("health_floor", sa.Float(), nullable=False, server_default=sa.text("70.0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # 6. alert_thresholds table
    op.create_table(
        "alert_thresholds",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("metric_name", sa.String(length=64), nullable=False, unique=True),
        sa.Column("threshold_value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=20), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False, server_default="warning"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column(
            "updated_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # 7. vnm_sharing_rules table
    op.create_table(
        "vnm_sharing_rules",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "building_asset_id",
            sa.String(length=64),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sharing_ratio", sa.Float(), nullable=False),
        sa.Column("rule_version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("jurisdiction", sa.String(length=50), nullable=False, server_default="IN-KA"),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("effective_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "updated_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # 8. audit_events table
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("actor", sa.String(length=100), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("resource_type", sa.String(length=50), nullable=False),
        sa.Column("resource_id", sa.String(length=64), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_events_event_type", "audit_events", ["event_type"])


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("vnm_sharing_rules")
    op.drop_table("alert_thresholds")
    op.drop_table("battery_configs")
    op.drop_table("building_configs")
    op.drop_table("assets")
    op.drop_table("sites")
    op.drop_table("users")
