import { useEffect, useState } from "react";
import type { Config } from "../../client";
import { translatorRequest, useTranslatorConnection } from "./connection";
import TranslatorCard from "./TranslatorCard";
import {
  normalizeTranslator,
  translatorDefaults,
  type TranslatorPreferences,
} from "./model";
import { read, write } from "../../storage";
type Status = {
  ready: boolean;
  runtimeAvailable: boolean;
  installing: boolean;
  error?: string;
  engine: string;
  models: { pair: string; installed: boolean; bytes: number }[];
  progress?: { pair: string; received: number; total: number };
};
export default function TranslatorPanel({
  config: provided,
}: {
  config?: Config;
}) {
  const config = useTranslatorConnection(provided);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [cards, setCards] = useState<TranslatorPreferences[]>([
    translatorDefaults(),
    translatorDefaults(true),
  ]);
  useEffect(() => {
    void read<TranslatorPreferences[]>("translator-preferences-v1", []).then(
      (saved) => {
        if (saved.length)
          setCards(
            saved.slice(0, 2).map((p, i) => normalizeTranslator(p, i === 1)),
          );
      },
    );
  }, []);
  useEffect(() => {
    if (!config) return;
    let stopped = false;
    const poll = () => {
      void translatorRequest<Status>(config, "status")
        .then((value) => {
          if (!stopped) {
            setStatus(value);
            setError("");
          }
        })
        .catch((cause) => {
          if (!stopped) setError(String(cause));
        });
    };
    poll();
    const timer = setInterval(poll, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [config]);
  return (
    <section className="panel translator-panel">
      <div className="panel-title">
        <span>🌐 Offline-Übersetzer</span>
        <span className="pill">DE · EN · FR</span>
      </div>
      <p>
        Nachrichten bleiben auf diesem Computer. Vier kostenlose
        Argos-Sprachmodelle unterstützen sechs Sprachrichtungen; Deutsch ↔
        Französisch wird über Englisch übersetzt.
      </p>
      <small>
        {status?.engine ?? "Lokale CPU-Übersetzung"} · Einmaliger Modelldownload
        ca. 413 MiB; installiert ca. 472 MiB. Runtime zusätzlich ca. 200 MiB.
        Lizenz- und Quellenhinweise bleiben im lokalen Modellpaket erhalten.
      </small>
      {status && (
        <p>
          {status.ready
            ? "Alle Sprachmodelle installiert. Offline bereit."
            : status.runtimeAvailable
              ? "Sprachmodelle fehlen oder sind unvollständig."
              : "Lokale Übersetzungsruntime fehlt in dieser Installation."}
        </p>
      )}
      {status?.models.map((m) => (
        <span key={m.pair} className="pill">
          {m.pair.toUpperCase()} {m.installed ? "✓" : "○"}
          {m.bytes ? ` · ${(m.bytes / 1024 / 1024).toFixed(0)} MB` : ""}
        </span>
      ))}
      {!status?.ready && (
        <button
          disabled={!config || !status?.runtimeAvailable || status.installing}
          onClick={() => {
            void translatorRequest<Status>(config!, "install", {})
              .then(setStatus)
              .catch((cause) => setError(String(cause)));
          }}
        >
          {status?.installing
            ? "Sprachmodelle werden installiert …"
            : "Sprachmodelle installieren"}
        </button>
      )}
      {status?.progress && status.installing && (
        <p>
          {status.progress.pair.toUpperCase()} ·{" "}
          {(status.progress.received / 1024 / 1024).toFixed(1)} MB{" "}
          {status.progress.total
            ? `von ${(status.progress.total / 1024 / 1024).toFixed(1)} MB`
            : "geladen"}
        </p>
      )}
      {(error || status?.error) && (
        <p role="alert" className="translator-error">
          {error || status?.error}
        </p>
      )}
      <div className="translator-two-cards">
        {cards.map((preferences, index) => (
          <div key={index}>
            <h3>
              {index === 0 ? "Nachrichten verstehen" : "Eigene Antworten"}
            </h3>
            <TranslatorCard
              config={config}
              preferences={preferences}
              onChange={(next) => {
                const updated = cards.map((p, i) => (i === index ? next : p));
                setCards(updated);
                void write("translator-preferences-v1", updated);
              }}
            />
          </div>
        ))}
      </div>
      <small>
        Chattexte werden nicht dauerhaft gespeichert. Übersetzerkarten im
        Overlay unter „Module“ einschalten. Bei aktivem Click-through zunächst
        mit dem Rettungshotkey Strg+Alt+Umschalt+O die Bedienung
        wiederherstellen.
      </small>
    </section>
  );
}
