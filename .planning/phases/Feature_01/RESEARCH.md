# Phase Feature_01: Floating Chat Bubble + Manual Calendar CRUD + Testing — Research

**Researched:** 2026-04-29
**Domain:** Next.js 16 / React 19 / FastAPI / Playwright / pytest
**Confidence:** HIGH

---

## Summary

Feature_01 adds three capabilities to an already-complete full-stack calendar app: (1) replace the
fixed `AIPanel` sidebar with a draggable floating chat bubble; (2) add click-to-edit calendar day
boxes for manual leave/schedule/holiday CRUD; (3) write backend pytest tests and Playwright UI
tests that run inside the Docker container.

The codebase is a static-export Next.js 16 (output: "export") app served by FastAPI as static
files. There is no SSR, no server actions, and no API routes — every mutation goes through
`apiFetch()` which attaches the JWT Bearer token from `localStorage`. All business-rule enforcement
already exists in FastAPI router modules (`leaves.py`, `schedule.py`, `holidays.py`). The frontend
currently stores the logged-in username in `localStorage.getItem("username")`.

**Primary recommendation:** Implement drag with pure React pointer-event hooks (no external
library). Use a modal dialog triggered by DayBox click for manual CRUD. Add pytest tests under
`backend/tests/` and Playwright tests under `e2e/`. Run both test suites as a separate Docker
Compose service.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Draggable floating chat bubble | Browser / Client | — | Pure CSS position:fixed + pointer events; no SSR needed |
| Chat open/close toggle | Browser / Client | — | Local useState; no server interaction |
| Chat clear (reset history) | Browser / Client | API / Backend | Frontend calls DELETE /api/ai/history |
| Day-click CRUD modal | Browser / Client | — | Modal rendered client-side, mutations via apiFetch |
| Leave add/update/delete | API / Backend | Database | Existing /api/leaves endpoints enforce all rules |
| Schedule primary update | API / Backend | Database | Existing /api/schedule/{date} endpoint |
| Holiday add/update/delete | API / Backend | Database | Existing /api/holidays endpoints |
| Backend unit tests | API / Backend | — | pytest against FastAPI test client |
| Playwright UI tests | Browser / Client | API / Backend | E2E against running Docker container |

---

## Current Codebase Inventory

### AI Panel (current)
- Component: `frontend/components/AIPanel.tsx`
- Rendered as a static sidebar: `width: 320, minWidth: 280, borderLeft` — no positioning
- Used in `app/calendar/page.tsx` as `<AIPanel />` (defaults: `/api/ai/chat`, `/api/ai/history`)
- Used in `app/admin/page.tsx` as `<AIPanel chatEndpoint="/api/ai/admin-chat" clearEndpoint="/api/ai/admin-history" placeholder="..." />`
- Has `clearChat()` which calls `DELETE {clearEndpoint}`
- History held in memory in `backend/routers/ai.py` as `_histories: dict[str, list[dict]]`

### Calendar Component (current)
- `frontend/components/Calendar.tsx` — pure display, receives `leaves`, `schedule`, `holidays` as props
- Passes per-day slices to `DayBox`
- `frontend/components/DayBox.tsx` — renders badges; no onClick, no interactivity
- Neither Calendar nor DayBox receive any callbacks or `onDayClick` prop

### Auth / User Identity
- JWT issued at `/auth/login`, stored in `localStorage` as `"token"` and `"username"`
- `backend/auth.py`: `get_current_user(credentials)` decodes JWT, returns `username` string
- `get_current_admin()` additionally checks `user == "Admin"`
- Frontend reads `localStorage.getItem("username")` for display — available client-side only
- `lib/api.ts` `apiFetch()` reads token from `localStorage` and injects `Authorization: Bearer` header

