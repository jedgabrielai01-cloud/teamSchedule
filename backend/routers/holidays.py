import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth import get_current_user
from backend.db import get_db

router = APIRouter(prefix="/api/holidays")


class HolidayBody(BaseModel):
    holiday_date: str
    description: str | None = None
    location: str | None = None


@router.post("", status_code=201)
def add_holiday(
    body: HolidayBody,
    user: str = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.execute(
        "INSERT INTO public_holidays (holiday_date, description, location) VALUES (?, ?, ?)",
        (body.holiday_date, body.description, body.location),
    )
    db.commit()
    return {"id": cur.lastrowid, **body.model_dump()}


@router.put("/{holiday_id}")
def update_holiday(
    holiday_id: int,
    body: HolidayBody,
    user: str = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute("SELECT id FROM public_holidays WHERE id = ?", (holiday_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.execute(
        "UPDATE public_holidays SET holiday_date = ?, description = ?, location = ? WHERE id = ?",
        (body.holiday_date, body.description, body.location, holiday_id),
    )
    db.commit()
    return {"id": holiday_id, **body.model_dump()}


@router.delete("/{holiday_id}", status_code=204)
def delete_holiday(
    holiday_id: int,
    user: str = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute("SELECT id FROM public_holidays WHERE id = ?", (holiday_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.execute("DELETE FROM public_holidays WHERE id = ?", (holiday_id,))
    db.commit()
