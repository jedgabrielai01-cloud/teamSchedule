"use client";
import { useState } from "react";
import DayBox from "./DayBox";
import DayModal from "./DayModal";

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
  month: number;
  leaves: Leave[];
  schedule: Schedule[];
  holidays: Holiday[];
  currentUser: string;
  isAdmin: boolean;
  members: string[];
  onMutate: () => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Calendar({
  year, month, leaves, schedule, holidays,
  currentUser, isAdmin, members, onMutate,
}: Props) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Date[] = [];

  for (let i = firstDay - 1; i >= 0; i--) cells.push(new Date(year, month, -i));
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0)
    cells.push(new Date(year, month + 1, cells.length - firstDay - daysInMonth + 1));

  return (
    <>
      <div className="flex flex-col flex-1 overflow-auto" data-testid="calendar-grid">
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
            const iso = toIso(date);
            return (
              <DayBox
                key={i}
                date={date}
                currentMonth={month}
                leaves={leaves.filter((l) => l.leave_date === iso)}
                schedule={schedule.find((s) => s.schedule_date === iso) ?? null}
                holidays={holidays.filter((h) => h.holiday_date === iso)}
                onEdit={() => setSelectedDate(date)}
              />
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <DayModal
          date={selectedDate}
          leaves={leaves.filter((l) => l.leave_date === toIso(selectedDate))}
          schedule={schedule.find((s) => s.schedule_date === toIso(selectedDate)) ?? null}
          currentUser={currentUser}
          isAdmin={isAdmin}
          members={members}
          onClose={() => setSelectedDate(null)}
          onMutate={() => { onMutate(); setSelectedDate(null); }}
        />
      )}
    </>
  );
}
