import { useEffect, useRef, useState } from "react";
import {
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  List,
} from "lucide-react";
import {
  slotDefinitions,
  effectStats,
  statDefinitions,
  type BuilderItem,
  type EffectFilter,
} from "@dofus/core";
import type { Config } from "../client";
import { request, message, type PageEnvelope } from "../v2/shared/request";
import ItemImage from "../v2/shared/ItemImage";
import EffectFilters from "./EffectFilters";
export default function ItemPicker({
  config,
  version,
  level,
  slot,
  onClose,
  onEquip,
  types,
  currentItem,
}: {
  config: Config;
  version: string;
  level: number;
  slot: string;
  onClose: () => void;
  onEquip: (item: BuilderItem) => void;
  types: { id: number; name: string }[];
  currentItem?: BuilderItem;
}) {
  const [query, setQuery] = useState(""),
    [debounced, setDebounced] = useState(""),
    [min, setMin] = useState(1),
    [max, setMax] = useState(level),
    [type, setType] = useState(""),
    [setName, setSetName] = useState(""),
    [effects, setEffects] = useState<EffectFilter[]>([]),
    [mode, setMode] = useState<"and" | "or">("and"),
    [sort, setSort] = useState("level-desc"),
    [page, setPage] = useState(1),
    [layout, setLayout] = useState("grid"),
    [result, setResult] = useState<PageEnvelope<BuilderItem[]>>({
      data: [],
      total: 0,
    }),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const filterKey = JSON.stringify(effects);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    const cancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el?.addEventListener("cancel", cancel);
    return () => el?.removeEventListener("cancel", cancel);
  }, [onClose]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    setPage(1);
  }, [min, max, type, setName, filterKey, mode, sort]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const p = new URLSearchParams({
      version,
      slot,
      q: debounced,
      minLevel: String(min),
      maxLevel: String(max),
      page: String(page),
      pageSize: "24",
      sort,
      effects: filterKey,
      effectMode: mode,
    });
    if (type) p.set("typeId", type);
    if (setName) p.set("setName", setName);
    void request<BuilderItem[]>(
      "/api/builder/items?" + p,
      config,
      controller.signal,
    )
      .then((r) => {
        if (!controller.signal.aborted) setResult(r);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    version,
    slot,
    debounced,
    min,
    max,
    type,
    setName,
    filterKey,
    mode,
    sort,
    page,
    config,
  ]);
  return (
    <dialog
      ref={dialog}
      className="builder-dialog picker-dialog"
      aria-label={`${slotDefinitions.find((s) => s[0] === slot)?.[1]} auswählen`}
    >
      <header>
        <div>
          <span className="eyebrow">AUSRÜSTUNG · {version}</span>
          <h2>{slotDefinitions.find((s) => s[0] === slot)?.[1]} auswählen</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Auswahl schließen"
        >
          <X />
        </button>
      </header>
      <div className="picker-controls">
        <label className="picker-search">
          <Search size={18} />
          <input
            autoFocus
            aria-label="Builder-Gegenstand suchen"
            placeholder="Name oder Item-ID …"
            list="builder-suggestions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <datalist id="builder-suggestions">
            {result.data.slice(0, 8).map((i) => (
              <option value={i.name} key={i.id} />
            ))}
          </datalist>
        </label>
        <label>
          Stufe von
          <input
            type="number"
            min="1"
            max="200"
            value={min}
            onChange={(e) => setMin(Number(e.target.value))}
          />
        </label>
        <label>
          bis
          <input
            type="number"
            min="1"
            max="200"
            value={max}
            onChange={(e) => setMax(Number(e.target.value))}
          />
        </label>
        <label>
          Gegenstandstyp
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Alle kompatiblen Typen</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Element
          <select
            aria-label="Builder-Elementfilter"
            value=""
            onChange={(e) => {
              if (e.target.value)
                setEffects((f) => [
                  ...f.filter((x) => x.id !== +e.target.value),
                  { id: +e.target.value, min: 1, absent: false },
                ]);
            }}
          >
            <option value="">Attribut hinzufügen …</option>
            <option value="45">Erde / Stärke</option>
            <option value="13">Feuer / Intelligenz</option>
            <option value="22">Wasser / Chance</option>
            <option value="36">Luft / Beweglichkeit</option>
          </select>
        </label>
        <label>
          Setname
          <input
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            placeholder="Alle Sets"
          />
        </label>
        <select
          aria-label="Builder-Sortierung"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="level-desc">Höchste Stufe zuerst</option>
          <option value="level-asc">Niedrigste Stufe zuerst</option>
          <option value="name">Name A–Z</option>
        </select>
        <button
          className="secondary"
          onClick={() => {
            setQuery("");
            setMin(1);
            setMax(level);
            setType("");
            setSetName("");
            setEffects([]);
            setMode("and");
            setPage(1);
          }}
        >
          Filter zurücksetzen
        </button>
      </div>
      <EffectFilters
        value={effects}
        onChange={setEffects}
        mode={mode}
        onMode={setMode}
      />
      <div className="toolbar picker-count">
        <strong>{result.total ?? 0} passende Gegenstände</strong>
        <span>{loading ? "Suche läuft …" : `Seite ${page}`}</span>
        <button
          aria-label="Rasteransicht"
          className="icon-button"
          onClick={() => setLayout("grid")}
        >
          <Grid2X2 />
        </button>
        <button
          aria-label="Listenansicht"
          className="icon-button"
          onClick={() => setLayout("list")}
        >
          <List />
        </button>
      </div>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      <div className={`picker-results ${layout}`} aria-busy={loading}>
        {result.data.map((item) => (
          <article className="picker-item" key={item.id}>
            <div className="picker-item-heading">
              <ItemImage item={item} />
              <div>
                <h3>{item.name}</h3>
                <small>
                  {item.type} · Stufe {item.level} · #{item.id}
                </small>
                {item.setName && (
                  <span className="set-name">{item.setName}</span>
                )}
              </div>
            </div>
            <div className="builder-item-effects">
              {item.effects.map((e, i) => (
                <span
                  className={
                    e.max < 0
                      ? "negative"
                      : e.active
                        ? "active-effect"
                        : "positive"
                  }
                  key={i}
                >
                  {e.label}
                </span>
              ))}
              {!item.effectsKnown && (
                <span className="warning-text">
                  Effekte dieses Datenstands fehlen. Keine vollständige
                  Berechnung.
                </span>
              )}
              {currentItem && (
                <details>
                  <summary>Mit {currentItem.name} vergleichen</summary>
                  {statDefinitions
                    .filter(
                      ([id]) =>
                        (effectStats(item.effects)[id] ?? 0) !==
                        (effectStats(currentItem.effects)[id] ?? 0),
                    )
                    .map(([id, label]) => {
                      const delta =
                        (effectStats(item.effects)[id] ?? 0) -
                        (effectStats(currentItem.effects)[id] ?? 0);
                      return (
                        <small
                          key={id}
                          className={delta > 0 ? "positive" : "negative"}
                        >
                          {label}: {delta > 0 ? "+" : ""}
                          {delta}
                        </small>
                      );
                    })}
                </details>
              )}
            </div>
            {item.requirements && (
              <small>Voraussetzung: {item.requirements}</small>
            )}
            <button onClick={() => onEquip(item)}>
              In {slotDefinitions.find((s) => s[0] === slot)?.[1]} ausrüsten
            </button>
          </article>
        ))}
      </div>
      {!loading && !result.data.length && (
        <div className="empty">
          Keine passenden Gegenstände. Filter oder Levelbereich anpassen.
        </div>
      )}
      <footer>
        <button
          className="secondary"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          <ChevronLeft size={16} />
          Zurück
        </button>
        <span>
          {page} / {Math.max(1, Math.ceil((result.total ?? 0) / 24))}
        </span>
        <button
          className="secondary"
          disabled={page * 24 >= (result.total ?? 0) || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Weiter
          <ChevronRight size={16} />
        </button>
      </footer>
    </dialog>
  );
}
