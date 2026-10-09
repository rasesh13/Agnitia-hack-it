from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user
from backend.api.rate_limit import rate_limiter
from backend.config import get_settings
from backend.db.database import get_db
from backend.db.repositories.user_repo import UserRepository
from backend.models.schemas import (
    GoogleAuthRequest,
    TokenResponse,
    UserLoginRequest,
    UserReadResponse,
    UserSignupRequest,
)
from backend.models.user import User, UserRole
from backend.services.auth_crypto import (
    create_access_token,
    hash_password,
    verify_password,
)
from backend.services.google_identity import GoogleTokenError, verify_google_id_token_async

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
async def signup(
    request: Request,
    payload: UserSignupRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """
    Registers a new user. The first provisioned user in the system is
    automatically granted the Administrator role. Subsequent users receive the Viewer role.
    """
    rate_limiter.check(request, key_prefix="auth_signup", max_requests=10, window_seconds=60)
    user_repo = UserRepository(session)

    existing_user = await user_repo.get_by_email(payload.email)
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "USER_ALREADY_EXISTS",
                "message": f"A user with email '{payload.email}' already exists.",
            },
        )

    # First user bootstrap rule (spec Section 4.1)
    user_count = await user_repo.count_users()
    assigned_role = UserRole.ADMIN if user_count == 0 else UserRole.VIEWER

    hashed_pw = hash_password(payload.password)
    user = await user_repo.create_user(
        email=payload.email,
        password_hash=hashed_pw,
        role=assigned_role,
    )

    settings = get_settings()
    token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
        token_version=user.token_version,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserReadResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate and receive JWT token",
)
async def login(
    request: Request,
    payload: UserLoginRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Authenticates credentials against stored Argon2id password hash."""
    rate_limiter.check(request, key_prefix="auth_login", max_requests=15, window_seconds=60)
    user_repo = UserRepository(session)

    user = await user_repo.get_by_email(payload.email)
    valid = user is not None and user.password_hash and verify_password(
        payload.password, user.password_hash
    )
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_CREDENTIALS",
                "message": "Invalid email or password.",
            },
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "USER_INACTIVE",
                "message": "This account is inactive.",
            },
        )

    settings = get_settings()
    token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
        token_version=user.token_version,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserReadResponse.model_validate(user),
    )


@router.post(
    "/google",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate via Google OAuth ID token",
)
async def google_auth(
    request: Request,
    payload: GoogleAuthRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """
    Authenticates or signs up a user with a verified Google OAuth ID token.
    Disabled when GOOGLE_CLIENT_ID is not configured.
    """
    rate_limiter.check(request, key_prefix="auth_google", max_requests=10, window_seconds=60)
    settings = get_settings()

    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "GOOGLE_AUTH_NOT_CONFIGURED",
                "message": "Google authentication is not configured on this server.",
            },
        )

    try:
        identity = await verify_google_id_token_async(payload.id_token, settings.GOOGLE_CLIENT_ID)
    except GoogleTokenError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "GOOGLE_TOKEN_INVALID",
                "message": "Failed to verify Google ID token.",
            },
        ) from err

    email = identity.email
    google_sub = identity.sub
    user_repo = UserRepository(session)
    user = await user_repo.get_by_google_sub(google_sub)
    if user is None:
        user = await user_repo.get_by_email(email)
        if user is not None:
            user.google_sub = google_sub
            await session.commit()
            await session.refresh(user)
        else:
            user_count = await user_repo.count_users()
            assigned_role = UserRole.ADMIN if user_count == 0 else UserRole.VIEWER
            user = await user_repo.create_user(
                email=email,
                google_sub=google_sub,
                role=assigned_role,
            )

    token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
        token_version=user.token_version,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserReadResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserReadResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile",
)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserReadResponse:
    """Returns the authenticated user profile information."""
    return UserReadResponse.model_validate(current_user)


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Invalidate active user session",
)
async def logout(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Revokes active JWT sessions by incrementing the user's token version."""
    user_repo = UserRepository(session)
    await user_repo.increment_token_version(current_user)
    return {"message": "Session successfully invalidated."}
