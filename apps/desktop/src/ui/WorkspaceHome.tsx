import { useEffect, useState } from "react";
import { ArrowUpRight, Clock3, ShieldCheck, Route } from "lucide-react";
import type { Build } from "@dofus/core";
import type { Config } from "../client";
import { request } from "../v2/shared/request";
import { navigatePath } from "../v2/routing";
import { classAssets } from "@dofus/core";
import { useRecentViews } from "./workspace";
import { navigationItems } from "./navigation";
import { StatusBadge } from "./primitives";
export default function WorkspaceHome({ config }: { config: Config }) {
  const recent = useRecentViews(),
    [builds, setBuilds] = useState<Build[]>([]),
    [routes, setRoutes] = useState<
      { id: string; name: string; route: { mapIds: number[] } }[]
    >([]),
    [offline, setOffline] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    void Promise.allSettled([
      request<Build[]>("/api/builder/builds", config, c.signal),
      request<typeof routes>("/api/world/personal/routes", config, c.signal),
    ]).then(([b, r]) => {
      if (c.signal.aborted) return;
      if (b.status === "fulfilled") setBuilds(b.value.data.slice(0, 3));
      if (r.status === "fulfilled") setRoutes(r.value.data.slice(0, 3));
      setOffline(b.status === "rejected" || r.status === "rejected");
    });
    return () => c.abort();
  }, [config]);
  return (
    <section className="ui-home-workspace">
      <div className="ui-home-section-heading">
        <h2>
          <Clock3 size={18} />
          Hier geht dein Abenteuer weiter.
        </h2>
        <button
          className="text-button"
          onClick={() => window.dispatchEvent(new Event("companion:command"))}
        >
          Alles durchsuchen <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="ui-recent-grid">
        {(recent.filter((r) => r.view !== "dashboard").length
          ? recent.filter((r) => r.view !== "dashboard").slice(0, 4)
          : [
              { path: "/world", view: "world", label: "Weltkarte" },
              { path: "/builder", view: "builder", label: "Builder" },
              {
                path: "/dungeons",
                view: "dungeons",
                label: "Dungeons & Bosse",
              },
              { path: "/quests", view: "quests", label: "Quest-Assistent" },
            ]
        ).map((r) => {
          const entry = navigationItems.find((i) => i.id === r.view);
          const Icon = entry?.icon ?? Clock3;
          return (
            <button
              className="ui-object-card"
              key={r.view}
              onClick={() => navigatePath(r.path)}
            >
              <Icon size={23} />
              <span>
                <strong>{r.label}</strong>
                <small className="ui-block">
                  {recent.some((v) => v.view === r.view)
                    ? "Zuletzt verwendet"
                    : entry?.description}
                </small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          );
        })}
      </div>
      {(builds.length > 0 || routes.length > 0) && (
        <div className="ui-home-saved">
          <article className="panel">
            <h3>
              <ShieldCheck size={17} />
              Gespeicherte Builds
            </h3>
            {builds.length ? (
              builds.map((b) => (
                <button
                  className="ui-saved-row"
                  key={b.id}
                  onClick={() => navigatePath(`/builder/${b.id}`)}
                >
                  <img
                    src={classAssets[b.classId]?.icon}
                    alt=""
                    width={34}
                    height={34}
                  />
                  <span>
                    <strong>{b.name}</strong>
                    <small>
                      Stufe {b.level} · {b.gameVersion}
                    </small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))
            ) : (
              <p className="v2-muted">Noch keine gespeicherten Builds.</p>
            )}
          </article>
          <article className="panel">
            <h3>
              <Route size={17} />
              Deine Farmrouten
            </h3>
            {routes.length ? (
              routes.map((r) => (
                <button
                  className="ui-saved-row"
                  key={r.id}
                  onClick={() =>
                    navigatePath(`/farming?routeId=${encodeURIComponent(r.id)}`)
                  }
                >
                  <Route size={22} />
                  <span>
                    <strong>{r.name}</strong>
                    <small>
                      {r.route.mapIds.length} Karten im gespeicherten Plan
                    </small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))
            ) : (
              <p className="v2-muted">
                Speichere eine Route auf der Weltkarte.
              </p>
            )}
          </article>
        </div>
      )}
      {offline && (
        <StatusBadge tone="warning">
          Gespeicherter Datenstand · Verbindung prüfen
        </StatusBadge>
      )}
    </section>
  );
}
