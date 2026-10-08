from enum import Enum
from typing import List, Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin


class AssetType(str, Enum):
    """Supported energy asset types defined in SURYA spec Section 8.2."""

    SITE = "site"
    BUILDING = "building"
    SOLAR = "solar"
    WIND = "wind"
    BATTERY = "battery"
    LOAD = "load"
    GRID = "grid"
    METER = "meter"


class Site(Base, TimestampMixin):
    """
    Campus Site entity storing geographical, timezone, and tariff jurisdiction metadata.
    """

    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata", nullable=False)
    jurisdiction: Mapped[str] = mapped_column(String(50), default="India", nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    config_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Relationships
    assets: Mapped[List["Asset"]] = relationship(
        "Asset", back_populates="site", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Site id={self.id} name='{self.name}' timezone='{self.timezone}'>"


class Asset(Base, TimestampMixin):
    """
    Digital twin Asset model representing physical energy devices, buildings, and meters.
    """

    __tablename__ = "assets"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    asset_type: Mapped[AssetType] = mapped_column(
        SQLEnum(AssetType, name="asset_type", native_enum=False),
        nullable=False,
    )
    site_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False
    )
    parent_asset_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True
    )
    rated_capacity_kw: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    adapter_mapping: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    site: Mapped["Site"] = relationship("Site", back_populates="assets")
    parent_asset: Mapped[Optional["Asset"]] = relationship(
        "Asset", remote_side=[id], backref="child_assets"
    )

    def __repr__(self) -> str:
        return f"<Asset id='{self.id}' type='{self.asset_type.value}' name='{self.name}'>"
