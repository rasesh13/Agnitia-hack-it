from collections.abc import Callable
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.db.repositories.user_repo import UserRepository
from backend.models.user import User, UserRole
from backend.services.auth_crypto import decode_access_token

# HTTP Bearer security scheme
security_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security_bearer)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Extracts, decodes, and validates the Bearer JWT token from the Authorization header.
    Verifies user existence, active status, and token version revocation.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_REQUIRED",
                "message": "Authentication credentials were not provided.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.ExpiredSignatureError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_TOKEN_EXPIRED",
                "message": "Access token has expired. Please sign in again.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        ) from err
    except (jwt.PyJWTError, ValueError) as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_TOKEN_INVALID",
                "message": "Invalid authentication token.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        ) from err

    user_repo = UserRepository(session)
    user_id = int(payload.sub)
    user = await user_repo.get_by_id(user_id)

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "USER_NOT_FOUND_OR_INACTIVE",
                "message": "The authenticated user is inactive or no longer exists.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Token version check (revocation support)
    if payload.token_version != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_TOKEN_REVOKED",
                "message": "Session has been invalidated. Please log in again.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_roles(*allowed_roles: UserRole) -> Callable:
    """Dependency factory restricting route access to specific User roles."""

    async def role_checker(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FORBIDDEN",
                    "message": (
                        f"Insufficient permissions. Required: {[r.value for r in allowed_roles]}, "
                        f"current: {current_user.role.value}"
                    ),
                },
            )
        return current_user

    return role_checker


# Role convenience dependencies
require_admin = require_roles(UserRole.ADMIN)
require_operator_or_admin = require_roles(UserRole.ADMIN, UserRole.OPERATOR)
require_viewer_or_above = require_roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.VIEWER)
