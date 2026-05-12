import csv
import io
import sqlite3
from datetime import date

import bcrypt
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from backend.auth import get_current_admin
from backend.db import get_db

router = APIRouter(prefix="/admin")

_LEAVE_COLS = {"employee_name", "leave_date", "leave_type"}
_SCHED_COLS = {
    "schedule_date", "primary_oncall", "secondary_oncall",
    "backup_oncall", "onshore_oncall", "comments",
}


def _validate_date(val: str, field: str, row_num: int) -> str | None:
    try:
        date.fromisoformat(val.strip())
        return None
    except ValueError:
        return f"Row {row_num}: invalid date '{val}' in field '{field}'"


def _parse_leave_csv(content: str) -> tuple[list[dict], list[str]]:
    errors: list[str] = []
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        return [], ["File is empty or missing a header row"]
    missing = _LEAVE_COLS - {f.strip() for f in reader.fieldnames}
    if missing:
        return [], [
            f"Missing required columns: {', '.join(sorted(missing))}. "
            "Expected: employee_name, leave_date, leave_type"
        ]
    rows: list[dict] = []
    for i, row in enumerate(reader, start=2):
        name = (row.get("employee_name") or "").strip()
        leave_date = (row.get("leave_date") or "").strip()
        leave_type = (row.get("leave_type") or "").strip() or None
        if not name:
            errors.append(f"Row {i}: employee_name is empty")
            continue
        if not leave_date:
            errors.append(f"Row {i}: leave_date is empty")
            continue
        err = _validate_date(leave_date, "leave_date", i)
        if err:
            errors.append(err)
            continue
        rows.append({"employee_name": name, "leave_date": leave_date, "leave_type": leave_type})
    return rows, errors


def _parse_schedule_csv(content: str) -> tuple[list[dict], list[str]]:
    errors: list[str] = []
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        return [], ["File is empty or missing a header row"]
    missing = _SCHED_COLS - {f.strip() for f in reader.fieldnames}
    if missing:
        return [], [
            f"Missing required columns: {', '.join(sorted(missing))}. "
            "Expected: schedule_date, primary_oncall, secondary_oncall, backup_oncall, onshore_oncall, comments"
        ]
    rows: list[dict] = []
    for i, row in enumerate(reader, start=2):
        sched_date = (row.get("schedule_date") or "").strip()
        if not sched_date:
            errors.append(f"Row {i}: schedule_date is empty")
            continue
        err = _validate_date(sched_date, "schedule_date", i)
        if err:
            errors.append(err)
            continue
        rows.append({
            "schedule_date": sched_date,
            "primary_oncall": (row.get("primary_oncall") or "").strip() or None,
            "secondary_oncall": (row.get("secondary_oncall") or "").strip() or None,
            "backup_oncall": (row.get("backup_oncall") or "").strip() or None,
            "onshore_oncall": (row.get("onshore_oncall") or "").strip() or None,
            "comments": (row.get("comments") or "").strip() or None,
        })
    return rows, errors


class MemberBody(BaseModel):
    name: str


@router.get("/members")
def list_members(
    _: str = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    today = date.today().isoformat()
    rows = db.execute(
        "SELECT id, username FROM users WHERE username != 'Admin' ORDER BY username"
    ).fetchall()
    result = []
    for row in rows:
        is_primary = db.execute(
            "SELECT COUNT(*) FROM support_schedule "
            "WHERE primary_oncall = ? AND schedule_date >= ?",
            (row["username"], today),
        ).fetchone()[0] > 0
        result.append({"id": row["id"], "name": row["username"], "is_primary_support": is_primary})
    return result


@router.post("/members", status_code=201)
def add_member(
    body: MemberBody,
    _: str = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    if db.execute("SELECT id FROM users WHERE username = ?", (name,)).fetchone():
        raise HTTPException(status_code=409, detail=f"Member '{name}' already exists")
    hashed = bcrypt.hashpw(b"RSD", bcrypt.gensalt()).decode()
    cur = db.execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)", (name, hashed)
    )
    db.commit()
    return {"id": cur.lastrowid, "name": name}


