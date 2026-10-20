import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import {toggleOverlay} from './v2/overlay/service';
export {isOverlayWindow,publishOverlaySnapshot,listenCompanionActions,listenSnapshotRequest,toggleOverlay} from './v2/overlay/service';
export type Mode = "dashboard" | "compact" | "overlay" | "hotbar";
export async function windowMode(mode: Mode) {
  if (!isTauri()) return;
  if(mode==='overlay'){await toggleOverlay();return;}
  const win = getCurrentWindow();
  await win.setAlwaysOnTop(mode !== "dashboard");
  await win.setDecorations(mode === "dashboard");
  const sizes = {
    dashboard: [1380, 900],
    compact: [440, 720],
    overlay: [460, 400],
    hotbar: [600, 135],
  };
  const [w, h] = sizes[mode];
  await win.setSize(new LogicalSize(w, h));
}
export async function openExternal(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:")
    throw new Error("Nur HTTPS-Links sind erlaubt.");
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else window.open(url, "_blank", "noopener,noreferrer");
}
export async function shortcut(accelerator: string, callback: () => void) {
  if (!isTauri())
    throw new Error("Globale Hotkeys sind in der Windows-App verfügbar.");
  const { register, isRegistered } =
    await import("@tauri-apps/plugin-global-shortcut");
  if (await isRegistered(accelerator))
    throw new Error("Diese Tastenkombination ist bereits belegt.");
  await register(accelerator, (event) => {
    if (event.state === "Pressed") callback();
  });
}
