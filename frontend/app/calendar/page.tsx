"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Calendar from "@/components/Calendar";
import FloatingChat from "@/components/FloatingChat";
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
      <div style={{ height: 2, background: "linear-gradient(90deg, #2d5ca8, #4A78C2, #D8B5A6, #F07A3F)" }} />

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
      <div className="flex-1 overflow-hidden">
        <Calendar
          year={year}
          month={month}
          leaves={data.leaves as Parameters<typeof Calendar>[0]["leaves"]}
          schedule={data.schedule as Parameters<typeof Calendar>[0]["schedule"]}
          holidays={data.holidays as Parameters<typeof Calendar>[0]["holidays"]}
          currentUser={username}
          isAdmin={false}
          members={[]}
          onMutate={fetchData}
        />
      </div>
      <FloatingChat />
    </div>
  );
}