### Existing API Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | /auth/login | none | returns JWT token |
| GET | /api/calendar?month=YYYY-MM | user | returns leaves, schedule, holidays for month |
| POST | /api/leaves | user | insert own leave; checks primary conflict |
| PUT | /api/leaves/{id} | user | update own leave; checks primary conflict |
| DELETE | /api/leaves/{id} | user | delete own leave |
| PUT | /api/schedule/{date} | user | update primary_oncall only |
| POST | /api/holidays | user | insert holiday |
| PUT | /api/holidays/{id} | user | update holiday |
| DELETE | /api/holidays/{id} | user | delete holiday |
| POST | /api/ai/chat | user | user AI chat |
| DELETE | /api/ai/history | user | clear user AI history |
| POST | /api/ai/admin-chat | admin | admin AI chat |
| DELETE | /api/ai/admin-history | admin | clear admin AI history |
| GET | /admin/members | admin | list members |
| POST | /admin/members | admin | add member |
| PUT | /admin/members/{id} | admin | update member |
| DELETE | /admin/members/{id} | admin | delete member |
| POST | /admin/upload | admin | CSV upload |

### No New Backend Endpoints Required
All CRUD rules are already implemented. The frontend merely needs to call existing endpoints
via `apiFetch`. No new FastAPI routes needed for Feature_01.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| next | 16.2.4 | Frontend framework | Static export mode (output: "export") |
| react | 19.2.4 | UI runtime | Concurrent features available |
| react-dom | 19.2.4 | DOM rendering | |
| fastapi | >=0.136.0 | Backend API | |
| uvicorn | >=0.44.0 | ASGI server | |
| python-jose | >=3.5.0 | JWT | |
| httpx | >=0.28.1 | AI HTTP calls | Also used for pytest test client |

### To Add for Testing
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| pytest | >=8.0 (host has 9.0.3) | Backend unit tests | Add to backend/pyproject.toml as dev dep |
| pytest-asyncio | latest | async FastAPI tests | needed for async endpoints |
| httpx | already present | FastAPI `TestClient` transport | httpx used by fastapi test client |
| @playwright/test | 1.59.1 (npm registry) | E2E UI tests | separate package.json or root-level |

**Note:** `fastapi.testclient.TestClient` uses `httpx` as its transport under the hood in
FastAPI >= 0.100. `httpx` is already a dependency. [VERIFIED: codebase inspection]

**Installation for tests:**
```bash
# Backend dev deps (inside container or locally with uv)
uv add --dev pytest pytest-asyncio

# Playwright (root or e2e/ directory)
npm init -y  # if no root package.json
npm install --save-dev @playwright/test
npx playwright install chromium
```

**Version verification:** [VERIFIED: npm registry 2026-04-29]
- @playwright/test: 1.59.1
- next: 16.2.4 (in package.json)

---

## Architecture Patterns

### Pattern 1: Draggable Floating Chat Bubble (pure React, no library)

**What:** A `position: fixed` element that follows pointer events for drag. A toggle button
opens/closes the chat panel. The bubble starts at a default position and can be repositioned.

**Why no library:** The project forbids over-engineering. `@dnd-kit` and `react-beautiful-dnd` are
designed for list reordering, not free-form window dragging. A simple `onPointerDown` +
`onPointerMove` + `onPointerUp` pattern is 30 lines and has zero dependencies.
[ASSUMED — library avoidance is a judgment call consistent with AGENTS.md "keep it simple"]

**Pattern:**
```tsx
// Source: React pointer events docs — standard pattern
"use client";
import { useState, useRef, useEffect } from "react";

export default function FloatingChat({ chatEndpoint, clearEndpoint, placeholder }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const bubbleRef = useRef<HTMLDivElement>(null);

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
  }
  function onPointerUp() { dragging.current = false; }

  return (
    <div
      ref={bubbleRef}
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 1000, cursor: "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* toggle button */}
      {/* chat panel — shown when open === true */}
    </div>
  );
}
```

**Pitfall:** `window` is not available during SSR. Since this project uses `output: "export"` and
all pages are `"use client"`, this is safe, but initial position must use `useState` with a lazy
initializer or a `useEffect` to set coordinates from `window`.

