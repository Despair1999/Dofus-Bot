import { isTauri, invoke } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { read, write } from "../../storage";
import {
  defaultLayouts,
  defaultNative,
  normalizeLayouts,
  type NativeResponse,
  type NativeSettings,
  type OverlayLayouts,
  type OverlaySnapshot,
} from "./model";
export function isOverlayWindow() {
  return new URLSearchParams(location.search).get("overlay") === "1";
}
export async function getNativeSettings(): Promise<NativeResponse> {
  if (isTauri()) return invoke("native_settings");
  return {
    settings: await read("native-settings-v2", defaultNative),
    recoveryHotkey: "Ctrl+Alt+Shift+O",
    recoveryRegistered: false,
    startupError: null,
  };
}
export async function saveNativeSettings(
  settings: NativeSettings,
): Promise<NativeResponse> {
  if (isTauri()) return invoke("save_native_settings", { settings });
  await write("native-settings-v2", settings);
  return getNativeSettings();
}
export async function getLayouts() {
  return normalizeLayouts(
    await read<OverlayLayouts>("overlay-layouts-v2", defaultLayouts()),
  );
}
export async function saveLayouts(layouts: OverlayLayouts) {
  const valid = normalizeLayouts(layouts);
  await write("overlay-layouts-v2", valid);
  if (isTauri()) await emit("overlay:layout", valid);
  window.dispatchEvent(new Event("overlay:layout"));
}
export async function toggleOverlay() {
  if (!isTauri())
    throw new Error(
      "Das separate Overlay ist in der Windows-Anwendung verfügbar.",
    );
  return invoke<boolean>("toggle_overlay");
}
export async function recoverOverlay() {
  if (isTauri()) await invoke("recover_overlay");
}
export async function saveOverlayPosition() {
  if (isTauri()) return invoke<NativeResponse>("overlay_position");
  return getNativeSettings();
}
export async function publishOverlaySnapshot(snapshot: OverlaySnapshot) {
  await write("overlay-snapshot-v2", snapshot);
  if (isTauri()) await emit("overlay:snapshot", snapshot);
}
export async function listenCompanionActions(
  callback: (action: string) => void,
): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen<string>("companion:action", (event) => callback(event.payload));
}
export async function listenSnapshotRequest(
  callback: () => void,
): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen("overlay:request-snapshot", callback);
}
