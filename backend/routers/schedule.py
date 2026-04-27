import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth import get_current_user
from backend.db import get_db

router = APIRouter(prefix="/api/schedule")


class ScheduleBody(BaseModel):
    primary_oncall: str


@router.put("/{schedule_date}")
def update_schedule(
    schedule_date: str,
    body: ScheduleBody,
    user: str = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute(
        "SELECT * FROM support_schedule WHERE schedule_date = ?", (schedule_date,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Schedule not found for that date")
    db.execute(
        "UPDATE support_schedule SET primary_oncall = ? WHERE schedule_date = ?",
        (body.primary_oncall, schedule_date),
    )
    db.commit()
    updated = db.execute(
        "SELECT * FROM support_schedule WHERE schedule_date = ?", (schedule_date,)
    ).fetchone()
    return dict(updated)
