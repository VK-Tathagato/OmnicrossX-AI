"""
FastAPI Main Application — OmniX AI Backend
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.utils.dependencies import init_dependencies
from app.routes import research, solutions, chat

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ─── Rate Limiter ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


# ─── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize dependencies on startup, clean up on shutdown."""
    logger.info("🚀 OmniX AI Backend starting...")
    await init_dependencies()
    logger.info("✅ Dependencies initialized")
    yield
    logger.info("🛑 OmniX AI Backend shutting down")


# ─── App Factory ──────────────────────────────────────────────────────────────
def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="OmniX AI — Scientific Research Assistant API",
        description="AI-powered RAG pipeline for scientific problem solving",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Exception Handlers ────────────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        origin = request.headers.get("origin")
        headers = {}
        if origin in settings.allowed_origins_list or "*" in settings.allowed_origins_list:
            headers["Access-Control-Allow-Origin"] = origin
            headers["Access-Control-Allow-Credentials"] = "true"
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error", "message": str(exc)},
            headers=headers
        )

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── Routes ────────────────────────────────────────────────────────────────
    app.include_router(research.router)
    app.include_router(solutions.router)
    app.include_router(chat.router)

    # ── Health ────────────────────────────────────────────────────────────────
    @app.get("/health")
    async def health():
        return {
            "status": "healthy",
            "version": "1.0.0",
            "environment": settings.environment,
        }

    return app


app = create_app()
