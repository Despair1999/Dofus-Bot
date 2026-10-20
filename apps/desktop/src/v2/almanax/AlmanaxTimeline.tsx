import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Download,
  ShoppingBag,
  Star,
  ExternalLink,
  RefreshCw,
  Bell,
  Package,
} from "lucide-react";
import { cached, type Config } from "../../client";
import { read, write } from "../../storage";
import {
  todayISO,
  shiftDate,
  weekDates,
  monthDates,
  escapeCSV,
} from "./calendar";
import "./almanax.css";
export interface AlmanaxDay {
  date: string;
  name?: string;
  npcName?: string;
  bonus: { description: string; type: { name: string; id: string } };
  reward_kamas: number;
  tribute: {
    item: {
      ankama_id: number;
      name: string;
      image_urls?: { icon?: string; sd?: string };
      subtype?: string;
    };
    quantity: number;
  };
}
type DayState = { data?: AlmanaxDay; error?: string; stale?: boolean };
export default function AlmanaxTimeline({
  config,
  onOpenItem,
  onNotice,
}: {
  config: Config;
  onOpenItem: (id: number, category?: string) => void;
  onNotice?: (message: string) => void;
}) {
  const [anchor, setAnchor] = useState(todayISO),
    [view, setView] = useState<"week" | "month">("week"),
    [selected, setSelected] = useState(todayISO),
    [entries, setEntries] = useState<Record<string, DayState>>({}),
    [loading, setLoading] = useState(false),
    [filter, setFilter] = useState(""),
    [favorites, setFavorites] = useState<string[]>([]);
  const dates = useMemo(
    () => (view === "week" ? weekDates(anchor) : monthDates(anchor)),
    [view, anchor],
  );
  const selectedDay = entries[selected]?.data;
  useEffect(() => {
    void read<string[]>("almanax-favorite-bonuses", []).then(setFavorites);
  }, []);
  useEffect(() => {
    let disposed = false;
    setLoading(true);
    void (async () => {
      for (let start = 0; start < dates.length; start += 4) {
        await Promise.all(
          dates.slice(start, start + 4).map(async (date) => {
            try {
              const result = await cached<AlmanaxDay>(
                `/api/almanax?date=${date}&lang=de`,
                config,
              );
              if (!disposed)
                setEntries((previous) => ({
                  ...previous,
                  [date]: { data: result.data, stale: result.stale },
                }));
            } catch (error) {
              if (!disposed)
                setEntries((previous) => ({
                  ...previous,
                  [date]: {
                    error:
                      error instanceof Error
                        ? error.message
                        : "Almanax konnte nicht geladen werden.",
                  },
                }));
            }
          }),
        );
        if (disposed) break;
      }
      if (!disposed) setLoading(false);
    })();
    return () => {
      disposed = true;
    };
  }, [dates, config.url, config.token]);
  const bonuses = [
    ...new Map(
      Object.values(entries).flatMap((entry) =>
        entry.data
          ? [[entry.data.bonus.type.id, entry.data.bonus.type.name] as const]
          : [],
      ),
    ).entries(),
  ];
  function move(direction: number) {
    if (view === "week") setAnchor(shiftDate(anchor, direction * 7));
    else {
      const date = new Date(`${anchor.slice(0, 7)}-01T12:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() + direction);
      setAnchor(date.toISOString().slice(0, 10));
    }
  }
  function download(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function shoppingList(days: AlmanaxDay[]) {
    const previous = await read<
      {
        id: string;
        name: string;
        items: {
          itemId: number;
          name: string;
          quantity: number;
          category?: string;
          imageUrl?: string;
        }[];
      }[]
    >("shopping-lists", []);
    const totals = new Map<
      number,
      {
        itemId: number;
        name: string;
        quantity: number;
        category?: string;
        imageUrl?: string;
      }
    >();
    for (const day of days) {
      const item = day.tribute.item;
      const entry = totals.get(item.ankama_id);
      if (entry) entry.quantity += day.tribute.quantity;
      else
        totals.set(item.ankama_id, {
          itemId: item.ankama_id,
          name: item.name,
          quantity: day.tribute.quantity,
          category: item.subtype,
          imageUrl: item.image_urls?.icon,
        });
    }
    const next = [
      ...previous,
      {
        id: crypto.randomUUID(),
        name: `Almanax ${dates[0]} – ${dates.at(-1)}`,
        items: [...totals.values()],
      },
    ];
    await write("shopping-lists", next);
    onNotice?.("Opfergaben als persönliche Einkaufsliste gespeichert.");
  }
  function exportRange() {
    const rows = [
      ["Datum", "Bonus", "Opfergabe", "Menge", "Kamas"],
      ...dates.flatMap((date) =>
        entries[date]?.data
          ? [
              [
                date,
                entries[date].data!.bonus.type.name,
                entries[date].data!.tribute.item.name,
                entries[date].data!.tribute.quantity,
                entries[date].data!.reward_kamas,
              ],
            ]
          : [],
      ),
    ];
    download(
      `almanax-${dates[0]}.csv`,
      "\uFEFF" + rows.map((row) => row.map(escapeCSV).join(";")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  function reminder(day: AlmanaxDay) {
    const stamp = day.date.replaceAll("-", "");
    const clean = (value: string) =>
      value
        .replaceAll("\\", "\\\\")
        .replaceAll("\n", "\\n")
        .replaceAll(",", "\\,")
        .replaceAll(";", "\\;");
    download(
      `almanax-${day.date}.ics`,
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//DOFUS Companion//Almanax//DE",
        "BEGIN:VEVENT",
        `UID:almanax-${day.date}@dofus-companion`,
        `DTSTAMP:${new Date()
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, "")}`,
        `DTSTART;TZID=Europe/Berlin:${stamp}T080000`,
        `DTEND;TZID=Europe/Berlin:${stamp}T081500`,
        `SUMMARY:${clean("Almanax: " + day.tribute.quantity + " × " + day.tribute.item.name)}`,
        `DESCRIPTION:${clean(day.bonus.description)}`,
        "BEGIN:VALARM",
        "TRIGGER:-PT30M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Almanax-Opfergabe vorbereiten",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n"),
      "text/calendar",
    );
    onNotice?.(
      "Kalender-Erinnerung exportiert. Die ICS-Datei in deinen Kalender importieren.",
    );
  }
  return (
    <div className="v2-almanax">
      <section className="panel">
        <div className="v2-calendar-title">
          <div>
            <span className="eyebrow">DEIN KALENDER DER ZWÖLF</span>
            <h2>
              {new Date(`${anchor}T12:00:00Z`).toLocaleDateString("de-DE", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </h2>
            <p>
              Opfergaben planen, Boni entdecken und deine Woche vorbereiten.
            </p>
          </div>
          <div className="toolbar">
            <button
              className="secondary"
              aria-label="Vorherige Woche oder Monat"
              onClick={() => move(-1)}
            >
              <ArrowLeft size={17} />
            </button>
            <button
              className="secondary"
              onClick={() => {
                setAnchor(todayISO());
                setSelected(todayISO());
              }}
            >
              Heute
            </button>
            <button
              className="secondary"
              aria-label="Nächste Woche oder Monat"
              onClick={() => move(1)}
            >
              <ArrowRight size={17} />
            </button>
            <input
              aria-label="Almanax-Datum wählen"
              type="date"
              value={anchor}
              onChange={(e) => {
                if (e.target.value) {
                  setAnchor(e.target.value);
                  setSelected(e.target.value);
                }
              }}
            />
          </div>
        </div>
        <div className="v2-calendar-tools">
          <div className="v2-segmented">
            <button
              className={view === "week" ? "active" : ""}
              onClick={() => setView("week")}
            >
              Woche
            </button>
            <button
              className={view === "month" ? "active" : ""}
              onClick={() => setView("month")}
            >
              Monat
            </button>
          </div>
          <select
            aria-label="Tagesbonus filtern"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Alle Tagesboni</option>
            <option value="favorites">Favorisierte Boni</option>
            {bonuses.map(([id, label]) => (
              <option value={id} key={id}>
                {label}
              </option>
            ))}
          </select>
          {loading && (
            <span className="v2-loading">
              <RefreshCw size={14} className="spin" /> Kalender wird geladen
            </span>
          )}
        </div>
        <div
          className={`v2-calendar-grid ${view}`}
          aria-label={
            view === "week"
              ? "Almanax-Wochenübersicht"
              : "Almanax-Monatsübersicht"
          }
        >
          {dates.map((date) => {
            const entry = entries[date],
              day = entry?.data;
            const hidden =
              !!filter &&
              !!day &&
              (filter === "favorites"
                ? !favorites.includes(day.bonus.type.id)
                : day.bonus.type.id !== filter);
            return (
              <button
                key={date}
                className={`v2-day ${date === todayISO() ? "today" : ""} ${date === selected ? "selected" : ""} ${hidden ? "dimmed" : ""}`}
                aria-pressed={date === selected}
                onClick={() => setSelected(date)}
              >
                <span className="v2-day-date">
                  <span>
                    {new Date(`${date}T12:00:00Z`).toLocaleDateString("de-DE", {
                      weekday: "short",
                      timeZone: "UTC",
                    })}
                  </span>
                  <strong>{date.slice(-2)}</strong>
                  <small>
                    {new Date(`${date}T12:00:00Z`).toLocaleDateString("de-DE", {
                      month: "short",
                      timeZone: "UTC",
                    })}
                  </small>
                </span>
                {day ? (
                  <>
                    <span className="v2-day-bonus">
                      {day.name || day.npcName || day.bonus.type.name}
                    </span>
                    <span className="v2-tribute-image">
                      {day.tribute.item.image_urls?.icon ? (
                        <img
                          loading="lazy"
                          src={day.tribute.item.image_urls.icon}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <Package size={30} />
                      )}
                      <b>× {day.tribute.quantity}</b>
                    </span>
                    <span className="v2-day-item">{day.tribute.item.name}</span>
                    <small>
                      {entry.stale ? "Gespeicherter Stand" : "Dofusdude"}
                    </small>
                  </>
                ) : (
                  <span className="v2-day-empty">
                    {entry?.error ? "Daten nicht verfügbar" : "Wird geladen …"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="toolbar">
          <button
            className="secondary"
            onClick={() =>
              void shoppingList(
                dates.flatMap((d) =>
                  entries[d]?.data ? [entries[d].data!] : [],
                ),
              )
            }
            disabled={!dates.some((d) => entries[d]?.data)}
          >
            <ShoppingBag size={16} /> Opfergaben-Einkaufsliste
          </button>
          <button className="secondary" onClick={exportRange}>
            <Download size={16} /> Zeitraum als CSV
          </button>
        </div>
      </section>
      <section className="panel v2-almanax-detail">
        <div className="panel-title">
          <span>
            <CalendarDays size={18} />
            {new Date(`${selected}T12:00:00Z`).toLocaleDateString("de-DE", {
              dateStyle: "full",
              timeZone: "UTC",
            })}
          </span>
          {entries[selected]?.stale && (
            <span className="pill">Offline-Stand</span>
          )}
        </div>
        {selectedDay ? (
          <>
            <div className="v2-day-detail-heading">
              <div>
                <span className="eyebrow">TAGESBONUS</span>
                <h2>{selectedDay.bonus.type.name}</h2>
                <p>{selectedDay.bonus.description}</p>
              </div>
              <button
                className="secondary"
                aria-pressed={favorites.includes(selectedDay.bonus.type.id)}
                onClick={() => {
                  const next = favorites.includes(selectedDay.bonus.type.id)
                    ? favorites.filter((id) => id !== selectedDay.bonus.type.id)
                    : [...favorites, selectedDay.bonus.type.id];
                  setFavorites(next);
                  void write("almanax-favorite-bonuses", next);
                }}
              >
                <Star size={16} /> Bonus merken
              </button>
            </div>
            <button
              className="v2-tribute-link"
              onClick={() =>
                onOpenItem(
                  selectedDay.tribute.item.ankama_id,
                  selectedDay.tribute.item.subtype,
                )
              }
            >
              {selectedDay.tribute.item.image_urls?.sd && (
                <img src={selectedDay.tribute.item.image_urls.sd} alt="" />
              )}
              <span>
                <small>OPFERGABE</small>
                <strong>
                  {selectedDay.tribute.quantity} ×{" "}
                  {selectedDay.tribute.item.name}
                </strong>
                <small>
                  {selectedDay.reward_kamas.toLocaleString("de-DE")} Kamas laut
                  Quelle
                </small>
              </span>
              <ExternalLink size={18} />
            </button>
            <div className="toolbar">
              <button
                className="secondary"
                onClick={() => void shoppingList([selectedDay])}
              >
                <ShoppingBag size={16} /> Auf Einkaufsliste
              </button>
              <button
                className="secondary"
                onClick={() => reminder(selectedDay)}
              >
                <Bell size={16} /> Kalender-Erinnerung
              </button>
            </div>
            <small>
              Quelle: Dofusdude · Zeitzone Europe/Berlin. Keine automatische
              Spielaktion. Kalendernamen werden nur angezeigt, wenn die Quelle
              sie liefert.
            </small>
          </>
        ) : (
          <div className="empty">
            <CalendarDays size={30} />
            <h3>
              {entries[selected]?.error
                ? "Dieser Tag ist noch nicht verfügbar"
                : "Wähle einen Kalendertag"}
            </h3>
            <p>
              {entries[selected]?.error ||
                "Datum, Opfergabe und Bonus werden aus der tatsächlichen Datenquelle geladen."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
