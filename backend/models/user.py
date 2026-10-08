from enum import Enum
from typing import Optional

from sqlalchemy import Boolean, Integer, String
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.base import Base, TimestampMixin


class UserRole(str, Enum):
    """User authorization roles defined in SURYA spec Section 4.1."""

    ADMIN = "admin"
    OPERATOR = "operator"
    VIEWER = "viewer"


class User(Base, TimestampMixin):
    """
    SQLAlchemy User model conforming to SURYA spec Section 12.
    Stores local and OAuth authentication details, role, and token versioning.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    google_sub: Mapped[Optional[str]] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole, name="user_role", native_enum=False),
        default=UserRole.VIEWER,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    token_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<User id={self.id} email='{self.email}' "
            f"role='{self.role.value}' active={self.is_active}>"
        )
