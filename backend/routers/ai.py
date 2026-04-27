import json
import os
import sqlite3
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth import get_current_admin, get_current_user
from backend.db import get_db

router = APIRouter(prefix="/api/ai")

_histories: dict[str, list[dict]] = {}

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "openai/gpt-oss-120b:free"
MODEL_FALLBACK = "nvidia/nemotron-3-super-120b-a12b:free"


def _build_system_prompt(user: str, db: sqlite3.Connection, is_admin: bool = False) -> str:
    today = datetime.now(timezone.utc).date().isoformat()

    leaves = [
        dict(r)
        for r in db.execute(
            "SELECT employee_name, leave_date, leave_type FROM leaves "
            "WHERE leave_date >= date('now', '-60 days') ORDER BY leave_date"
        )
    ]
    schedule = [
        dict(r)
        for r in db.execute(
            "SELECT schedule_date, primary_oncall, secondary_oncall, backup_oncall, onshore_oncall "
            "FROM support_schedule WHERE schedule_date >= date('now', '-60 days') ORDER BY schedule_date"
        )
    ]
    holidays = [
        dict(r)
        for r in db.execute(
            "SELECT id, holiday_date, description, location FROM public_holidays "
            "WHERE holiday_date >= date('now', '-60 days') ORDER BY holiday_date"
        )
    ]

    if is_admin:
        leave_rule = "You are the admin assistant. You may insert, update, or delete any member's vacation leaves."
        extra_scope = "\n- You may also answer questions about the CSV file format for leave_records.csv and support_schedule.csv."
    else:
        leave_rule = "A user may only insert, update, or delete their own vacation leaves."
        extra_scope = ""

    return f"""You are a snarky but helpful team calendar assistant. Today is {today}. The logged-in user is "{user}".

PERSONALITY:
- Be snarky, dry, and a little sarcastic — but still actually helpful. Think of a witty coworker who rolls their eyes but gets the job done.
- Keep responses concise and punchy. No corporate speak.
- You may respond to greetings and small talk with a snarky quip, then redirect to what you can actually help with.

RULES:
- Only answer questions about vacation leaves and support schedules.{extra_scope}
- {leave_rule}
- A vacation leave request must be rejected if the person is listed as primary_oncall on that date.
- Any user may update any member's primary_oncall on the support schedule.
- Only primary_oncall may be updated on the schedule; no insert or delete of schedule rows.
- Any user may insert, update, or delete holidays.
- Always ask confirmation before executing any insert, update, or delete.
- For anything outside leaves, schedules, and greetings: refuse with a snarky one-liner.

CURRENT DATA (last 60 days and future):
Leaves: {json.dumps(leaves)}
Schedule: {json.dumps(schedule)}
Holidays: {json.dumps(holidays)}

RESPONSE FORMAT — always respond with valid JSON only, no markdown:
When just answering or asking for confirmation:
{{"response": "<message to user>", "action": null}}

When executing a confirmed action:
{{"response": "<confirmation message>", "action": {{"type": "<action_type>", "data": {{...}}}}}}

Action types and required data fields:
- insert_leave: {{"employee_name": str, "leave_date": "YYYY-MM-DD", "leave_type": str|null}}
- update_leave: {{"employee_name": str, "old_leave_date": "YYYY-MM-DD", "new_leave_date": "YYYY-MM-DD", "leave_type": str|null}}
- delete_leave: {{"employee_name": str, "leave_date": "YYYY-MM-DD"}}
- update_primary_support: {{"schedule_date": "YYYY-MM-DD", "primary_oncall": str}}
- insert_holiday: {{"holiday_date": "YYYY-MM-DD", "description": str|null, "location": str|null}}
- update_holiday: {{"id": int, "holiday_date": "YYYY-MM-DD", "description": str|null, "location": str|null}}
- delete_holiday: {{"id": int}}"""


