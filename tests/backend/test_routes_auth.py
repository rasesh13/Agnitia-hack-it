import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from backend.api.rate_limit import rate_limiter
from backend.db.database import get_db
from backend.main import create_app
from backend.models.base import Base
from backend.models.user import UserRole


@pytest.fixture
async def test_app():
    """Creates an isolated test application with an in-memory SQLite database using StaticPool."""
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async def override_get_db():
        async with session_maker() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app = create_app()
    app.dependency_overrides[get_db] = override_get_db
    rate_limiter.reset()

    yield app

    await engine.dispose()
    rate_limiter.reset()


@pytest.mark.asyncio
async def test_auth_signup_flow(test_app):
    """Verify signup flow, first user admin promotion, and second user default viewer role."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Sign up first user (should be ADMIN)
        res1 = await client.post(
            "/api/v1/auth/signup",
            json={"email": "admin@surya-energy.com", "password": "StrongPassword123!"},
        )
        assert res1.status_code == 201
        data1 = res1.json()
        assert "access_token" in data1
        assert data1["user"]["email"] == "admin@surya-energy.com"
        assert data1["user"]["role"] == UserRole.ADMIN.value

        # 2. Sign up second user (should be VIEWER)
        res2 = await client.post(
            "/api/v1/auth/signup",
            json={"email": "operator@surya-energy.com", "password": "StrongPassword123!"},
        )
        assert res2.status_code == 201
        data2 = res2.json()
        assert data2["user"]["role"] == UserRole.VIEWER.value

        # 3. Duplicate email rejection
        res3 = await client.post(
            "/api/v1/auth/signup",
            json={"email": "admin@surya-energy.com", "password": "AnotherPassword123!"},
        )
        assert res3.status_code == 409
        assert res3.json()["error"]["code"] == "USER_ALREADY_EXISTS"


@pytest.mark.asyncio
async def test_auth_login_and_me_endpoints(test_app):
    """Verify login validation, profile retrieval via /me, and invalid credentials handling."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        await client.post(
            "/api/v1/auth/signup",
            json={"email": "ops@surya-energy.com", "password": "SecurePassword123!"},
        )

        # Valid login
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "ops@surya-energy.com", "password": "SecurePassword123!"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]

        # Call /me with valid token
        me_res = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_res.status_code == 200
        assert me_res.json()["email"] == "ops@surya-energy.com"

        # Invalid login
        bad_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "ops@surya-energy.com", "password": "WrongPassword!"},
        )
        assert bad_login.status_code == 401
        assert bad_login.json()["error"]["code"] == "INVALID_CREDENTIALS"

        # Unauthenticated /me call
        no_auth_res = await client.get("/api/v1/auth/me")
        assert no_auth_res.status_code == 401
        assert no_auth_res.json()["error"]["code"] == "AUTH_REQUIRED"


@pytest.mark.asyncio
async def test_logout_revokes_token(test_app):
    """Verify that calling logout increments token_version and invalidates old token."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        signup_res = await client.post(
            "/api/v1/auth/signup",
            json={"email": "revoketest@surya-energy.com", "password": "SecurePassword123!"},
        )
        token = signup_res.json()["access_token"]

        # Logout to revoke token
        logout_res = await client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert logout_res.status_code == 200

        # Subsequent request with old token must be rejected as revoked
        me_res = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_res.status_code == 401
        assert me_res.json()["error"]["code"] == "AUTH_TOKEN_REVOKED"


@pytest.mark.asyncio
async def test_ip_rate_limiting(test_app):
    """Verify rate limiter blocks bursts exceeding limit."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Signup has limit of 10 requests per minute
        for i in range(10):
            await client.post(
                "/api/v1/auth/signup",
                json={"email": f"user{i}@surya-energy.com", "password": "Password123!"},
            )

        # 11th request must be blocked
        blocked_res = await client.post(
            "/api/v1/auth/signup",
            json={"email": "overflow@surya-energy.com", "password": "Password123!"},
        )
        assert blocked_res.status_code == 429
        assert blocked_res.json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"
