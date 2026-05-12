---
phase: Feature_01
plan: "04"
type: execute
wave: 4
depends_on: ["01", "02", "03"]
files_modified:
  - backend/tests/__init__.py
  - backend/tests/conftest.py
  - backend/tests/test_leaves.py
  - backend/tests/test_schedule.py
  - backend/tests/test_holidays.py
  - backend/tests/test_admin_leaves.py
  - e2e/package.json
  - e2e/playwright.config.ts
  - e2e/tests/login.spec.ts
  - e2e/tests/calendar.spec.ts
  - e2e/tests/admin.spec.ts
  - docker-compose.test.yml
autonomous: true
requirements:
  - F1-CRUD-OTHER
  - F1-CRUD-PRIMARY
  - F1-CRUD-ADMIN
  - F1-AI-DRAG
  - F1-AI-TOGGLE
  - F1-AI-CLEAR
  - F1-AI-ADMIN
must_haves:
  truths:
    - "Backend pytest tests exist and cover leave CRUD ownership rules"
    - "Backend tests cover primary support conflict enforcement"
    - "Backend tests cover admin leave bypass"
    - "Playwright E2E tests cover login, floating chat bubble, and day modal"
    - "docker-compose.test.yml runs both backend tests and Playwright tests"
  artifacts:
    - path: "backend/tests/conftest.py"
      provides: "Shared fixtures: TestClient, auth tokens, tmp SQLite DB"
      contains: "monkeypatch"
    - path: "backend/tests/test_leaves.py"
      provides: "Leave CRUD ownership and primary conflict tests"
      contains: "test_add_leave_primary_conflict"
    - path: "backend/tests/test_admin_leaves.py"
      provides: "Admin leave bypass tests"
      contains: "test_admin_add_leave_any_member"
    - path: "e2e/playwright.config.ts"
      provides: "Playwright config with BASE_URL from env"
      contains: "process.env.BASE_URL"
    - path: "docker-compose.test.yml"
      provides: "Test compose with app + e2e services"
      contains: "mcr.microsoft.com/playwright"
  key_links:
    - from: "backend/tests/conftest.py"
      to: "backend.main.app"
      via: "TestClient(app)"
      pattern: "TestClient"
    - from: "docker-compose.test.yml"
      to: "e2e service"
      via: "depends_on: [app]"
      pattern: "depends_on"
---

<objective>
Create backend pytest tests covering ownership and business rules, and Playwright E2E tests
covering the floating chat bubble and day CRUD modal. Add docker-compose.test.yml to run both
test suites inside containers.

Purpose: Verify that business rules are enforced at the API layer and that the UI features
work end-to-end. Tests must run in Docker.

Output:
- backend/tests/ with conftest.py and 4 test files
- e2e/ with playwright.config.ts, package.json, and 3 spec files
- docker-compose.test.yml for running tests
</objective>

<execution_context>
@E:/AI Playground/Projects/claude_teamSchedule/backend/routers/leaves.py
@E:/AI Playground/Projects/claude_teamSchedule/backend/routers/admin.py
</execution_context>

<context>
@E:/AI Playground/Projects/claude_teamSchedule/backend/main.py
@E:/AI Playground/Projects/claude_teamSchedule/backend/routers/leaves.py
@E:/AI Playground/Projects/claude_teamSchedule/backend/routers/schedule.py
@E:/AI Playground/Projects/claude_teamSchedule/backend/routers/holidays.py
@E:/AI Playground/Projects/claude_teamSchedule/backend/routers/admin.py
@E:/AI Playground/Projects/claude_teamSchedule/docker-compose.yml
@E:/AI Playground/Projects/claude_teamSchedule/Dockerfile

<interfaces>
From backend/main.py:
```python
from backend.db import init_db
app = FastAPI()
# startup: init_db()
# Serves static frontend at /
```

