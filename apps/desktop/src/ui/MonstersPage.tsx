import { useEffect, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import type { DungeonMonster } from "@dofus/core";
import type { Config } from "../client";
import { request, message } from "../v2/shared/request";
import { navigatePath, useRoute } from "../v2/routing";
import ItemImage from "../v2/shared/ItemImage";
import { useGameAssets } from "../gameAssets";
import { MonsterCard } from "../v4/DungeonsPage";
import {
  PageTitle,
  SearchField,
  EmptyState,
  Skeleton,
  StatusBadge,
} from "./primitives";

type Summary = {
  id: number;
  name: string;
  nameFr: string;
  image: string | null;
  level: number;
};
type Detail = DungeonMonster & {
  version: string;
  dungeons: { id: number; name: string; entrance: { mapId: number } | null }[];
};
export default function MonstersPage({ config }: { config: Config }) {
  const route = useRoute(),
    assets = useGameAssets();
  const [q, setQ] = useState(""),
    [version, setVersion] = useState("3.7.12.12"),
    [page, setPage] = useState(1),
    [rows, setRows] = useState<Summary[]>([]),
    [total, setTotal] = useState(0),
    [detail, setDetail] = useState<Detail | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [tab, setTab] = useState("Werte & Zauber");
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      void request<Summary[]>(
        `/api/monsters?q=${encodeURIComponent(q)}&version=${version}&page=${page}&pageSize=30`,
        config,
        c.signal,
      )
        .then((r) => {
          setRows(r.data);
          setTotal(r.total ?? 0);
        })
        .catch((e) => {
          if (!c.signal.aborted) setError(message(e));
        })
        .finally(() => {
          if (!c.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [q, version, page, config]);
  useEffect(() => {
    setDetail(null);
    if (!route.id) return;
    const c = new AbortController();
    void request<Detail>(
      `/api/monsters/${route.id}?version=${version}`,
      config,
      c.signal,
    )
      .then((r) => setDetail(r.data))
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [route.id, version, config]);
  return (
    <section className="ui-monsters-page">
      <PageTitle
        eyebrow="BESTIARIUM · VERSIONIERTE ORIGINALDATEN"
        title="Kenne deinen Gegner."
        description="Resistenzen, Zauber, Beute und belegte Fundorte aus dem vorhandenen Dungeon-Datenbestand."
        actions={
          <label>
            Datenstand
            <select
              aria-label="Monster-Datenstand"
              value={version}
              onChange={(e) => {
                setVersion(e.target.value);
                setPage(1);
              }}
            >
              <option>3.7.12.12</option>
              <option>3.6.12.16</option>
            </select>
          </label>
        }
      />
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {route.id ? (
        <>
          <button
            className="secondary"
            onClick={() => navigatePath("/monsters")}
          >
            <ArrowLeft size={16} />
            Zum Bestiarium
          </button>
          {detail ? (
            <div className="ui-monster-detail">
              <div className="ui-object-hero">
                <ItemImage
                  url={assets?.monsters[String(detail.id)]}
                  name={detail.name}
                  size={128}
                />
                <div>
                  <StatusBadge>Originaldaten {version}</StatusBadge>
                  <h2>{detail.name}</h2>
                  <p>
                    {detail.nameFr} · Monster #{detail.id}
                  </p>
                  <small>Illustration: Bildstand 3.7.12.12</small>
                </div>
              </div>
              <div
                className="ui-module-tabs"
                role="tablist"
                aria-label="Monsterinformationen"
              >
                {["Werte & Zauber", "Drops", "Fundorte"].map((t) => (
                  <button
                    role="tab"
                    aria-selected={t === tab}
                    key={t}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {tab === "Werte & Zauber" && <MonsterCard monster={detail} />}
              {tab === "Drops" && (
                <div className="ui-card-grid">
                  {detail.drops.map((d, i) => (
                    <button
                      className="ui-object-card"
                      key={`${d.itemId}-${i}`}
                      onClick={() => navigatePath(`/items/${d.itemId}`)}
                    >
                      <ItemImage iconId={d.iconId} name={d.name} />
                      <span>
                        <h3>{d.name}</h3>
                        <small>Grad 1–5: {d.rates.join(" / ")}%</small>
                        {d.conditions && <p>{d.conditions}</p>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {tab === "Fundorte" && (
                <>
                  <p className="v2-muted">
                    Gebietszuordnungen belegen keine exakten Spawns oder
                    Raumgruppen.
                  </p>
                  <div className="ui-card-grid">
                    {detail.dungeons.map((d) => (
                      <article className="ui-object-card" key={d.id}>
                        <h3>{d.name}</h3>
                        <div className="toolbar">
                          <button
                            onClick={() => navigatePath(`/dungeons/${d.id}`)}
                          >
                            Dungeon öffnen
                          </button>
                          {d.entrance && (
                            <button
                              className="secondary"
                              onClick={() =>
                                navigatePath(
                                  `/world?mapId=${d.entrance!.mapId}`,
                                )
                              }
                            >
                              <MapPin size={15} />
                              Eingang
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="ui-region-chips">
                    {detail.subAreaIds.map((id) => (
                      <button
                        className="secondary"
                        key={id}
                        onClick={() => navigatePath(`/world?subAreaId=${id}`)}
                      >
                        Untergebiet #{id} auf Karte
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <Skeleton />
          )}
        </>
      ) : (
        <>
          <div className="ui-catalog-toolbar">
            <SearchField
              label="Monster suchen"
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
              placeholder="Name, französischer Name oder Monster-ID …"
            />
            <StatusBadge>{total.toLocaleString("de-DE")} Einträge</StatusBadge>
          </div>
          {loading ? (
            <Skeleton />
          ) : rows.length ? (
            <div className="ui-card-grid">
              {rows.map((m) => (
                <button
                  className="ui-object-card"
                  key={m.id}
                  onClick={() => {
                    setTab("Werte & Zauber");
                    navigatePath(`/monsters/${m.id}`);
                  }}
                >
                  <ItemImage
                    url={assets?.monsters[String(m.id)]}
                    name={m.name}
                    size={72}
                  />
                  <span>
                    <h3>{m.name}</h3>
                    <StatusBadge>Stufe {m.level}</StatusBadge>
                    <small className="ui-block">
                      #{m.id} · {m.nameFr}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Kein Monster gefunden"
              description="Versuche einen anderen Namen oder eine Monster-ID."
              action={
                <button onClick={() => setQ("")}>Suche zurücksetzen</button>
              }
            />
          )}
          <div className="ui-pagination">
            <button
              className="secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Zurück
            </button>
            <span>
              Seite {page} / {Math.max(1, Math.ceil(total / 30))}
            </span>
            <button
              className="secondary"
              disabled={page * 30 >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Weiter
            </button>
          </div>
        </>
      )}
    </section>
  );
}
