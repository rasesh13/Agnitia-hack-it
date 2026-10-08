from collections.abc import AsyncGenerator
from typing import Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from backend.config import get_settings
from backend.models.base import Base

_engine: Optional[AsyncEngine] = None
_session_maker: Optional[async_sessionmaker[AsyncSession]] = None


def get_async_engine(db_url: Optional[str] = None) -> AsyncEngine:
    """Returns or creates the global async SQLAlchemy engine singleton."""
    global _engine
    if _engine is None or db_url is not None:
        url = db_url or get_settings().DATABASE_URL
        # Set connect_args for SQLite if applicable
        connect_args = {"check_same_thread": False} if "sqlite" in url else {}
        engine = create_async_engine(
            url,
            echo=False,
            future=True,
            connect_args=connect_args,
            pool_pre_ping=True,
        )
        if db_url is None:
            _engine = engine
        return engine
    return _engine


def get_session_maker(
    engine: Optional[AsyncEngine] = None,
) -> async_sessionmaker[AsyncSession]:
    """Returns or creates the async session factory."""
    global _session_maker
    eng = engine or get_async_engine()
    if _session_maker is None or engine is not None:
        maker = async_sessionmaker(
            bind=eng,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
            autocommit=False,
        )
        if engine is None:
            _session_maker = maker
        return maker
    return _session_maker


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for yielding an asynchronous database session."""
    session_factory = get_session_maker()
    async with session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db(engine: Optional[AsyncEngine] = None) -> None:
    """Creates database tables for local testing."""
    eng = engine or get_async_engine()
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db(engine: Optional[AsyncEngine] = None) -> None:
    """Disposes database engine connections."""
    global _engine, _session_maker
    eng = engine or _engine
    if eng is not None:
        await eng.dispose()
    if engine is None:
        _engine = None
        _session_maker = None