@router.put("/members/{member_id}")
def update_member(
    member_id: int,
    body: MemberBody,
    _: str = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    new_name = body.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    row = db.execute("SELECT username FROM users WHERE id = ?", (member_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")
    old_name = row["username"]
    if old_name == "Admin":
        raise HTTPException(status_code=400, detail="Cannot modify Admin")
    if db.execute(
        "SELECT id FROM users WHERE username = ? AND id != ?", (new_name, member_id)
    ).fetchone():
        raise HTTPException(status_code=409, detail=f"Member '{new_name}' already exists")

    db.execute("UPDATE users SET username = ? WHERE id = ?", (new_name, member_id))
    db.execute("UPDATE leaves SET employee_name = ? WHERE employee_name = ?", (new_name, old_name))
    for col in ("primary_oncall", "secondary_oncall", "backup_oncall", "onshore_oncall"):
        db.execute(
            f"UPDATE support_schedule SET {col} = ? WHERE {col} = ?",  # noqa: S608
            (new_name, old_name),
        )
    db.commit()
    return {"id": member_id, "name": new_name}


@router.delete("/members/{member_id}", status_code=204)
def delete_member(
    member_id: int,
    _: str = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute("SELECT username FROM users WHERE id = ?", (member_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")
    username = row["username"]
    if username == "Admin":
        raise HTTPException(status_code=400, detail="Cannot delete Admin")

    today = date.today().isoformat()
    future_primary = db.execute(
        "SELECT COUNT(*) FROM support_schedule WHERE primary_oncall = ? AND schedule_date >= ?",
        (username, today),
    ).fetchone()[0]
    if future_primary > 0:
        raise HTTPException(
            status_code=409,
            detail=(
                f"'{username}' is assigned as Primary Support on {future_primary} future date(s). "
                "Reassign their Primary Support entries before deleting."
            ),
        )

    db.execute("DELETE FROM users WHERE id = ?", (member_id,))
    db.commit()


@router.post("/upload")
async def upload_csv(
    confirm: bool = Form(False),
    leave_file: UploadFile | None = File(None),
    schedule_file: UploadFile | None = File(None),
    _: str = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    if not leave_file and not schedule_file:
        raise HTTPException(status_code=400, detail="At least one CSV file is required")

    all_errors: list[str] = []
    leave_rows: list[dict] = []
    sched_rows: list[dict] = []

    if leave_file:
        content = (await leave_file.read()).decode("utf-8-sig")
        rows, errors = _parse_leave_csv(content)
        if errors:
            all_errors.extend(f"[Leave CSV] {e}" for e in errors)
        else:
            leave_rows = rows

    if schedule_file:
        content = (await schedule_file.read()).decode("utf-8-sig")
        rows, errors = _parse_schedule_csv(content)
        if errors:
            all_errors.extend(f"[Schedule CSV] {e}" for e in errors)
        else:
            sched_rows = rows

    if all_errors:
        return {"status": "validation_error", "errors": all_errors}

    if not confirm:
        overlap_leave: list[str] = []
        overlap_sched: list[str] = []

        if leave_rows:
            dates = list({r["leave_date"] for r in leave_rows})
            ph = ",".join("?" * len(dates))
            overlap_leave = [
                r["leave_date"]
                for r in db.execute(
                    f"SELECT DISTINCT leave_date FROM leaves WHERE leave_date IN ({ph})", dates
                ).fetchall()
            ]

        if sched_rows:
            dates = list({r["schedule_date"] for r in sched_rows})
            ph = ",".join("?" * len(dates))
            overlap_sched = [
                r["schedule_date"]
                for r in db.execute(
                    f"SELECT DISTINCT schedule_date FROM support_schedule "
                    f"WHERE schedule_date IN ({ph})",
                    dates,
                ).fetchall()
            ]

        if overlap_leave or overlap_sched:
            return {
                "status": "overlap_warning",
                "overlap_leave_dates": overlap_leave,
                "overlap_schedule_dates": overlap_sched,
            }

    inserted_leaves = 0
    inserted_schedule = 0

    if leave_rows:
        dates = list({r["leave_date"] for r in leave_rows})
        ph = ",".join("?" * len(dates))
        db.execute(f"DELETE FROM leaves WHERE leave_date IN ({ph})", dates)
        for r in leave_rows:
            db.execute(
                "INSERT INTO leaves (employee_name, leave_date, leave_type) VALUES (?, ?, ?)",
                (r["employee_name"], r["leave_date"], r["leave_type"]),
            )
        inserted_leaves = len(leave_rows)

    if sched_rows:
        dates = list({r["schedule_date"] for r in sched_rows})
        ph = ",".join("?" * len(dates))
        db.execute(f"DELETE FROM support_schedule WHERE schedule_date IN ({ph})", dates)
        for r in sched_rows:
            db.execute(
                "INSERT INTO support_schedule "
                "(schedule_date, primary_oncall, secondary_oncall, backup_oncall, onshore_oncall, comments) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (r["schedule_date"], r["primary_oncall"], r["secondary_oncall"],
                 r["backup_oncall"], r["onshore_oncall"], r["comments"]),
            )
        inserted_schedule = len(sched_rows)

    db.commit()
    return {
        "status": "success",
        "inserted_leaves": inserted_leaves,
        "inserted_schedule": inserted_schedule,
    }


class AdminLeaveBody(BaseModel):
    employee_name: str
    leave_date: str
    leave_type: str | None = None


@router.post("/leaves", status_code=201)
def admin_add_leave(
    body: AdminLeaveBody,
    _: str = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    conflict = db.execute(
        "SELECT id FROM support_schedule WHERE schedule_date = ? AND primary_oncall = ?",
        (body.leave_date, body.employee_name),
    ).fetchone()
    if conflict:
        raise HTTPException(
            status_code=409,
            detail=f"{body.employee_name} is Primary Support on {body.leave_date} and cannot take leave.",
        )
    cur = db.execute(
        "INSERT INTO leaves (employee_name, leave_date, leave_type) VALUES (?, ?, ?)",
        (body.employee_name, body.leave_date, body.leave_type),
    )
    db.commit()
    return {"id": cur.lastrowid, **body.model_dump()}


@router.put("/leaves/{leave_id}")
def admin_update_leave(
    leave_id: int,
    body: AdminLeaveBody,
    _: str = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute("SELECT id FROM leaves WHERE id = ?", (leave_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Leave not found")
    conflict = db.execute(
        "SELECT id FROM support_schedule WHERE schedule_date = ? AND primary_oncall = ?",
        (body.leave_date, body.employee_name),
    ).fetchone()
    if conflict:
        raise HTTPException(
            status_code=409,
            detail=f"{body.employee_name} is Primary Support on {body.leave_date} and cannot take leave.",
        )
    db.execute(
        "UPDATE leaves SET employee_name = ?, leave_date = ?, leave_type = ? WHERE id = ?",
        (body.employee_name, body.leave_date, body.leave_type, leave_id),
    )
    db.commit()
    return {"id": leave_id, **body.model_dump()}


@router.delete("/leaves/{leave_id}", status_code=204)
def admin_delete_leave(
    leave_id: int,
    _: str = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute("SELECT id FROM leaves WHERE id = ?", (leave_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Leave not found")
    db.execute("DELETE FROM leaves WHERE id = ?", (leave_id,))
    db.commit()