**Open/Close:** A single boolean `open` state. When closed, show only the chat bubble icon.
When open, show the full chat panel (reuse AIPanel's message list + input UI, extracted or
inlined). The bubble remains draggable whether open or closed.

**Reset:** A "Clear" button inside the open panel calls `DELETE {clearEndpoint}` and clears
local `messages` state — identical to existing `AIPanel.clearChat()`.

### Pattern 2: Day Click Modal for Manual CRUD

**What:** `DayBox` receives an `onDayClick` callback prop. Clicking a day opens a modal in the
parent page. The modal displays current day data and offers Add/Update/Delete actions depending on
the user role and data present.

**Data flow:**
1. `Calendar` receives `onDayClick: (date: string, leaves: Leave[], schedule: Schedule | null, holidays: Holiday[]) => void`
2. `Calendar` passes `onDayClick` down to each `DayBox` along with the already-computed `iso` date string
3. `DayBox` adds `onClick={() => onDayClick(iso, leaves, schedule, holidays)}` on its root div
4. Parent page (`calendar/page.tsx` or `admin/page.tsx`) manages modal state

**Modal logic — user:**
- **Leaves:** Can only add/update/delete their own leave (`username === leave.employee_name`)
  - Add: enabled on any date that does not already have their leave; blocked if they are primary support
  - Update: only for existing own leave; blocked if they are primary support on the new date
  - Delete: only for existing own leave
- **Schedule:** Can update primary_oncall on any date that has a schedule entry (PUT /api/schedule/{date})
- **Holidays:** Can add, update, delete any holiday

**Modal logic — admin:**
- No restrictions on leaves (any member), schedule (primary only), holidays

**Member list for dropdowns:** Use `GET /admin/members` for admin. For regular users, the current
data from the calendar response contains all names — can derive unique member names from
`schedule` and `leaves` data already fetched.

**Key implementation detail:** The existing `Modal` component in `admin/page.tsx` can be extracted
to `components/Modal.tsx` for reuse. A separate `DayCrudModal` component should handle the day
CRUD form logic.

### Pattern 3: Extracting Shared Components

The `Modal` component currently lives inside `admin/page.tsx`. It should be extracted to
`frontend/components/Modal.tsx` so both `calendar/page.tsx` and `admin/page.tsx` can use it
for the CRUD confirmation dialogs.

### Pattern 4: Backend Tests with pytest + FastAPI TestClient

```python
# backend/tests/test_leaves.py
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_add_leave_success(auth_headers):
    resp = client.post("/api/leaves", json={"leave_date": "2026-06-01"}, headers=auth_headers)
    assert resp.status_code == 201

def test_add_leave_primary_conflict(auth_headers_primary):
    # user is primary support on that date
    resp = client.post("/api/leaves", json={"leave_date": "2026-05-01"}, headers=auth_headers_primary)
    assert resp.status_code == 409
```

**Database isolation:** Use a `tmp_path` fixture with a fresh SQLite database per test, patching
`backend.db.DB_PATH`. The `init_db()` call in `@app.on_event("startup")` seeds the test DB.
Alternatively, use a fixture that wraps each test in a transaction that rolls back.

**Key insight:** `TestClient` from `fastapi.testclient` is synchronous and manages lifespan
events (startup/shutdown). It does not require a running server. [VERIFIED: FastAPI docs pattern,
httpx is already a dep]

### Pattern 5: Playwright Tests in Docker

**Approach:** Add a second service `e2e` to `docker-compose.yml` (or a separate
`docker-compose.test.yml`) that uses a `playwright` Docker image, mounts the `e2e/` directory,
and runs tests against the running `app` service via service networking.

```yaml
# docker-compose.test.yml
services:
  app:
    build: .
    ports: ["8000:8000"]
    env_file: .env
    volumes: ["./db:/app/db"]

  e2e:
    image: mcr.microsoft.com/playwright:v1.59.1-jammy
    working_dir: /app
    volumes:
      - ./e2e:/app
    depends_on: [app]
    environment:
      BASE_URL: http://app:8000
    command: npx playwright test
```

