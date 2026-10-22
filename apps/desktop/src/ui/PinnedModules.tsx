import { useEffect, useState } from "react";
import { navigationItems } from "./navigation";
import type { View } from "../v2/routing";
import { read, write } from "../storage";
function usePinnedState() {
  const [pinned, setPinned] = useState<View[]>([]);
  useEffect(() => {
    const load = () =>
      void read<View[]>("ui:pinned-modules", []).then((v) =>
        setPinned(v.filter((id) => navigationItems.some((i) => i.id === id))),
      );
    load();
    window.addEventListener("companion:pinned", load);
    return () => window.removeEventListener("companion:pinned", load);
  }, []);
  return [pinned, setPinned] as const;
}
export function usePinnedModules() {
  return usePinnedState()[0];
}
export default function PinnedModules() {
  const [pinned, setPinned] = usePinnedState();
  return (
    <section className="panel">
      <h2>Favorisierte Module</h2>
      <p className="v2-muted">
        Angeheftete Module bleiben oben in der Seitenleiste erreichbar.
      </p>
      <div className="pinned-module-options">
        {navigationItems.map((i) => (
          <label key={i.id}>
            <input
              type="checkbox"
              checked={pinned.includes(i.id)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...pinned, i.id]
                  : pinned.filter((id) => id !== i.id);
                setPinned(next);
                void write("ui:pinned-modules", next)
                  .then(() =>
                    window.dispatchEvent(new Event("companion:pinned")),
                  )
                  .catch(() => setPinned(pinned));
              }}
            />
            <i.icon size={17} />
            {i.label}
          </label>
        ))}
      </div>
    </section>
  );
}