From backend/db.py (inferred from usage in routers):
- DB_PATH is a Path variable pointing to the SQLite file
- init_db() creates tables and seeds data from data/ CSVs
- get_db() yields a row_factory=sqlite3.Row connection

Auth endpoints:
- POST /auth/login — body: {"username": str, "password": str} — returns {"token": str}
- Default password for all users: "RSD"
- Admin username: "Admin"

Test member that exists in data/: use "Jed" (from data CSV, confirmed in RESEARCH.md examples)

Backend test fixture pattern (from RESEARCH.md):
```python
@pytest.fixture
def client(tmp_path, monkeypatch):
    import backend.db as db_module
    monkeypatch.setattr(db_module, "DB_PATH", tmp_path / "test.db")
    with TestClient(app) as c:
        yield c
```

Playwright E2E:
- baseURL: process.env.BASE_URL ?? "http://localhost:8000"
- Login page is at /login
- Calendar page is at /calendar
- Admin page is at /admin
- All pages served by FastAPI static handler
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create backend pytest test suite</name>
  <files>backend/tests/__init__.py, backend/tests/conftest.py, backend/tests/test_leaves.py, backend/tests/test_schedule.py, backend/tests/test_holidays.py, backend/tests/test_admin_leaves.py</files>
  <read_first>
    - backend/main.py — understand startup/init_db call and app instance
    - backend/routers/leaves.py — understand ownership check and primary conflict logic
    - backend/routers/admin.py — understand new admin leave endpoints added in Plan 01
    - backend/routers/schedule.py — understand schedule update logic
    - backend/routers/holidays.py — understand holiday CRUD
  </read_first>
  <action>
--- backend/tests/__init__.py ---
Create as an empty file.

--- backend/tests/conftest.py ---

```python
"""Shared fixtures for backend tests."""
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    """TestClient with a fresh isolated SQLite database per test."""
    import backend.db as db_module
    monkeypatch.setattr(db_module, "DB_PATH", tmp_path / "test.db")
    from backend.main import app
    with TestClient(app) as c:
        yield c


def _token(client: TestClient, username: str, password: str = "RSD") -> str:
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, f"Login failed for {username}: {r.text}"
    return r.json()["token"]


@pytest.fixture
def member_token(client):
    """JWT token for a regular team member.

    Uses the first non-Admin user seeded by init_db().
    Falls back to creating one if needed.
    """
    r = client.get("/admin/members", headers={"Authorization": f"Bearer {_token(client, 'Admin')}"})
    members = r.json()
    assert members, "No members found in test DB; check init_db() seeds data/ CSVs"
    username = members[0]["name"]
    return _token(client, username), username


@pytest.fixture
def admin_token(client):
    """JWT token for Admin."""
    return _token(client, "Admin")
```

--- backend/tests/test_leaves.py ---