[CITED: https://playwright.dev/docs/docker — official Playwright Docker image]

**Test structure:**
```
e2e/
  playwright.config.ts       # baseURL from env BASE_URL
  tests/
    login.spec.ts
    calendar.spec.ts          # floating bubble, day modal
    admin.spec.ts             # admin page interactions
  package.json
```

**Playwright config:**
```ts
// e2e/playwright.config.ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:8000" },
  testDir: "./tests",
});
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag physics / pointer capture | Custom mouse tracking | React pointer events + `setPointerCapture` | Pointer capture handles multi-touch, edge cases, out-of-window drag |
| CRUD business rules | Duplicate in frontend | Trust existing FastAPI responses | Rules are already enforced server-side; frontend just shows error from response |
| JWT decode in frontend | Custom JWT parser | Read `localStorage.getItem("username")` already set at login | No need to decode the token client-side |
| Test database setup | Manual SQL scripts | pytest `tmp_path` + `init_db()` | Clean isolation per test |
| Playwright browser install | Custom Chrome install | Official `mcr.microsoft.com/playwright` Docker image | Includes all browsers with correct dependencies |

---

## Common Pitfalls

### Pitfall 1: `window` undefined in Next.js static export
**What goes wrong:** Using `window.innerWidth` at module or component initialization time causes
a hydration error even in static-export mode when running `next build`.
**Why it happens:** Next.js still runs a build-time render pass; `window` doesn't exist in that
environment.
**How to avoid:** Initialize position in a `useEffect` or use a lazy `useState` initializer that
checks `typeof window !== "undefined"`.
**Warning signs:** `ReferenceError: window is not defined` during `npm run build`.

### Pitfall 2: Drag state in the wrong component
**What goes wrong:** Putting drag state inside `AIPanel` while render occurs in a portal or
parent. Z-index conflicts with `position: fixed` calendar headers.
**How to avoid:** The FloatingChat component uses `position: fixed` directly with a high `zIndex`
(e.g., 1000). No portal needed. Keep drag state fully self-contained in `FloatingChat`.

### Pitfall 3: DayBox click conflicts with badge click
**What goes wrong:** Clicking a badge inside a DayBox also triggers the parent day `onClick`.
**How to avoid:** The DayBox `onClick` handler is on the container div. Badges are read-only
display elements. No nested interactive elements exist, so event bubbling is not an issue unless
`stopPropagation` is called — which it isn't.

### Pitfall 4: Admin-specific leave restriction confusion
**What goes wrong:** The admin page calls the standard user `/api/leaves` endpoints but the
AI assistant (backend `ai.py`) enforces `is_admin` to bypass the "own leaves only" restriction.
The leaves router (`leaves.py`) does NOT have an admin bypass — it uses `get_current_user` and
checks `row["employee_name"] != user`.
**How to avoid:** For the admin manual CRUD modal, the admin must either:
  (a) Use the AI assistant path for other members' leaves (backend already handles), OR
  (b) A new admin-specific leaves endpoint must be added (e.g., `POST /admin/leaves`)
  This is a genuine gap: the backend leaves router enforces ownership for all users including Admin.
**Action required:** Add `POST /admin/leaves`, `PUT /admin/leaves/{id}`, `DELETE /admin/leaves/{id}`
routes in `backend/routers/admin.py` that use `get_current_admin` and skip the ownership check.
Or: add a query param `?as_admin=true` pattern — but a separate admin router is cleaner.

### Pitfall 5: Schedule "add" and "delete" not allowed
**What goes wrong:** Feature spec says "add is allowed for empty dates" for primary support. But
per `AGENTS.md` rules: "Only the Primary Support column may be updated on the support schedule;
Delete and Insert of schedule rows is not allowed." The UI must show update-only for schedule,
not insert/delete.
**How to avoid:** In the DayCrudModal, for schedule rows, only show an "Edit Primary Support"
button — no Add Row or Delete Row. The "add is allowed for empty dates" clause in the feature
spec refers only to vacation leaves, not schedule rows.

### Pitfall 6: Playwright tests against static-export app
**What goes wrong:** Static export means no Next.js dev server API routes. All API traffic goes
to the FastAPI backend on port 8000. Playwright tests must target the full Docker stack (FastAPI
serving static files) not just the Next.js dev server.
**How to avoid:** Always run Playwright against `http://app:8000` (Docker service) or
`http://localhost:8000` (local run), never `http://localhost:3000`.

### Pitfall 7: pytest vs. async FastAPI endpoints
**What goes wrong:** Some FastAPI endpoints use `async def`. `TestClient` is synchronous but
handles async correctly via `anyio`. `pytest-asyncio` is needed only if test functions themselves
are `async def`. Standard `TestClient` usage with sync test functions works without
`pytest-asyncio`.
**How to avoid:** Use `TestClient` with synchronous test functions. Only add `pytest-asyncio`
if async fixtures or async test functions are needed.

---

## API Gaps Identified

### New Backend Endpoints Needed

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /admin/leaves | admin | Insert leave for any member (bypasses ownership check) |
| PUT | /admin/leaves/{leave_id} | admin | Update any member's leave |
| DELETE | /admin/leaves/{leave_id} | admin | Delete any member's leave |

These belong in `backend/routers/admin.py` using `get_current_admin` dependency.
Without these, the admin manual CRUD modal cannot modify other members' leaves (only the AI
assistant path currently bypasses ownership checks).

