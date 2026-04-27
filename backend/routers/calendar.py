import sqlite3

from fastapi import APIRouter, Depends, Query

from backend.auth import get_current_user
from backend.db import get_db

router = APIRouter(prefix="/api/calendar")


@router.get("")
def get_calendar(
    month: str = Query(..., description="YYYY-MM"),
    user: str = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    start = f"{month}-01"
    # Compute last day by going to next month day 0
    year, m = int(month[:4]), int(month[5:7])
    if m == 12:
        end = f"{year + 1}-01-01"
    else:
        end = f"{year}-{m + 1:02d}-01"

    leaves = [
        dict(r)
        for r in db.execute(
            "SELECT * FROM leaves WHERE leave_date >= ? AND leave_date < ?",
            (start, end),
        )
    ]
    schedule = [
        dict(r)
        for r in db.execute(
            "SELECT * FROM support_schedule WHERE schedule_date >= ? AND schedule_date < ?",
            (start, end),
        )
    ]
    holidays = [
        dict(r)
        for r in db.execute(
            "SELECT * FROM public_holidays WHERE holiday_date >= ? AND holiday_date < ?",
            (start, end),
        )
    ]

    return {"leaves": leaves, "schedule": schedule, "holidays": holidays}
