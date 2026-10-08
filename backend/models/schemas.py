from datetime import datetime
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from backend.models.user import UserRole

T = TypeVar("T")


class APIErrorDetail(BaseModel):
    """Detailed error object conforming to SURYA REST contract."""

    model_config = ConfigDict(extra="forbid")

    code: str = Field(
        ...,
        description="Machine-readable error code (e.g. VALIDATION_ERROR, AUTH_EXPIRED)",
    )
    message: str = Field(..., description="Human-readable explanation of the error")
    request_id: Optional[str] = Field(
        None, description="Correlation ID for tracing the request"
    )
    details: Optional[dict[str, Any]] = Field(
        None, description="Additional context or validation failure map"
    )


class APIErrorResponse(BaseModel):
    """Root error response container."""

    model_config = ConfigDict(extra="forbid")

    error: APIErrorDetail


class StandardResponse(BaseModel, Generic[T]):
    """Standard generic API response."""

    model_config = ConfigDict(extra="forbid")

    data: T
    request_id: Optional[str] = None


# ==============================================================================
# Authentication Request & Response Schemas
# ==============================================================================


class UserSignupRequest(BaseModel):
    """Signup request schema."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(..., description="User email address")
    password: str = Field(
        ..., min_length=8, max_length=128, description="User password (min 8 chars)"
    )


class UserLoginRequest(BaseModel):
    """Login request schema."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class GoogleAuthRequest(BaseModel):
    """Google OAuth ID token verification request."""

    model_config = ConfigDict(extra="forbid")

    id_token: str = Field(..., description="Google OAuth ID Token JWT")


class UserReadResponse(BaseModel):
    """Safe user profile response representation."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    """JWT bearer token response."""

    model_config = ConfigDict(extra="forbid")

    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field("bearer", description="Token type")
    expires_in: int = Field(..., description="Token validity in seconds")
    user: UserReadResponse


class TokenPayload(BaseModel):
    """Decoded JWT claims payload."""

    model_config = ConfigDict(extra="forbid")

    sub: str = Field(..., description="User ID subject")
    email: str = Field(..., description="User email")
    role: UserRole = Field(..., description="User role")
    token_version: int = Field(1, description="Token revocation version")
    iat: int = Field(..., description="Issued at epoch timestamp")
    exp: int = Field(..., description="Expiration epoch timestamp")
