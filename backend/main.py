from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.db import init_db
from backend.routers import admin, ai, auth, calendar, holidays, leaves, schedule

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(calendar.router)
app.include_router(leaves.router)
app.include_router(schedule.router)
app.include_router(holidays.router)
app.include_router(ai.router)
app.include_router(admin.router)


@app.on_event("startup")
def on_startup():
    init_db()


STATIC_DIR = Path(__file__).parent.parent / "frontend" / "out"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
