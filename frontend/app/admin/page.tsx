"use client";
import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import AIPanel from "@/components/AIPanel";
import Calendar from "@/components/Calendar";

type Tab = "calendar" | "members" | "upload";

interface Member {
  id: number;
  name: string;
  is_primary_support: boolean;
}

interface UploadResult {
  status: "success" | "overlap_warning" | "validation_error";
  errors?: string[];
  overlap_leave_dates?: string[];
  overlap_schedule_dates?: string[];
  inserted_leaves?: number;
  inserted_schedule?: number;
}

interface CalendarData {
  leaves: unknown[];
  schedule: unknown[];
  holidays: unknown[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const LEGEND = [
  { bg: "#2d5ca8", label: "Primary" },
  { bg: "#3a6ab5", label: "Secondary" },
  { bg: "#3a5080", label: "Backup" },
  { bg: "#5a3a30", label: "Onshore" },
  { bg: "#7a3a18", label: "On Leave" },
  { bg: "#6a2a10", label: "Holiday" },
];

function Modal({
  title,
  message,
  onClose,
  onConfirm,
  confirmLabel = "Confirm",
  isWarning = false,
}: {
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  isWarning?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div
        className="rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl border"
        style={{ background: "#252d3f", borderColor: "#2d3a52" }}
      >
        <h3
          className="font-semibold text-base mb-3"
          style={{ color: isWarning ? "#f0a070" : "#e2e8f0" }}
        >
          {title}
        </h3>
        <p className="text-sm mb-5 whitespace-pre-wrap" style={{ color: "#a0aec0" }}>{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border hover:opacity-80"
            style={{ borderColor: "#2d3a52", color: "#a0aec0", background: "#1a2235" }}
          >
            {onConfirm ? "Cancel" : "OK"}
          </button>
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg text-sm text-white hover:opacity-80"
              style={{ background: isWarning ? "#E0642F" : "#4A78C2" }}
            >
              {confirmLabel}
            </button>
          )}
        </div>
        <div
          style={{ height: 2, borderRadius: "0 0 8px 8px", marginTop: 16, background: "linear-gradient(90deg, #2d5ca8, #4A78C2, #D8B5A6, #F07A3F)" }}
        />
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("calendar");
  const now = new Date();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    if (!token || username !== "Admin") {
      router.replace(token ? "/calendar" : "/login");
    }
  }, [router]);