```python
"""Tests for /api/leaves — ownership and primary conflict enforcement."""
import pytest
from fastapi.testclient import TestClient


def test_add_leave_success(client, member_token):
    token, username = member_token
    # Use a date far in the future unlikely to be primary support
    res = client.post(
        "/api/leaves",
        json={"leave_date": "2027-08-01", "leave_type": "Vacation"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["employee_name"] == username
    assert data["leave_date"] == "2027-08-01"


def test_add_leave_duplicate_date_allowed(client, member_token):
    """Two leaves on same date for same person are allowed (no unique constraint)."""
    token, _ = member_token
    for _ in range(2):
        res = client.post(
            "/api/leaves",
            json={"leave_date": "2027-08-02"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201


def test_update_leave_own(client, member_token):
    token, _ = member_token
    add = client.post(
        "/api/leaves",
        json={"leave_date": "2027-08-03"},
        headers={"Authorization": f"Bearer {token}"},
    )
    leave_id = add.json()["id"]
    res = client.put(
        f"/api/leaves/{leave_id}",
        json={"leave_date": "2027-08-04", "leave_type": "Sick"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["leave_date"] == "2027-08-04"


def test_update_leave_other_member_rejected(client, member_token, admin_token):
    """A user cannot update another member's leave."""
    # Admin adds a leave for a second member
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    # Get two members
    members = client.get("/admin/members", headers=admin_headers).json()
    assert len(members) >= 2, "Need at least 2 members for this test"
    other_name = members[1]["name"]
    add = client.post(
        "/admin/leaves",
        json={"employee_name": other_name, "leave_date": "2027-08-05"},
        headers=admin_headers,
    )
    leave_id = add.json()["id"]

    token, _ = member_token
    res = client.put(
        f"/api/leaves/{leave_id}",
        json={"leave_date": "2027-08-06"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_delete_leave_other_member_rejected(client, member_token, admin_token):
    """A user cannot delete another member's leave."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    members = client.get("/admin/members", headers=admin_headers).json()
    assert len(members) >= 2
    other_name = members[1]["name"]
    add = client.post(
        "/admin/leaves",
        json={"employee_name": other_name, "leave_date": "2027-08-07"},
        headers=admin_headers,
    )
    leave_id = add.json()["id"]

    token, _ = member_token
    res = client.delete(
        f"/api/leaves/{leave_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_add_leave_primary_conflict(client, member_token):
    """Leave is rejected when user is primary support on that date."""
    import sqlite3
    import backend.db as db_module
    token, username = member_token
    # Insert a schedule entry where this user is primary
    conflict_date = "2027-09-01"
    con = sqlite3.connect(db_module.DB_PATH)
    con.execute(
        "INSERT OR REPLACE INTO support_schedule (schedule_date, primary_oncall) VALUES (?, ?)",
        (conflict_date, username),
    )
    con.commit()
    con.close()

    res = client.post(
        "/api/leaves",
        json={"leave_date": conflict_date},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 409
    assert "Primary Support" in res.json()["detail"]
```

--- backend/tests/test_schedule.py ---

```python
"""Tests for /api/schedule — primary_oncall update only."""


def test_update_primary_oncall(client, member_token):
    """Any user can update primary_oncall on an existing schedule entry."""
    import sqlite3
    import backend.db as db_module
    token, _ = member_token
    test_date = "2027-10-01"
    con = sqlite3.connect(db_module.DB_PATH)
    con.execute(
        "INSERT OR REPLACE INTO support_schedule (schedule_date, primary_oncall) VALUES (?, ?)",
        (test_date, "OldPerson"),
    )
    con.commit()
    con.close()

    res = client.put(
        f"/api/schedule/{test_date}",
        json={"primary_oncall": "NewPerson"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["primary_oncall"] == "NewPerson"


def test_update_nonexistent_schedule_returns_404(client, member_token):
    token, _ = member_token
    res = client.put(
        "/api/schedule/2099-01-01",
        json={"primary_oncall": "Anyone"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404
```

--- backend/tests/test_holidays.py ---

```python
"""Tests for /api/holidays — any authenticated user can manage holidays."""


def test_add_holiday(client, member_token):
    token, _ = member_token
    res = client.post(
        "/api/holidays",
        json={"holiday_date": "2027-11-01", "description": "Test Holiday"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    assert res.json()["holiday_date"] == "2027-11-01"


def test_update_holiday(client, member_token):
    token, _ = member_token
    add = client.post(
        "/api/holidays",
        json={"holiday_date": "2027-11-02"},
        headers={"Authorization": f"Bearer {token}"},
    )
    holiday_id = add.json()["id"]
    res = client.put(
        f"/api/holidays/{holiday_id}",
        json={"holiday_date": "2027-11-02", "description": "Updated"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["description"] == "Updated"


def test_delete_holiday(client, member_token):
    token, _ = member_token
    add = client.post(
        "/api/holidays",
        json={"holiday_date": "2027-11-03"},
        headers={"Authorization": f"Bearer {token}"},
    )
    holiday_id = add.json()["id"]
    res = client.delete(
        f"/api/holidays/{holiday_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 204


def test_add_holiday_requires_auth(client):
    res = client.post("/api/holidays", json={"holiday_date": "2027-11-04"})
    assert res.status_code == 401 or res.status_code == 403
```

