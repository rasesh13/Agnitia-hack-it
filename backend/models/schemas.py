from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field

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
