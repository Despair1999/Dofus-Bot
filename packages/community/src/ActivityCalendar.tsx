import type { Activity } from "./model";
import { calendarDays, dayKey, type CalendarView } from "./calendar";
export default function ActivityCalendar({
  activities,
  anchor,
  view,
  onSelect,
}: {
  activities: Activity[];
  anchor: Date;
  view: CalendarView;
  onSelect: (id: string) => void;
}) {
  const days = calendarDays(anchor, view),
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div
      className="cc-calendar"
      role="grid"
      aria-label={`${view === "week" ? "Wochenkalender" : "Monatskalender"} · ${timezone}`}
    >
      {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
        <b role="columnheader" key={d}>
          {d}
        </b>
      ))}
      {days.map((date) => (
        <div
          role="gridcell"
          key={dayKey(date)}
          className={`cc-calendar-day ${date.getMonth() !== anchor.getMonth() ? "cc-calendar-muted" : ""}`}
        >
          <time dateTime={dayKey(date)}>
            {date.toLocaleDateString("de-DE", {
              day: "numeric",
              month: "short",
            })}
          </time>
          {activities
            .filter(
              (e) => dayKey(new Date(e.startsAt), timezone) === dayKey(date),
            )
            .map((e) => (
              <button
                key={e.id}
                onClick={() => onSelect(e.id)}
                className={
                  e.status === "cancelled" ? "cc-calendar-cancelled" : ""
                }
              >
                <time>
                  {new Date(e.startsAt).toLocaleTimeString("de-DE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>{" "}
                {e.title}
                <small>
                  {e.joined}/{e.capacity} · {e.server}
                </small>
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}
