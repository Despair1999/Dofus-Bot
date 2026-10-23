export type CalendarView = "list" | "week" | "month";
export function calendarDays(anchor: Date, view: CalendarView) {
  const first = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    view === "month" ? 1 : anchor.getDate(),
    12,
  );
  if (view !== "list")
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  return Array.from({ length: view === "month" ? 42 : 7 }, (_, i) => {
    const date = new Date(first);
    date.setDate(first.getDate() + i);
    return date;
  });
}
export function dayKey(
  date: Date,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((key) => parts.find((p) => p.type === key)!.value)
    .join("-");
}
export function zonedInstant(value: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw Error("Datum und Uhrzeit fehlen.");
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const [year, month, day, hour, minute] = value.split(/[-T:]/).map(Number),
    target = Date.UTC(year, month - 1, day, hour, minute);
  const stamp = (time: number) => {
    const p = format.formatToParts(time);
    const n = (key: string) => Number(p.find((x) => x.type === key)!.value);
    return Date.UTC(
      n("year"),
      n("month") - 1,
      n("day"),
      n("hour"),
      n("minute"),
    );
  };
  let guess = target;
  for (let i = 0; i < 3; i++) guess += target - stamp(guess);
  const candidates = [
    -7200000, -3600000, -1800000, 0, 1800000, 3600000, 7200000,
  ]
    .map((n) => guess + n)
    .filter((n) => stamp(n) === target)
    .sort((a, b) => a - b);
  if (!candidates.length)
    throw Error(
      "Diese Uhrzeit existiert in der gewählten Zeitzone nicht (Sommerzeitwechsel). Bitte einen anderen Termin wählen.",
    );
  return new Date(candidates[0]).toISOString();
}
