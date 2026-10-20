import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  Package,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { Config } from "../../client";
import { request, message, type PageEnvelope } from "../shared/request";
import ItemImage from "../shared/ItemImage";
import ItemSearchBar, { queryParams } from "./ItemSearchBar";
import ItemSummaryCard from "./ItemSummaryCard";
import {
  defaultFilters,
  type CatalogItem,
  type CatalogDetail,
  type ItemFilters,
  type ItemType,
} from "./types";
import "./items.css";
export interface ItemsPageProps {
  config: Config;
  query?: string;
  itemId?: number;
  itemCategory?: string;
  filters?: Partial<ItemFilters>;
  page?: number;
  navigateItem: (id: number, category?: string) => void;
  onSearch?: (query: string, filters: ItemFilters, page: number) => void;
  onQueryChange?: (query: string) => void;
  onCraft: (item: CatalogDetail) => void;
  onFavorite?: (item: CatalogDetail) => void;
  onBack?: () => void;
}
export default function ItemsPage({
  config,
  query = "",
  itemId,
  itemCategory,
  filters: initialFilters,
  page: initialPage = 1,
  navigateItem,
  onSearch,
  onQueryChange,
  onCraft,
  onFavorite,
  onBack,
}: ItemsPageProps) {
  const [draft, setDraft] = useState(query),
    [search, setSearch] = useState(query),
    [filters, setFilters] = useState<ItemFilters>({
      ...defaultFilters,
      ...initialFilters,
    }),
    [types, setTypes] = useState<ItemType[]>([]),
    [page, setPage] = useState(initialPage),
    [results, setResults] = useState<PageEnvelope<CatalogItem[]>>({
      data: [],
      total: 0,
    }),
    [detail, setDetail] = useState<CatalogDetail | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const filterKey = JSON.stringify(filters);
  const routeFilterKey = JSON.stringify(initialFilters ?? defaultFilters);
  useEffect(() => {
    setFilters({ ...defaultFilters, ...JSON.parse(routeFilterKey) });
    setPage(initialPage);
  }, [routeFilterKey, initialPage]);
  useEffect(() => {
    setDraft(query);
    setSearch(query);
  }, [query]);
  useEffect(() => {
    const c = new AbortController();
    void request<ItemType[]>("/api/item-types", config, c.signal)
      .then((r) => setTypes(r.data))
      .catch(() => {});
    return () => c.abort();
  }, [config.url, config.token]);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    if (itemId) {
      void request<CatalogDetail>(
        `/api/items/${itemId}?lang=de${itemCategory ? `&category=${itemCategory}` : ""}`,
        config,
        c.signal,
      )
        .then((r) => {
          if (!c.signal.aborted) {
            setDetail(r.data);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (!c.signal.aborted) {
            setError(message(e));
            setLoading(false);
          }
        });
    } else {
      setDetail(null);
      void request<CatalogItem[]>(
        `/api/items?${queryParams(search, JSON.parse(filterKey) as ItemFilters, page, 30)}`,
        config,
        c.signal,
      )
        .then((r) => {
          if (!c.signal.aborted) {
            setResults(r);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (!c.signal.aborted) {
            setError(message(e));
            setLoading(false);
          }
        });
    }
    return () => c.abort();
  }, [search, filterKey, page, itemId, itemCategory, config.url, config.token]);
  function submit(q: string) {
    setSearch(q);
    setDraft(q);
    setPage(1);
    onSearch?.(q, filters, 1);
  }
  function update(next: Partial<ItemFilters>) {
    const merged = { ...filters, ...next };
    setFilters(merged);
    setPage(1);
    onSearch?.(search, merged, 1);
  }
  function changePage(next: number) {
    setPage(next);
    onSearch?.(search, filters, next);
  }
  const selectedTypes = types.filter(
    (t) => !t.mainGroup || t.mainGroup === filters.mainGroup,
  );
  const total = results.total ?? results.data.length;
  const pages = Math.max(1, Math.ceil(total / (results.pageSize ?? 30)));
  return (
    <div className="v2-items-page">
      <div className="v2-page-intro">
        <span className="eyebrow">ENZYKLOPÄDIE</span>
        <h2>
          {itemId
            ? "Gegenstand im Detail"
            : "Ein vollständiger Blick auf deine Ausrüstung."}
        </h2>
        <p>
          Durchsuche den importierten Katalog. Deutsche Namen, echte Rezepte und
          nachvollziehbare Daten.
        </p>
      </div>
      <ItemSearchBar
        config={config}
        value={draft}
        onChange={(q) => {
          setDraft(q);
          onQueryChange?.(q);
        }}
        onSubmit={submit}
        onSelect={(i) => navigateItem(i.id, i.category)}
        filters={filters}
      />
      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}
      {itemId ? (
        <>
          <button
            className="text-button v2-back"
            onClick={() =>
              onBack ? onBack() : onSearch?.(search, filters, page)
            }
          >
            <ChevronLeft size={16} /> Zurück zu den Ergebnissen
          </button>
          {loading ? (
            <Loading />
          ) : detail ? (
            <>
              <ItemSummaryCard
                item={detail}
                onCraft={onCraft}
                onFavorite={onFavorite}
              />
              <section className="panel v2-recipe-preview">
                <div className="panel-title">
                  <span>Herstellungsrezept</span>
                  <span className="pill">
                    {detail.recipe.length} Materialien
                  </span>
                </div>
                {detail.recipe.length ? (
                  <div className="v2-material-grid">
                    {detail.recipe.map((material) => (
                      <button
                        className="v2-material-card"
                        key={material.itemId}
                        onClick={() =>
                          navigateItem(material.itemId, material.category)
                        }
                      >
                        <ItemImage url={material.imageUrl} />
                        <span>
                          <strong>
                            {material.name ?? "Materialdaten fehlen"}
                          </strong>
                          <small>
                            Benötigt:{" "}
                            {material.quantity.toLocaleString("de-DE")}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>
                    Für diesen Gegenstand ist kein Herstellungsrezept in der
                    Quelle hinterlegt.
                  </p>
                )}
              </section>
            </>
          ) : null}
        </>
      ) : (
        <>
          <div
            className="v2-catalog-tabs"
            role="tablist"
            aria-label="Hauptbereiche"
          >
            <button
              role="tab"
              aria-selected={filters.mainGroup === "equipment"}
              onClick={() =>
                update({
                  mainGroup: "equipment",
                  category: undefined,
                  typeId: undefined,
                })
              }
            >
              <Package size={17} /> Ausrüstung
            </button>
            <button
              role="tab"
              aria-selected={filters.mainGroup === "resources"}
              onClick={() =>
                update({
                  mainGroup: "resources",
                  category: undefined,
                  typeId: undefined,
                })
              }
            >
              <SlidersHorizontal size={17} /> Ressourcen
            </button>
          </div>
          <div className="v2-filters">
            <label>
              Gegenstandstyp
              <select
                aria-label="Gegenstandstyp"
                value={filters.typeId ?? ""}
                onChange={(e) =>
                  update({
                    typeId: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              >
                <option value="">Alle Typen</option>
                {selectedTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nameDe ?? t.name}
                    {t.count !== undefined ? ` (${t.count})` : ""}
                  </option>
                ))}
              </select>
            </label>
            {filters.mainGroup === "resources" && (
              <label>
                Ursprüngliche Kategorie
                <select
                  aria-label="Ursprüngliche Kategorie"
                  value={filters.category ?? ""}
                  onChange={(e) =>
                    update({
                      category: e.target.value || undefined,
                      typeId: undefined,
                    })
                  }
                >
                  <option value="">Alle Ressourcen & sonstige Items</option>
                  <option value="resources">Ressourcen</option>
                  <option value="quest">Questgegenstände</option>
                  <option value="consumables">Verbrauchsgegenstände</option>
                  <option value="cosmetics">Kosmetik</option>
                </select>
              </label>
            )}
            <label>
              Stufe von
              <input
                aria-label="Mindeststufe"
                type="number"
                min={1}
                max={200}
                placeholder="1"
                value={filters.minLevel ?? ""}
                onChange={(e) =>
                  update({
                    minLevel: e.target.value
                      ? Math.max(
                          1,
                          Math.min(200, Math.trunc(Number(e.target.value))),
                        )
                      : undefined,
                  })
                }
              />
            </label>
            <label>
              bis
              <input
                aria-label="Höchststufe"
                type="number"
                min={1}
                max={200}
                placeholder="200"
                value={filters.maxLevel ?? ""}
                onChange={(e) =>
                  update({
                    maxLevel: e.target.value
                      ? Math.max(
                          1,
                          Math.min(200, Math.trunc(Number(e.target.value))),
                        )
                      : undefined,
                  })
                }
              />
            </label>
            <label>
              Sortieren
              <select
                aria-label="Items sortieren"
                value={filters.sort}
                onChange={(e) =>
                  update({ sort: e.target.value as ItemFilters["sort"] })
                }
              >
                <option value="name">Name A–Z</option>
                <option value="level-asc">Stufe aufsteigend</option>
                <option value="level-desc">Stufe absteigend</option>
              </select>
            </label>
            <button
              className="text-button"
              onClick={() =>
                update({
                  ...defaultFilters,
                  mainGroup: filters.mainGroup,
                  category: undefined,
                  typeId: undefined,
                  minLevel: undefined,
                  maxLevel: undefined,
                })
              }
            >
              Filter zurücksetzen
            </button>
          </div>
          <div className="v2-results-heading">
            <div>
              <strong>{total.toLocaleString("de-DE")} Gegenstände</strong>
              <small>
                {search
                  ? `Ergebnisse für „${search}“`
                  : "Alle verfügbaren Einträge im gewählten Bereich"}
                {results.stale ? " · Gespeicherter Stand" : ""}
              </small>
            </div>
            <span>{results.version ?? ""}</span>
          </div>
          {loading ? (
            <Loading />
          ) : results.data.length ? (
            <div className="v2-item-grid">
              {results.data.map((i) => (
                <button
                  className="v2-item-card"
                  key={`${i.category}:${i.id}`}
                  onClick={() => navigateItem(i.id, i.category)}
                >
                  <div className="v2-item-card-top">
                    <ItemImage url={i.imageUrl} name="" size={64} />
                    <span className="v2-level">{i.level}</span>
                  </div>
                  <strong>{i.name}</strong>
                  <small>{i.type}</small>
                </button>
              ))}
            </div>
          ) : (
            <section className="panel v2-empty">
              <Search size={32} />
              <h3>Keine passenden Gegenstände</h3>
              <p>
                Ändere die Filter oder importiere den vollständigen Katalog in
                den Einstellungen.
              </p>
            </section>
          )}
          <div className="v2-pagination">
            <span>
              Seite {page} von {pages}
            </span>
            <div>
              <button
                className="secondary"
                disabled={page <= 1 || loading}
                onClick={() => changePage(page - 1)}
              >
                <ArrowLeft size={15} /> Zurück
              </button>
              <button
                className="secondary"
                disabled={page >= pages || loading}
                onClick={() => changePage(page + 1)}
              >
                Weiter <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
function Loading() {
  return (
    <div className="v2-loading" role="status">
      <RefreshCw size={22} className="spin" /> Daten werden geladen …
    </div>
  );
}
