import { useEffect, useRef, useState } from "react";
import { read, write } from "../storage";
import { navigatePath, parseRoute } from "../v2/routing";
import { navigationItems } from "./navigation";

export interface RecentView {
  path: string;
  label: string;
  view: string;
  visitedAt: string;
}
export const workspaceEvent = "companion:workspace";
export function useWorkspace(ready: boolean, path: string) {
  const initialized = useRef(false),
    last = useRef("");
  const [hydrated, setHydrated] = useState(false);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    if (!ready || initialized.current) return;
    initialized.current = true;
    void Promise.all([
      read("ui:last-view", "/"),
      read("ui:restore-view", true),
    ]).then(([saved, restore]) => {
      if (
        !location.hash &&
        restore &&
        typeof saved === "string" &&
        navigationItems.some((i) => i.id === parseRoute("#" + saved).view)
      )
        navigatePath(saved, true);
      setHydrated(true);
    });
  }, [ready]);
  useEffect(() => {
    if (!ready || !hydrated || path === last.current) return;
    last.current = path;
    const entry = navigationItems.find(
      (i) => i.id === parseRoute("#" + path).view,
    );
    if (!entry) return;
    queue.current = queue.current
      .then(() => read<RecentView[]>("ui:recent", []))
      .then(async (previous) => {
        const next = [
          {
            path,
            label: entry.label,
            view: entry.id,
            visitedAt: new Date().toISOString(),
          },
          ...previous.filter((v) => v.view !== entry.id),
        ].slice(0, 8);
        await write("ui:recent", next);
        await write("ui:last-view", path);
        window.dispatchEvent(new Event(workspaceEvent));
      });
  }, [ready, hydrated, path]);
}
export function useRecentViews() {
  const [recent, setRecent] = useState<RecentView[]>([]);
  useEffect(() => {
    let active = true;
    const load = () =>
      void read<RecentView[]>("ui:recent", []).then((v) => {
        if (active) setRecent(v);
      });
    load();
    window.addEventListener(workspaceEvent, load);
    return () => {
      active = false;
      window.removeEventListener(workspaceEvent, load);
    };
  }, []);
  return recent;
}
