---
phase: Feature_01
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/routers/admin.py
  - backend/pyproject.toml
autonomous: true
requirements:
  - F1-CRUD-ADMIN
must_haves:
  truths:
    - "Admin can insert a vacation leave for any team member via POST /admin/leaves"
    - "Admin can update any member's leave via PUT /admin/leaves/{id}"
    - "Admin can delete any member's leave via DELETE /admin/leaves/{id}"
    - "pytest and pytest-asyncio are declared as dev dependencies in pyproject.toml"
  artifacts:
    - path: "backend/routers/admin.py"
      provides: "Three new admin leave endpoints: POST, PUT, DELETE /admin/leaves"
      contains: "router.post(\"/leaves\")"
    - path: "backend/pyproject.toml"
      provides: "Dev dependency declarations for pytest"
      contains: "pytest"
  key_links:
    - from: "backend/routers/admin.py"
      to: "backend.auth.get_current_admin"
      via: "Depends(get_current_admin)"
      pattern: "get_current_admin"
    - from: "backend/routers/admin.py"
      to: "backend.db.get_db"
      via: "Depends(get_db)"
      pattern: "get_db"
---

<objective>
Add three admin-only leave endpoints that bypass ownership enforcement, and declare pytest dev
dependencies so the test suite in Plan 04 can run.

Purpose: The existing /api/leaves endpoints enforce that a user can only modify their own leaves.
Admin must be able to modify any member's leaves from the manual CRUD modal. A separate admin
router is the cleanest approach (consistent with existing admin.py pattern).

Output: Three new routes in backend/routers/admin.py; pytest + pytest-asyncio added to
pyproject.toml [tool.uv.dev-dependencies].
</objective>

<execution_context>
@E:/AI Playground/Projects/claude_teamSchedule/backend/routers/admin.py
</execution_context>

<context>
@E:/AI Playground/Projects/claude_teamSchedule/backend/routers/leaves.py
@E:/AI Playground/Projects/claude_teamSchedule/backend/routers/admin.py
@E:/AI Playground/Projects/claude_teamSchedule/backend/pyproject.toml

<interfaces>
From backend/routers/leaves.py:
```python
class LeaveBody(BaseModel):
    leave_date: str
    leave_type: str | None = None

def _check_primary_conflict(db: sqlite3.Connection, name: str, date: str):
    # raises HTTP 409 if `name` is primary_oncall on `date`
```

From backend/auth.py (existing pattern in admin.py):
```python
def get_current_admin(credentials: HTTPAuthorizationCredentials = ...) -> str:
    # raises HTTP 403 if user != "Admin"
    # returns username string
```

From backend/db.py (existing pattern in admin.py):
```python
def get_db() -> sqlite3.Connection:
    # yields a row_factory=sqlite3.Row connection
```

leaves table schema (from existing INSERT in leaves.py):
    id INTEGER PRIMARY KEY, employee_name TEXT, leave_date TEXT, leave_type TEXT
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add admin leave endpoints to admin.py</name>
  <files>backend/routers/admin.py</files>
  <read_first>
    - backend/routers/admin.py — read the full file before editing; append new code after the existing /upload route
    - backend/routers/leaves.py — reference for LeaveBody model and _check_primary_conflict pattern
  </read_first>
  <action>
Append three new route functions to the bottom of backend/routers/admin.py.

Import additions needed at the top of the file (add to existing imports):
- `from pydantic import BaseModel` is already imported
- `sqlite3` is already imported
- Add `LeaveBody` as a local model (do NOT import from leaves.py to avoid circular deps)

Add this model class just before the new routes (after the existing MemberBody class):

```python
class AdminLeaveBody(BaseModel):
    employee_name: str
    leave_date: str
    leave_type: str | None = None
```

Add these three route functions at the bottom of the file:

```python
@router.post("/leaves", status_code=201)
def admin_add_leave(
    body: AdminLeaveBody,
    _: str = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """Insert a leave entry for any member, bypassing ownership check."""
    row = db.execute(
        "SELECT id FROM support_schedule WHERE schedule_date = ? AND primary_oncall = ?",
        (body.leave_date, body.employee_name),
    ).fetchone()
    if row:
        raise HTTPException(
            status_code=409,
            detail=f"{body.employee_name} is Primary Support on {body.leave_date} and cannot take leave on that date.",
        )
    cur = db.execute(
        "INSERT INTO leaves (employee_name, leave_date, leave_type) VALUES (?, ?, ?)",
        (body.employee_name, body.leave_date, body.leave_type),
    )
    db.commit()
    return {"id": cur.lastrowid, "employee_name": body.employee_name, "leave_date": body.leave_date, "leave_type": body.leave_type}


@router.put("/leaves/{leave_id}")
def admin_update_leave(
    leave_id: int,
    body: AdminLeaveBody,
    _: str = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """Update any member's leave, bypassing ownership check."""
    row = db.execute("SELECT * FROM leaves WHERE id = ?", (leave_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Leave not found")
    conflict = db.execute(
        "SELECT id FROM support_schedule WHERE schedule_date = ? AND primary_oncall = ?",
        (body.leave_date, body.employee_name),
    ).fetchone()
    if conflict:
        raise HTTPException(
            status_code=409,
            detail=f"{body.employee_name} is Primary Support on {body.leave_date} and cannot take leave on that date.",
        )
    db.execute(
        "UPDATE leaves SET employee_name = ?, leave_date = ?, leave_type = ? WHERE id = ?",
        (body.employee_name, body.leave_date, body.leave_type, leave_id),
    )
    db.commit()
    return {"id": leave_id, "employee_name": body.employee_name, "leave_date": body.leave_date, "leave_type": body.leave_type}


@router.delete("/leaves/{leave_id}", status_code=204)
def admin_delete_leave(
    leave_id: int,
    _: str = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """Delete any member's leave, bypassing ownership check."""
    row = db.execute("SELECT id FROM leaves WHERE id = ?", (leave_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Leave not found")
    db.execute("DELETE FROM leaves WHERE id = ?", (leave_id,))
    db.commit()
```
  </action>
  <verify>
    <automated>cd "E:/AI Playground/Projects/claude_teamSchedule" && grep -c "router.post(\"/leaves\"" backend/routers/admin.py</automated>
  </verify>
  <acceptance_criteria>
    - backend/routers/admin.py contains `router.post("/leaves"` (admin_add_leave)
    - backend/routers/admin.py contains `router.put("/leaves/{leave_id}"` (admin_update_leave)
    - backend/routers/admin.py contains `router.delete("/leaves/{leave_id}"` (admin_delete_leave)
    - All three functions use `Depends(get_current_admin)` — not get_current_user
    - AdminLeaveBody model has fields: employee_name, leave_date, leave_type
    - Primary conflict check is present in both POST and PUT routes (SELECT from support_schedule WHERE primary_oncall = ?)
  </acceptance_criteria>
  <done>Three admin leave endpoints exist in admin.py, all gated by get_current_admin, primary conflict enforced on POST and PUT.</done>
</task>

<task type="auto">
  <name>Task 2: Add pytest dev dependencies to pyproject.toml</name>
  <files>backend/pyproject.toml</files>
  <read_first>
    - backend/pyproject.toml — read before editing to see current structure
  </read_first>
  <action>
Add a [tool.uv] dev-dependencies section to backend/pyproject.toml. The current file has
`[tool.uv]` with only `package = false`. Replace that section with:

```toml
[tool.uv]
package = false
dev-dependencies = [
    "pytest>=9.0",
    "pytest-asyncio>=0.25",
]
```

Do NOT run `uv add` — edit the file directly. The Dockerfile installs with `--no-dev --frozen`
so dev deps do not bloat the production image. Tests run outside the container or in a test-only
compose service.
  </action>
  <verify>
    <automated>cd "E:/AI Playground/Projects/claude_teamSchedule" && grep -c "pytest" backend/pyproject.toml</automated>
  </verify>
  <acceptance_criteria>
    - backend/pyproject.toml contains `"pytest>=9.0"` under dev-dependencies
    - backend/pyproject.toml contains `"pytest-asyncio>=0.25"` under dev-dependencies
    - The `[tool.uv]` section retains `package = false`
    - The `[project].dependencies` list is unchanged (no pytest in prod deps)
  </acceptance_criteria>
  <done>pytest and pytest-asyncio declared as dev dependencies; uv sync --dev will install them.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client -> /admin/leaves | Admin JWT required; ownership bypassed intentionally |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-F1-01-01 | Elevation of Privilege | /admin/leaves POST/PUT/DELETE | mitigate | get_current_admin dependency enforces user == "Admin"; HTTP 403 on any other user |
| T-F1-01-02 | Spoofing | JWT on admin endpoints | accept | Existing HS256 JWT + 8-hour expiry unchanged; same trust surface as existing admin routes |
</threat_model>

<verification>
After both tasks, verify:
1. `grep "router.post(\"/leaves\"" backend/routers/admin.py` returns a match
2. `grep "router.put(\"/leaves" backend/routers/admin.py` returns a match
3. `grep "router.delete(\"/leaves" backend/routers/admin.py` returns a match
4. `grep "pytest" backend/pyproject.toml` returns 2 matches
5. `grep "get_current_admin" backend/routers/admin.py | wc -l` returns >= 6 (3 existing + 3 new)
</verification>

<success_criteria>
- POST /admin/leaves creates a leave for any employee_name when called with Admin JWT
- PUT /admin/leaves/{id} updates any leave regardless of employee ownership
- DELETE /admin/leaves/{id} deletes any leave regardless of employee ownership
- All three reject non-admin callers with 403
- pytest declared as dev dependency in pyproject.toml
</success_criteria>

<output>
After completion, create `.planning/phases/Feature_01/Feature_01-01-SUMMARY.md` with:
- What was changed in admin.py (three new endpoints, AdminLeaveBody model)
- The exact route paths: POST /admin/leaves, PUT /admin/leaves/{id}, DELETE /admin/leaves/{id}
- Auth: get_current_admin on all three
- pyproject.toml dev-dependencies added
</output>