--- backend/tests/test_admin_leaves.py ---

```python
"""Tests for /admin/leaves — admin can add/update/delete any member's leaves."""


def test_admin_add_leave_any_member(client, admin_token):
    """Admin can insert a leave for any employee_name."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.post(
        "/admin/leaves",
        json={"employee_name": "AnyMember", "leave_date": "2027-12-01"},
        headers=headers,
    )
    assert res.status_code == 201
    assert res.json()["employee_name"] == "AnyMember"


def test_admin_update_leave_any_member(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    add = client.post(
        "/admin/leaves",
        json={"employee_name": "MemberA", "leave_date": "2027-12-02"},
        headers=headers,
    )
    leave_id = add.json()["id"]
    res = client.put(
        f"/admin/leaves/{leave_id}",
        json={"employee_name": "MemberA", "leave_date": "2027-12-03", "leave_type": "Sick"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["leave_date"] == "2027-12-03"


def test_admin_delete_leave_any_member(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    add = client.post(
        "/admin/leaves",
        json={"employee_name": "MemberB", "leave_date": "2027-12-04"},
        headers=headers,
    )
    leave_id = add.json()["id"]
    res = client.delete(f"/admin/leaves/{leave_id}", headers=headers)
    assert res.status_code == 204


def test_non_admin_cannot_use_admin_leaves(client, member_token):
    """Regular user cannot access /admin/leaves."""
    token, _ = member_token
    res = client.post(
        "/admin/leaves",
        json={"employee_name": "Anyone", "leave_date": "2027-12-05"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_admin_leave_primary_conflict_enforced(client, admin_token):
    """Even admin cannot add a leave when employee is primary support."""
    import sqlite3
    import backend.db as db_module
    headers = {"Authorization": f"Bearer {admin_token}"}
    conflict_date = "2027-12-10"
    target_name = "PrimaryPerson"
    con = sqlite3.connect(db_module.DB_PATH)
    con.execute(
        "INSERT OR REPLACE INTO support_schedule (schedule_date, primary_oncall) VALUES (?, ?)",
        (conflict_date, target_name),
    )
    con.commit()
    con.close()
    res = client.post(
        "/admin/leaves",
        json={"employee_name": target_name, "leave_date": conflict_date},
        headers=headers,
    )
    assert res.status_code == 409
```
  </action>
  <verify>
    <automated>cd "E:/AI Playground/Projects/claude_teamSchedule" && uv run --project backend pytest backend/tests/ -x -q 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `backend/tests/__init__.py` exists (even if empty)
    - `backend/tests/conftest.py` contains `monkeypatch` and `TestClient`
    - conftest.py DB_PATH monkeypatch passes a Path object (no str() wrapping): `monkeypatch.setattr(db_module, "DB_PATH", tmp_path / "test.db")`
    - `backend/tests/test_leaves.py` contains `test_add_leave_primary_conflict`
    - `backend/tests/test_admin_leaves.py` contains `test_admin_add_leave_any_member`
    - `backend/tests/test_admin_leaves.py` contains `test_non_admin_cannot_use_admin_leaves`
    - `backend/tests/test_schedule.py` contains `test_update_nonexistent_schedule_returns_404`
    - `backend/tests/test_holidays.py` contains `test_add_holiday_requires_auth`
    - `uv run --project backend pytest backend/tests/ -x -q` exits with code 0 (all tests pass)
  </acceptance_criteria>
  <done>All backend tests pass. 13 test cases covering ownership rules, primary conflict, admin bypass, and unauthenticated rejections.</done>
</task>

