from contextlib import asynccontextmanager
import os
import re

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.responses import Response

from app.routers import admin, dots_leaderboard, health, members, pr_board, sync
from app.scheduler import start_scheduler, stop_scheduler

load_dotenv()


def _normalize_origin(origin: str) -> str:
    value = origin.strip().strip('"').strip("'").rstrip("/")
    return value


def _cors_origins() -> list[str]:
    origins: list[str] = []
    raw = os.environ.get("CORS_ORIGINS")
    if raw:
        origins.extend(_normalize_origin(part) for part in raw.split(",") if part.strip())

    frontend_url = os.environ.get("FRONTEND_URL")
    if frontend_url:
        origins.append(_normalize_origin(frontend_url))

    if not origins:
        origins = [
            "http://localhost:5173",
            "http://localhost:5174",
            "https://gym-board-weld.vercel.app",
        ]

    return list(dict.fromkeys(origins))


def _cors_origin_regex() -> str | None:
    value = os.environ.get("CORS_ORIGIN_REGEX")
    if value is None:
        return r"https://([a-z0-9-]+\.)*vercel\.app"
    value = value.strip()
    return value or None


def _origin_allowed(origin: str) -> bool:
    normalized = _normalize_origin(origin)
    if normalized in _cors_origins():
        return True
    pattern = _cors_origin_regex()
    return bool(pattern and re.fullmatch(pattern, normalized))


def _apply_cors_headers(request: Request, response: Response) -> Response:
    origin = request.headers.get("origin")
    if origin and _origin_allowed(origin):
        response.headers["Access-Control-Allow-Origin"] = _normalize_origin(origin)
        response.headers["Access-Control-Allow-Credentials"] = "true"
        vary = response.headers.get("Vary")
        response.headers["Vary"] = "Origin" if not vary else f"{vary}, Origin"
    return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Fullstack API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_origin_regex=_cors_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def ensure_cors_on_error_responses(request: Request, call_next):
    try:
        response = await call_next(request)
    except Exception:
        response = JSONResponse(status_code=500, content={"detail": "Internal server error"})
    return _apply_cors_headers(request, response)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    response = JSONResponse(status_code=500, content={"detail": "Internal server error"})
    return _apply_cors_headers(request, response)

app.include_router(health.router)
app.include_router(members.router)
app.include_router(pr_board.router)
app.include_router(dots_leaderboard.router)
app.include_router(sync.router)
app.include_router(admin.router)


@app.get("/")
async def root():
    return {"message": "Welcome to the Fullstack API"}
