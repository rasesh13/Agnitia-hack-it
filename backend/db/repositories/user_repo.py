from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.user import User, UserRole


class UserRepository:
    """Repository handling asynchronous database operations for User records."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, user_id: int) -> Optional[User]:
        """Fetch user by primary key ID."""
        stmt = select(User).where(User.id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        """Fetch user by unique email address (case-insensitive)."""
        stmt = select(User).where(func.lower(User.email) == func.lower(email))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_google_sub(self, google_sub: str) -> Optional[User]:
        """Fetch user by Google OAuth subject identifier."""
        stmt = select(User).where(User.google_sub == google_sub)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def count_users(self) -> int:
        """Returns total number of registered users."""
        stmt = select(func.count(User.id))
        result = await self.session.execute(stmt)
        return result.scalar_one() or 0

    async def create_user(
        self,
        email: str,
        password_hash: Optional[str] = None,
        google_sub: Optional[str] = None,
        role: UserRole = UserRole.VIEWER,
    ) -> User:
        """Creates and persists a new User."""
        user = User(
            email=email.strip().lower(),
            password_hash=password_hash,
            google_sub=google_sub,
            role=role,
            is_active=True,
            token_version=1,
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def increment_token_version(self, user: User) -> User:
        """Increments token version to revoke all existing sessions."""
        user.token_version += 1
        await self.session.commit()
        await self.session.refresh(user)
        return user
