import {
  normalizeTranslator,
  type TranslatorPreferences,
} from "../../v4/translator/model";
export type OverlayModuleId =
  | "quest"
  | "step"
  | "coordinates"
  | "materials"
  | "items"
  | "quests"
  | "treasure"
  | "almanax"
  | "notes"
  | "character"
  | "favorites"
  | "tasks"
  | "navigation"
  | "translator-incoming"
  | "translator-outgoing";
export const moduleLabels: Record<OverlayModuleId, string> = {
  quest: "Aktuelle Quest",
  step: "Nächster Schritt",
  coordinates: "Zielkoordinaten",
  materials: "Materialbedarf",
  items: "Item-Schnellsuche",
  quests: "Quest-Schnellsuche",
  treasure: "Schatzsuche",
  almanax: "Almanax",
  notes: "Persönliche Notizen",
  character: "Charakterinformation",
  favorites: "Schnellaktionen & Favoriten",
  tasks: "Eigene Aufgaben",
  navigation: "Farmroute · Nächstes Ziel",
  "translator-incoming": "Übersetzer · Nachrichten",
  "translator-outgoing": "Übersetzer · Antworten",
};
export type OverlayModule = {
  id: OverlayModuleId;
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  translator?: TranslatorPreferences;
};
export type OverlayProfile = {
  id: string;
  name: string;
  opacity: number;
  fontSize: number;
  background: string;
  compact: boolean;
  modules: OverlayModule[];
};
export type OverlayLayouts = {
  version: 1;
  activeId: string;
  profiles: OverlayProfile[];
};
export type Binding = { action: string; accelerator: string; enabled: boolean };
export type NativeSettings = {
  schemaVersion: number;
  overlay: {
    width: number;
    height: number;
    x: number | null;
    y: number | null;
    alwaysOnTop: boolean;
    clickThrough: boolean;
    locked: boolean;
    snap: boolean;
  };
  hotkeys: Binding[];
};
export type NativeResponse = {
  settings: NativeSettings;
  recoveryHotkey: string;
  recoveryRegistered: boolean;
  startupError: string | null;
};
export const defaultNative: NativeSettings = {
  schemaVersion: 1,
  overlay: {
    width: 460,
    height: 650,
    x: null,
    y: null,
    alwaysOnTop: true,
    clickThrough: false,
    locked: false,
    snap: true,
  },
  hotkeys: [
    { action: "overlay", accelerator: "F8", enabled: true },
    { action: "main", accelerator: "Ctrl+Shift+D", enabled: true },
    { action: "questScanner", accelerator: "Ctrl+Shift+Q", enabled: true },
    { action: "itemScanner", accelerator: "Ctrl+Shift+I", enabled: false },
    { action: "search", accelerator: "Ctrl+Alt+S", enabled: false },
    { action: "compact", accelerator: "Ctrl+Alt+C", enabled: false },
    { action: "treasure", accelerator: "Ctrl+Alt+T", enabled: false },
  ],
};
export function defaultLayouts(): OverlayLayouts {
  return {
    version: 1,
    activeId: "default",
    profiles: [
      {
        id: "default",
        name: "Abenteuer",
        opacity: 94,
        fontSize: 14,
        background: "#14221b",
        compact: false,
        modules: Object.keys(moduleLabels).map((id, index) => ({
          id: id as OverlayModuleId,
          enabled: [
            "quest",
            "step",
            "coordinates",
            "character",
            "notes",
          ].includes(id),
          x: id.startsWith("translator-") ? 12 : 12 + (index % 2) * 210,
          y: id.startsWith("translator-")
            ? id === "translator-outgoing"
              ? 1320
              : 920
            : 12 + Math.floor(index / 2) * 130,
          width: id.startsWith("translator-") ? 340 : 198,
          height: id.startsWith("translator-") ? 390 : 118,
          ...(id.startsWith("translator-")
            ? {
                translator: normalizeTranslator(
                  undefined,
                  id === "translator-outgoing",
                ),
              }
            : {}),
        })),
      },
    ],
  };
}
export function activeProfile(layouts: OverlayLayouts) {
  return (
    layouts.profiles.find((p) => p.id === layouts.activeId) ??
    layouts.profiles[0] ??
    defaultLayouts().profiles[0]
  );
}
export function normalizeLayouts(raw: OverlayLayouts): OverlayLayouts {
  if (
    raw?.version !== 1 ||
    !Array.isArray(raw.profiles) ||
    !raw.profiles.length
  )
    return defaultLayouts();
  return {
    ...raw,
    profiles: raw.profiles.slice(0, 10).map((p) => ({
      ...p,
      opacity: Math.max(25, Math.min(100, p.opacity || 94)),
      fontSize: Math.max(11, Math.min(24, p.fontSize || 14)),
      modules: [
        ...p.modules,
        ...defaultLayouts().profiles[0].modules.filter(
          (m) =>
            (m.id.startsWith("translator-") || m.id === "navigation") &&
            !p.modules.some((existing) => existing.id === m.id),
        ),
      ]
        .filter(
          (m, index, modules) =>
            m.id in moduleLabels &&
            modules.findIndex((entry) => entry.id === m.id) === index,
        )
        .map((m) => ({
          ...m,
          x: Math.max(0, Number(m.x) || 0),
          y: Math.max(0, Number(m.y) || 0),
          width: Math.max(150, Math.min(1200, Number(m.width) || 198)),
          height: Math.max(85, Math.min(900, Number(m.height) || 118)),
          ...(m.id.startsWith("translator-")
            ? {
                translator: normalizeTranslator(
                  m.translator,
                  m.id === "translator-outgoing",
                ),
              }
            : {}),
        })),
    })),
  };
}
export type OverlaySnapshot = {
  navigation?: {
    nextMapId: number;
    coordinates?: { x: number; y: number };
    direction: string;
    remaining: number;
    resourceNames: string[];
    step: number;
    total: number;
  } | null;
  character?: {
    name: string;
    className?: string;
    level?: number;
    server?: string;
  } | null;
  quest?: {
    id: number;
    name: string;
    steps?: {
      name?: string;
      description?: string;
      objectives?: {
        description?: string;
        coordinates?: { x: number; y: number } | null;
      }[];
    }[];
  } | null;
  step?: number;
  materials?: { name: string; quantity: number }[];
  almanax?: {
    bonus?: { description?: string };
    tribute?: { quantity?: number; item?: { name?: string } };
  } | null;
  favorites?: { name: string; kind?: string; id?: number }[];
  tasks?: { id: string; text: string; done: boolean }[];
};
export function friendlyHotkey(value: string) {
  return value
    .replace(/CommandOrControl|Control|Ctrl/g, "Strg")
    .replace(/Shift/g, "Umschalt")
    .replace(/Alt/g, "Alt")
    .replace(/Super|Meta/g, "Windows")
    .split("+")
    .join(" + ");
}
export function recordKeyboard(
  event: Pick<
    KeyboardEvent,
    "code" | "key" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey"
  >,
): string | null {
  if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) return null;
  if (event.metaKey)
    throw new Error("Windows-Tastenkombinationen sind reserviert.");
  const key = /^Key[A-Z]$/.test(event.code)
    ? event.code.slice(3)
    : /^Digit[0-9]$/.test(event.code)
      ? event.code.slice(5)
      : /^F(?:[1-9]|1[0-9]|2[0-4])$/.test(event.key)
        ? event.key
        : (
            {
              ArrowUp: "ArrowUp",
              ArrowDown: "ArrowDown",
              ArrowLeft: "ArrowLeft",
              ArrowRight: "ArrowRight",
              Home: "Home",
              End: "End",
              PageUp: "PageUp",
              PageDown: "PageDown",
              Insert: "Insert",
            } as Record<string, string>
          )[event.key];
  if (!key)
    throw new Error("Diese Taste wird als globaler Hotkey nicht unterstützt.");
  if (
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey &&
    !key.startsWith("F")
  )
    throw new Error(
      "Buchstaben und Navigationstasten benötigen eine Zusatztaste.",
    );
  const result = [
    event.ctrlKey ? "Ctrl" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey ? "Shift" : "",
    key,
  ]
    .filter(Boolean)
    .join("+");
  if (
    [
      "Alt+F4",
      "Alt+Tab",
      "Ctrl+Alt+Delete",
      "Ctrl+Shift+Escape",
      "Ctrl+Alt+Shift+O",
    ].includes(result)
  )
    throw new Error(
      "Diese Kombination ist für Windows oder die Overlay-Rettung reserviert.",
    );
  return result;
}
