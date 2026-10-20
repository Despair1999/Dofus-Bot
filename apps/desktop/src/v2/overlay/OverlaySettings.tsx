import { useEffect, useState } from "react";
import {
  Plus,
  Layers,
  Save,
  RotateCcw,
  Keyboard,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import OverlayCanvas from "./OverlayCanvas";
import HotkeyRecorder from "./HotkeyRecorder";
import {
  getLayouts,
  getNativeSettings,
  saveLayouts,
  saveNativeSettings,
  saveOverlayPosition,
  toggleOverlay,
  recoverOverlay,
} from "./service";
import {
  activeProfile,
  defaultLayouts,
  defaultNative,
  friendlyHotkey,
  moduleLabels,
  type NativeResponse,
  type OverlayLayouts,
  type OverlayProfile,
  type OverlaySnapshot,
} from "./model";
import "./overlay.css";
const actions: Record<string, string> = {
  overlay: "Overlay ein-/ausblenden",
  main: "Hauptfenster öffnen",
  questScanner: "Quest-Scanner",
  itemScanner: "Item-Scanner",
  search: "Schnellsuche",
  compact: "Compact Mode",
  treasure: "Schatzsuche",
};
export default function OverlaySettings({
  onNotice,
  snapshot,
}: {
  onNotice?: (text: string) => void;
  snapshot?: OverlaySnapshot;
}) {
  const [layouts, setLayouts] = useState<OverlayLayouts>(defaultLayouts()),
    [native, setNative] = useState<NativeResponse>({
      settings: defaultNative,
      recoveryHotkey: "Ctrl+Alt+Shift+O",
      recoveryRegistered: false,
      startupError: null,
    }),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState("");
  useEffect(() => {
    void Promise.all([getLayouts(), getNativeSettings()])
      .then(([layouts, native]) => {
        setLayouts(layouts);
        setNative(native);
      })
      .catch((e) => setStatus(String(e)));
  }, []);
  const profile = activeProfile(layouts);
  function updateProfile(next: OverlayProfile) {
    setLayouts({
      ...layouts,
      profiles: layouts.profiles.map((p) => (p.id === profile.id ? next : p)),
    });
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setStatus("");
    try {
      await fn();
    } catch (error) {
      setStatus(String(error instanceof Error ? error.message : error));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    await run(async () => {
      const response = await saveNativeSettings(native.settings);
      await saveLayouts(layouts);
      setNative(response);
      setStatus("Overlay-Layout und Hotkeys dauerhaft gespeichert.");
      onNotice?.("Overlay und Hotkeys gespeichert.");
    });
  }
  return (
    <>
      <section className="panel overlay-settings-panel">
        <div className="panel-title">
          <span>
            <Layers size={18} /> Overlay konfigurieren
          </span>
          <span className="pill">Eigenes Fenster</span>
        </div>
        <p>
          Dein Companion über DOFUS im Fenster- oder Borderless-Modus. Wähle
          Module aus und ordne sie in der echten Vorschau per Ziehen an.
          Exklusives Vollbild wird nicht garantiert unterstützt.
        </p>
        <div className="toolbar">
          <label>
            Layoutprofil
            <select
              value={layouts.activeId}
              onChange={(e) =>
                setLayouts({ ...layouts, activeId: e.target.value })
              }
            >
              {layouts.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <input
            aria-label="Neues Overlayprofil"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Neues Layoutprofil"
            maxLength={40}
          />
          <button
            className="secondary"
            disabled={!name.trim() || layouts.profiles.length >= 10}
            onClick={() => {
              const id = crypto.randomUUID();
              setLayouts({
                ...layouts,
                activeId: id,
                profiles: [
                  ...layouts.profiles,
                  { ...structuredClone(profile), id, name: name.trim() },
                ],
              });
              setName("");
            }}
          >
            <Plus size={16} /> Profil anlegen
          </button>
          <button
            className="secondary"
            onClick={() => {
              if (
                confirm("Dieses Layout auf die Standardanordnung zurücksetzen?")
              )
                updateProfile({
                  ...defaultLayouts().profiles[0],
                  id: profile.id,
                  name: profile.name,
                });
            }}
          >
            <RotateCcw size={15} /> Layout zurücksetzen
          </button>
          {layouts.profiles.length > 1 && (
            <button
              className="secondary"
              onClick={() => {
                if (confirm("Aktuelles Overlayprofil löschen?"))
                  setLayouts({
                    ...layouts,
                    activeId: layouts.profiles.find((p) => p.id !== profile.id)!
                      .id,
                    profiles: layouts.profiles.filter(
                      (p) => p.id !== profile.id,
                    ),
                  });
              }}
            >
              Profil löschen
            </button>
          )}
        </div>
        <div className="overlay-editor-grid">
          <div className="overlay-controls">
            <h3>Sichtbare Module</h3>
            {profile.modules.map((module, index) => (
              <div className="module-choice" key={module.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={module.enabled}
                    onChange={(e) =>
                      updateProfile({
                        ...profile,
                        modules: profile.modules.map((m) =>
                          m.id === module.id
                            ? { ...m, enabled: e.target.checked }
                            : m,
                        ),
                      })
                    }
                  />
                  {moduleLabels[module.id]}
                </label>
                <button
                  className="icon-button"
                  title={`${moduleLabels[module.id]} nach oben`}
                  disabled={index === 0}
                  onClick={() => {
                    const modules = [...profile.modules];
                    [modules[index - 1], modules[index]] = [
                      modules[index],
                      modules[index - 1],
                    ];
                    updateProfile({ ...profile, modules });
                  }}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  className="icon-button"
                  title={`${moduleLabels[module.id]} nach unten`}
                  disabled={index === profile.modules.length - 1}
                  onClick={() => {
                    const modules = [...profile.modules];
                    [modules[index + 1], modules[index]] = [
                      modules[index],
                      modules[index + 1],
                    ];
                    updateProfile({ ...profile, modules });
                  }}
                >
                  <ArrowDown size={12} />
                </button>
              </div>
            ))}
            <h3>Darstellung</h3>
            <label>
              Deckkraft {profile.opacity} %
              <input
                type="range"
                min="25"
                max="100"
                value={profile.opacity}
                onChange={(e) =>
                  updateProfile({ ...profile, opacity: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Schriftgröße {profile.fontSize} px
              <input
                type="range"
                min="11"
                max="24"
                value={profile.fontSize}
                onChange={(e) =>
                  updateProfile({
                    ...profile,
                    fontSize: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Hintergrund
              <input
                type="color"
                value={profile.background}
                onChange={(e) =>
                  updateProfile({ ...profile, background: e.target.value })
                }
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={profile.compact}
                onChange={(e) =>
                  updateProfile({ ...profile, compact: e.target.checked })
                }
              />{" "}
              Kompakte Abstände
            </label>
            <div className="form-grid">
              <label>
                Breite
                <input
                  type="number"
                  min="260"
                  max="1800"
                  value={native.settings.overlay.width}
                  onChange={(e) =>
                    setNative({
                      ...native,
                      settings: {
                        ...native.settings,
                        overlay: {
                          ...native.settings.overlay,
                          width: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
              <label>
                Höhe
                <input
                  type="number"
                  min="160"
                  max="1600"
                  value={native.settings.overlay.height}
                  onChange={(e) =>
                    setNative({
                      ...native,
                      settings: {
                        ...native.settings,
                        overlay: {
                          ...native.settings.overlay,
                          height: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
            </div>
            {(
              [
                ["alwaysOnTop", "Immer im Vordergrund"],
                ["locked", "Position und Module fixieren"],
                ["snap", "An Bildschirmrändern einrasten"],
                ["clickThrough", "Mausklicks an DOFUS durchreichen"],
              ] as const
            ).map(([key, label]) => (
              <label className="check-label" key={key}>
                <input
                  type="checkbox"
                  checked={native.settings.overlay[key]}
                  disabled={
                    key === "clickThrough" &&
                    (!isTauri() || !native.recoveryRegistered)
                  }
                  onChange={(e) =>
                    setNative({
                      ...native,
                      settings: {
                        ...native.settings,
                        overlay: {
                          ...native.settings.overlay,
                          [key]: e.target.checked,
                        },
                      },
                    })
                  }
                />
                {label}
              </label>
            ))}
            <small>
              Fester Rettungs-Hotkey:{" "}
              <b>{friendlyHotkey(native.recoveryHotkey)}</b>. Er deaktiviert
              Click-through und öffnet die Einstellungen. Click-through bleibt
              ohne registrierten Rettungs-Hotkey gesperrt.
            </small>
          </div>
          <div className="overlay-preview-wrap">
            <div className="eyebrow">
              INTERAKTIVE VORSCHAU · MODULE ZIEHEN UND VERGRÖSSERN
            </div>
            <div
              className="overlay-preview"
              style={{ maxWidth: native.settings.overlay.width }}
            >
              <OverlayCanvas
                profile={profile}
                snapshot={snapshot}
                editable
                onChange={updateProfile}
              />
            </div>
          </div>
        </div>
        <div className="toolbar">
          <button disabled={busy} onClick={() => void save()}>
            <Save size={16} /> Overlay & Hotkeys speichern
          </button>
          <button
            className="secondary"
            onClick={() =>
              void run(async () => {
                await save();
                await toggleOverlay();
              })
            }
          >
            Overlay ein-/ausblenden
          </button>
          <button
            className="secondary"
            onClick={() =>
              void run(async () => {
                setNative(await saveOverlayPosition());
                setStatus("Aktuelle Fensterposition gespeichert.");
              })
            }
          >
            Fensterposition übernehmen
          </button>
          <button className="secondary" onClick={() => void recoverOverlay()}>
            Sicher zum Hauptfenster
          </button>
        </div>
      </section>
      <section className="panel">
        <div className="panel-title">
          <span>
            <Keyboard size={18} /> Tastenkombinationen
          </span>
          <span className="pill">Beim Start wiederhergestellt</span>
        </div>
        <p>
          Klicke auf ein Feld und drücke die gewünschte Kombination,
          beispielsweise F8 oder Strg + Umschalt + D. Escape bricht die Aufnahme
          ab. Danach dauerhaft speichern.
        </p>
        <div className="hotkeys-grid">
          {native.settings.hotkeys.map((binding) => (
            <div className="binding-row" key={binding.action}>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={binding.enabled}
                  onChange={(e) =>
                    setNative({
                      ...native,
                      settings: {
                        ...native.settings,
                        hotkeys: native.settings.hotkeys.map((b) =>
                          b.action === binding.action
                            ? { ...b, enabled: e.target.checked }
                            : b,
                        ),
                      },
                    })
                  }
                />{" "}
                Aktiv
              </label>
              <HotkeyRecorder
                label={actions[binding.action] ?? binding.action}
                value={binding.accelerator}
                defaultValue={
                  defaultNative.hotkeys.find((b) => b.action === binding.action)
                    ?.accelerator
                }
                used={native.settings.hotkeys
                  .filter((b) => b.action !== binding.action && b.enabled)
                  .map((b) => b.accelerator)}
                onChange={(accelerator) =>
                  setNative({
                    ...native,
                    settings: {
                      ...native.settings,
                      hotkeys: native.settings.hotkeys.map((b) =>
                        b.action === binding.action
                          ? { ...b, accelerator, enabled: !!accelerator }
                          : b,
                      ),
                    },
                  })
                }
              />
            </div>
          ))}
        </div>
        <button disabled={busy} onClick={() => void save()}>
          Hotkeys dauerhaft speichern
        </button>
        {native.startupError && (
          <div className="notice" role="alert">
            {native.startupError}
          </div>
        )}
        {status && (
          <div role="status" className="notice">
            {status}
          </div>
        )}
      </section>
    </>
  );
}