def _execute_action(action: dict, user: str, db: sqlite3.Connection, is_admin: bool = False):
    t = action["type"]
    d = action["data"]

    if t == "insert_leave":
        name = d["employee_name"]
        if not is_admin and name != user:
            raise HTTPException(status_code=403, detail="Cannot add leave for another member")
        conflict = db.execute(
            "SELECT id FROM support_schedule WHERE schedule_date = ? AND primary_oncall = ?",
            (d["leave_date"], name),
        ).fetchone()
        if conflict:
            raise HTTPException(
                status_code=409,
                detail=f"{name} is Primary Support on {d['leave_date']}",
            )
        db.execute(
            "INSERT INTO leaves (employee_name, leave_date, leave_type) VALUES (?, ?, ?)",
            (name, d["leave_date"], d.get("leave_type")),
        )

    elif t == "update_leave":
        name = d["employee_name"]
        if not is_admin and name != user:
            raise HTTPException(status_code=403, detail="Cannot modify another member's leave")
        row = db.execute(
            "SELECT id FROM leaves WHERE employee_name = ? AND leave_date = ?",
            (name, d["old_leave_date"]),
        ).fetchone()
        if not row:
            raise HTTPException(
                status_code=404,
                detail=f"No leave found for {name} on {d['old_leave_date']}",
            )
        conflict = db.execute(
            "SELECT id FROM support_schedule WHERE schedule_date = ? AND primary_oncall = ?",
            (d["new_leave_date"], name),
        ).fetchone()
        if conflict:
            raise HTTPException(
                status_code=409,
                detail=f"{name} is Primary Support on {d['new_leave_date']}",
            )
        db.execute("DELETE FROM leaves WHERE id = ?", (row["id"],))
        db.execute(
            "INSERT INTO leaves (employee_name, leave_date, leave_type) VALUES (?, ?, ?)",
            (name, d["new_leave_date"], d.get("leave_type")),
        )

    elif t == "delete_leave":
        name = d["employee_name"]
        row = db.execute(
            "SELECT id, employee_name FROM leaves WHERE employee_name = ? AND leave_date = ?",
            (name, d["leave_date"]),
        ).fetchone()
        if not row:
            raise HTTPException(
                status_code=404,
                detail=f"No leave found for {name} on {d['leave_date']}",
            )
        if not is_admin and row["employee_name"] != user:
            raise HTTPException(status_code=403, detail="Cannot modify another member's leave")
        db.execute("DELETE FROM leaves WHERE id = ?", (row["id"],))

    elif t == "update_primary_support":
        row = db.execute(
            "SELECT id FROM support_schedule WHERE schedule_date = ?", (d["schedule_date"],)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Schedule not found for that date")
        db.execute(
            "UPDATE support_schedule SET primary_oncall = ? WHERE schedule_date = ?",
            (d["primary_oncall"], d["schedule_date"]),
        )

    elif t == "insert_holiday":
        db.execute(
            "INSERT INTO public_holidays (holiday_date, description, location) VALUES (?, ?, ?)",
            (d["holiday_date"], d.get("description"), d.get("location")),
        )

    elif t == "update_holiday":
        row = db.execute("SELECT id FROM public_holidays WHERE id = ?", (d["id"],)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Holiday not found")
        db.execute(
            "UPDATE public_holidays SET holiday_date = ?, description = ?, location = ? WHERE id = ?",
            (d["holiday_date"], d.get("description"), d.get("location"), d["id"]),
        )

    elif t == "delete_holiday":
        row = db.execute("SELECT id FROM public_holidays WHERE id = ?", (d["id"],)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Holiday not found")
        db.execute("DELETE FROM public_holidays WHERE id = ?", (d["id"],))

    db.commit()


def _call_ai(user: str, message: str, db: sqlite3.Connection, history_key: str, is_admin: bool = False) -> str:
    history = _histories.setdefault(history_key, [])
    history.append({"role": "user", "content": message})

    system_prompt = _build_system_prompt(user, db, is_admin=is_admin)
    api_key = os.environ["OPENROUTER_API_KEY"]

    req_headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    messages = [{"role": "system", "content": system_prompt}] + history

    def _post(model: str) -> httpx.Response:
        return httpx.post(
            OPENROUTER_URL,
            headers=req_headers,
            json={"model": model, "messages": messages},
            timeout=30,
        )

    try:
        resp = _post(MODEL)
    except httpx.TimeoutException:
        try:
            resp = _post(MODEL_FALLBACK)
        except httpx.RequestError as e:
            history.pop()
            raise HTTPException(status_code=503, detail=f"Could not reach AI service: {e}")
    except httpx.RequestError as e:
        history.pop()
        raise HTTPException(status_code=503, detail=f"Could not reach AI service: {e}")

    if resp.status_code != 200:
        history.pop()
        raise HTTPException(
            status_code=502,
            detail=f"AI service returned {resp.status_code}: {resp.text[:400]}",
        )

    body = resp.json()
    if "error" in body:
        history.pop()
        raise HTTPException(status_code=502, detail=f"AI model error: {body['error']}")
    if not body.get("choices"):
        history.pop()
        raise HTTPException(status_code=502, detail=f"AI returned no choices: {str(body)[:300]}")

    raw = body["choices"][0]["message"]["content"].strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        cleaned = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            history.pop()
            raise HTTPException(status_code=502, detail=f"AI returned invalid JSON: {raw[:200]}")

    action = parsed.get("action")
    if action:
        _execute_action(action, user, db, is_admin=is_admin)

    history.append({"role": "assistant", "content": raw})
    return parsed.get("response", "Done.")


class ChatRequest(BaseModel):
    message: str


@router.post("/chat")
def chat(
    body: ChatRequest,
    user: str = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    reply = _call_ai(user, body.message, db, history_key=user)
    return {"response": reply}


@router.delete("/history", status_code=204)
def clear_history(user: str = Depends(get_current_user)):
    _histories.pop(user, None)


@router.post("/admin-chat")
def admin_chat(
    body: ChatRequest,
    user: str = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    reply = _call_ai(user, body.message, db, history_key="__admin__", is_admin=True)
    return {"response": reply}


@router.delete("/admin-history", status_code=204)
def clear_admin_history(_: str = Depends(get_current_admin)):
    _histories.pop("__admin__", None)
