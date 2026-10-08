import pytest
from sqlalchemy import Integer, String, select
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.database import (
    close_db,
    get_async_engine,
    get_db,
    get_session_maker,
    init_db,
)
from backend.models.base import Base, TimestampMixin


class DummyItem(Base, TimestampMixin):
    """Test model to verify Base and TimestampMixin persistence."""

    __tablename__ = "test_dummy_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)


@pytest.fixture(autouse=True)
async def cleanup_db():
    """Ensure database engine is cleanly disposed between test runs."""
    yield
    await close_db()


@pytest.mark.asyncio
async def test_async_engine_connection():
    """Verify that an in-memory SQLite async engine can connect and execute queries."""
    engine = get_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.connect() as conn:
        result = await conn.execute(select(1))
        assert result.scalar() == 1
    await close_db(engine)


@pytest.mark.asyncio
async def test_session_maker_and_crud():
    """Verify session creation, table initialization, and CRUD operations."""
    engine = get_async_engine("sqlite+aiosqlite:///:memory:")
    await init_db(engine)

    session_maker = get_session_maker(engine)
    async with session_maker() as session:
        item = DummyItem(name="Solar Inverter Meter")
        session.add(item)
        await session.commit()
        await session.refresh(item)

        assert item.id is not None
        assert item.name == "Solar Inverter Meter"
        assert item.created_at is not None
        assert item.updated_at is not None

    async with session_maker() as session:
        stmt = select(DummyItem).where(DummyItem.name == "Solar Inverter Meter")
        result = await session.execute(stmt)
        found = result.scalar_one_or_none()
        assert found is not None
        assert found.name == "Solar Inverter Meter"

    await close_db(engine)


@pytest.mark.asyncio
async def test_get_db_dependency():
    """Verify the get_db FastAPI generator yields an active session."""
    engine = get_async_engine("sqlite+aiosqlite:///:memory:")
    await init_db(engine)

    gen = get_db()
    session = await anext(gen)
    assert session.is_active

    result = await session.execute(select(1))
    assert result.scalar() == 1

    # Complete the generator
    with pytest.raises(StopAsyncIteration):
        await anext(gen)

    await close_db(engine)
