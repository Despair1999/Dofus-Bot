import { useEffect, useRef, useState } from "react";
import type { Config } from "../../client";
import {
  languageNames,
  type Language,
  type TranslatorPreferences,
} from "./model";
import { translatorRequest, useTranslatorConnection } from "./connection";
import "./translator.css";

export default function TranslatorCard({
  preferences,
  onChange,
  config: provided,
}: {
  preferences: TranslatorPreferences;
  onChange: (next: TranslatorPreferences) => void;
  config?: Config;
}) {
  const config = useTranslatorConnection(provided);
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pivot, setPivot] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const latest = useRef({ text, preferences, config });
  latest.current = { text, preferences, config };
  const invalidate = () => {
    generation.current++;
    controller.current?.abort();
    setBusy(false);
    setResult("");
    setError("");
  };
  function input(value: string) {
    invalidate();
    setText(value);
  }
  function preferencesChanged(next: TranslatorPreferences) {
    invalidate();
    onChange(next);
  }
  async function translate() {
    const {
      text: value,
      preferences: pref,
      config: connection,
    } = latest.current;
    if (!connection || !value.trim()) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const id = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const response = await translatorRequest<{
        text: string;
        pivot: boolean;
      }>(
        connection,
        "translate",
        { text: value, source: pref.source, target: pref.target },
        abort.signal,
      );
      if (id === generation.current) {
        setResult(response.text);
        setPivot(response.pivot);
      }
    } catch (cause) {
      if (!abort.signal.aborted && id === generation.current)
        setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (id === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!preferences.automatic || !text.trim() || !config) return;
    const timer = setTimeout(() => {
      void translate();
    }, 650);
    return () => clearTimeout(timer);
  }, [
    text,
    preferences.source,
    preferences.target,
    preferences.automatic,
    config,
  ]);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  async function clipboard(copy: boolean) {
    try {
      if (copy) await navigator.clipboard.writeText(result);
      else input(await navigator.clipboard.readText());
      setError("");
    } catch {
      setError(
        "Zwischenablage ist nicht freigegeben. Bitte Strg+V oder markierten Text mit Strg+C verwenden.",
      );
    }
  }
  if (preferences.minimized)
    return (
      <button
        className="text-button"
        onClick={() => onChange({ ...preferences, minimized: false })}
      >
        🌐 {preferences.source.toUpperCase()} →{" "}
        {preferences.target.toUpperCase()} · öffnen
      </button>
    );
  return (
    <div
      className="translator-card"
      onKeyDown={(e) => {
        if (e.ctrlKey && e.key === "Enter") {
          e.preventDefault();
          void translate();
        }
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") {
          e.preventDefault();
          void clipboard(true);
        }
      }}
    >
      <div className="translator-languages">
        <select
          aria-label="Ausgangssprache"
          value={preferences.source}
          onChange={(e) => {
            const source = e.target.value as Language;
            preferencesChanged({
              ...preferences,
              source,
              target:
                source === preferences.target
                  ? preferences.source
                  : preferences.target,
            });
          }}
        >
          {Object.entries(languageNames).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <button
          title="Sprachen tauschen"
          onClick={() =>
            preferencesChanged({
              ...preferences,
              source: preferences.target,
              target: preferences.source,
            })
          }
        >
          ⇄
        </button>
        <select
          aria-label="Zielsprache"
          value={preferences.target}
          onChange={(e) =>
            preferencesChanged({
              ...preferences,
              target: e.target.value as Language,
            })
          }
        >
          {Object.entries(languageNames)
            .filter(([code]) => code !== preferences.source)
            .map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
        </select>
      </div>
      <textarea
        aria-label="Zu übersetzender Text"
        value={text}
        maxLength={2000}
        placeholder="Nachricht einfügen oder Antwort schreiben …"
        onChange={(e) => input(e.target.value)}
      />
      <div className="translator-actions">
        <button onClick={() => void clipboard(false)}>Einfügen</button>
        <button onClick={() => input("")}>Leeren</button>
        <small>{text.length}/2000</small>
      </div>
      <div className="translator-output" role="status" aria-live="polite">
        {busy
          ? "Wird lokal übersetzt …"
          : result || "Deine Übersetzung erscheint hier."}
      </div>
      {error && (
        <p className="translator-error" role="alert">
          {error}
        </p>
      )}
      <div className="translator-actions">
        <button
          disabled={busy || !text.trim() || !config}
          onClick={() => void translate()}
        >
          Übersetzen
        </button>
        <button disabled={!result || busy} onClick={() => void clipboard(true)}>
          Kopieren
        </button>
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          checked={preferences.automatic}
          onChange={(e) =>
            preferencesChanged({ ...preferences, automatic: e.target.checked })
          }
        />
        Automatisch übersetzen
      </label>
      <small>
        Lokal · Strg+Enter übersetzt · Strg+Umschalt+C kopiert
        {result && pivot ? " · über Englisch" : ""}
      </small>
    </div>
  );
}
