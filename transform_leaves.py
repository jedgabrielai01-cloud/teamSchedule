"""
Transforms Leave Details 2026.xlsx into normalized CSV and SQL files.
Outputs:
  - leave_records.csv       one row per leave day per employee
  - public_holidays.csv     one row per public holiday
  - leave_insert.sql        SQL INSERT statements for both tables
"""

import openpyxl
import csv
from datetime import date
from pathlib import Path

YEAR = 2026

# Canonical name for aliases found in the spreadsheet
# Short names follow the support schedule as reference
NAME_ALIASES = {
    "Sourabh": "Sourabh Kumar",
    "Edgar Allen Gayya": "Edgar",
    "Kiran M": "Kiran",
    "Pranay Krishna Sao": "Pranay",
}

MONTH_MAP = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "June": 6,
    "July": 7, "Aug": 8, "Sept": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}

SOURCE = Path("Leave Details 2026.xlsx")
OUT_DIR = Path("data")


def parse_days(value) -> list[int]:
    if value is None:
        return []
    if isinstance(value, (int, float)):
        return [int(value)]
    s = str(value).strip()
    if not s:
        return []
    # "X to Y" range
    lower = s.lower()
    if " to " in lower:
        parts = lower.split(" to ")
        try:
            return list(range(int(parts[0].strip()), int(parts[1].strip()) + 1))
        except ValueError:
            return []
    # comma-separated
    days = []
    for part in s.split(","):
        part = part.strip()
        if part:
            try:
                days.append(int(part))
            except ValueError:
                pass
    return days


def normalize_name(value) -> str | None:
    if not value:
        return None
    name = " ".join(str(value).strip().split()).title()
    return NAME_ALIASES.get(name, name)


def is_date_like(value) -> bool:
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return True
    return any(c.isdigit() for c in str(value))


def is_location(value) -> bool:
    """True when cell looks like a place/org name rather than date numbers."""
    if value is None or isinstance(value, (int, float)):
        return False
    s = str(value).strip()
    return any(c.isalpha() for c in s) and not any(c.isdigit() for c in s)


def make_date(year, month, day) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        print(f"  WARNING: skipping invalid date {year}-{month:02d}-{day:02d}")
        return None


def build_records(wb) -> tuple[list[dict], list[dict]]:
    leaves = []
    holidays = []

    for sheet_name, month_num in MONTH_MAP.items():
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue

        header = rows[0]
        ph_col = next(
            (i for i, c in enumerate(header) if c and "PH" in str(c)), None
        )

        for row in rows[1:]:
            if not any(c is not None for c in row):
                continue

            emp = normalize_name(row[0]) if row else None
            dates_raw = row[1] if len(row) > 1 else None
            leave_type = (
                str(row[2]).strip() if len(row) > 2 and row[2] else None
            )

            # Employee leave record
            if emp and is_date_like(dates_raw):
                for day in parse_days(dates_raw):
                    d = make_date(YEAR, month_num, day)
                    if d:
                        leaves.append(
                            {
                                "employee_name": emp,
                                "leave_date": d.isoformat(),
                                "leave_type": leave_type,
                            }
                        )

            # Public holidays
            if ph_col is not None and len(row) > ph_col:
                ph_val = row[ph_col]
                next_val = row[ph_col + 1] if len(row) > ph_col + 1 else None

                if is_location(ph_val):
                    # Sub-table: location in ph_col, dates in next col
                    location = str(ph_val).strip()
                    for day in parse_days(next_val):
                        d = make_date(YEAR, month_num, day)
                        if d:
                            holidays.append(
                                {
                                    "holiday_date": d.isoformat(),
                                    "description": None,
                                    "location": location,
                                }
                            )
                elif is_date_like(ph_val):
                    desc = (
                        str(next_val).strip()
                        if next_val and isinstance(next_val, str) and not is_date_like(next_val)
                        else None
                    )
                    for day in parse_days(ph_val):
                        d = make_date(YEAR, month_num, day)
                        if d:
                            holidays.append(
                                {
                                    "holiday_date": d.isoformat(),
                                    "description": desc,
                                    "location": None,
                                }
                            )

    # Deduplicate holidays by (date, location)
    seen = set()
    unique_holidays = []
    for h in holidays:
        key = (h["holiday_date"], h.get("location") or "")
        if key not in seen:
            seen.add(key)
            unique_holidays.append(h)

    return leaves, unique_holidays


def write_csv(records: list[dict], path: Path):
    if not records:
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(records[0].keys()))
        writer.writeheader()
        writer.writerows(records)
    print(f"Written {len(records)} rows -> {path}")


def write_sql(leaves: list[dict], holidays: list[dict], path: Path):
    lines = [
        "-- ============================================================",
        "-- Leave Details 2026 — auto-generated INSERT statements",
        "-- ============================================================",
        "",
        "CREATE TABLE IF NOT EXISTS leaves (",
        "    id         INTEGER PRIMARY KEY AUTOINCREMENT,",
        "    employee_name TEXT    NOT NULL,",
        "    leave_date    DATE    NOT NULL,",
        "    leave_type    TEXT",
        ");",
        "",
        "CREATE TABLE IF NOT EXISTS public_holidays (",
        "    id           INTEGER PRIMARY KEY AUTOINCREMENT,",
        "    holiday_date DATE    NOT NULL,",
        "    description  TEXT,",
        "    location     TEXT",
        ");",
        "",
        "-- Leave records",
    ]

    for r in leaves:
        lt = f"'{r['leave_type']}'" if r["leave_type"] else "NULL"
        lines.append(
            f"INSERT INTO leaves (employee_name, leave_date, leave_type) "
            f"VALUES ('{r['employee_name']}', '{r['leave_date']}', {lt});"
        )

    lines += ["", "-- Public holidays"]
    for h in holidays:
        desc = f"'{h['description']}'" if h["description"] else "NULL"
        loc = f"'{h['location']}'" if h["location"] else "NULL"
        lines.append(
            f"INSERT INTO public_holidays (holiday_date, description, location) "
            f"VALUES ('{h['holiday_date']}', {desc}, {loc});"
        )

    path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Written SQL -> {path}")


def main():
    wb = openpyxl.load_workbook(SOURCE)
    leaves, holidays = build_records(wb)

    write_csv(leaves, OUT_DIR / "leave_records.csv")
    write_csv(holidays, OUT_DIR / "public_holidays.csv")
    write_sql(leaves, holidays, OUT_DIR / "leave_insert.sql")

    print(f"\nSummary: {len(leaves)} leave records, {len(holidays)} public holidays")


if __name__ == "__main__":
    main()
