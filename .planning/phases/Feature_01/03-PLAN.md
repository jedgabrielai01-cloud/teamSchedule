---
phase: Feature_01
plan: "03"
type: execute
wave: 3
depends_on: ["01", "02"]
files_modified:
  - frontend/components/Modal.tsx
  - frontend/components/DayCrudModal.tsx
  - frontend/components/Calendar.tsx
  - frontend/components/DayBox.tsx
  - frontend/app/calendar/page.tsx
  - frontend/app/admin/page.tsx
autonomous: true
requirements:
  - F1-CRUD-OWN
  - F1-CRUD-OTHER
  - F1-CRUD-PRIMARY
  - F1-CRUD-SCHEDULE
  - F1-CRUD-ADMIN
must_haves:
  truths:
    - "Clicking a day box opens a CRUD modal for that date"
    - "User can add their own vacation leave from the modal for any date they are not primary support"
    - "User cannot add a leave for a date where they are already primary support"
    - "User can update their own existing leave from the modal"
    - "User can delete their own existing leave from the modal"
    - "User cannot add, update, or delete another member's leave"
    - "Any user can update primary_oncall on dates that have a schedule entry"
    - "Any user can add, update, or delete holidays"
    - "Admin can add/update/delete leaves for any member"
    - "Modal shows current day data (leaves, schedule, holidays)"
  artifacts:
    - path: "frontend/components/Modal.tsx"
      provides: "Reusable modal dialog extracted from admin/page.tsx"
      contains: "export default function Modal"
    - path: "frontend/components/DayCrudModal.tsx"
      provides: "Day CRUD modal with sections for Leaves, Schedule, Holidays"
      contains: "onRefresh"
    - path: "frontend/components/Calendar.tsx"
      provides: "Calendar with onDayClick prop passed to DayBox"
      contains: "onDayClick"
    - path: "frontend/components/DayBox.tsx"
      provides: "DayBox with optional onDayClick prop"
      contains: "onDayClick"
    - path: "frontend/app/calendar/page.tsx"
      provides: "Calendar page with modal state and DayCrudModal"
      contains: "DayCrudModal"
    - path: "frontend/app/admin/page.tsx"
      provides: "Admin page with modal state and DayCrudModal for calendar tab"
      contains: "DayCrudModal"
  key_links:
    - from: "frontend/app/calendar/page.tsx"
      to: "frontend/components/DayCrudModal.tsx"
      via: "onDayClick handler sets selectedDay state"
      pattern: "selectedDay"
    - from: "frontend/components/Calendar.tsx"
      to: "frontend/components/DayBox.tsx"
      via: "onDayClick prop passed through"
      pattern: "onDayClick"
    - from: "frontend/components/DayCrudModal.tsx"
      to: "apiFetch"
      via: "POST/PUT/DELETE /api/leaves, /api/schedule, /api/holidays, /admin/leaves"
      pattern: "apiFetch"
---

<objective>
Add a click-to-edit CRUD modal to calendar day boxes. Users click any day to open a modal
that shows leave, schedule, and holiday data for that date and allows permitted mutations.

Purpose: Users need a way to manually manage leaves, primary support, and holidays without
using the AI assistant.

Output:
- Modal.tsx: extracted reusable dialog (remove duplicate from admin/page.tsx)
- DayCrudModal.tsx: day-specific CRUD form with role-based sections
- Calendar.tsx: add onDayClick prop
- DayBox.tsx: add onDayClick prop with pointer cursor
- Both pages: wire DayCrudModal with selectedDay state
</objective>

<execution_context>
@E:/AI Playground/Projects/claude_teamSchedule/frontend/app/admin/page.tsx
</execution_context>

