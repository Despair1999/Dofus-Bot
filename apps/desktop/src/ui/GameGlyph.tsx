// Original vector symbols authored for Companion; no third-party game artwork.
const paths: Record<string, string> = {
  hat: "M3 15h18v4H3z M7 15l2-10h6l2 10",
  amulet: "M5 3c-2 11 4 12 7 15 3-3 9-4 7-15 M12 15l4 4-4 4-4-4z",
  ring: "M7 9a8 8 0 1 0 10 0 M8 3h8l2 4-6 6-6-6z",
  weapon: "M5 20L18 4l3-1-1 5L8 21 M4 13l7 6 M3 21l3-3",
  shield: "M4 4l8-2 8 2v8c0 5-8 10-8 10S4 17 4 12z M12 5v13",
  cape: "M8 3h8l5 17-9-3-9 3z M8 3l4 5 4-5 M12 8v9",
  belt: "M2 8h20v8H2z M9 6h6v12H9z M12 10v4 M17 12h3",
  boots: "M6 3h8l-1 10 7 3v5H4v-8z M4 17h8",
  companion: "M7 3l2 6h6l2-6 3 8-2 8-6 3-6-3-2-8z M8 13h1 M15 13h1 M10 18h4",
  dofus:
    "M12 2C7 6 4 13 5 17c2 7 12 7 14 0 1-4-2-11-7-15z M10 8l-2 7 4-2-1 6 5-9-4 2z",
  zaap: "M3 21V9C3-1 21-1 21 9v12h-5V10c0-6-8-6-8 0v11z M9 22h6",
  dungeon: "M3 21V7h4V3h3v4h4V3h3v4h4v14z M9 21v-6a3 3 0 0 1 6 0v6",
  quest: "M10 3h4v11h-4z M10 18h4v4h-4z",
  waypoint:
    "M12 22s8-9 8-14A8 8 0 0 0 4 8c0 5 8 14 8 14z M9 8a3 3 0 1 0 6 0 3 3 0 1 0-6 0",
  transport:
    "M3 17l2-9h14l2 9z M7 8l2-5h6l2 5 M6 17v4 M18 17v4 M7 12h1 M16 12h1",
  workshop: "M3 21l9-10 M13 3l8 8 M10 6l6-3 5 5-3 6z",
  market: "M3 10h18l-3-6H6z M5 10v11h14V10 M9 21v-7h6v7",
  temple: "M2 8l10-6 10 6z M4 21h16 M6 9v9 M12 9v9 M18 9v9",
  territory: "M4 22V3 M4 3h15l-3 4 3 4H4",
  property: "M2 11L12 2l10 9 M5 9v12h14V9 M10 21v-7h4v7",
  anomaly: "M12 2l3 6 7 4-7 4-3 6-3-6-7-4 7-4z M12 8v8",
  resource:
    "M12 22V10 M12 15C2 14 1 6 3 3c9 0 10 6 9 12z M12 19c0-10 7-12 10-11 0 9-6 12-10 11",
  star: "M12 2l3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1z",
};
export default function GameGlyph({
  name,
  size = 24,
}: {
  name: string;
  size?: number;
}) {
  return (
    <svg
      data-glyph={name}
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name] ?? paths.star} />
    </svg>
  );
}
export function slotGlyph(slot: string) {
  return slot.startsWith("dofus")
    ? "dofus"
    : slot.startsWith("ring")
      ? "ring"
      : slot;
}
export const mapCategories: Record<
  number,
  { label: string; glyph: string; color: string }
> = {
  1: { label: "Klassentempel", glyph: "temple", color: "#dcc49c" },
  2: { label: "Verkaufsräume", glyph: "market", color: "#e2bb70" },
  3: { label: "Werkstätten", glyph: "workshop", color: "#9cc9ea" },
  4: { label: "Verschiedenes", glyph: "star", color: "#e2d674" },
  5: { label: "Gebietseroberung", glyph: "territory", color: "#b3d6df" },
  6: { label: "Dungeons", glyph: "dungeon", color: "#e3bf76" },
  7: { label: "Besitztümer", glyph: "property", color: "#d4b6a1" },
  8: { label: "Orientierungspunkte", glyph: "waypoint", color: "#6dcac4" },
  9: { label: "Transportmittel", glyph: "transport", color: "#8ecbde" },
  10: { label: "Zeitanomalien", glyph: "anomaly", color: "#bca1e6" },
  11: { label: "Quests", glyph: "quest", color: "#b8e179" },
  12: { label: "Wiederholbare Quests", glyph: "quest", color: "#c2bc78" },
};
export function markerAppearance(p: { kind: string; categoryId?: number }) {
  if (
    ["waypoint", "observation", "resource", "route", "quest"].includes(p.kind)
  )
    return {
      label:
        p.kind === "resource"
          ? "Ressourcenfund"
          : p.kind === "quest"
            ? "Questziel"
            : p.kind === "route"
              ? "Routenpunkt"
              : "Eigene Markierung",
      glyph:
        p.kind === "resource"
          ? "resource"
          : p.kind === "quest"
            ? "quest"
            : "waypoint",
      color: p.kind === "resource" ? "#9bdaa0" : "#e3bf76",
    };
  return p.kind === "zaap"
    ? { label: "Zaap", glyph: "zaap", color: "#65d6d0" }
    : (mapCategories[p.categoryId ?? 0] ?? {
        label: "Markierung",
        glyph: "waypoint",
        color: "#e3bf76",
      });
}
export function glyphImage(glyph: string, color: string) {
  const path = paths[glyph] ?? paths.star;
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="-3 -3 30 30"><rect x="-2" y="-2" width="28" height="28" rx="7" fill="#111a22" stroke="${color}"/><path d="${path}" fill="none" stroke="${color}" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/></svg>`)}`;
}
