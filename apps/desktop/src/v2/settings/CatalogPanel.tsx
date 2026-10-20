import { useEffect, useState } from "react";
import {
  Database,
  RefreshCw,
  Download,
  Package,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import { api, type Config } from "../../client";
type State = {
  itemCount: number;
  questCount: number;
  classCount?: number;
  sourceItemCount?: number;
  apiItemCount?: number;
  missingImages?: number;
  version?: string;
  updatedAt?: string;
  categoryCounts?: Record<string, number>;
  progress?: { phase: string; percent: number; message: string };
  import?: { running: boolean; error?: string | null; lastResult?: unknown };
};
export default function CatalogPanel({
  config,
  onComplete,
}: {
  config: Config;
  onComplete?: () => void;
}) {
  const [state, setState] = useState<State | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false,
      wasRunning = false;
    async function poll() {
      try {
        const r = await api<State>("/api/catalog/status", config);
        if (cancelled) return;
        setState(r.data);
        if (wasRunning && !r.data.import?.running && !r.data.import?.error)
          onComplete?.();
        wasRunning = !!r.data.import?.running;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }
    void poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [config.url, config.token]);
  async function update() {
    setBusy(true);
    setError("");
    try {
      await api("/api/catalog/update", config, {});
      const r = await api<State>("/api/catalog/status", config);
      setState(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel v2-catalog-status">
      <div className="panel-title">
        <span>
          <Database size={18} /> DOFUS-Spieldaten
        </span>
        <span className="pill">{state?.version || "Noch kein Datenpaket"}</span>
      </div>
      <p>
        Gegenstände, Rezepte, Klassen und Questkategorien werden in einem
        eigenen lokalen Katalog gespeichert. Persönliche Daten bleiben davon
        getrennt.
      </p>
      <div className="v2-data-counts">
        <div>
          <Package size={19} />
          <strong>{(state?.itemCount ?? 0).toLocaleString("de-DE")}</strong>
          <small>Gegenstände</small>
        </div>
        <div>
          <BookOpen size={19} />
          <strong>{(state?.questCount ?? 0).toLocaleString("de-DE")}</strong>
          <small>Quests</small>
        </div>
        <div>
          <ShieldCheck size={19} />
          <strong>{state?.classCount ?? 0}</strong>
          <small>Klassen</small>
        </div>
      </div>
      {state?.progress && state.import?.running && (
        <div className="v2-import-progress">
          <progress max={100} value={state.progress.percent} />
          <p>
            {state.progress.message} · {state.progress.percent} %
          </p>
        </div>
      )}
      {state?.categoryCounts && (
        <details>
          <summary>Importqualität und Datenherkunft</summary>
          <p>
            Verarbeitete Quelldatensätze:{" "}
            {state.sourceItemCount?.toLocaleString("de-DE")}. Ergänzt mit{" "}
            {state.apiItemCount?.toLocaleString("de-DE")} formatierten
            API-Gegenständen. Fehlende Bildreferenzen:{" "}
            {state.missingImages?.toLocaleString("de-DE")}.
          </p>
          <div className="v2-category-counts">
            {Object.entries(state.categoryCounts).map(([name, count]) => (
              <span key={name}>
                {(
                  {
                    equipment: "Ausrüstung",
                    resources: "Ressourcen",
                    consumables: "Verbrauchsgegenstände",
                    quest: "Questgegenstände",
                    cosmetics: "Kosmetik & sonstige Items",
                  } as Record<string, string>
                )[name] ?? name}
                <b>{count.toLocaleString("de-DE")}</b>
              </span>
            ))}
          </div>
          <small>
            Quellen: dofus-sqlite und Dofusdude. Quelldatensätze ohne
            vollständige Bild-/Effektangaben bleiben ausdrücklich als Datenlücke
            erkennbar.
          </small>
        </details>
      )}
      <div className="toolbar">
        <button
          onClick={() => void update()}
          disabled={busy || state?.import?.running}
        >
          <Download size={16} />
          {state?.import?.running
            ? "Spieldaten werden importiert …"
            : state?.itemCount
              ? "Spieldaten aktualisieren"
              : "Vollständigen Katalog importieren"}
        </button>
        <small>
          Erster Quellimport: etwa 385 MB. Der stabile Bestand bleibt bei
          Fehlern erhalten.
        </small>
      </div>
      {(error || state?.import?.error) && (
        <div className="notice" role="alert">
          {error || state?.import?.error}
        </div>
      )}
      <small>
        <RefreshCw size={11} /> Datenstand:{" "}
        {state?.updatedAt
          ? new Date(state.updatedAt).toLocaleString("de-DE")
          : "noch nicht importiert"}
        . App-Updates und Datenupdates werden unabhängig geprüft.
      </small>
    </section>
  );
}
