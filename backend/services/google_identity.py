"""
Verification of Google Sign-In ID tokens.

Tokens are RS256 JWTs signed by Google. A token is accepted only when its signature
checks out against Google's published keys and its audience, issuer, expiry and
email-verification claims are valid; decoding without the signature check would let
anyone forge a token for any email address.
"""

import asyncio
from dataclasses import dataclass
from functools import lru_cache

import jwt
from jwt import PyJWKClient

GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")


class GoogleTokenError(ValueError):
    """Raised when a Google ID token fails verification."""


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    # PyJWKClient caches Google's signing keys and refreshes them on unknown key ids.
    return PyJWKClient(GOOGLE_CERTS_URL, cache_keys=True, lifespan=6 * 3600)


def verify_google_id_token(
    id_token: str, client_id: str, jwks_client: PyJWKClient | None = None
) -> GoogleIdentity:
    """Verifies a Google ID token synchronously and returns the account identity."""
    try:
        signing_key = (jwks_client or _jwks_client()).get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=client_id,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError as err:
        raise GoogleTokenError(f"Invalid Google ID token: {err}") from err

    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise GoogleTokenError("Token was not issued by Google")
    email = claims.get("email")
    if not email or claims.get("email_verified") is not True:
        raise GoogleTokenError("Google account email is missing or unverified")
    return GoogleIdentity(sub=str(claims["sub"]), email=str(email).lower())


async def verify_google_id_token_async(id_token: str, client_id: str) -> GoogleIdentity:
    """Runs verification off the event loop, since fetching Google's keys is blocking I/O."""
    return await asyncio.to_thread(verify_google_id_token, id_token, client_id)
