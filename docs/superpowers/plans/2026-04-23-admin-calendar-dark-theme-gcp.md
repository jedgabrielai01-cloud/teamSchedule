# Admin Calendar, Dark Theme & GCP Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the calendar to the admin page, restyle the entire frontend to a dark dashboard theme, and add GCP e2-micro deployment scripts.

**Architecture:** All three tasks are frontend/infra-only — no backend changes. Dark theme is applied by updating inline style color values across all components and pages. The admin page gains a calendar section (reusing existing `Calendar` + `DayBox` components) above the existing management tabs. GCP deployment adds four new files: a prod docker-compose and three shell scripts.

**Tech Stack:** Next.js (see note below), React 19, Tailwind CSS v4, Docker, GCP Compute Engine

> **IMPORTANT — Next.js version:** Before writing any Next.js code, read the guide at `frontend/node_modules/next/dist/docs/` — this version has breaking changes vs common training data.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `frontend/app/globals.css` | Dark theme CSS custom properties + body bg |
| Modify | `frontend/components/DayBox.tsx` | Dark-adapted badge + cell colors |
| Modify | `frontend/components/Calendar.tsx` | Dark day-header + border colors |
| Modify | `frontend/components/AIPanel.tsx` | Dark container, bubbles, input |
| Modify | `frontend/app/login/page.tsx` | Dark page bg, card, inputs |
| Modify | `frontend/app/calendar/page.tsx` | Dark header, legend, layout |
| Modify | `frontend/app/admin/page.tsx` | Calendar section + dark theme throughout |
| Create | `docker-compose.prod.yml` | Port 80, restart policy |
| Create | `scripts/setup-gcp-vm.sh` | One-time VM bootstrap |
| Create | `scripts/deploy-gcp.sh` | Repeatable deploy / update |
| Create | `scripts/gcp-firewall.sh` | Open ports 80 + 443 via gcloud CLI |

---

## Task 1: Dark theme — CSS tokens in globals.css

**Files:**
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Replace globals.css**

```css
@import "tailwindcss";

:root {
  --bg-page:        #1e2433;
  --bg-surface:     #252d3f;
  --bg-surface-alt: #1a2235;
  --border:         #2d3a52;
  --text-primary:   #e2e8f0;
  --text-secondary: #a0aec0;
  --text-muted:     #6b7a99;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background: #1e2433;
  color: #e2e8f0;
}
```

- [ ] **Step 2: Start the dev server and verify the page background turns dark navy**

```bash
cd frontend && npm run dev
```

Expected: opening `http://localhost:3000` shows a dark navy background on all pages.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/globals.css
git commit -m "feat: add dark theme tokens to globals.css"
```

---

## Task 2: Dark theme — DayBox component

**Files:**
- Modify: `frontend/components/DayBox.tsx`

- [ ] **Step 1: Replace DayBox.tsx**

```tsx
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

interface Holiday {
  id: number;
  holiday_date: string;
  description: string | null;
  location: string | null;
}

interface Props {
  date: Date;
  currentMonth: number;
  leaves: Leave[];
  schedule: Schedule | null;
  holidays: Holiday[];
}

type BadgeConfig = { bg: string; text: string };

const BADGE: Record<string, BadgeConfig> = {
  primary:   { bg: "#2d5ca8", text: "#93b8f5" },
  secondary: { bg: "#3a6ab5", text: "#a8c4f0" },
  backup:    { bg: "#3a5080", text: "#b8cef0" },
  onshore:   { bg: "#5a3a30", text: "#e8c8ba" },
  leave:     { bg: "#7a3a18", text: "#fdb882" },
  holiday:   { bg: "#6a2a10", text: "#f0a070" },
};

const badge = (text: string, cfg: BadgeConfig) => (
  <span
    key={text}
    className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded leading-tight mb-0.5"
    style={{ background: cfg.bg, color: cfg.text }}
  >
    {text}
  </span>
);