**Members list endpoint for regular users:**
Currently `GET /admin/members` is admin-only. The day modal for regular users needs a member
list to populate the "change primary support" dropdown. Options:
- Expose `GET /api/members` (new, user-authenticated, returns just names)
- Derive names from already-loaded calendar data (simpler, no new endpoint)

**Recommendation:** Derive member names from `schedule` + `leaves` data in the existing calendar
response. No new endpoint needed for regular users.

---

## Code Examples

### FloatingChat component skeleton
```tsx
// Source: React pointer events — standard pattern [ASSUMED implementation, verified API]
"use client";
import { useState, useRef, useEffect, FormEvent } from "react";
import { apiFetch } from "@/lib/api";

interface Message { role: "user" | "assistant"; content: string; }

interface Props {
  chatEndpoint: string;
  clearEndpoint: string;
  placeholder?: string;
}

export default function FloatingChat({ chatEndpoint, clearEndpoint, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setPos({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
  }
  function onPointerUp() { dragging.current = false; }

  // ... send/clear handlers same as AIPanel
}
```

### DayBox with onClick prop
```tsx
// Minimal change to DayBox.tsx
interface Props {
  date: Date;
  currentMonth: number;
  leaves: Leave[];
  schedule: Schedule | null;
  holidays: Holiday[];
  onDayClick?: () => void;   // new optional prop
}

export default function DayBox({ ..., onDayClick }: Props) {
  return (
    <div
      ...
      onClick={onDayClick}
      style={{ ..., cursor: onDayClick ? "pointer" : "default" }}
    >
      ...
    </div>
  );
}
```

### DayCrudModal interface (conceptual)
```tsx
// New component: frontend/components/DayCrudModal.tsx
// Props: date, leaves, schedule, holidays, username, isAdmin, onClose, onRefresh
// Sections:
//   1. Vacation Leaves: list existing + Add button (own only for user / any for admin)
//   2. Primary Support: show current + Edit button (PUT /api/schedule/{date})
//   3. Holidays: list existing + Add button + Delete per item
```