<context>
@E:/AI Playground/Projects/claude_teamSchedule/frontend/components/Calendar.tsx
@E:/AI Playground/Projects/claude_teamSchedule/frontend/components/DayBox.tsx
@E:/AI Playground/Projects/claude_teamSchedule/frontend/app/calendar/page.tsx
@E:/AI Playground/Projects/claude_teamSchedule/frontend/app/admin/page.tsx
@E:/AI Playground/Projects/claude_teamSchedule/frontend/lib/api.ts

<interfaces>
Existing type definitions (from Calendar.tsx and DayBox.tsx):
```typescript
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
```

API endpoints for CRUD (all use apiFetch which attaches Bearer token):
- POST /api/leaves — body: { leave_date, leave_type? } — inserts own leave (user only)
- PUT /api/leaves/{id} — body: { leave_date, leave_type? } — updates own leave (user only)
- DELETE /api/leaves/{id} — deletes own leave (user only)
- POST /admin/leaves — body: { employee_name, leave_date, leave_type? } — admin any member
- PUT /admin/leaves/{id} — body: { employee_name, leave_date, leave_type? } — admin any member
- DELETE /admin/leaves/{id} — admin any member
- PUT /api/schedule/{date} — body: { primary_oncall: string } — any user
- POST /api/holidays — body: { holiday_date, description?, location? }
- PUT /api/holidays/{id} — body: { holiday_date, description?, location? }
- DELETE /api/holidays/{id}

Admin detection: `localStorage.getItem("username") === "Admin"`
Current user: `localStorage.getItem("username")`

From admin/page.tsx — Modal component (to be extracted):
```typescript
function Modal({
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;   // default "Confirm"
  isWarning?: boolean;
})
```