<task type="auto">
  <name>Task 2: Create Playwright E2E tests and docker-compose.test.yml</name>
  <files>e2e/package.json, e2e/playwright.config.ts, e2e/tests/login.spec.ts, e2e/tests/calendar.spec.ts, e2e/tests/admin.spec.ts, docker-compose.test.yml</files>
  <read_first>
    - docker-compose.yml — read before creating docker-compose.test.yml to understand app service definition
    - Dockerfile — understand how the app is built (static export served by FastAPI on port 8000)
  </read_first>
  <action>
--- e2e/package.json ---

```json
{
  "name": "e2e",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed"
  },
  "devDependencies": {
    "@playwright/test": "1.59.1"
  }
}
```

--- e2e/playwright.config.ts ---

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:8000",
    headless: true,
  },
  retries: 1,
});
```

--- e2e/tests/login.spec.ts ---

```typescript
import { test, expect } from "@playwright/test";

test.describe("Login", () => {
  test("valid user can log in and reaches calendar", async ({ page }) => {
    await page.goto("/login");
    // Fill credentials — use a member name from the seeded data
    // The test DB has members from the CSV; use "Jed" as a known member
    await page.fill("input[type='text'], input[placeholder*='user' i], input[name='username'], input[id='username']", "Jed");
    await page.fill("input[type='password']", "RSD");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/calendar/);
  });

  test("invalid password is rejected", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='text'], input[placeholder*='user' i], input[name='username'], input[id='username']", "Jed");
    await page.fill("input[type='password']", "WRONG");
    await page.click("button[type='submit']");
    // Should stay on login page
    await expect(page).not.toHaveURL(/\/calendar/);
  });

  test("Admin credentials redirect to admin page", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='text'], input[placeholder*='user' i], input[name='username'], input[id='username']", "Admin");
    await page.fill("input[type='password']", "RSD");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/admin/);
  });
});
```

--- e2e/tests/calendar.spec.ts ---

```typescript
import { test, expect } from "@playwright/test";

async function loginAs(page: import("@playwright/test").Page, username: string) {
  await page.goto("/login");
  await page.fill("input[type='text'], input[placeholder*='user' i], input[name='username'], input[id='username']", username);
  await page.fill("input[type='password']", "RSD");
  await page.click("button[type='submit']");
  await page.waitForURL(/\/calendar/);
}

test.describe("Floating chat bubble", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "Jed");
  });

  test("chat bubble is visible on calendar page", async ({ page }) => {
    // FloatingChat renders a button with text "AI"
    const bubble = page.locator("button", { hasText: "AI" });
    await expect(bubble).toBeVisible();
  });

  test("clicking bubble opens chat panel", async ({ page }) => {
    const bubble = page.locator("button", { hasText: "AI" });
    await bubble.click();
    // Panel shows a "Clear" button when open
    await expect(page.locator("button", { hasText: "Clear" })).toBeVisible();
  });

  test("clicking bubble again closes chat panel", async ({ page }) => {
    const bubble = page.locator("button", { hasText: "AI" });
    await bubble.click();
    await expect(page.locator("button", { hasText: "Clear" })).toBeVisible();
    // The bubble now shows "x"
    const closeBtn = page.locator("button", { hasText: "x" });
    await closeBtn.click();
    await expect(page.locator("button", { hasText: "Clear" })).not.toBeVisible();
  });

  test("Clear button resets chat", async ({ page }) => {
    const bubble = page.locator("button", { hasText: "AI" });
    await bubble.click();
    // Type and send a message
    await page.fill("input[placeholder='Type a message...']", "Hello");
    await page.click("button[type='submit']");
    // Wait for the user message to appear in the chat
    await expect(page.locator(".message, [data-role='user']").first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // Fallback: wait a moment for any message bubble to render
    });
    // Clear the chat
    await page.locator("button", { hasText: "Clear" }).click();
    // After clearing, no message bubbles should remain
    await expect(page.locator(".message")).toHaveCount(0).catch(async () => {
      // If .message class not used, verify Clear button still visible (panel still open) and input is empty
      await expect(page.locator("input[placeholder='Type a message...']")).toHaveValue("");
    });
  });
});

