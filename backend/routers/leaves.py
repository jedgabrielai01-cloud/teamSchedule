import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from backend.auth import get_current_user
from backend.db import get_db

router = APIRouter(prefix="/api/leaves")


class LeaveBody(BaseModel):
    leave_date: str
    leave_type: str | None = None


def _check_primary_conflict(db: sqlite3.Connection, name: str, date: str):
    row = db.execute(
        "SELECT id FROM support_schedule WHERE schedule_date = ? AND primary_oncall = ?",
        (date, name),
    ).fetchone()
    if row:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{name} is Primary Support on {date} and cannot take leave on that date.",
        )


@router.post("", status_code=201)
def add_leave(
    body: LeaveBody,
    user: str = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    _check_primary_conflict(db, user, body.leave_date)
    cur = db.execute(
        "INSERT INTO leaves (employee_name, leave_date, leave_type) VALUES (?, ?, ?)",
        (user, body.leave_date, body.leave_type),
    )
    db.commit()
    return {"id": cur.lastrowid, "employee_name": user, **body.model_dump()}


@router.put("/{leave_id}")
def update_leave(
    leave_id: int,
    body: LeaveBody,
    user: str = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute("SELECT * FROM leaves WHERE id = ?", (leave_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Leave not found")
    if row["employee_name"] != user:
        raise HTTPException(status_code=403, detail="Cannot modify another member's leave")
    _check_primary_conflict(db, user, body.leave_date)
    db.execute(
        "UPDATE leaves SET leave_date = ?, leave_type = ? WHERE id = ?",
        (body.leave_date, body.leave_type, leave_id),
    )
    db.commit()
    return {"id": leave_id, "employee_name": user, **body.model_dump()}


@router.delete("/{leave_id}", status_code=204)
def delete_leave(
    leave_id: int,
    user: str = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute("SELECT * FROM leaves WHERE id = ?", (leave_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Leave not found")
    if row["employee_name"] != user:
        raise HTTPException(status_code=403, detail="Cannot modify another member's leave")
    db.execute("DELETE FROM leaves WHERE id = ?", (leave_id,))
    db.commit()
