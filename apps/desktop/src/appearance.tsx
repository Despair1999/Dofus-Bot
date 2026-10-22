import { useEffect, useState } from "react";
import { read, write } from "./storage";
import { isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import "./appearance.css";

export const themes = [
  {
    id: "mythic",
    name: "Obsidian & Gold",
    description: "Dark Fantasy · Gold & Türkis",
    colors: ["#10141e", "#d6b479", "#72c6c1"],
  },
  {
    id: "forest",
    name: "Wald der Zwölf",
    description: "Moosgrün & warmes Dunkel",
    colors: ["#101719", "#b9e779", "#26352a"],
  },
  {
    id: "ocean",
    name: "Sufokia",
    description: "Tiefes Blau & Türkis",
    colors: ["#0e1725", "#74d9eb", "#233a50"],
  },
  {
    id: "amethyst",
    name: "Zwielicht",
    description: "Violett & Amethyst",
    colors: ["#191321", "#d0a6ff", "#3a2c4b"],
  },
  {
    id: "ember",
    name: "Brâkmar",
    description: "Anthrazit & Kupfer",
    colors: ["#1e1514", "#f0b27b", "#4a3027"],
  },
] as const;
type Theme = (typeof themes)[number]["id"];
const validTheme = (value: unknown): value is Theme =>
  themes.some((t) => t.id === value);
function apply(value: unknown) {
  document.documentElement.dataset.theme = validTheme(value) ? value : "mythic";
}
export function AppearanceSync() {
  useEffect(() => {
    let active = true;
    void read("appearance:theme", "mythic").then((v) => {
      if (active) apply(v);
    });
    let unlisten: (() => void) | undefined;
    if (isTauri())
      void listen<string>("companion:theme", (e) => apply(e.payload)).then(
        (fn) => {
          if (active) unlisten = fn;
          else fn();
        },
      );
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);
  return null;
}
export function AppearanceSettings() {
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme ?? "mythic",
  );
  const [error, setError] = useState("");
  async function select(value: Theme) {
    try {
      await write("appearance:theme", value);
      apply(value);
      setTheme(value);
      setError("");
      if (isTauri()) await emit("companion:theme", value);
    } catch {
      setError("Das Farbschema konnte nicht gespeichert werden.");
    }
  }
  return (
    <section className="panel appearance-settings">
      <span className="eyebrow">DEIN COMPANION. DEIN STIL.</span>
      <h2>Erscheinungsbild</h2>
      <p>
        Wähle dein Farbschema. Deine Auswahl wird gespeichert und auch im
        Overlay verwendet.
      </p>
      <div className="theme-options" role="group" aria-label="Farbschema">
        {themes.map((t) => (
          <button
            key={t.id}
            className={`theme-option ${theme === t.id ? "selected" : ""}`}
            aria-pressed={theme === t.id}
            onClick={() => void select(t.id)}
          >
            <span className="theme-preview" style={{ background: t.colors[0] }}>
              {t.colors.map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </span>
            <strong>
              {t.name}
              {theme === t.id ? " ✓" : ""}
            </strong>
            <small>{t.description}</small>
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
