import os
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "test_secret_key_for_tests_only")
os.environ.setdefault("OPENROUTER_API_KEY", "test_key_not_used")

import sqlite3

import bcrypt
import pytest
from fastapi.testclient import TestClient

from backend.auth import create_token
from backend.db import get_db
from backend.main import app

SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
);
CREATE TABLE leaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_name TEXT NOT NULL,
    leave_date DATE NOT NULL,
    leave_type TEXT
);
CREATE TABLE public_holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    holiday_date DATE NOT NULL,
    description TEXT,
    location TEXT
);
CREATE TABLE support_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_date DATE NOT NULL,
    primary_oncall TEXT,
    secondary_oncall TEXT,
    backup_oncall TEXT,
    onshore_oncall TEXT,
    comments TEXT
);
"""


@pytest.fixture
def db():
    # check_same_thread=False required because FastAPI runs handlers in a thread pool
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    pw = bcrypt.hashpw(b"RSD", bcrypt.gensalt()).decode()
    conn.execute("INSERT INTO users (username, password_hash) VALUES ('Alice', ?)", (pw,))
    conn.execute("INSERT INTO users (username, password_hash) VALUES ('Bob', ?)", (pw,))
    conn.execute("INSERT INTO users (username, password_hash) VALUES ('Admin', ?)", (pw,))
    conn.execute(
        "INSERT INTO support_schedule (schedule_date, primary_oncall, secondary_oncall, backup_oncall, onshore_oncall)"
        " VALUES ('2026-06-01', 'Alice', 'Bob', NULL, NULL)"
    )
    conn.execute(
        "INSERT INTO support_schedule (schedule_date, primary_oncall, secondary_oncall, backup_oncall, onshore_oncall)"
        " VALUES ('2026-06-02', 'Bob', 'Alice', NULL, NULL)"
    )
    conn.commit()
    yield conn
    conn.close()


@pytest.fixture
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    # Patch init_db so startup does not try to create or seed a real database file
    with patch("backend.main.init_db"):
        with TestClient(app) as c:
            yield c
    app.dependency_overrides.clear()


@pytest.fixture
def alice_headers():
    return {"Authorization": f"Bearer {create_token('Alice')}"}


@pytest.fixture
def admin_headers():
    return {"Authorization": f"Bearer {create_token('Admin')}"}