  // ── Calendar ──────────────────────────────────────────────────────────────
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calData, setCalData] = useState<CalendarData>({ leaves: [], schedule: [], holidays: [] });
  const calIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCalData = useCallback(async () => {
    const monthStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
    const res = await apiFetch(`/api/calendar?month=${monthStr}`);
    if (res.ok) setCalData(await res.json());
  }, [calYear, calMonth]);

  useEffect(() => {
    fetchCalData();
    calIntervalRef.current = setInterval(fetchCalData, 5000);
    return () => { if (calIntervalRef.current) clearInterval(calIntervalRef.current); };
  }, [fetchCalData]);

  function prevCalMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }

  function nextCalMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  // ── Interface 1: Team Members ─────────────────────────────────────────────
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [modal, setModal] = useState<{
    title: string;
    message: string;
    onConfirm?: () => void;
    isWarning?: boolean;
  } | null>(null);

  const fetchMembers = useCallback(async () => {
    const res = await apiFetch("/admin/members");
    if (res.ok) setMembers(await res.json());
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  async function addMember(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const res = await apiFetch("/admin/members", { method: "POST", body: JSON.stringify({ name }) });
    if (res.ok) { setNewName(""); fetchMembers(); }
    else {
      const data = await res.json();
      setModal({ title: "Cannot Add Member", message: data.detail, isWarning: true });
    }
  }

  async function saveMember(id: number) {
    const name = editName.trim();
    if (!name) return;
    const res = await apiFetch(`/admin/members/${id}`, { method: "PUT", body: JSON.stringify({ name }) });
    if (res.ok) { setEditingId(null); fetchMembers(); }
    else {
      const data = await res.json();
      setModal({ title: "Cannot Update Member", message: data.detail, isWarning: true });
    }
  }

  function promptDelete(id: number, name: string, isPrimary: boolean) {
    if (isPrimary) {
      setModal({
        title: "Cannot Delete Member",
        message: `"${name}" is assigned as Primary Support on future dates.\n\nPlease reassign their Primary Support entries first, then retry the deletion.`,
        isWarning: true,
      });
      return;
    }
    setModal({
      title: "Delete Member",
      message: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      onConfirm: async () => {
        setModal(null);
        const res = await apiFetch(`/admin/members/${id}`, { method: "DELETE" });
        if (res.status !== 204) {
          const data = await res.json();
          setModal({ title: "Cannot Delete Member", message: data.detail, isWarning: true });
        } else {
          fetchMembers();
        }
      },
    });
  }

  // ── Interface 2: CSV Upload ───────────────────────────────────────────────
  const [leaveFile, setLeaveFile] = useState<File | null>(null);
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [overlapData, setOverlapData] = useState<UploadResult | null>(null);

  async function submitUpload(confirm = false) {
    if (!leaveFile && !scheduleFile) return;
    setUploadResult(null);
    const form = new FormData();
    if (leaveFile) form.append("leave_file", leaveFile);
    if (scheduleFile) form.append("schedule_file", scheduleFile);
    form.append("confirm", String(confirm));
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch("/admin/upload", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data: UploadResult = await res.json();
    if (data.status === "overlap_warning") {
      setOverlapData(data);
    } else {
      setOverlapData(null);
      setUploadResult(data);
      if (data.status === "success") { setLeaveFile(null); setScheduleFile(null); }
    }
  }

  function buildOverlapMessage(data: UploadResult): string {
    const lines = [
      "The uploaded file(s) contain dates that already exist in the database. Proceeding will permanently replace the existing data for those dates.",
      "",
    ];
    if (data.overlap_leave_dates?.length) lines.push(`Leave records: ${data.overlap_leave_dates.length} overlapping date(s).`);
    if (data.overlap_schedule_dates?.length) lines.push(`Schedule records: ${data.overlap_schedule_dates.length} overlapping date(s).`);
    lines.push("", "This action cannot be undone. Do you want to proceed?");
    return lines.join("\n");
  }

  // ── Shared ────────────────────────────────────────────────────────────────
  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    router.push("/login");
  }

  const TAB_LABELS: Record<Tab, string> = {
    calendar: "Calendar",
    members: "Team Members",
    upload: "CSV Upload",
  };

  return (
    <div className="flex flex-col h-screen" style={{ background: "#1e2433" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-3 text-white shrink-0"
        style={{ background: "linear-gradient(135deg, #1a3a6e, #2d5ca8)" }}
      >
        <span className="font-bold text-lg">Team Schedule — Admin</span>
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-80">Admin</span>
          <button
            onClick={logout}
            className="text-xs border border-white/50 rounded px-3 py-1 hover:bg-white/10"
          >
            Logout
          </button>
        </div>
      </header>
      <div style={{ height: 2, background: "linear-gradient(90deg, #2d5ca8, #4A78C2, #D8B5A6, #F07A3F)" }} />

      {/* Tabs + content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: tabs + panels */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Tab bar */}
          <div
            className="flex shrink-0"
            style={{ background: "#252d3f", borderBottom: "1px solid #2d3a52" }}
          >
            {(["calendar", "members", "upload"] as Tab[]).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="px-6 py-3 text-sm font-medium border-b-2 transition-colors"
                style={
                  tab === key
                    ? { borderColor: "#4A78C2", color: "#e2e8f0" }
                    : { borderColor: "transparent", color: "#6b7a99" }
                }
              >
                {TAB_LABELS[key]}
              </button>
            ))}
          </div>

          {/* Calendar tab */}
          {tab === "calendar" && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Month nav + legend */}
              <div
                className="flex items-center justify-between px-6 py-2 flex-wrap gap-2 shrink-0"
                style={{ background: "#252d3f", borderBottom: "1px solid #2d3a52" }}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={prevCalMonth}
                    className="text-xl font-bold px-2 hover:opacity-70"
                    style={{ color: "#e2e8f0" }}
                  >
                    &#8249;
                  </button>
                  <span className="font-semibold w-44 text-center" style={{ color: "#e2e8f0" }}>
                    {MONTH_NAMES[calMonth]} {calYear}
                  </span>
                  <button
                    onClick={nextCalMonth}
                    className="text-xl font-bold px-2 hover:opacity-70"
                    style={{ color: "#e2e8f0" }}
                  >
                    &#8250;
                  </button>
                </div>
                <div className="flex gap-4 flex-wrap">
                  {LEGEND.map(({ bg, label }) => (
                    <div key={label} className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-sm inline-block" style={{ background: bg }} />
                      <span className="text-xs" style={{ color: "#a0aec0" }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Calendar grid — fills remaining height */}
              <div className="flex-1 overflow-auto">
                <Calendar
                  year={calYear}
                  month={calMonth}
                  leaves={calData.leaves as Parameters<typeof Calendar>[0]["leaves"]}
                  schedule={calData.schedule as Parameters<typeof Calendar>[0]["schedule"]}
                  holidays={calData.holidays as Parameters<typeof Calendar>[0]["holidays"]}
                />
              </div>
            </div>
          )}

          {/* Interface 1 — Team Members */}
          {tab === "members" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl">
                <form onSubmit={addMember} className="flex gap-2 mb-6">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="New member name"
                    className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ background: "#252d3f", border: "1px solid #2d3a52", color: "#e2e8f0" }}
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-80"
                    style={{ background: "#4A78C2" }}
                  >
                    Add Member
                  </button>
                </form>

                <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#2d3a52" }}>
                  {members.length === 0 ? (
                    <p className="text-sm text-center py-8" style={{ color: "#6b7a99" }}>
                      No team members found.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className="border-b text-xs uppercase tracking-wide"
                          style={{ background: "#1a2235", borderColor: "#2d3a52", color: "#6b7a99" }}
                        >
                          <th className="text-left px-4 py-3">Name</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m, idx) => (
                          <tr
                            key={m.id}
                            className="border-b last:border-0"
                            style={{
                              background: idx % 2 === 0 ? "#252d3f" : "#1a2235",
                              borderColor: "#2d3a52",
                            }}
                          >
                            <td className="px-4 py-3" style={{ color: "#e2e8f0" }}>
                              {editingId === m.id ? (
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveMember(m.id);
                                    if (e.key === "Escape") setEditingId(null);
                                  }}
                                  className="rounded px-2 py-1 text-sm focus:outline-none w-full max-w-xs"
                                  style={{ background: "#1a2235", border: "1px solid #2d3a52", color: "#e2e8f0" }}
                                />
                              ) : (
                                <span>{m.name}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {editingId === m.id ? (
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={() => saveMember(m.id)}
                                    className="text-xs text-white px-3 py-1 rounded hover:opacity-80"
                                    style={{ background: "#4A78C2" }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="text-xs px-3 py-1 rounded border hover:opacity-80"
                                    style={{ borderColor: "#2d3a52", color: "#a0aec0" }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={() => { setEditingId(m.id); setEditName(m.name); }}
                                    className="text-xs text-white px-3 py-1 rounded hover:opacity-80"
                                    style={{ background: "#5F8FD6" }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => promptDelete(m.id, m.name, m.is_primary_support)}
                                    className="text-xs text-white px-3 py-1 rounded hover:opacity-80"
                                    style={{ background: "#E0642F" }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Interface 2 — CSV Upload */}
          {tab === "upload" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl">
                <div
                  className="rounded-xl border p-6 space-y-5"
                  style={{ background: "#252d3f", borderColor: "#2d3a52" }}
                >
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "#a0aec0" }}>
                      Leave Details CSV
                      <span className="ml-2 text-xs font-normal" style={{ color: "#6b7a99" }}>
                        columns: employee_name, leave_date, leave_type
                      </span>
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => { setLeaveFile(e.target.files?.[0] ?? null); setUploadResult(null); }}
                      className="block w-full text-sm"
                      style={{ color: "#a0aec0" }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "#a0aec0" }}>
                      Support Schedule CSV
                      <span className="ml-2 text-xs font-normal" style={{ color: "#6b7a99" }}>
                        columns: schedule_date, primary_oncall, secondary_oncall, backup_oncall, onshore_oncall, comments
                      </span>
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => { setScheduleFile(e.target.files?.[0] ?? null); setUploadResult(null); }}
                      className="block w-full text-sm"
                      style={{ color: "#a0aec0" }}
                    />
                  </div>

                  <button
                    onClick={() => submitUpload(false)}
                    disabled={!leaveFile && !scheduleFile}
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 hover:opacity-80"
                    style={{ background: "#4A78C2" }}
                  >
                    Upload
                  </button>

                  {uploadResult?.status === "validation_error" && (
                    <div className="p-4 rounded-lg border" style={{ background: "#3a1a1a", borderColor: "#6a2a2a" }}>
                      <p className="text-sm font-medium mb-2" style={{ color: "#f0a070" }}>
                        Validation errors found in uploaded file(s):
                      </p>
                      <ul className="text-xs space-y-1" style={{ color: "#fdb882" }}>
                        {uploadResult.errors?.map((e, i) => <li key={i}>• {e}</li>)}
                      </ul>
                      <p className="text-xs mt-2" style={{ color: "#a0aec0" }}>
                        Fix the errors in your CSV file and try again.
                      </p>
                    </div>
                  )}

                  {uploadResult?.status === "success" && (
                    <div className="p-4 rounded-lg border" style={{ background: "#1a3a1a", borderColor: "#2a6a2a" }}>
                      <p className="text-sm font-medium" style={{ color: "#86efac" }}>Upload successful.</p>
                      <p className="text-xs mt-1" style={{ color: "#a0aec0" }}>
                        {!!uploadResult.inserted_leaves && `Leave records: ${uploadResult.inserted_leaves} rows imported. `}
                        {!!uploadResult.inserted_schedule && `Schedule records: ${uploadResult.inserted_schedule} rows imported.`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: AI sidebar */}
        <AIPanel
          chatEndpoint="/api/ai/admin-chat"
          clearEndpoint="/api/ai/admin-history"
          placeholder="Ask about leaves, schedules, or CSV file format."
        />
      </div>

      {modal && (
        <Modal
          title={modal.title}
          message={modal.message}
          isWarning={modal.isWarning}
          onClose={() => setModal(null)}
          onConfirm={modal.onConfirm}
        />
      )}

      {overlapData && (
        <Modal
          title="WARNING: Existing Data Will Be Replaced"
          message={buildOverlapMessage(overlapData)}
          isWarning
          onClose={() => setOverlapData(null)}
          onConfirm={() => { setOverlapData(null); submitUpload(true); }}
          confirmLabel="Yes, Replace Data"
        />
      )}
    </div>
  );
}
