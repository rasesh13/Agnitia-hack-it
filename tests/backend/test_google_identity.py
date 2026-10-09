"""Google Sign-In ID token verification: signature, audience, issuer, expiry, email."""

import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from backend.services.google_identity import GoogleTokenError, verify_google_id_token

CLIENT_ID = "1234567890-test.apps.googleusercontent.com"

google_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
attacker_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class FakeGoogleJwks:
    """Stands in for Google's JWKS endpoint, serving the test 'Google' public key."""

    def get_signing_key_from_jwt(self, _token: str):
        return SimpleNamespace(key=google_key.public_key())


def make_token(key=google_key, **overrides) -> str:
    now = int(time.time())
    claims = {
        "iss": "https://accounts.google.com",
        "aud": CLIENT_ID,
        "sub": "109876543210",
        "email": "Student@Prestige.edu.in",
        "email_verified": True,
        "iat": now,
        "exp": now + 600,
        **overrides,
    }
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test-key"})


def verify(token: str):
    return verify_google_id_token(token, CLIENT_ID, jwks_client=FakeGoogleJwks())


def test_accepts_a_genuine_google_token():
    identity = verify(make_token())
    assert identity.sub == "109876543210"
    assert identity.email == "student@prestige.edu.in"


def test_rejects_a_forged_token_signed_by_another_key():
    with pytest.raises(GoogleTokenError):
        verify(make_token(key=attacker_key, email="admin@prestige.edu.in"))


def test_rejects_a_token_for_another_client():
    with pytest.raises(GoogleTokenError):
        verify(make_token(aud="someone-else.apps.googleusercontent.com"))


def test_rejects_a_token_not_issued_by_google():
    with pytest.raises(GoogleTokenError):
        verify(make_token(iss="https://evil.example.com"))


def test_rejects_an_unverified_email():
    with pytest.raises(GoogleTokenError):
        verify(make_token(email_verified=False))


def test_rejects_an_expired_token():
    past = int(time.time()) - 3600
    with pytest.raises(GoogleTokenError):
        verify(make_token(iat=past - 600, exp=past))