Colors:
- Background dark: #252d3f, #1a2235
- Border: #2d3a52
- Text primary: #e2e8f0, text secondary: #a0aec0, text muted: #6b7a99
- Blue action: #4A78C2, orange action: #F07A3F, danger: #E0642F
- Gradient bar: linear-gradient(90deg, #2d5ca8, #4A78C2, #D8B5A6, #F07A3F)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract Modal and create DayCrudModal component</name>
  <files>frontend/components/Modal.tsx, frontend/components/DayCrudModal.tsx</files>
  <read_first>
    - frontend/app/admin/page.tsx — copy the exact Modal function body from lines 45-97
    - frontend/lib/api.ts — confirm apiFetch signature
    - frontend/components/DayBox.tsx — confirm Leave, Schedule, Holiday interfaces
  </read_first>
  <action>
--- PART A: Create frontend/components/Modal.tsx ---

Extract the Modal function from admin/page.tsx (lines 45-97) into a standalone file.
Add "use client" at the top. Export it as default.

```typescript
"use client";

export default function Modal({
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
```

--- PART B: Create frontend/components/DayCrudModal.tsx ---

This is a "use client" component. It opens as a full-screen overlay (z-index: 60, above FloatingChat at 1000 — use 1200 for DayCrudModal).

Props:
```typescript
interface DayCrudModalProps {
  date: string;          // ISO date string "YYYY-MM-DD"
  leaves: Leave[];       // all leaves on this date
  schedule: Schedule | null;
  holidays: Holiday[];
  username: string;      // logged-in user
  isAdmin: boolean;
  onClose: () => void;
  onRefresh: () => void; // call after any successful mutation to reload calendar
}
```

Internal interfaces (copy from Calendar.tsx):
```typescript
interface Leave { id: number; employee_name: string; leave_date: string; leave_type: string | null; }
interface Schedule { schedule_date: string; primary_oncall: string | null; secondary_oncall: string | null; backup_oncall: string | null; onshore_oncall: string | null; }
interface Holiday { id: number; holiday_date: string; description: string | null; location: string | null; }
```

State:
```typescript
const [error, setError] = useState<string | null>(null);
const [confirm, setConfirm] = useState<{ message: string; action: () => Promise<void> } | null>(null);
// For inline forms:
const [addLeaveForm, setAddLeaveForm] = useState<{ employee_name: string; leave_type: string } | null>(null);
const [editLeaveId, setEditLeaveId] = useState<number | null>(null);
const [editLeaveType, setEditLeaveType] = useState("");
const [editPrimary, setEditPrimary] = useState(false);
const [primaryValue, setPrimaryValue] = useState(schedule?.primary_oncall ?? "");
const [addHolidayForm, setAddHolidayForm] = useState<{ description: string; location: string } | null>(null);
const [editHolidayId, setEditHolidayId] = useState<number | null>(null);
const [editHolidayDesc, setEditHolidayDesc] = useState("");
const [editHolidayLocation, setEditHolidayLocation] = useState("");
```

Helper: `function humanDate(iso: string)` — converts "2026-04-15" to "April 15, 2026":
```typescript
function humanDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${names[m - 1]} ${d}, ${y}`;
}
```

SECTION 1 — VACATION LEAVES:

Display each leave as a row with employee_name and leave_type.

For each leave row:
- If `isAdmin` OR `leave.employee_name === username`:
  - Show Edit button: sets editLeaveId = leave.id, editLeaveType = leave.leave_type ?? ""
  - Show Delete button: calls deleteLeave(leave.id)
- Otherwise: no action buttons (view only)

Edit inline form (shown when editLeaveId === leave.id):
- Text input for leave_type
- Save button: calls updateLeave(leave.id, leave.employee_name, editLeaveType)
- Cancel button: sets editLeaveId = null

Add Leave button logic:
- User (not admin): show "Add My Leave" button only if `!leaves.some(l => l.employee_name === username)`.
  When clicked: sets addLeaveForm = { employee_name: username, leave_type: "" }
- Admin: show "Add Leave" button (always). When clicked: sets addLeaveForm = { employee_name: "", leave_type: "" }
  Admin add form includes an employee_name text input.

Add leave inline form:
- Admin: employee_name input + leave_type input
- User: leave_type input only (employee_name = username)
- Save: calls addLeave()
- Cancel: setAddLeaveForm(null)

CRUD functions:
```typescript
async function addLeave() {
  if (!addLeaveForm) return;
  const name = isAdmin ? addLeaveForm.employee_name.trim() : username;
  if (!name) { setError("Employee name is required"); return; }
  const endpoint = isAdmin ? "/admin/leaves" : "/api/leaves";
  const body = isAdmin
    ? { employee_name: name, leave_date: date, leave_type: addLeaveForm.leave_type || null }
    : { leave_date: date, leave_type: addLeaveForm.leave_type || null };
  const res = await apiFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) { const d = await res.json(); setError(d.detail ?? "Failed to add leave"); return; }
  setAddLeaveForm(null);
  onRefresh();
}

async function updateLeave(leaveId: number, employeeName: string, leaveType: string) {
  const endpoint = isAdmin ? `/admin/leaves/${leaveId}` : `/api/leaves/${leaveId}`;
  const body = isAdmin
    ? { employee_name: employeeName, leave_date: date, leave_type: leaveType || null }
    : { leave_date: date, leave_type: leaveType || null };
  const res = await apiFetch(endpoint, { method: "PUT", body: JSON.stringify(body) });
  if (!res.ok) { const d = await res.json(); setError(d.detail ?? "Failed to update leave"); return; }
  setEditLeaveId(null);
  onRefresh();
}

