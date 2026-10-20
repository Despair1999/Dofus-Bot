import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Settings, EyeOff, Save } from "lucide-react";
import { read } from "../../storage";
import OverlayCanvas from "./OverlayCanvas";
import {
  getLayouts,
  getNativeSettings,
  saveLayouts,
  recoverOverlay,
  saveOverlayPosition,
  toggleOverlay,
} from "./service";
import {
  activeProfile,
  defaultLayouts,
  type NativeResponse,
  type OverlayLayouts,
  type OverlaySnapshot,
} from "./model";
import "./overlay.css";
export default function OverlayView({
  snapshot: initial,
}: {
  snapshot?: OverlaySnapshot;
}) {
  const [layouts, setLayouts] = useState<OverlayLayouts>(defaultLayouts()),
    [snapshot, setSnapshot] = useState<OverlaySnapshot>(initial ?? {}),
    [native, setNative] = useState<NativeResponse | null>(null),
    [status, setStatus] = useState("");
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.documentElement.classList.add("overlay-document");
    let stopped = false;
    const releases: UnlistenFn[] = [];
    void (async () => {
      setLayouts(await getLayouts());
      setNative(await getNativeSettings());
      setSnapshot(initial ?? (await read("overlay-snapshot-v2", {})));
      if (isTauri()) {
        for (const [name, callback] of [
          [
            "overlay:snapshot",
            (payload: unknown) => setSnapshot(payload as OverlaySnapshot),
          ],
          [
            "overlay:layout",
            (payload: unknown) => setLayouts(payload as OverlayLayouts),
          ],
          ["overlay:settings", () => void getNativeSettings().then(setNative)],
        ] as const) {
          const off = await listen(name, (event) => callback(event.payload));
          if (stopped) off();
          else releases.push(off);
        }
      }
    })();
    return () => {
      stopped = true;
      releases.forEach((off) => off());
    };
  }, []);
  const profile = activeProfile(layouts);
  async function save() {
    try {
      const result = await saveOverlayPosition();
      setNative(result);
      setStatus("Position gespeichert.");
    } catch (error) {
      setStatus(String(error));
    }
  }
  return (
    <div className="separate-overlay">
      <div
        className="overlay-window-bar"
        data-tauri-drag-region={!native?.settings.overlay.locked || undefined}
        onDoubleClick={() => {
          if (!native?.settings.overlay.locked && isTauri())
            void getCurrentWindow().startDragging();
        }}
      >
        <span
          data-tauri-drag-region={!native?.settings.overlay.locked || undefined}
        >
          DOFUS Companion · {profile.name}
        </span>
        <div>
          <button
            title="Overlay-Position speichern"
            onClick={() => void save()}
          >
            <Save size={13} />
          </button>
          <button
            title="Overlay-Einstellungen öffnen"
            onClick={() => {
              if (isTauri())
                void invoke("overlay_navigate", { action: "settings" }).catch(
                  () => recoverOverlay(),
                );
            }}
          >
            <Settings size={13} />
          </button>
          <button
            title="Overlay ausblenden"
            onClick={() => void toggleOverlay()}
          >
            <EyeOff size={13} />
          </button>
        </div>
      </div>
      <OverlayCanvas
        profile={profile}
        snapshot={snapshot}
        editable={!native?.settings.overlay.locked}
        onChange={(next) => {
          const updated = {
            ...layouts,
            profiles: layouts.profiles.map((p) =>
              p.id === profile.id ? next : p,
            ),
          };
          setLayouts(updated);
          void saveLayouts(updated);
        }}
      />
      {status && <small className="overlay-window-status">{status}</small>}
    </div>
  );
}
