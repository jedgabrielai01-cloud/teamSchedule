"use client";
import { useState, FormEvent } from "react";
import { apiFetch } from "@/lib/api";

interface Leave {
  id: number;
  employee_name: string;
  leave_date: string;
  leave_type: string | null;
}

interface Schedule {
  schedule_date: string;
  primary_oncall: string | null;
  secondary_oncall: string | null;
  backup_oncall: string | null;
  onshore_oncall: string | null;
}

interface Props {
  date: Date;
  leaves: Leave[];
  schedule: Schedule | null;
  currentUser: string;
  isAdmin: boolean;
  members: string[];
  onClose: () => void;
  onMutate: () => void;
}

const LEAVE_TYPES = ["Annual Leave", "Sick Leave", "Personal Leave", "Other"];

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DayModal({
  date,
  leaves,
  schedule,
  currentUser,
  isAdmin,
  members,
  onClose,
  onMutate,
}: Props) {
  const iso = toIso(date);

  const [editingSupport, setEditingSupport] = useState(false);
  const [newPrimary, setNewPrimary] = useState(schedule?.primary_oncall ?? "");
  const [supportError, setSupportError] = useState("");

  const [addLeaveType, setAddLeaveType] = useState("Annual Leave");
  const [addMember, setAddMember] = useState(members[0] ?? "");

  const [editLeaveId, setEditLeaveId] = useState<number | null>(null);
  const [editLeaveType, setEditLeaveType] = useState("");

  const [leaveError, setLeaveError] = useState("");

  const userLeave = leaves.find((l) => l.employee_name === currentUser) ?? null;
  const isUserPrimary = schedule?.primary_oncall === currentUser;
  const canUserAddLeave = !isUserPrimary && !userLeave;

  async function handleUpdateSupport(e: FormEvent) {
    e.preventDefault();
    setSupportError("");
    const res = await apiFetch(`/api/schedule/${iso}`, {
      method: "PUT",
      body: JSON.stringify({ primary_oncall: newPrimary }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSupportError(err.detail ?? "Failed to update.");
      return;
    }
    onMutate();
    onClose();
  }

  async function handleAddLeave(e: FormEvent) {
    e.preventDefault();
    setLeaveError("");
    const endpoint = isAdmin ? "/admin/leaves" : "/api/leaves";
    const body = isAdmin
      ? { employee_name: addMember, leave_date: iso, leave_type: addLeaveType }
      : { leave_date: iso, leave_type: addLeaveType };
    const res = await apiFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setLeaveError(err.detail ?? "Failed to add leave.");
      return;
    }
    onMutate();
    onClose();
  }

  async function handleUpdateLeave(e: FormEvent) {
    e.preventDefault();
    if (editLeaveId === null) return;
    setLeaveError("");
    const leave = leaves.find((l) => l.id === editLeaveId)!;
    const endpoint = isAdmin ? `/admin/leaves/${editLeaveId}` : `/api/leaves/${editLeaveId}`;
    const body = isAdmin
      ? { employee_name: leave.employee_name, leave_date: iso, leave_type: editLeaveType }
      : { leave_date: iso, leave_type: editLeaveType };
    const res = await apiFetch(endpoint, { method: "PUT", body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setLeaveError(err.detail ?? "Failed to update leave.");
      return;
    }
    onMutate();
    onClose();
  }

  async function handleDeleteLeave(leaveId: number) {
    setLeaveError("");
    const endpoint = isAdmin ? `/admin/leaves/${leaveId}` : `/api/leaves/${leaveId}`;
    const res = await apiFetch(endpoint, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setLeaveError(err.detail ?? "Failed to delete leave.");
      return;
    }
    onMutate();
    onClose();
  }

  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        data-testid="day-modal"
        className="rounded-xl p-6 w-full max-w-md mx-4 shadow-xl border"
        style={{ background: "#252d3f", borderColor: "#2d3a52" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-base" style={{ color: "#e2e8f0" }}>
            {formattedDate}
          </h3>
          <button
            onClick={onClose}
            data-testid="modal-close"
            className="text-xl leading-none hover:opacity-70"
            style={{ color: "#6b7a99" }}
          >
            ×
          </button>
        </div>

        {/* Primary Support */}
        <section className="mb-5">
          <p className="text-xs uppercase tracking-wide mb-2 font-medium" style={{ color: "#6b7a99" }}>
            Primary Support
          </p>
          {schedule ? (
            editingSupport ? (
              <form onSubmit={handleUpdateSupport} className="flex flex-col gap-2">
                <input
                  type="text"
                  value={newPrimary}
                  onChange={(e) => setNewPrimary(e.target.value)}
                  placeholder="Name"
                  className="rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                  style={{ background: "#1a2235", border: "1px solid #2d3a52", color: "#e2e8f0" }}
                />
                {supportError && (
                  <p className="text-xs" style={{ color: "#f0a070" }}>{supportError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg text-white text-xs font-medium hover:opacity-80"
                    style={{ background: "#4A78C2" }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingSupport(false); setSupportError(""); }}
                    className="px-3 py-1.5 rounded-lg text-xs border hover:opacity-80"
                    style={{ borderColor: "#2d3a52", color: "#a0aec0" }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm" style={{ color: schedule.primary_oncall ? "#93b8f5" : "#6b7a99" }}>
                  {schedule.primary_oncall ?? "Not set"}
                </span>
                <button
                  onClick={() => { setNewPrimary(schedule.primary_oncall ?? ""); setEditingSupport(true); }}
                  className="text-xs px-2 py-1 rounded hover:opacity-80"
                  style={{ background: "#3a4a6a", color: "#a0aec0" }}
                >
                  Edit
                </button>
              </div>
            )
          ) : (
            <p className="text-xs" style={{ color: "#6b7a99" }}>No schedule entry for this date.</p>
          )}
        </section>

        <div style={{ height: 1, background: "#2d3a52", marginBottom: 20 }} />

        {/* Vacation Leaves */}
        <section>
          <p className="text-xs uppercase tracking-wide mb-2 font-medium" style={{ color: "#6b7a99" }}>
            Vacation Leaves
          </p>

          {leaves.length === 0 && (
            <p className="text-xs mb-3" style={{ color: "#6b7a99" }}>No leaves on this day.</p>
          )}

          {leaves.map((leave) => {
            const canManage = isAdmin || leave.employee_name === currentUser;
            return (
              <div key={leave.id} className="mb-3">
                {editLeaveId === leave.id ? (
                  <form onSubmit={handleUpdateLeave} className="flex flex-col gap-2">
                    <p className="text-sm font-medium" style={{ color: "#e2e8f0" }}>{leave.employee_name}</p>
                    <select
                      value={editLeaveType}
                      onChange={(e) => setEditLeaveType(e.target.value)}
                      className="rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                      style={{ background: "#1a2235", border: "1px solid #2d3a52", color: "#e2e8f0" }}
                    >
                      {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg text-white text-xs font-medium hover:opacity-80"
                        style={{ background: "#4A78C2" }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditLeaveId(null); setLeaveError(""); }}
                        className="px-3 py-1.5 rounded-lg text-xs border hover:opacity-80"
                        style={{ borderColor: "#2d3a52", color: "#a0aec0" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium" style={{ color: "#fdb882" }}>
                        {leave.employee_name}
                      </span>
                      <span className="text-xs ml-2" style={{ color: "#6b7a99" }}>
                        {leave.leave_type ?? "Leave"}
                      </span>
                    </div>
                    {canManage && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditLeaveId(leave.id); setEditLeaveType(leave.leave_type ?? "Annual Leave"); setLeaveError(""); }}
                          className="text-xs px-2 py-1 rounded hover:opacity-80"
                          style={{ background: "#5F8FD6", color: "#fff" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteLeave(leave.id)}
                          className="text-xs px-2 py-1 rounded hover:opacity-80"
                          style={{ background: "#E0642F", color: "#fff" }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {leaveError && <p className="text-xs mb-2" style={{ color: "#f0a070" }}>{leaveError}</p>}

          {(isAdmin || canUserAddLeave) && editLeaveId === null && (
            <form
              onSubmit={handleAddLeave}
              className="mt-2 flex flex-col gap-2 pt-3 border-t"
              style={{ borderColor: "#2d3a52" }}
            >
              <p className="text-xs font-medium" style={{ color: "#a0aec0" }}>Add Leave</p>
              {isAdmin && (
                <select
                  value={addMember}
                  onChange={(e) => setAddMember(e.target.value)}
                  className="rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                  style={{ background: "#1a2235", border: "1px solid #2d3a52", color: "#e2e8f0" }}
                >
                  {members.map((m) => <option key={m}>{m}</option>)}
                </select>
              )}
              <select
                value={addLeaveType}
                onChange={(e) => setAddLeaveType(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                style={{ background: "#1a2235", border: "1px solid #2d3a52", color: "#e2e8f0" }}
              >
                {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg text-white text-xs font-medium hover:opacity-80 self-start"
                style={{ background: "#4A78C2" }}
              >
                Add Leave
              </button>
            </form>
          )}

          {!isAdmin && !canUserAddLeave && isUserPrimary && (
            <p className="text-xs mt-2" style={{ color: "#f0a070" }}>
              You are Primary Support on this date — leave cannot be added.
            </p>
          )}
        </section>

        <div
          style={{
            height: 2,
            borderRadius: "0 0 8px 8px",
            marginTop: 20,
            background: "linear-gradient(90deg, #2d5ca8, #4A78C2, #D8B5A6, #F07A3F)",
          }}
        />
      </div>
    </div>
  );
}
