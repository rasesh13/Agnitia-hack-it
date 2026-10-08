from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.middleware import (
    RequestCorrelationMiddleware,
    register_exception_handlers,
)
from backend.api.routes_auth import router as auth_router
from backend.config import get_settings
from backend.core.logging import setup_logging
from backend.db.database import close_db, init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown hooks."""
    settings = get_settings()
    setup_logging()

    # Initialize DB in development if needed
    if settings.ENVIRONMENT in {"development", "test"}:
        await init_db()

    yield

    await close_db()


def create_app() -> FastAPI:
    """FastAPI application factory for SURYA Operations Platform."""
    settings = get_settings()

    app = FastAPI(
        title="SURYA Operations Platform API",
        description="Smart Unified Renewable Yield Automation for Campus Microgrids",
        version="0.1.0",
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )

    # 1. Register Request Correlation Middleware
    app.add_middleware(RequestCorrelationMiddleware)

    # 2. Configure CORS
    cors_origins = (
        settings.CORS_ORIGINS
        if isinstance(settings.CORS_ORIGINS, list)
        else [settings.CORS_ORIGINS]
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 3. Register standard SURYA exception handlers
    register_exception_handlers(app)

    # 4. Mount API Routers
    app.include_router(auth_router)

    return app


app = create_app()
