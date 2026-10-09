from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

from backend.api.middleware import (
    RequestCorrelationMiddleware,
    register_exception_handlers,
)
from backend.api.routes_auth import router as auth_router
from backend.api.routes_control import router as control_router
from backend.api.routes_decisions import router as decisions_router
from backend.api.routes_export import router as export_router
from backend.api.routes_forecast import router as forecast_router
from backend.api.routes_health import router as health_router, set_global_scheduler
from backend.api.routes_settings import router as settings_router
from backend.api.routes_twin import router as twin_router
from backend.config import get_settings
from backend.core.logging import setup_logging
from backend.db.database import close_db, get_session_maker, init_db
from backend.db.seed_demo_data import seed_prestige_microgrid
from backend.services.ml_microgrid_sync import ml_sync_service
from backend.services.scheduler import DecisionScheduler
from backend.ws import ws_manager
from backend.ws.routes_ws import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown hooks."""
    settings = get_settings()
    setup_logging()

    # Development creates tables directly; other environments are migrated by Alembic.
    if settings.ENVIRONMENT in {"development", "test"}:
        await init_db()
    # Seed the Prestige University microgrid in development, or on demo deployments.
    if settings.ENVIRONMENT in {"development", "test"} or settings.SEED_DEMO_DATA:
        session_factory = get_session_maker()
        async with session_factory() as session:
            await seed_prestige_microgrid(session)

    # Initialize and register continuous background optimization scheduler
    session_factory = get_session_maker()
    scheduler = DecisionScheduler(
        session_factory=session_factory,
        settings=settings,
        broadcast_callback=ws_manager.broadcast,
    )
    set_global_scheduler(scheduler)
    scheduler.start()

    # Start continuous real-time weather & ML model streaming (3.0s cadence, no demo values)
    ml_sync_service.start_background_streaming(
        session_factory=session_factory,
        interval_seconds=3.0,
        site_id=1,
        region_id="central_india_mp_indore",
    )

    yield

    ml_sync_service.stop_background_streaming()
    await scheduler.stop()
    await close_db()


def create_app() -> FastAPI:
    """FastAPI application factory for SURYA Operations Platform."""
    settings = get_settings()

    app = FastAPI(
        title="SURYA Operations Platform API",
        description="Smart Unified Renewable Yield Automation for Campus Microgrids",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
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
        # Lets the browser read the report filename on cross-origin downloads.
        expose_headers=["Content-Disposition"],
    )

    # 3. Register standard SURYA exception handlers
    register_exception_handlers(app)

    # 4. Root interactive landing page & API directory
    @app.get("/", tags=["Root"], include_in_schema=False)
    async def root_index(request: Request):
        """Root interactive landing page for humans and JSON metadata for API consumers."""
        if "application/json" in request.headers.get("accept", ""):
            return JSONResponse({
                "service": "SURYA Operations Platform API",
                "version": "0.1.0",
                "status": "operational",
                "environment": settings.ENVIRONMENT,
                "docs_url": "/docs",
                "redoc_url": "/redoc",
                "health_url": "/health",
                "frontend_console": "https://surya-sim.vercel.app",
            })

        html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SURYA Platform Engine — Production Backend API</title>
  <link rel="icon" type="image/svg+xml" href="https://surya-sim.vercel.app/surya-mark.svg">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #030712;
      color: #f3f4f6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2.5rem 1rem;
    }
    .container { max-width: 960px; width: 100%; }
    .header {
      text-align: center;
      margin-bottom: 2.5rem;
      padding: 2.5rem 2rem;
      background: radial-gradient(circle at 50% 0%, rgba(245, 158, 11, 0.18), transparent 70%);
      border-radius: 1.5rem;
      border: 1px solid rgba(245, 158, 11, 0.25);
    }
    .logo {
      font-size: 3.25rem;
      margin-bottom: 0.5rem;
      display: inline-block;
      filter: drop-shadow(0 0 24px rgba(245, 158, 11, 0.7));
    }
    h1 {
      font-size: 2.25rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      background: linear-gradient(to right, #fbbf24, #f59e0b, #10b981);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      color: #9ca3af;
      font-size: 0.95rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 1.25rem;
    }
    .badge-live {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #34d399;
      padding: 0.45rem 1.2rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .pulse {
      width: 9px;
      height: 9px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 12px #10b981;
      animation: pulse-dot 1.5s infinite;
    }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.3; transform: scale(1.3); }
    }
    .actions {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 1rem;
      margin-bottom: 2.5rem;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.9rem 1.25rem;
      border-radius: 0.85rem;
      font-weight: 700;
      font-size: 0.9rem;
      text-decoration: none;
      transition: all 0.2s ease;
      text-align: center;
    }
    .btn-primary {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #030712;
      box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(245, 158, 11, 0.45);
    }
    .btn-secondary {
      background: #111827;
      color: #f3f4f6;
      border: 1px solid #374151;
    }
    .btn-secondary:hover {
      background: #1f2937;
      border-color: #4b5563;
      transform: translateY(-2px);
    }
    .btn-emerald {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.35);
    }
    .btn-emerald:hover {
      background: rgba(16, 185, 129, 0.25);
      transform: translateY(-2px);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2.5rem;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 1rem;
      padding: 1.25rem;
    }
    .card-title {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #9ca3af;
      margin-bottom: 0.5rem;
    }
    .card-val {
      font-size: 1.25rem;
      font-weight: 700;
      color: #f9fafb;
    }
    .card-sub {
      font-size: 0.8rem;
      color: #6b7280;
      margin-top: 0.35rem;
    }
    .endpoints-card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 1rem;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .endpoints-title {
      font-size: 1.15rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: #f3f4f6;
    }
    .endpoint-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 0;
      border-bottom: 1px solid #1f2937;
      font-size: 0.875rem;
    }
    .endpoint-row:last-child { border-bottom: none; }
    .method {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 0.375rem;
      font-size: 0.7rem;
      font-weight: 700;
      margin-right: 0.5rem;
    }
    .method-get { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
    .method-post { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .method-ws { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
    .path { font-family: monospace; color: #e5e7eb; }
    .desc a { color: #60a5fa; text-decoration: none; }
    .desc a:hover { text-decoration: underline; }
    footer {
      text-align: center;
      color: #6b7280;
      font-size: 0.8rem;
      margin-top: auto;
      padding-top: 2rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">⚡</div>
      <h1>SURYA Operations Platform API</h1>
      <div class="subtitle">Smart Unified Renewable Yield Automation · Production Backend</div>
      <div class="badge-live">
        <span class="pulse"></span>
        <span>PRODUCTION ENGINE ONLINE & HEALTHY</span>
      </div>
    </div>

    <div class="actions">
      <a href="/docs" class="btn btn-primary">📖 Interactive API Docs (Swagger)</a>
      <a href="/redoc" class="btn btn-secondary">📚 ReDoc Documentation</a>
      <a href="/health" class="btn btn-secondary">🩺 System Health Check</a>
      <a href="https://surya-sim.vercel.app" target="_blank" class="btn btn-emerald">🖥️ Open Vercel Web Console →</a>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-title">Database Interconnection</div>
        <div class="card-val">PostgreSQL 16</div>
        <div class="card-sub">Connected via AsyncPG & Alembic</div>
      </div>
      <div class="card">
        <div class="card-title">Campus Digital Twin</div>
        <div class="card-val">Prestige University, Indore</div>
        <div class="card-sub">Malwa Microgrid (300kW Solar + 120kW Wind)</div>
      </div>
      <div class="card">
        <div class="card-title">Autonomous Optimization</div>
        <div class="card-val">Active (10s Cadence)</div>
        <div class="card-sub">Closed-loop dispatch & reserve guard</div>
      </div>
      <div class="card">
        <div class="card-title">ML Forecasting Engine</div>
        <div class="card-val">LightGBM & XGBoost</div>
        <div class="card-sub">48H P10/P50/P90 Multi-Horizon Quantiles</div>
      </div>
    </div>

    <div class="endpoints-card">
      <div class="endpoints-title">Core Service Endpoints (Click to test directly)</div>
      <div class="endpoint-row">
        <div><span class="method method-get">GET</span><span class="path">/health</span></div>
        <div class="desc"><a href="/health">Health & Readiness Probe</a></div>
      </div>
      <div class="endpoint-row">
        <div><span class="method method-get">GET</span><span class="path">/docs</span></div>
        <div class="desc"><a href="/docs">Interactive Swagger UI Playground</a></div>
      </div>
      <div class="endpoint-row">
        <div><span class="method method-get">GET</span><span class="path">/api/v1/forecast/48h</span></div>
        <div class="desc"><a href="/api/v1/forecast/48h?region_id=central_india_mp_indore">48-Hour Renewable Forecast (Indore)</a></div>
      </div>
      <div class="endpoint-row">
        <div><span class="method method-get">GET</span><span class="path">/api/v1/forecast/regions</span></div>
        <div class="desc"><a href="/api/v1/forecast/regions">Available Regional Microgrid Profiles</a></div>
      </div>
      <div class="endpoint-row">
        <div><span class="method method-get">GET</span><span class="path">/api/v1/twin/live?site_id=1</span></div>
        <div class="desc"><a href="/api/v1/twin/live?site_id=1">Live Campus Microgrid Telemetry</a></div>
      </div>
      <div class="endpoint-row">
        <div><span class="method method-post">POST</span><span class="path">/api/v1/auth/login</span></div>
        <div class="desc">JWT Credentials Authentication</div>
      </div>
      <div class="endpoint-row">
        <div><span class="method method-post">POST</span><span class="path">/api/v1/auth/google</span></div>
        <div class="desc">Google OAuth 2.0 Identity Token Exchange</div>
      </div>
      <div class="endpoint-row">
        <div><span class="method method-ws">WS</span><span class="path">/ws</span></div>
        <div class="desc">Real-time Telemetry WebSocket Broadcast</div>
      </div>
    </div>

    <footer>
      SURYA Operations Platform &copy; 2026 &bull; Agnitia Hackathon
    </footer>
  </div>
</body>
</html>"""
        return HTMLResponse(content=html)

    # 5. Mount API & WebSocket Routers
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(twin_router)
    app.include_router(decisions_router)
    app.include_router(settings_router)
    app.include_router(control_router)
    app.include_router(export_router)
    app.include_router(forecast_router)
    app.include_router(ws_router)

    return app


app = create_app()
