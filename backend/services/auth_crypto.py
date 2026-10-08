from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from backend.config import get_settings
from backend.models.schemas import TokenPayload
from backend.models.user import UserRole

# Argon2id password hasher with secure defaults
_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(plain_password: str) -> str:
    """Hashes a plaintext password using Argon2id."""
    return _hasher.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against an Argon2id hash."""
    try:
        return _hasher.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def create_access_token(
    user_id: int,
    email: str,
    role: UserRole,
    token_version: int = 1,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Creates a signed JWT access token containing required claims:
    sub (user_id), email, role, token_version, iat, and exp.
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    if expires_delta is not None:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role.value if isinstance(role, UserRole) else str(role),
        "token_version": token_version,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }

    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")
    return token


def decode_access_token(token: str) -> TokenPayload:
    """
    Decodes and validates a JWT access token against the configured secret and HS256 algorithm.
    Raises jwt.PyJWTError on expiration or invalid signature.
    """
    settings = get_settings()
    decoded = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
    return TokenPayload(
        sub=str(decoded["sub"]),
        email=str(decoded["email"]),
        role=UserRole(decoded["role"]),
        token_version=int(decoded.get("token_version", 1)),
        iat=int(decoded["iat"]),
        exp=int(decoded["exp"]),
    )
