from contextlib import asynccontextmanager
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin, dots_leaderboard, health, members, pr_board, sync
from app.scheduler import start_scheduler, stop_scheduler

load_dotenv()


def _cors_origins() -> list[str]:
    raw = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174",
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Fullstack API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(members.router)
app.include_router(pr_board.router)
app.include_router(dots_leaderboard.router)
app.include_router(sync.router)
app.include_router(admin.router)


@app.get("/")
async def root():
    return {"message": "Welcome to the Fullstack API"}
