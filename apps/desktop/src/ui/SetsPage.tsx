import { useEffect, useState } from "react";
import type { BuilderSet, BuilderItem } from "@dofus/core";
import type { Config } from "../client";
import { request, message } from "../v2/shared/request";
import { useRoute, navigatePath } from "../v2/routing";
import ItemImage from "../v2/shared/ItemImage";
import {
  EmptyState,
  PageTitle,
  SearchField,
  Skeleton,
  StatusBadge,
} from "./primitives";
type SetDetail = BuilderSet & { items: BuilderItem[] };
export default function SetsPage({ config }: { config: Config }) {
  const route = useRoute();
  const [q, setQ] = useState(""),
    [version, setVersion] = useState("3.7.12.12"),
    [rows, setRows] = useState<SetDetail[]>([]),
    [detail, setDetail] = useState<SetDetail | null>(null),
    [total, setTotal] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [page, setPage] = useState(1),
    [tier, setTier] = useState(2);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      void request<SetDetail[]>(
        `/api/builder/sets?q=${encodeURIComponent(q)}&version=${version}&limit=40&page=${page}`,
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
    }, 160);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [q, version, config, page]);
  useEffect(() => {
    setDetail(null);
    if (!route.id) return;
    const c = new AbortController();
    void request<SetDetail>(
      `/api/builder/sets/${route.id}?version=${version}`,
      config,
      c.signal,
    )
      .then((r) => {
        setDetail(r.data);
        setTier(Math.min(2, r.data.items.length));
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [route.id, version, config]);
  return (
    <section className="ui-sets-page">
      <PageTitle
        eyebrow="AUSRÜSTUNG · GEMEINSAME BUILDERDATEN"
        title="Teile, die zusammenpassen."
        description="Entdecke vorhandene Ausrüstungssets, ihre Gegenstände und die Boni je Anzahl getragener Teile."
        actions={
          <label>
            Datenstand
            <select
              aria-label="Set-Datenstand"
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
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {route.id ? (
        <>
          <button className="secondary" onClick={() => navigatePath("/sets")}>
            Zur Setübersicht
          </button>
          {detail ? (
            <>
              <div className="ui-object-hero">
                <div className="ui-set-collage">
                  {detail.items.slice(0, 4).map((i) => (
                    <ItemImage key={i.id} item={i} itemId={i.id} size={64} />
                  ))}
                </div>
                <div>
                  <h2>{detail.name}</h2>
                  <p>
                    {detail.items.length} Teile · Set #{detail.id} · {version}
                  </p>
                  <button onClick={() => navigatePath("/builder")}>
                    Im Builder planen
                  </button>
                </div>
              </div>
              <section className="panel">
                <h3>Setboni vergleichen</h3>
                <label>
                  Anzahl getragener Teile
                  <select
                    aria-label="Anzahl Set-Teile"
                    value={tier}
                    onChange={(e) => setTier(+e.target.value)}
                  >
                    {Object.keys(detail.tiers).map((t) => (
                      <option key={t} value={t}>
                        {t} Teile
                      </option>
                    ))}
                  </select>
                </label>
                <div className="v2-effect-grid">
                  {(detail.tiers[tier] ?? []).map((effect, i) => (
                    <div className="v2-effect" key={i}>
                      {effect.label}
                    </div>
                  ))}
                </div>
                {!detail.tiers[tier]?.length && (
                  <p className="v2-muted">
                    Für diese Anzahl ist kein Setbonus hinterlegt.
                  </p>
                )}
              </section>
              <div className="ui-card-grid">
                {detail.items.map((i) => (
                  <button
                    className="ui-object-card"
                    key={i.id}
                    onClick={() => navigatePath(`/items/${i.id}`)}
                  >
                    <ItemImage item={i} itemId={i.id} size={64} />
                    <span>
                      <h3>{i.name}</h3>
                      <StatusBadge>Stufe {i.level}</StatusBadge>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <Skeleton />
          )}
        </>
      ) : (
        <>
          <div className="ui-catalog-toolbar">
            <SearchField
              label="Sets suchen"
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
            />
            <StatusBadge>{total} Sets</StatusBadge>
          </div>
          {loading ? (
            <Skeleton />
          ) : rows.length ? (
            <div className="ui-card-grid">
              {rows.map((s) => (
                <button
                  className="ui-object-card ui-set-card"
                  key={s.id}
                  onClick={() => navigatePath(`/sets/${s.id}`)}
                >
                  <div className="ui-set-collage">
                    {s.items.slice(0, 4).map((i) => (
                      <ItemImage key={i.id} item={i} itemId={i.id} size={40} />
                    ))}
                  </div>
                  <span>
                    <h3>{s.name}</h3>
                    <small>{s.items.length} Teile · Setboni ansehen</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Kein Set gefunden"
              description="Ändere den Suchbegriff oder wähle einen anderen Datenstand."
            />
          )}
          <div className="v2-pagination">
            <button
              className="secondary"
              disabled={page === 1 || loading}
              onClick={() => setPage((v) => v - 1)}
            >
              Zurück
            </button>
            <span>
              Seite {page} von {Math.max(1, Math.ceil(total / 40))}
            </span>
            <button
              className="secondary"
              disabled={page * 40 >= total || loading}
              onClick={() => setPage((v) => v + 1)}
            >
              Weiter
            </button>
          </div>
        </>
      )}
    </section>
  );
}
