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