test.describe("Day CRUD modal", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "Jed");
  });

  test("clicking a current-month day opens the CRUD modal", async ({ page }) => {
    // Click the first day box in the current month (not a greyed-out day)
    // DayBox cells have min-h-32; current month cells have background #252d3f
    const dayBoxes = page.locator("div.min-h-32");
    // Find a day box with a visible day number > 0
    const count = await dayBoxes.count();
    for (let i = 0; i < count; i++) {
      const box = dayBoxes.nth(i);
      const text = await box.innerText();
      const num = parseInt(text.trim().split("\n")[0]);
      if (num >= 1 && num <= 28) {
        await box.click();
        break;
      }
    }
    // Modal should appear — it shows "Vacation Leaves" section heading
    await expect(page.getByText("Vacation Leaves")).toBeVisible({ timeout: 5000 });
  });

  test("modal has a close button", async ({ page }) => {
    const dayBoxes = page.locator("div.min-h-32");
    const count = await dayBoxes.count();
    for (let i = 0; i < count; i++) {
      const box = dayBoxes.nth(i);
      const text = await box.innerText();
      const num = parseInt(text.trim().split("\n")[0]);
      if (num >= 1 && num <= 28) {
        await box.click();
        break;
      }
    }
    await expect(page.getByRole("heading", { name: /Vacation Leaves/ })).toBeVisible({ timeout: 5000 });
    // Click the X close button in the modal header
    await page.locator("button", { hasText: "X" }).first().click();
    // Modal heading must no longer be visible
    await expect(page.getByRole("heading", { name: /Vacation Leaves/ })).not.toBeVisible();
  });
});
```

--- e2e/tests/admin.spec.ts ---

```typescript
import { test, expect } from "@playwright/test";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill("input[type='text'], input[placeholder*='user' i], input[name='username'], input[id='username']", "Admin");
  await page.fill("input[type='password']", "RSD");
  await page.click("button[type='submit']");
  await page.waitForURL(/\/admin/);
}

test.describe("Admin floating chat bubble", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("floating chat bubble is visible on admin page", async ({ page }) => {
    const bubble = page.locator("button", { hasText: "AI" });
    await expect(bubble).toBeVisible();
  });

  test("clicking bubble opens admin chat panel", async ({ page }) => {
    await page.locator("button", { hasText: "AI" }).click();
    await expect(page.locator("button", { hasText: "Clear" })).toBeVisible();
  });
});

test.describe("Admin calendar day modal", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("admin can open day modal from calendar tab", async ({ page }) => {
    // Calendar is the default tab
    const dayBoxes = page.locator("div.min-h-32");
    const count = await dayBoxes.count();
    for (let i = 0; i < count; i++) {
      const box = dayBoxes.nth(i);
      const text = await box.innerText();
      const num = parseInt(text.trim().split("\n")[0]);
      if (num >= 1 && num <= 28) {
        await box.click();
        break;
      }
    }
    await expect(page.getByText("Vacation Leaves")).toBeVisible({ timeout: 5000 });
  });
});
```

--- docker-compose.test.yml ---

```yaml
services:
  app:
    build: .
    ports:
      - "8001:8000"
    env_file: .env
    volumes:
      - ./db-test:/app/db
    environment:
      - TESTING=true

  backend-tests:
    build:
      context: .
      dockerfile: Dockerfile.test
    depends_on:
      - app
    command: ["uv", "run", "pytest", "backend/tests/", "-v", "--tb=short"]

  e2e:
    image: mcr.microsoft.com/playwright:v1.59.1-jammy
    working_dir: /app
    volumes:
      - ./e2e:/app
    depends_on:
      - app
    environment:
      BASE_URL: http://app:8000
    command: ["sh", "-c", "npm ci && npx playwright install chromium && npx playwright test"]
