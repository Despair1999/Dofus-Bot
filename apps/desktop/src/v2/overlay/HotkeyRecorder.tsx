import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { Keyboard, RotateCcw, X } from "lucide-react";
import { friendlyHotkey, recordKeyboard } from "./model";
export default function HotkeyRecorder({
  label,
  value,
  onChange,
  used = [],
  defaultValue = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  used?: string[];
  defaultValue?: string;
}) {
  const [recording, setRecording] = useState(false),
    [candidate, setCandidate] = useState(value),
    [error, setError] = useState("");
  useEffect(() => {
    if (!recording) return;
    setCandidate("");
    setError("");
    if (isTauri())
      void invoke("suspend_hotkeys", { suspended: true }).catch((e) =>
        setError(String(e)),
      );
    function down(e: KeyboardEvent) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      try {
        const key = recordKeyboard(e);
        if (key) {
          if (used.includes(key))
            throw new Error(
              "Diese Kombination ist bereits einer anderen Aktion zugewiesen.",
            );
          setCandidate(key);
          setError("");
        }
      } catch (error) {
        setError(String(error instanceof Error ? error.message : error));
      }
    }
    function up(e: KeyboardEvent) {
      if (recording) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      if (isTauri())
        void invoke("suspend_hotkeys", { suspended: false }).catch(() => {});
    };
  }, [recording, used.join("|")]);
  return (
    <div className="hotkey-recorder">
      <span>{label}</span>
      <div className="hotkey-row">
        <button
          className={`secondary hotkey-field ${recording ? "recording" : ""}`}
          type="button"
          aria-label={`${label} aufnehmen`}
          onClick={() => setRecording(true)}
        >
          <Keyboard size={16} />
          {recording
            ? candidate
              ? friendlyHotkey(candidate)
              : "Tastenkombination drücken …"
            : value
              ? friendlyHotkey(value)
              : "Nicht zugewiesen"}
        </button>
        {recording ? (
          <>
            <button
              type="button"
              disabled={!candidate || !!error}
              onClick={() => {
                onChange(candidate);
                setRecording(false);
              }}
            >
              Übernehmen
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setRecording(false)}
            >
              Abbrechen
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="icon-button"
              title={`${label} zurücksetzen`}
              onClick={() => onChange(defaultValue)}
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              className="icon-button"
              title={`${label} entfernen`}
              onClick={() => onChange("")}
            >
              <X size={15} />
            </button>
          </>
        )}
      </div>
      {error && (
        <small role="alert" className="overlay-error">
          {error}
        </small>
      )}
    </div>
  );
}
