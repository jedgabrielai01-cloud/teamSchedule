---
phase: Feature_01
slug: feature-01
date: 2026-04-29
---

# Feature_01 — Validation Strategy

## Test Framework

| Property | Value |
|----------|-------|
| Backend framework | pytest 9.0.3 + FastAPI TestClient |
| Config file | `backend/tests/conftest.py` |
| Quick backend run | `uv run pytest backend/tests/ -x -q` |
| Full backend run | `uv run pytest backend/tests/ -v` |
| Playwright framework | @playwright/test 1.59.1 |
| Playwright config | `e2e/playwright.config.ts` |
| Playwright run (local) | `cd e2e && npx playwright test` |
| Playwright run (Docker) | `docker compose -f docker-compose.test.yml run e2e` |

## Requirement-to-Test Map

| Req ID | Behavior | Test Type | Command |
|--------|----------|-----------|---------|
| F1-AI-DRAG | Bubble is draggable across screen | Playwright | `npx playwright test -g "drag bubble"` |
| F1-AI-TOGGLE | Bubble open/close toggles chat | Playwright | `npx playwright test -g "chat toggle"` |
| F1-AI-CLEAR | Clear resets conversation | Playwright | `npx playwright test -g "chat clear"` |
| F1-AI-ADMIN | Floating bubble works on admin page | Playwright | `npx playwright test -g "admin chat"` |
| F1-CRUD-OWN | User can add their own leave from modal | Playwright + unit | both |
| F1-CRUD-OTHER | User cannot modify another member's leave | unit (backend) | `uv run pytest -k "test_leave_ownership"` |
| F1-CRUD-PRIMARY | Leave blocked if user is primary support | unit (backend) | `uv run pytest -k "test_primary_conflict"` |
| F1-CRUD-SCHEDULE | Only primary_oncall can be updated in modal | Playwright | `npx playwright test -g "schedule update"` |
| F1-CRUD-HOLIDAY | Any user can add, update, delete holidays | unit + Playwright | both |
| F1-CRUD-ADMIN | Admin has no restrictions on leaves | unit (backend) | `uv run pytest -k "test_admin_leaves"` |

## Backend Test Files

| File | Tests |
|------|-------|
| `backend/tests/conftest.py` | Shared fixtures: TestClient, auth tokens, tmp DB, admin token |
| `backend/tests/test_leaves.py` | Add own leave, blocked if primary support, cannot modify other's leave, admin can modify any leave |
| `backend/tests/test_schedule.py` | Update primary_oncall succeeds, cannot insert/delete schedule row |
| `backend/tests/test_holidays.py` | Add holiday, update holiday, delete holiday |

## Playwright E2E Test Files

| File | Tests |
|------|-------|
| `e2e/tests/login.spec.ts` | Valid login redirects to calendar, invalid login shows error |
| `e2e/tests/calendar.spec.ts` | Floating bubble visible, toggle open/close, drag to new position, clear chat, day click opens modal, add leave from modal, close modal |
| `e2e/tests/admin.spec.ts` | Admin floating bubble visible on admin page, admin can add leave for other member via modal |

## Sampling Continuity

All business rules enforced server-side (FastAPI) are covered by unit tests. All user-facing UI behaviors are covered by Playwright E2E tests running against the full Docker stack. Both test suites must pass before the phase is considered complete.

## Run Order

1. Backend tests first (faster, no Docker required): `uv run pytest backend/tests/ -v`
2. Build Docker image: `docker compose build`
3. Playwright E2E tests in Docker: `docker compose -f docker-compose.test.yml run e2e`
4. Verify exit codes for both: both must be 0