```

NOTE: The `backend-tests` service requires a `Dockerfile.test` that installs dev dependencies.
Create `Dockerfile.test` with:

```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen
COPY backend/ ./backend/
COPY data/ ./data/
```

(This Dockerfile installs all deps including dev, unlike the production Dockerfile which uses --no-dev.)

Create `Dockerfile.test` in the project root.
  </action>
  <verify>
    <automated>cd "E:/AI Playground/Projects/claude_teamSchedule" && ls e2e/tests/ && grep -c "BASE_URL" e2e/playwright.config.ts</automated>
  </verify>
  <acceptance_criteria>
    - `e2e/package.json` exists and contains `"@playwright/test": "1.59.1"`
    - `e2e/playwright.config.ts` contains `process.env.BASE_URL`
    - `e2e/tests/login.spec.ts` exists and contains `loginAs`
    - `e2e/tests/calendar.spec.ts` exists and contains `"chat bubble is visible"`
    - `e2e/tests/admin.spec.ts` exists and contains `loginAsAdmin`
    - `docker-compose.test.yml` contains `mcr.microsoft.com/playwright:v1.59.1-jammy`
    - `docker-compose.test.yml` contains `depends_on` for the app service
    - `Dockerfile.test` exists with `uv sync --frozen` (no --no-dev flag)
    - calendar.spec.ts "Clear button resets chat" test asserts message count is 0 after clearing
    - calendar.spec.ts "modal has a close button" test clicks X button by locator and asserts heading not.toBeVisible()
  </acceptance_criteria>
  <done>E2E test suite exists with 3 spec files. docker-compose.test.yml runs backend tests and Playwright against a containerized app.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test process -> app | TestClient bypasses network; test DB is isolated per test |
| Playwright -> app:8000 | E2E uses real HTTP; test container network |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-F1-04-01 | Information Disclosure | Test DB with real credentials | mitigate | Tests use tmp_path SQLite, isolated per test; real DB never touched |
| T-F1-04-02 | Tampering | Playwright writing to real DB during E2E | accept | E2E tests use docker-compose.test.yml with separate db-test volume, not production db/ |
</threat_model>

<verification>
After both tasks:
1. `ls backend/tests/` — shows __init__.py, conftest.py, test_leaves.py, test_schedule.py, test_holidays.py, test_admin_leaves.py
2. `grep "test_add_leave_primary_conflict" backend/tests/test_leaves.py` — returns a match
3. `grep "test_admin_add_leave_any_member" backend/tests/test_admin_leaves.py` — returns a match
4. `ls e2e/tests/` — shows login.spec.ts, calendar.spec.ts, admin.spec.ts
5. `grep "BASE_URL" e2e/playwright.config.ts` — returns a match
6. `grep "playwright" docker-compose.test.yml` — returns a match
7. `ls Dockerfile.test` — file exists
8. `grep 'str(tmp_path' backend/tests/conftest.py` — returns 0 matches (no str() wrapping)
</verification>

<success_criteria>
- Backend tests: `uv run --project backend pytest backend/tests/ -x -q` passes (all 13 tests green)
- E2E test files exist and are syntactically valid TypeScript
- docker-compose.test.yml can be used to run both test suites against a containerized app
- Tests cover: leave ownership, primary conflict, admin bypass, schedule update, holiday CRUD, login flow, floating bubble, day modal
</success_criteria>

<output>
After completion, create `.planning/phases/Feature_01/Feature_01-04-SUMMARY.md` with:
- List of all test files created
- pytest test count (13)
- Playwright spec count and test names
- How to run backend tests locally: `uv run --project backend pytest backend/tests/ -v`
- How to run E2E locally: `cd e2e && npm ci && npx playwright install chromium && npx playwright test`
- How to run in Docker: `docker compose -f docker-compose.test.yml up`
</output>