async function deleteLeave(leaveId: number) {
  const endpoint = isAdmin ? `/admin/leaves/${leaveId}` : `/api/leaves/${leaveId}`;
  const res = await apiFetch(endpoint, { method: "DELETE" });
  if (!res.ok && res.status !== 204) { const d = await res.json(); setError(d.detail ?? "Failed to delete leave"); return; }
  onRefresh();
}
```

SECTION 2 — PRIMARY SUPPORT:

Show current primary_oncall value (or "None").

If `schedule !== null`:
  - Show "Edit" button. When clicked, sets editPrimary = true and shows text input for primaryValue.
  - Save: calls updatePrimary()
  - Cancel: setEditPrimary(false)

If `schedule === null`:
  - Show text: "No schedule entry for this date."
  - No add/edit button (AGENTS.md: Insert of schedule rows is not allowed)

```typescript
async function updatePrimary() {
  if (!primaryValue.trim()) { setError("Primary support name is required"); return; }
  const res = await apiFetch(`/api/schedule/${date}`, {
    method: "PUT",
    body: JSON.stringify({ primary_oncall: primaryValue.trim() }),
  });
  if (!res.ok) { const d = await res.json(); setError(d.detail ?? "Failed to update schedule"); return; }
  setEditPrimary(false);
  onRefresh();
}
```

SECTION 3 — HOLIDAYS:

Display each holiday row with description and location. Show Edit and Delete buttons for each holiday row.

Edit button per holiday row: sets editHolidayId = holiday.id, editHolidayDesc = holiday.description ?? "", editHolidayLocation = holiday.location ?? "".

Edit inline form (shown when editHolidayId === holiday.id):
- description input (value = editHolidayDesc)
- location input (value = editHolidayLocation)
- Save button: calls updateHoliday(holiday.id, editHolidayDesc, editHolidayLocation)
- Cancel button: sets editHolidayId = null

Show "Add Holiday" button. When clicked: setAddHolidayForm({ description: "", location: "" }).
Inline add form: description input + location input + Save + Cancel.

```typescript
async function addHoliday() {
  if (!addHolidayForm) return;
  const res = await apiFetch("/api/holidays", {
    method: "POST",
    body: JSON.stringify({ holiday_date: date, description: addHolidayForm.description || null, location: addHolidayForm.location || null }),
  });
  if (!res.ok) { const d = await res.json(); setError(d.detail ?? "Failed to add holiday"); return; }
  setAddHolidayForm(null);
  onRefresh();
}

async function updateHoliday(holidayId: number, description: string, location: string) {
  const res = await apiFetch(`/api/holidays/${holidayId}`, {
    method: "PUT",
    body: JSON.stringify({ holiday_date: date, description: description || null, location: location || null }),
  });
  if (!res.ok) { const d = await res.json(); setError(d.detail ?? "Failed to update holiday"); return; }
  setEditHolidayId(null);
  onRefresh();
}

