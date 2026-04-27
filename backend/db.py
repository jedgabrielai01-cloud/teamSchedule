import sqlite3
from pathlib import Path
from typing import Generator

import bcrypt

DB_PATH = Path("db/schedule.db")
DATA_DIR = Path("data")


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _seed(conn: sqlite3.Connection):
    for sql_file in [DATA_DIR / "leave_insert.sql", DATA_DIR / "schedule_insert.sql"]:
        conn.executescript(sql_file.read_text(encoding="utf-8"))

    names = set()
    for row in conn.execute("SELECT DISTINCT employee_name FROM leaves"):
        names.add(row[0])
    for row in conn.execute(
        "SELECT primary_oncall, secondary_oncall, backup_oncall, onshore_oncall FROM support_schedule"
    ):
        for name in row:
            if name:
                names.add(name)

    conn.execute(
        "CREATE TABLE IF NOT EXISTS users ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "username TEXT NOT NULL UNIQUE,"
        "password_hash TEXT NOT NULL"
        ")"
    )

    hashed = bcrypt.hashpw(b"RSD", bcrypt.gensalt()).decode()
    for name in names:
        conn.execute(
            "INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)",
            (name, hashed),
        )
    conn.commit()


def _ensure_admin(conn: sqlite3.Connection):
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "username TEXT NOT NULL UNIQUE,"
        "password_hash TEXT NOT NULL"
        ")"
    )
    hashed = bcrypt.hashpw(b"RSD", bcrypt.gensalt()).decode()
    conn.execute(
        "INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)",
        ("Admin", hashed),
    )
    conn.commit()


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    is_new = not DB_PATH.exists()
    conn = _get_connection()
    if is_new:
        _seed(conn)
    _ensure_admin(conn)
    conn.close()


def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = _get_connection()
    try:
        yield conn
    finally:
        conn.close()
