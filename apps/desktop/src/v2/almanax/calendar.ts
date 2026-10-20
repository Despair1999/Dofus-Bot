export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function shiftDate(date: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Ungültiges Kalenderdatum");
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function mondayOf(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shiftDate(date, -((day + 6) % 7));
}
export function weekDates(date: string) {
  const start = mondayOf(date);
  return Array.from({ length: 7 }, (_, i) => shiftDate(start, i));
}
export function monthDates(date: string) {
  const first = `${date.slice(0, 7)}-01`;
  const last = new Date(`${first}T12:00:00Z`);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  const start = mondayOf(first);
  const days =
    Math.ceil(
      (Math.round(
        (last.getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86400000,
      ) +
        1) /
        7,
    ) * 7;
  return Array.from({ length: days }, (_, i) => shiftDate(start, i));
}
export function escapeCSV(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