export default function DayBox({ date, currentMonth, leaves, schedule, holidays }: Props) {
  const isCurrentMonth = date.getMonth() === currentMonth;
  const dayNum = date.getDate();

  return (
    <div
      className="min-h-32 p-1.5 flex flex-col border"
      style={{
        background: isCurrentMonth ? "#252d3f" : "#1a2235",
        borderColor: "#2d3a52",
        opacity: isCurrentMonth ? 1 : 0.5,
      }}
    >
      <div
        className="text-xs font-bold mb-1"
        style={{ color: isCurrentMonth ? "#e2e8f0" : "#6b7a99" }}
      >
        {dayNum}
      </div>

      <div className="flex flex-col gap-0.5 text-[10px] overflow-hidden">
        {schedule?.primary_oncall && <div>{badge(schedule.primary_oncall, BADGE.primary)}</div>}
        {schedule?.secondary_oncall && <div>{badge(schedule.secondary_oncall, BADGE.secondary)}</div>}
        {schedule?.backup_oncall && <div>{badge(schedule.backup_oncall, BADGE.backup)}</div>}
        {schedule?.onshore_oncall && <div>{badge(schedule.onshore_oncall, BADGE.onshore)}</div>}
        {leaves.map((l) => <div key={l.id}>{badge(l.employee_name, BADGE.leave)}</div>)}
        {holidays.map((h) => (
          <div key={h.id}>{badge(h.description ?? h.location ?? "Holiday", BADGE.holiday)}</div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Check the calendar page in browser**

Expected: day boxes have dark navy backgrounds, badges show coloured text on dark backgrounds, out-of-month days are dimmed.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/DayBox.tsx
git commit -m "feat: dark theme for DayBox component"
```

---

## Task 3: Dark theme — Calendar component

**Files:**
- Modify: `frontend/components/Calendar.tsx`

- [ ] **Step 1: Replace Calendar.tsx**

```tsx
import DayBox from "./DayBox";

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

interface Holiday {
  id: number;
  holiday_date: string;
  description: string | null;
  location: string | null;
}

interface Props {
  year: number;
  month: number; // 0-based
  leaves: Leave[];
  schedule: Schedule[];
  holidays: Holiday[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Calendar({ year, month, leaves, schedule, holidays }: Props) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Date[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push(new Date(year, month, -i));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) {
    cells.push(new Date(year, month + 1, cells.length - firstDay - daysInMonth + 1));
  }

  function isoDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <div className="grid grid-cols-7 border-b" style={{ borderColor: "#2d3a52" }}>
        {DAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-semibold py-2 uppercase tracking-wide"
            style={{ color: "#6b7a99" }}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 flex-1">
        {cells.map((date, i) => {
          const iso = isoDate(date);
          const dayLeaves = leaves.filter((l) => l.leave_date === iso);
          const daySchedule = schedule.find((s) => s.schedule_date === iso) ?? null;
          const dayHolidays = holidays.filter((h) => h.holiday_date === iso);
          return (
            <DayBox
              key={i}
              date={date}
              currentMonth={month}
              leaves={dayLeaves}
              schedule={daySchedule}
              holidays={dayHolidays}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Expected: day-of-week headers (Sun–Sat) are muted grey, the header separator uses the dark border color.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/Calendar.tsx
git commit -m "feat: dark theme for Calendar component"
```

---

## Task 4: Dark theme — AIPanel component

**Files:**
- Modify: `frontend/components/AIPanel.tsx`

- [ ] **Step 1: Replace AIPanel.tsx**

```tsx
"use client";
import { useState, useRef, useEffect, FormEvent } from "react";
import { apiFetch } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIPanelProps {
  chatEndpoint?: string;
  clearEndpoint?: string;
  fullWidth?: boolean;
  placeholder?: string;
}

export default function AIPanel({
  chatEndpoint = "/api/ai/chat",
  clearEndpoint = "/api/ai/history",
  fullWidth = false,
  placeholder = "Ask about leaves or support schedules.",
}: AIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await apiFetch(chatEndpoint, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error contacting AI." }]);
    } finally {
      setLoading(false);
    }
  }

  async function clearChat() {
    await apiFetch(clearEndpoint, { method: "DELETE" });
    setMessages([]);
  }

  return (
    <div
      className={`flex flex-col h-full`}
      style={
        fullWidth
          ? {}
          : { width: 320, minWidth: 280, borderLeft: "1px solid #2d3a52" }
      }
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white text-sm font-semibold shrink-0"
        style={{ background: "linear-gradient(135deg, #1a3a6e, #2d5ca8)" }}
      >
        <span>AI Assistant</span>
        <button onClick={clearChat} className="text-xs opacity-80 hover:opacity-100 underline">
          Clear
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 text-sm"
        style={{ background: "#1a2235" }}
      >
        {messages.length === 0 && (
          <p className="text-xs text-center mt-4" style={{ color: "#6b7a99" }}>{placeholder}</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed"
              style={
                m.role === "user"
                  ? { background: "#2d5ca8", color: "#e2e8f0" }
                  : { background: "#252d3f", color: "#e2e8f0" }
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div
              className="rounded-xl px-3 py-2 text-xs"
              style={{ background: "#252d3f", color: "#6b7a99" }}
            >
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={sendMessage}
        className="p-3 flex gap-2 shrink-0"
        style={{ borderTop: "1px solid #2d3a52" }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
          style={{
            background: "#252d3f",
            border: "1px solid #2d3a52",
            color: "#e2e8f0",
          }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 hover:opacity-80"
          style={{ background: "#F07A3F" }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Expected: AI panel sidebar has dark background, user messages show blue bubbles, assistant messages show dark surface bubbles, both with light text.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/AIPanel.tsx
git commit -m "feat: dark theme for AIPanel component"
```

---

## Task 5: Dark theme — Login page

**Files:**
- Modify: `frontend/app/login/page.tsx`

- [ ] **Step 1: Replace login/page.tsx**

```tsx
"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("Invalid username or password.");
        return;
      }
      const { token } = await res.json();
      localStorage.setItem("token", token);
      localStorage.setItem("username", username);
      router.push(username === "Admin" ? "/admin" : "/calendar");
    } catch {
      setError("Could not connect to server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#1e2433" }}
    >
      <div
        className="rounded-2xl shadow-xl p-10 w-full max-w-sm border"
        style={{ background: "#252d3f", borderColor: "#2d3a52" }}
      >
        <h1 className="text-2xl font-bold text-center mb-2" style={{ color: "#93b8f5" }}>
          Team Schedule
        </h1>
        <p className="text-center text-sm mb-8" style={{ color: "#6b7a99" }}>Sign in to continue</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#a0aec0" }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{
                background: "#1a2235",
                border: "1px solid #2d3a52",
                color: "#e2e8f0",
              }}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#a0aec0" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{
                background: "#1a2235",
                border: "1px solid #2d3a52",
                color: "#e2e8f0",
              }}
              placeholder="Password"
            />
          </div>

          {error && <p className="text-sm" style={{ color: "#f0a070" }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-2 rounded-lg text-white font-semibold text-sm transition-opacity disabled:opacity-60 hover:opacity-80"
            style={{ background: "linear-gradient(90deg, #F07A3F, #E0642F)" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-6 h-0.5 rounded" style={{ background: "linear-gradient(90deg, #2d5ca8, #4A78C2, #D8B5A6, #F07A3F)" }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify login page in browser at `http://localhost:3000/login`**

Expected: dark navy page background, dark card, light-text labels, dark inputs, orange gradient sign-in button, accent gradient bar at bottom of card.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/login/page.tsx
git commit -m "feat: dark theme for login page"
```

---

## Task 6: Dark theme — Calendar page

**Files:**
- Modify: `frontend/app/calendar/page.tsx`

- [ ] **Step 1: Replace calendar/page.tsx**

```tsx
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Calendar from "@/components/Calendar";
import AIPanel from "@/components/AIPanel";
import { apiFetch } from "@/lib/api";

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

export default function CalendarPage() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [data, setData] = useState<CalendarData>({ leaves: [], schedule: [], holidays: [] });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      router.replace("/login");
    }
  }, [router]);

  const fetchData = useCallback(async () => {
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    const res = await apiFetch(`/api/calendar?month=${monthStr}`);
    if (res.ok) setData(await res.json());
  }, [year, month]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    router.push("/login");
  }

  const username = typeof window !== "undefined" ? localStorage.getItem("username") ?? "" : "";

  return (
    <div className="flex flex-col h-screen" style={{ background: "#1e2433" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-3 text-white shrink-0"
        style={{ background: "linear-gradient(135deg, #1a3a6e, #2d5ca8)" }}
      >
        <span className="font-bold text-lg">Team Schedule</span>
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="text-white text-xl font-bold px-2 hover:opacity-70">&#8249;</button>
          <span className="font-semibold w-44 text-center">{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="text-white text-xl font-bold px-2 hover:opacity-70">&#8250;</button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-80">{username}</span>
          <button
            onClick={logout}
            className="text-xs border border-white/50 rounded px-3 py-1 hover:bg-white/10"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Legend */}
      <div
        className="flex gap-4 px-6 py-2 text-xs shrink-0 flex-wrap"
        style={{ background: "#252d3f", borderBottom: "1px solid #2d3a52" }}
      >
        {LEGEND.map(({ bg, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: bg }} />
            <span style={{ color: "#a0aec0" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <Calendar
            year={year}
            month={month}
            leaves={data.leaves as Parameters<typeof Calendar>[0]["leaves"]}
            schedule={data.schedule as Parameters<typeof Calendar>[0]["schedule"]}
            holidays={data.holidays as Parameters<typeof Calendar>[0]["holidays"]}
          />
        </div>
        <AIPanel />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add accent bar below the header**

In the JSX, immediately after `</header>`, add:

```tsx
<div style={{ height: 2, background: "linear-gradient(90deg, #2d5ca8, #4A78C2, #D8B5A6, #F07A3F)" }} />
```

- [ ] **Step 3: Log in as a regular user and verify the calendar page**

Expected: dark page, dark header with gradient, 2px accent bar below header, legend bar in dark surface color with dark-adapted legend dots, day boxes dark, AI panel dark.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/calendar/page.tsx
git commit -m "feat: dark theme for calendar page"
```

---

## Task 7: Admin page — calendar integration + dark theme

**Files:**
- Modify: `frontend/app/admin/page.tsx`

- [ ] **Step 1: Replace admin/page.tsx with the full updated version**

```tsx
"use client";
import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import AIPanel from "@/components/AIPanel";
import Calendar from "@/components/Calendar";

type Tab = "members" | "upload";

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
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("members");
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

      {/* Calendar section */}
      <div className="shrink-0" style={{ borderBottom: "1px solid #2d3a52" }}>
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
        {/* Calendar grid — fixed height so management tabs remain visible */}
        <div style={{ height: 320, overflow: "hidden" }}>
          <Calendar
            year={calYear}
            month={calMonth}
            leaves={calData.leaves as Parameters<typeof Calendar>[0]["leaves"]}
            schedule={calData.schedule as Parameters<typeof Calendar>[0]["schedule"]}
            holidays={calData.holidays as Parameters<typeof Calendar>[0]["holidays"]}
          />
        </div>
      </div>

      {/* Tabs + content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: tabs + panels */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Tab bar */}
          <div
            className="flex shrink-0"
            style={{ background: "#252d3f", borderBottom: "1px solid #2d3a52" }}
          >
            {(["members", "upload"] as Tab[]).map((key) => (
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
                    <div
                      className="p-4 rounded-lg border"
                      style={{ background: "#3a1a1a", borderColor: "#6a2a2a" }}
                    >
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
                    <div
                      className="p-4 rounded-lg border"
                      style={{ background: "#1a3a1a", borderColor: "#2a6a2a" }}
                    >
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
```

- [ ] **Step 2: Add accent bar below the header**

In the JSX, immediately after `</header>`, add:

```tsx
<div style={{ height: 2, background: "linear-gradient(90deg, #2d5ca8, #4A78C2, #D8B5A6, #F07A3F)" }} />
```

Also add accent bar inside the `Modal` component, as the last child of the modal card `<div>` (the one with `background: "#252d3f"`):

```tsx
<div style={{ height: 2, borderRadius: "0 0 8px 8px", background: "linear-gradient(90deg, #2d5ca8, #4A78C2, #D8B5A6, #F07A3F)" }} />
```

- [ ] **Step 3: Log in as Admin and verify**

Check:
- 2px accent bar visible below the admin header
- Calendar is visible at the top with month navigation and color legend
- Navigating months in the admin calendar works independently
- Team Members and CSV Upload tabs are below the calendar and still functional
- Dark theme applied throughout: modals (with accent bar), tables, inputs, tabs
- AI panel sidebar is dark

- [ ] **Step 4: Commit**

```bash
git add frontend/app/admin/page.tsx
git commit -m "feat: add calendar to admin page and apply dark theme"
```

---

## Task 8: GCP deployment files

**Files:**
- Create: `docker-compose.prod.yml`
- Create: `scripts/setup-gcp-vm.sh`
- Create: `scripts/deploy-gcp.sh`
- Create: `scripts/gcp-firewall.sh`

> **Note:** The git repo root is the parent `Projects/` directory. The app lives in `Projects/claude_teamSchedule/`. All GCP scripts assume the VM clones the `Projects` repo and `cd`s into `claude_teamSchedule/`.

- [ ] **Step 1: Create docker-compose.prod.yml in the project root**

```yaml
services:
  app:
    build: .
    ports:
      - "80:8000"
    env_file: .env
    volumes:
      - ./db:/app/db
    restart: unless-stopped
```

- [ ] **Step 2: Create scripts/setup-gcp-vm.sh**

```bash
#!/usr/bin/env bash
# Run once on a fresh Ubuntu 22.04 GCP e2-micro VM via SSH.
# Usage: bash setup-gcp-vm.sh
set -euo pipefail

echo "=== Installing Docker ==="
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

sudo usermod -aG docker "$USER"

echo "=== Cloning repository ==="
git clone https://github.com/jedgabrielai01-cloud/Projects.git ~/Projects

echo ""
echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Place your .env file at: ~/Projects/claude_teamSchedule/.env"
echo "  2. Log out and back in (for docker group to take effect), then run:"
echo "     bash ~/Projects/claude_teamSchedule/scripts/deploy-gcp.sh"
```

- [ ] **Step 3: Create scripts/deploy-gcp.sh**

```bash
#!/usr/bin/env bash
# Deploy or update the app on the GCP VM.
# Run from anywhere on the VM; safe to re-run for updates.
set -euo pipefail

APP_DIR="$HOME/Projects/claude_teamSchedule"

echo "=== Pulling latest code ==="
cd "$HOME/Projects"
git pull

echo "=== Building and starting container ==="
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

EXTERNAL_IP=$(curl -sf \
  -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip" \
  || echo "<external-ip>")

echo ""
echo "=== Deployed ==="
echo "Access the app at: http://${EXTERNAL_IP}"
```

- [ ] **Step 4: Create scripts/gcp-firewall.sh**

```bash
#!/usr/bin/env bash
# Run once from your LOCAL machine (not the VM) with gcloud CLI installed.
# Usage: bash gcp-firewall.sh YOUR_PROJECT_ID
set -euo pipefail

PROJECT_ID="${1:?Usage: bash gcp-firewall.sh YOUR_PROJECT_ID}"

echo "Creating firewall rules for project: $PROJECT_ID"

gcloud compute firewall-rules create allow-http \
  --project="$PROJECT_ID" \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:80 \
  --source-ranges=0.0.0.0/0 \
  --description="Allow HTTP for team schedule app" \
  --quiet || echo "allow-http rule already exists, skipping."

gcloud compute firewall-rules create allow-https \
  --project="$PROJECT_ID" \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:443 \
  --source-ranges=0.0.0.0/0 \
  --description="Allow HTTPS for team schedule app (for future domain + cert setup)" \
  --quiet || echo "allow-https rule already exists, skipping."

echo "Done. Firewall rules created."
```

- [ ] **Step 5: Make scripts executable**

```bash
chmod +x scripts/setup-gcp-vm.sh scripts/deploy-gcp.sh scripts/gcp-firewall.sh
```

- [ ] **Step 6: Verify docker-compose.prod.yml locally**

```bash
cd "E:/AI Playground/Projects/claude_teamSchedule"
docker compose -f docker-compose.prod.yml config
```

Expected: no errors, shows port mapping `80:8000` and `restart: unless-stopped`.

- [ ] **Step 7: Commit**

```bash
git add docker-compose.prod.yml scripts/setup-gcp-vm.sh scripts/deploy-gcp.sh scripts/gcp-firewall.sh
git commit -m "feat: add GCP e2-micro deployment scripts and prod docker-compose"
```

---

## GCP First-Time Deployment Checklist

After all code tasks are complete and pushed to GitHub:

1. Create VM in GCP Console:
   - Machine type: `e2-micro`
   - Region: `us-central1` (always-free tier)
   - Boot disk: Ubuntu 22.04 LTS, 30 GB standard
   - Firewall: tick "Allow HTTP traffic"

2. From your local machine, open ports:
   ```bash
   bash scripts/gcp-firewall.sh YOUR_GCP_PROJECT_ID
   ```

3. Reserve a static external IP (optional but recommended):
   - GCP Console → VPC Network → External IP addresses → Reserve static address → attach to VM

4. SSH into VM and run setup:
   ```bash
   bash setup-gcp-vm.sh
   ```
   Then place `.env` at `~/Projects/claude_teamSchedule/.env`.

5. Log out and back in, then deploy:
   ```bash
   bash ~/Projects/claude_teamSchedule/scripts/deploy-gcp.sh
   ```

6. Access at `http://<external-ip>`
