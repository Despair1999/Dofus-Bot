import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  Settings,
  Palette,
  PanelLeft,
  Layers,
  Keyboard,
  Languages,
  Database,
  MessageCircle,
  SlidersHorizontal,
} from "lucide-react";
import { useRoute, navigatePath } from "../v2/routing";
import type { Config } from "../client";
import { request } from "../v2/shared/request";
import { assetFailures, type AssetFailure } from "./assetDiagnostics";
import { DisplayPreferences } from "./preferences";

const categories = [
  { id: "general", label: "Allgemein", icon: Settings },
  { id: "appearance", label: "Darstellung", icon: Palette },
  { id: "navigation", label: "Navigation", icon: PanelLeft },
  { id: "overlay", label: "Overlay", icon: Layers },
  { id: "keyboard", label: "Tastenkürzel", icon: Keyboard },
  { id: "language", label: "Sprache", icon: Languages },
  { id: "data", label: "Daten & Updates", icon: Database },
  { id: "discord", label: "Discord", icon: MessageCircle },
  { id: "advanced", label: "Erweitert", icon: SlidersHorizontal },
];
const SettingsContext = createContext("general");
export function SettingsGroup({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return useContext(SettingsContext) === id ? <>{children}</> : null;
}
export default function SettingsWorkspace({
  children,
}: {
  children: ReactNode;
}) {
  const route = useRoute(),
    requested = route.params.get("section") || "general",
    active = categories.some((c) => c.id === requested) ? requested : "general";
  return (
    <div className="ui-settings-workspace">
      <nav className="ui-settings-nav" aria-label="Einstellungskategorien">
        {categories.map((c) => (
          <button
            className={c.id === active ? "selected" : ""}
            aria-current={c.id === active ? "page" : undefined}
            key={c.id}
            onClick={() => navigatePath(`/settings?section=${c.id}`)}
          >
            <c.icon size={17} />
            {c.label}
          </button>
        ))}
      </nav>
      <div className="ui-settings-content">
        <SettingsContext.Provider value={active}>
          {children}
        </SettingsContext.Provider>
      </div>
    </div>
  );
}
export function SettingsInformation({ config }: { config: Config }) {
  const [discord, setDiscord] = useState<{ configured: boolean } | null>(null);
  useEffect(() => {
    const c = new AbortController();
    void request<{ configured: boolean }>(
      "/api/activity/config",
      config,
      c.signal,
    )
      .then((r) => setDiscord(r.data))
      .catch(() => {});
    return () => c.abort();
  }, [config]);
  return (
    <>
      <SettingsGroup id="general">
        <DisplayPreferences />
        <section className="panel">
          <h2>Dein persönlicher Arbeitsbereich</h2>
          <p>
            Charaktere, Builds, Quests und eigene Fundorte bleiben lokal mit
            deinem Companion verbunden.
          </p>
          <div className="toolbar">
            <button onClick={() => navigatePath("/characters")}>
              Charaktere verwalten
            </button>
            <button
              className="secondary"
              onClick={() => navigatePath("/settings?section=data")}
            >
              Datenbestand prüfen
            </button>
          </div>
        </section>
      </SettingsGroup>
      <SettingsGroup id="navigation">
        <section className="panel">
          <h2>Schneller zu deinem nächsten Schritt</h2>
          <p>
            Entdecken, Planen, Tools und Persönlich ordnen die vorhandenen
            Module. Gruppen und Icon-Modus werden automatisch gespeichert.
          </p>
          <div className="ui-shortcut-list">
            <span>
              <kbd>Ctrl</kbd> + <kbd>K</kbd>
            </span>
            <p>Globale Suche und direkte Modulaktionen</p>
            <span>Seitenleistenkopf</span>
            <p>Zwischen vollständiger Navigation und Icon-Modus wechseln</p>
          </div>
          <button
            onClick={() => window.dispatchEvent(new Event("companion:command"))}
          >
            Globale Suche öffnen
          </button>
        </section>
      </SettingsGroup>
      <SettingsGroup id="keyboard">
        <section className="panel">
          <h2>Tastenkürzel</h2>
          <div className="ui-shortcut-list">
            <span>
              <kbd>Ctrl</kbd> + <kbd>K</kbd>
            </span>
            <p>Globale Suche</p>
            <span>
              <kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd>
            </span>
            <p>Suchergebnis auswählen und öffnen</p>
            <span>
              <kbd>Esc</kbd>
            </span>
            <p>Dialog schließen; kompakte Hauptansicht verlassen</p>
            <span>
              <kbd>Ctrl</kbd> + <kbd>S</kbd>
            </span>
            <p>Im Builder den geöffneten Build speichern</p>
          </div>
          <button
            className="secondary"
            onClick={() => navigatePath("/settings?section=overlay")}
          >
            Globale Overlay-Hotkeys konfigurieren
          </button>
        </section>
      </SettingsGroup>
      <SettingsGroup id="language">
        <section className="panel">
          <h2>Sprache & Übersetzung</h2>
          <p>
            Die Benutzeroberfläche ist deutsch. Der lokale Übersetzer
            unterstützt Deutsch, Englisch und Französisch mit zwei unabhängigen
            Karten.
          </p>
          <p>
            Originalnamen und historische Datenstände bleiben in den Fachmodulen
            sichtbar. Es werden keine Spieltexte durch ungeprüfte automatische
            Übersetzungen ersetzt.
          </p>
          <button onClick={() => navigatePath("/translator")}>
            Sprachen im Übersetzer wählen
          </button>
        </section>
      </SettingsGroup>
      <SettingsGroup id="discord">
        <section className="panel">
          <h2>Discord Companion</h2>
          <p>
            {discord
              ? discord.configured
                ? "Die Activity-Konfiguration ist im verbundenen Backend vorhanden."
                : "Für eine Live-Activity fehlen im verbundenen Backend noch Discord-Konfiguration oder HTTPS-Hosting."
              : "Activity-Status derzeit nicht verfügbar."}
          </p>
          <p>
            Die Activity teilt nur ausdrücklich übernommene Karten-/Routenziele
            mit ihrer Discord-Instanz. Lokale Charaktere und private Builds
            bleiben getrennt.
          </p>
          <p>
            Bot-Zugang und Berechtigungen werden weiterhin in der bestehenden
            Serverkonfiguration verwaltet. Zugangsschlüssel werden nicht in
            dieser Oberfläche gespeichert.
          </p>
        </section>
      </SettingsGroup>
    </>
  );
}

export function AssetDiagnostics() {
  const [failures, setFailures] = useState<AssetFailure[]>(assetFailures);
  useEffect(() => {
    const load = () => setFailures(assetFailures());
    window.addEventListener("companion:asset-failure", load);
    return () => window.removeEventListener("companion:asset-failure", load);
  }, []);
  return (
    <section className="panel">
      <h2>Bilddiagnostik dieser Sitzung</h2>
      <p>
        Originalbilder werden über ihre vorhandenen IDs zugeordnet. Bei einem
        Ladefehler wird die nächste vorhandene Referenz versucht, danach
        erscheint ein gekennzeichneter Platzhalter.
      </p>
      {failures.length ? (
        <>
          <p>
            {failures.length} Bildreferenzen konnten mindestens einmal nicht
            geladen werden.
          </p>
          <ul className="ui-asset-failures">
            {failures.map((f) => (
              <li key={f.path}>
                <code>{f.path}</code>
                <span>{f.count}×</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="v2-muted">
          Bisher keine beobachteten Bildladefehler in dieser Sitzung. Nicht
          besuchte Ansichten sind dadurch nicht geprüft.
        </p>
      )}
      <small>
        Nur im Arbeitsspeicher; keine Zugangsschlüssel oder vollständigen
        externen URLs.
      </small>
    </section>
  );
}
