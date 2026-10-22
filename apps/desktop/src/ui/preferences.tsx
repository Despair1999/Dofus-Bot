import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { read, write } from "../storage";

type Preferences = {
  scale: number;
  density: "comfortable" | "compact";
  motion: "system" | "reduced";
  restore: boolean;
};
const defaults: Preferences = {
  scale: 1,
  density: "comfortable",
  motion: "system",
  restore: true,
};
function apply(value: Preferences) {
  const root = document.documentElement;
  root.style.setProperty("--ui-scale", String(value.scale));
  root.dataset.density = value.density;
  root.dataset.motion = value.motion;
}
export function PreferenceSync() {
  useEffect(() => {
    let active = true,
      off: (() => void) | undefined;
    void read("ui:display", defaults).then((v) => {
      if (active) apply(v);
    });
    if (isTauri())
      void listen<Preferences>("companion:display", (e) =>
        apply(e.payload),
      ).then((fn) => {
        if (active) off = fn;
        else fn();
      });
    return () => {
      active = false;
      off?.();
    };
  }, []);
  return null;
}
export function DisplayPreferences() {
  const [value, setValue] = useState(defaults),
    [error, setError] = useState("");
  useEffect(() => {
    void read("ui:display", defaults).then(setValue);
  }, []);
  async function save(next: Preferences) {
    try {
      await write("ui:display", next);
      await write("ui:restore-view", next.restore);
      setValue(next);
      apply(next);
      setError("");
      if (isTauri()) await emit("companion:display", next);
    } catch {
      setError("Anzeigeoptionen konnten nicht gespeichert werden.");
    }
  }
  return (
    <section className="panel">
      <h2>Anzeige & Bedienkomfort</h2>
      <div className="ui-preferences-grid">
        <label>
          UI-Textgröße
          <select
            aria-label="UI-Textgröße"
            value={value.scale}
            onChange={(e) => void save({ ...value, scale: +e.target.value })}
          >
            <option value={0.9}>90 % · Kompakter</option>
            <option value={1}>100 % · Standard</option>
            <option value={1.1}>110 % · Größer</option>
            <option value={1.2}>120 % · Gut lesbar</option>
          </select>
        </label>
        <label>
          Informationsdichte
          <select
            aria-label="Informationsdichte"
            value={value.density}
            onChange={(e) =>
              void save({
                ...value,
                density: e.target.value as Preferences["density"],
              })
            }
          >
            <option value="comfortable">Komfortabel</option>
            <option value="compact">Kompakt</option>
          </select>
        </label>
        <label>
          Animationen
          <select
            aria-label="Animationen"
            value={value.motion}
            onChange={(e) =>
              void save({
                ...value,
                motion: e.target.value as Preferences["motion"],
              })
            }
          >
            <option value="system">Systemeinstellung beachten</option>
            <option value="reduced">Bewegung reduzieren</option>
          </select>
        </label>
      </div>
      <label className="ui-check-label">
        <input
          type="checkbox"
          checked={value.restore}
          onChange={(e) => void save({ ...value, restore: e.target.checked })}
        />
        Letzte Ansicht beim Start wiederherstellen
      </label>
      <p className="v2-muted">
        Deine Daten und Entwürfe bleiben erhalten. Explizite Links öffnen
        weiterhin direkt ihr Ziel.
      </p>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
