from datetime import timedelta

import jwt
import pytest

from backend.models.user import UserRole
from backend.services.auth_crypto import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_argon2id_hashing_and_verification():
    """Verify Argon2id password hashing and verification."""
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)

    assert hashed.startswith("$argon2id$")
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword123!", hashed) is False
    assert verify_password("", hashed) is False

    # Salt uniqueness: hashing same password twice yields different hashes
    hashed2 = hash_password(password)
    assert hashed != hashed2


def test_jwt_creation_and_decoding():
    """Verify JWT access token issuance and claims parsing."""
    token = create_access_token(
        user_id=42,
        email="operator@surya-energy.com",
        role=UserRole.OPERATOR,
        token_version=2,
        expires_delta=timedelta(minutes=30),
    )

    payload = decode_access_token(token)
    assert payload.sub == "42"
    assert payload.email == "operator@surya-energy.com"
    assert payload.role == UserRole.OPERATOR
    assert payload.token_version == 2
    assert payload.exp > payload.iat


def test_jwt_expiration():
    """Verify expired JWT tokens raise ExpiredSignatureError."""
    expired_token = create_access_token(
        user_id=1,
        email="admin@surya-energy.com",
        role=UserRole.ADMIN,
        token_version=1,
        expires_delta=timedelta(seconds=-10),  # expired 10 seconds ago
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(expired_token)


def test_jwt_invalid_signature():
    """Verify token signed with different key raises InvalidSignatureError."""
    payload = {
        "sub": "1",
        "email": "admin@surya-energy.com",
        "role": "admin",
        "token_version": 1,
        "iat": 1000,
        "exp": 9999999999,
    }
    token = jwt.encode(
        payload,
        "different_secret_key_used_for_attack_vector_xyz",
        algorithm="HS256",
    )

    with pytest.raises(jwt.InvalidSignatureError):
        decode_access_token(token)
