def test_admin_add_leave_for_any_member(client, admin_headers):
    r = client.post(
        "/admin/leaves",
        json={"employee_name": "Bob", "leave_date": "2026-06-05", "leave_type": "Annual Leave"},
        headers=admin_headers,
    )
    assert r.status_code == 201
    assert r.json()["employee_name"] == "Bob"


def test_admin_add_leave_primary_conflict_still_blocked(client, admin_headers):
    r = client.post(
        "/admin/leaves",
        json={"employee_name": "Alice", "leave_date": "2026-06-01"},
        headers=admin_headers,
    )
    assert r.status_code == 409
    assert "Primary Support" in r.json()["detail"]


def test_non_admin_cannot_reach_admin_leave_endpoint(client, alice_headers):
    r = client.post(
        "/admin/leaves",
        json={"employee_name": "Bob", "leave_date": "2026-06-05"},
        headers=alice_headers,
    )
    assert r.status_code == 403


def test_admin_update_any_leave(client, admin_headers, db):
    db.execute(
        "INSERT INTO leaves (employee_name, leave_date, leave_type) VALUES ('Bob', '2026-06-05', 'Annual Leave')"
    )
    db.commit()
    leave_id = db.execute("SELECT id FROM leaves WHERE employee_name='Bob'").fetchone()["id"]
    r = client.put(
        f"/admin/leaves/{leave_id}",
        json={"employee_name": "Bob", "leave_date": "2026-06-05", "leave_type": "Sick Leave"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert r.json()["leave_type"] == "Sick Leave"


def test_admin_update_leave_not_found(client, admin_headers):
    r = client.put(
        "/admin/leaves/99999",
        json={"employee_name": "Bob", "leave_date": "2026-06-05"},
        headers=admin_headers,
    )
    assert r.status_code == 404


def test_admin_delete_any_leave(client, admin_headers, db):
    db.execute(
        "INSERT INTO leaves (employee_name, leave_date, leave_type) VALUES ('Bob', '2026-06-06', NULL)"
    )
    db.commit()
    leave_id = db.execute("SELECT id FROM leaves WHERE employee_name='Bob'").fetchone()["id"]
    r = client.delete(f"/admin/leaves/{leave_id}", headers=admin_headers)
    assert r.status_code == 204


def test_admin_delete_leave_not_found(client, admin_headers):
    r = client.delete("/admin/leaves/99999", headers=admin_headers)
    assert r.status_code == 404