async function deleteHoliday(holidayId: number) {
  const res = await apiFetch(`/api/holidays/${holidayId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) { const d = await res.json(); setError(d.detail ?? "Failed to delete holiday"); return; }
  onRefresh();
}
```

MODAL LAYOUT:
- Fixed overlay: `position: fixed, inset: 0, background: rgba(0,0,0,0.7), zIndex: 1200, display: flex, alignItems: center, justifyContent: center`
- Inner container: `background: #1a2235, borderRadius: 12, border: 1px solid #2d3a52, padding: 24, maxWidth: 480, width: 100%, maxHeight: 80vh, overflowY: auto, margin: 16`
- Header: date in humanDate format, close (X) button in top-right. The X button calls onClose directly (onClick={onClose}).
- Three sections with heading labels: "Vacation Leaves", "Primary Support", "Holidays"
- Error display: if error is set, show red text above the close button
- Gradient bar at bottom: `linear-gradient(90deg, #2d5ca8, #4A78C2, #D8B5A6, #F07A3F)`, height 2px

Delete confirmation: wrap delete actions with a confirmation step using the `confirm` state:
```typescript
function promptConfirm(message: string, action: () => Promise<void>) {
  setConfirm({ message, action });
}
// In JSX, if confirm !== null, show inline confirmation:
// "Are you sure? [Yes] [No]"
// Yes: confirm.action().then(() => setConfirm(null))
// No: setConfirm(null)
```
  </action>
  <verify>
    <automated>cd "E:/AI Playground/Projects/claude_teamSchedule" && grep -c "onRefresh" frontend/components/DayCrudModal.tsx && grep -c "export default function Modal" frontend/components/Modal.tsx && grep -c "updateHoliday" frontend/components/DayCrudModal.tsx</automated>
  </verify>
  <acceptance_criteria>
    - frontend/components/Modal.tsx exists and contains `export default function Modal`
    - frontend/components/DayCrudModal.tsx exists and contains `onRefresh`
    - DayCrudModal.tsx contains `isAdmin` in its props interface
    - DayCrudModal.tsx contains `/admin/leaves` (uses admin endpoint when isAdmin is true)
    - DayCrudModal.tsx contains `/api/leaves` (uses user endpoint when not admin)
    - DayCrudModal.tsx contains `/api/schedule/${date}` for primary support update
    - DayCrudModal.tsx contains `/api/holidays` for holiday operations
    - DayCrudModal.tsx contains `updateHoliday` function (grep: `grep -c "updateHoliday" frontend/components/DayCrudModal.tsx` returns >= 1)
    - DayCrudModal.tsx contains Edit button per holiday row that sets editHolidayId
    - DayCrudModal.tsx contains `humanDate` function
    - DayCrudModal.tsx contains zIndex 1200 (above FloatingChat at 1000)
    - Modal.tsx does NOT contain "use client" violations (it does have "use client")
  </acceptance_criteria>
  <done>Modal.tsx extracted and exported. DayCrudModal.tsx implements all three sections with role-based controls, including holiday edit (updateHoliday) and delete.</done>
</task>

<task type="auto">
  <name>Task 2: Wire DayBox, Calendar, and both pages to the CRUD modal</name>
  <files>frontend/components/DayBox.tsx, frontend/components/Calendar.tsx, frontend/app/calendar/page.tsx, frontend/app/admin/page.tsx</files>
  <read_first>
    - frontend/components/DayBox.tsx — read full file before editing
    - frontend/components/Calendar.tsx — read full file before editing
    - frontend/app/calendar/page.tsx — read full file (updated by Plan 02)
    - frontend/app/admin/page.tsx — read full file (updated by Plan 02)
    - frontend/components/DayCrudModal.tsx — check prop names to wire correctly
  </read_first>
  <action>
--- DayBox.tsx ---

Add `onDayClick?: () => void` to the Props interface.

Change the signature to destructure `onDayClick`:
```typescript
export default function DayBox({ date, currentMonth, leaves, schedule, holidays, onDayClick }: Props) {
```

Add onClick and cursor style to the root div:
```typescript
<div
  className="min-h-32 p-1.5 flex flex-col border"
  style={{
    background: isCurrentMonth ? "#252d3f" : "#1a2235",
    borderColor: "#2d3a52",
    opacity: isCurrentMonth ? 1 : 0.5,
    cursor: onDayClick ? "pointer" : "default",
  }}
  onClick={onDayClick}
>
```

No other changes to DayBox.

--- Calendar.tsx ---

Add to the Props interface:
```typescript
onDayClick?: (date: string, leaves: Leave[], schedule: Schedule | null, holidays: Holiday[]) => void;
```

Add `onDayClick` to the function parameters.

In the cells.map(), pass onDayClick to each DayBox:
```typescript
<DayBox
  key={i}
  date={date}
  currentMonth={month}
  leaves={dayLeaves}
  schedule={daySchedule}
  holidays={dayHolidays}
  onDayClick={onDayClick ? () => onDayClick(iso, dayLeaves, daySchedule, dayHolidays) : undefined}
/>
```

--- calendar/page.tsx ---

After Plan 02, this file has: FloatingChat imported, Calendar without onDayClick.

Add imports:
```typescript
import DayCrudModal from "@/components/DayCrudModal";
```

Add state for the selected day:
```typescript
interface SelectedDay {
  date: string;
  leaves: unknown[];
  schedule: unknown;
  holidays: unknown[];
}
const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null);
```

Read username:
```typescript
const [username, setUsername] = useState("");
useEffect(() => {
  setUsername(localStorage.getItem("username") ?? "");
}, []);
```
(Remove the existing `const username = typeof window !== "undefined" ? ...` line and replace with this state + effect.)

Wire Calendar's onDayClick:
```typescript
<Calendar
  year={year}
  month={month}
  leaves={data.leaves as Parameters<typeof Calendar>[0]["leaves"]}
  schedule={data.schedule as Parameters<typeof Calendar>[0]["schedule"]}
  holidays={data.holidays as Parameters<typeof Calendar>[0]["holidays"]}
  onDayClick={(date, leaves, schedule, holidays) =>
    setSelectedDay({ date, leaves: leaves as unknown[], schedule, holidays: holidays as unknown[] })
  }
/>
```

Add DayCrudModal inside the page return, just before the FloatingChat:
```typescript
{selectedDay && (
  <DayCrudModal
    date={selectedDay.date}
    leaves={selectedDay.leaves as Parameters<typeof DayCrudModal>[0]["leaves"]}
    schedule={selectedDay.schedule as Parameters<typeof DayCrudModal>[0]["schedule"]}
    holidays={selectedDay.holidays as Parameters<typeof DayCrudModal>[0]["holidays"]}
    username={username}
    isAdmin={username === "Admin"}
    onClose={() => setSelectedDay(null)}
    onRefresh={fetchData}
  />
)}
```

--- admin/page.tsx ---

Import additions:
```typescript
import Modal from "@/components/Modal";
import DayCrudModal from "@/components/DayCrudModal";
```

The admin page already has a local `function Modal(...)` inline — REMOVE that local Modal function
since we now import it from components/Modal.tsx. The existing `modal` and `overlapData` state
and handlers remain unchanged; they continue to use the Modal component (now imported).

Add selected day state (same as calendar page):
```typescript
interface SelectedDay {
  date: string;
  leaves: unknown[];
  schedule: unknown;
  holidays: unknown[];
}
const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null);
```

Username for admin page: admin/page.tsx already reads from localStorage for auth check.
Add: `const adminUsername = "Admin";` (admin is always "Admin").

Wire Calendar's onDayClick in the calendar tab section:
```typescript
<Calendar
  year={calYear}
  month={calMonth}
  leaves={calData.leaves as Parameters<typeof Calendar>[0]["leaves"]}
  schedule={calData.schedule as Parameters<typeof Calendar>[0]["schedule"]}
  holidays={calData.holidays as Parameters<typeof Calendar>[0]["holidays"]}
  onDayClick={(date, leaves, schedule, holidays) =>
    setSelectedDay({ date, leaves: leaves as unknown[], schedule, holidays: holidays as unknown[] })
  }
/>
```

Add DayCrudModal just before the existing `{modal && <Modal ...>}` block:
```typescript
{selectedDay && (
  <DayCrudModal
    date={selectedDay.date}
    leaves={selectedDay.leaves as Parameters<typeof DayCrudModal>[0]["leaves"]}
    schedule={selectedDay.schedule as Parameters<typeof DayCrudModal>[0]["schedule"]}
    holidays={selectedDay.holidays as Parameters<typeof DayCrudModal>[0]["holidays"]}
    username={adminUsername}
    isAdmin={true}
    onClose={() => setSelectedDay(null)}
    onRefresh={fetchCalData}
  />
)}
```
  </action>
  <verify>
    <automated>cd "E:/AI Playground/Projects/claude_teamSchedule" && grep -c "onDayClick" frontend/components/Calendar.tsx && grep -c "onDayClick" frontend/components/DayBox.tsx && grep -c "DayCrudModal" frontend/app/calendar/page.tsx && grep -c "DayCrudModal" frontend/app/admin/page.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep "onDayClick" frontend/components/DayBox.tsx` returns at least 2 matches (interface + usage)
    - `grep "onDayClick" frontend/components/Calendar.tsx` returns at least 3 matches (interface + prop + pass-through)
    - `grep "DayCrudModal" frontend/app/calendar/page.tsx` returns at least 2 matches (import + render)
    - `grep "DayCrudModal" frontend/app/admin/page.tsx` returns at least 2 matches (import + render)
    - `grep "selectedDay" frontend/app/calendar/page.tsx` returns at least 3 matches (state declaration + setter + usage)
    - admin/page.tsx no longer contains the inline `function Modal(` (it is now imported)
    - `grep "import Modal" frontend/app/admin/page.tsx` returns a match (imported from components)
    - calendar/page.tsx passes `onRefresh={fetchData}` to DayCrudModal
    - admin/page.tsx passes `isAdmin={true}` and `onRefresh={fetchCalData}` to DayCrudModal
  </acceptance_criteria>
  <done>DayBox and Calendar support onDayClick. Both pages open DayCrudModal on day click with correct role and refresh callback.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client -> /api/leaves | User JWT; backend enforces own-only rule |
| client -> /admin/leaves | Admin JWT required; backend enforces via get_current_admin |
| client -> /api/schedule | User JWT; backend only allows primary_oncall update |
| client -> /api/holidays | User JWT; any user can manage holidays |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-F1-03-01 | Elevation of Privilege | DayCrudModal isAdmin flag | mitigate | isAdmin derived from localStorage username === "Admin"; actual enforcement is server-side via get_current_admin; frontend flag only controls which endpoint is called — backend always validates |
| T-F1-03-02 | Tampering | User editing another member's leave | mitigate | Backend /api/leaves enforces employee_name == JWT user; HTTP 403 returned and shown to user |
| T-F1-03-03 | Tampering | User adding schedule rows | mitigate | PUT /api/schedule only updates existing rows; backend returns 404 for dates with no schedule entry; UI shows "No schedule entry for this date" without add button |
</threat_model>

<verification>
After both tasks:
1. `grep "onDayClick" frontend/components/DayBox.tsx` — at least 2 matches
2. `grep "onDayClick" frontend/components/Calendar.tsx` — at least 3 matches
3. `grep "DayCrudModal" frontend/app/calendar/page.tsx` — at least 2 matches
4. `grep "DayCrudModal" frontend/app/admin/page.tsx` — at least 2 matches
5. `grep "import Modal" frontend/app/admin/page.tsx` — 1 match (imported, not inline)
6. `grep "function Modal" frontend/app/admin/page.tsx` — 0 matches (inline version removed)
7. `grep "export default function Modal" frontend/components/Modal.tsx` — 1 match
8. `grep "/admin/leaves" frontend/components/DayCrudModal.tsx` — at least 2 matches
9. `grep "updateHoliday" frontend/components/DayCrudModal.tsx` — at least 1 match
</verification>

<success_criteria>
- Clicking any calendar day opens DayCrudModal for that date
- User sees their own leaves with edit/delete buttons; other members' leaves are read-only
- Admin sees all leaves with edit/delete buttons
- Primary support can be edited on any date that has a schedule entry; dates without schedule show "No schedule entry"
- Holidays can be added, edited, and deleted by any user
- Modal closes on X button click (onClose called directly by X button)
- Calendar refreshes after any successful mutation
- Modal.tsx is a standalone component (no inline duplication in admin/page.tsx)
</success_criteria>

<output>
After completion, create `.planning/phases/Feature_01/Feature_01-03-SUMMARY.md` with:
- DayCrudModal prop interface (date, leaves, schedule, holidays, username, isAdmin, onClose, onRefresh)
- API endpoints called from DayCrudModal (list all 10, including PUT /api/holidays/{id})
- How Calendar/DayBox pass onDayClick
- How both pages wire selectedDay state
- Confirmation that admin/page.tsx uses imported Modal (not inline)
</output>