### FastAPI TestClient pattern
```python
# Source: FastAPI docs — TestClient usage [CITED: fastapi.tiangolo.com/tutorial/testing/]
import pytest
from fastapi.testclient import TestClient
from backend.main import app

@pytest.fixture
def client(tmp_path, monkeypatch):
    import backend.db as db_module
    monkeypatch.setattr(db_module, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(db_module, "DATA_DIR", Path("data"))
    with TestClient(app) as c:
        yield c

@pytest.fixture
def auth_token(client):
    r = client.post("/auth/login", json={"username": "SomeMember", "password": "RSD"})
    return r.json()["token"]
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Container build/run | ✓ | 29.4.0 | — |
| Docker Compose | Multi-service | ✓ | v5.1.1 | — |
| Node.js | Frontend build | ✓ | v24.14.1 | — |
| npm | Package install | ✓ | 11.11.0 | — |
| Python / pytest | Backend tests | ✓ | pytest 9.0.3 | — |
| uv | Python pkg mgr | ✓ | 0.11.7 | — |
| @playwright/test (npm) | E2E tests | ✓ (registry) | 1.59.1 | — |
| mcr.microsoft.com/playwright Docker image | E2E in container | needs pull | v1.59.1 | install locally |

**Missing dependencies with no fallback:** None — all required tools are available.

**Missing dependencies with fallback:** Playwright Docker image must be pulled; if unavailable,
tests can run on the host machine with `npx playwright test` against `localhost:8000`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest 9.0.3 + FastAPI TestClient |
| Config file | `backend/tests/conftest.py` (Wave 0 gap) |
| Quick backend run | `uv run pytest backend/tests/ -x -q` |
| Full backend run | `uv run pytest backend/tests/ -v` |
| Playwright framework | @playwright/test 1.59.1 |
| Playwright config | `e2e/playwright.config.ts` (Wave 0 gap) |
| Playwright run (local) | `cd e2e && npx playwright test` |
| Playwright run (Docker) | `docker compose -f docker-compose.test.yml run e2e` |

### Phase Requirements to Test Map
| Req | Behavior | Test Type | Command |
|-----|----------|-----------|---------|
| F1-AI-DRAG | Bubble is draggable across screen | Playwright | `npx playwright test -g "drag bubble"` |
| F1-AI-TOGGLE | Bubble open/close toggles chat | Playwright | `npx playwright test -g "chat toggle"` |
| F1-AI-CLEAR | Clear resets conversation | Playwright | `npx playwright test -g "chat clear"` |
| F1-AI-ADMIN | Floating bubble works on admin page | Playwright | `npx playwright test -g "admin chat"` |
| F1-CRUD-OWN | User can add their own leave from modal | Playwright + unit | both |
| F1-CRUD-OTHER | User cannot modify another's leave | unit (backend) | `pytest -k "test_leave_ownership"` |
| F1-CRUD-PRIMARY | Leave blocked if user is primary support | unit (backend) | `pytest -k "test_primary_conflict"` |
| F1-CRUD-SCHEDULE | Only primary_oncall can be updated in modal | Playwright | `npx playwright test -g "schedule update"` |
| F1-CRUD-ADMIN | Admin has no restrictions on leaves | unit (backend) | `pytest -k "test_admin_leaves"` |

### Wave 0 Gaps
- [ ] `backend/tests/__init__.py` — empty init
- [ ] `backend/tests/conftest.py` — shared fixtures (TestClient, auth tokens, tmp DB)
- [ ] `backend/tests/test_leaves.py` — leave CRUD tests
- [ ] `backend/tests/test_schedule.py` — schedule update tests
- [ ] `backend/tests/test_holidays.py` — holiday CRUD tests
- [ ] `e2e/package.json` — playwright package
- [ ] `e2e/playwright.config.ts` — config with baseURL
- [ ] `e2e/tests/` — test specs
- [ ] `uv add --dev pytest pytest-asyncio` in backend/pyproject.toml

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | existing JWT + bcrypt |
| V3 Session Management | yes | existing 8-hour JWT expiry |
| V4 Access Control | yes | `get_current_user` / `get_current_admin` FastAPI deps |
| V5 Input Validation | yes | Pydantic models on all request bodies |
| V6 Cryptography | no | no new crypto; existing bcrypt + HS256 unchanged |

No new security surface introduced by the draggable bubble or day modal — both call existing
authenticated endpoints via `apiFetch` which already attaches the Bearer token. The new admin
leave endpoints must use `get_current_admin` dependency, same as the existing admin router.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pure pointer-event drag (no library) is the right approach | Patterns | If drag feel is poor, could switch to @dnd-kit (6.3.1 on registry); low effort to swap |
| A2 | Admin leave CRUD requires new backend endpoints | API Gaps | If admin personal leave can be self-modified via existing endpoints, only "other members" need new routes; test first |
| A3 | Member name list for regular users can be derived from calendar data | API Gaps | If calendar data for some months has no schedule, dropdown would be empty; may need `/api/members` endpoint |
| A4 | `mcr.microsoft.com/playwright` Docker image is pullable from build environment | Environment | If registry blocked, install Playwright inside app Dockerfile or run on host |

---

## Open Questions (RESOLVED)

1. **Admin leave endpoints: new routes vs. elevating existing?**
   - What we know: `leaves.py` uses `get_current_user` and checks ownership
   - What's unclear: Whether the spec intends admin to bypass this via UI (the AI already bypasses it)
   - Recommendation: Add `POST/PUT/DELETE /admin/leaves` in `admin.py` using `get_current_admin`; minimal code
   - RESOLVED: Plan 01 adds `POST /admin/leaves`, `PUT /admin/leaves/{leave_id}`, and `DELETE /admin/leaves/{leave_id}` to `backend/routers/admin.py` using `get_current_admin` dependency, bypassing the ownership check enforced by the standard leaves router.

2. **Primary support "add" for empty schedule dates**
   - What we know: Schedule rows are created by CSV import only; the schedule router has no INSERT
   - What's unclear: Feature spec says "add is allowed for empty dates" — does this mean add a new schedule row?
   - Recommendation: Per AGENTS.md rule "Insert of schedule rows is not allowed", the modal should
     show "No schedule entry for this date" and not offer an add button
   - RESOLVED: Plan 03 implements DayCrudModal to show "No schedule entry for this date" when `schedule === null`, with no Add button for schedule rows. "Add is allowed for empty dates" in the feature spec refers only to vacation leaves.

3. **Playwright test database state**
   - What we know: The Docker app uses a real SQLite DB mounted as a volume
   - What's unclear: Whether tests should seed fresh data or use existing DB
   - Recommendation: Playwright tests should use a dedicated test DB seeded by the container
     startup; OR accept that tests read real data (fragile) — a test-only docker-compose service
     with a fresh volume is the cleanest approach
   - RESOLVED: Plan 04 creates `docker-compose.test.yml` with a separate `db-test` volume, mounting a freshly initialized SQLite database for E2E tests. The `e2e` service depends on the `app-test` service which seeds from `data/` CSV files at startup.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection — all frontend components, backend routers, Dockerfile, docker-compose
- `/e/AI Playground/Projects/claude_teamSchedule/frontend/node_modules/next/dist/docs/` — official Next.js 16 bundled docs
- FastAPI `TestClient` pattern — consistent with FastAPI built-in docs, httpx already installed

### Secondary (MEDIUM confidence)
- Playwright Docker image: `mcr.microsoft.com/playwright:v1.59.1-jammy` — from Playwright official docs pattern [CITED: playwright.dev/docs/docker]
- React pointer events API — standard web API, verified against React 19 docs conventions [ASSUMED stable since React 17]

### Tertiary (LOW confidence)
- None — all critical decisions verified against codebase or official bundled docs

---

## Metadata

**Confidence breakdown:**
- Current codebase inventory: HIGH — direct file inspection
- Standard stack: HIGH — package.json, pyproject.toml verified
- Architecture patterns: HIGH — based on existing code structure
- API gaps: HIGH — cross-referenced leaves.py ownership logic vs. admin intent
- Test patterns: HIGH — pytest and FastAPI TestClient patterns verified
- Playwright Docker: MEDIUM — based on official docs, image pull not tested locally

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (stable stack, no fast-moving dependencies)

---

## RESEARCH COMPLETE
