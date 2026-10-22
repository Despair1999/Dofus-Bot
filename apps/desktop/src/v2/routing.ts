import { useEffect, useState } from "react";
export type View =
  | "monsters"
  | "sets"
  | "dashboard"
  | "items"
  | "builder"
  | "world"
  | "farming"
  | "dungeons"
  | "professions"
  | "translator"
  | "quests"
  | "scanner"
  | "craft"
  | "characters"
  | "almanax"
  | "favorites"
  | "settings";
export function parseRoute(hash = location.hash) {
  const url = new URL(hash.replace(/^#/, "") || "/", location.origin);
  const segments = url.pathname.split("/").filter(Boolean);
  const view = (!segments.length ? "dashboard" : segments[0]) as View;
  return {
    view,
    entityId: segments[1],
    id:
      segments[1] && /^\d+$/.test(segments[1])
        ? Number(segments[1])
        : undefined,
    params: url.searchParams,
    path: url.pathname + url.search,
  };
}
export function navigatePath(path: string, replace = false) {
  const target = "#" + path;
  if (location.hash === target) return;
  if (replace) {
    history.replaceState(null, "", target);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else location.hash = path;
}
export function useRoute() {
  const [route, setRoute] = useState(() => parseRoute());
  useEffect(() => {
    const handler = () => setRoute(parseRoute());
    addEventListener("hashchange", handler);
    return () => removeEventListener("hashchange", handler);
  }, []);
  return route;
}
