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
