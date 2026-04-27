"""
Transforms Support Schedule 2026.xlsx into normalized CSV and SQL files.
Outputs:
  - support_schedule.csv     one row per scheduled date
  - schedule_insert.sql      SQL INSERT statements
"""

import openpyxl
import csv
from pathlib import Path

SOURCE = Path("Support Schedule 2026.xlsx")
OUT_DIR = Path("data")

# Canonical name for aliases found in the spreadsheet
NAME_ALIASES = {
    "Sourabh": "Sourabh Kumar",
}


def normalize_name(value) -> str | None:
    if not value:
        return None
    name = " ".join(str(value).strip().split()).title()
    return NAME_ALIASES.get(name, name)


def build_records(wb) -> list[dict]:
    ws = wb["Schedule"]
    rows = list(ws.iter_rows(values_only=True))

    if not rows:
        return []

    records = []
    for row in rows[1:]:  # skip header
        date_val = row[0] if len(row) > 0 else None
        if date_val is None:
            continue

        primary = normalize_name(row[1]) if len(row) > 1 else None
        secondary = normalize_name(row[2]) if len(row) > 2 else None
        backup = normalize_name(row[3]) if len(row) > 3 else None
        onshore = normalize_name(row[4]) if len(row) > 4 else None
        comments = str(row[5]).strip() if len(row) > 5 and row[5] else None

        # Skip rows with no assignments at all
        if not any([primary, secondary, backup, onshore]):
            continue

        schedule_date = date_val.date() if hasattr(date_val, "date") else date_val

        records.append(
            {
                "schedule_date": schedule_date.isoformat(),
                "primary_oncall": primary,
                "secondary_oncall": secondary,
                "backup_oncall": backup,
                "onshore_oncall": onshore,
                "comments": comments,
            }
        )

    return records


def write_csv(records: list[dict], path: Path):
    if not records:
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(records[0].keys()))
        writer.writeheader()
        writer.writerows(records)
    print(f"Written {len(records)} rows -> {path}")


def write_sql(records: list[dict], path: Path):
    lines = [
        "-- ============================================================",
        "-- Support Schedule 2026 — auto-generated INSERT statements",
        "-- ============================================================",
        "",
        "CREATE TABLE IF NOT EXISTS support_schedule (",
        "    id               INTEGER PRIMARY KEY AUTOINCREMENT,",
        "    schedule_date    DATE    NOT NULL,",
        "    primary_oncall   TEXT,",
        "    secondary_oncall TEXT,",
        "    backup_oncall    TEXT,",
        "    onshore_oncall   TEXT,",
        "    comments         TEXT",
        ");",
        "",
        "-- Schedule records",
    ]

    def q(val):
        return f"'{val}'" if val else "NULL"

    for r in records:
        lines.append(
            f"INSERT INTO support_schedule "
            f"(schedule_date, primary_oncall, secondary_oncall, backup_oncall, onshore_oncall, comments) "
            f"VALUES ("
            f"'{r['schedule_date']}', {q(r['primary_oncall'])}, {q(r['secondary_oncall'])}, "
            f"{q(r['backup_oncall'])}, {q(r['onshore_oncall'])}, {q(r['comments'])});"
        )

    path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Written SQL -> {path}")


def main():
    wb = openpyxl.load_workbook(SOURCE)
    records = build_records(wb)

    write_csv(records, OUT_DIR / "support_schedule.csv")
    write_sql(records, OUT_DIR / "schedule_insert.sql")

    print(f"\nSummary: {len(records)} schedule records")


if __name__ == "__main__":
    main()
