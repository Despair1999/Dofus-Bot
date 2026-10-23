import { useState, useRef } from "react";
import type { CatalogItem } from "./catalog-search";
export default function CatalogSearch({
  search,
  onSelect,
}: {
  search?: (q: string) => Promise<CatalogItem[]>;
  onSelect: (item: CatalogItem) => void;
}) {
  const [q, setQ] = useState(""),
    [items, setItems] = useState<CatalogItem[]>([]),
    [category, setCategory] = useState(""),
    [min, setMin] = useState("0"),
    [max, setMax] = useState("200"),
    [page, setPage] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  const run = async () => {
    if (!search) return;
    const ticket = ++epoch.current;
    setBusy(true);
    setError("");
    try {
      const result = await search(q);
      if (ticket === epoch.current) {
        setItems(result);
        setPage(0);
      }
    } catch (e) {
      if (ticket === epoch.current) setError(String(e));
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  };
  const filtered = items.filter(
    (i) =>
      (!category || i.category === category) &&
      (i.level ?? 0) >= Number(min) &&
      (i.level ?? 0) <= Number(max),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 30)),
    current = Math.min(page, pages - 1);
  return (
    <section className="cc-catalog-search" aria-label="Gegenstandskatalog">
      <div className="cc-toolbar">
        <label className="cc-field">
          Gegenstand im DOFUS-Katalog suchen
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void run();
              }
            }}
            placeholder="Name oder Item-ID · Deutsch, Englisch, Französisch"
          />
        </label>
        <button
          type="button"
          disabled={!search || busy}
          onClick={() => void run()}
        >
          {busy ? "Suche läuft …" : "Suchen"}
        </button>
      </div>
      <div className="cc-form-grid">
        <label className="cc-field">
          Gegenstandskategorie
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Alle Kategorien</option>
            {[
              ["equipment", "Ausrüstung"],
              ["resources", "Ressourcen & Drops"],
              ["consumables", "Verbrauchsgegenstände"],
              ["cosmetics", "Kosmetik"],
            ].map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="cc-field">
          Gegenstandslevel ab
          <input
            type="number"
            min={0}
            max={200}
            value={min}
            onChange={(e) => {
              setMin(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="cc-field">
          Gegenstandslevel bis
          <input
            type="number"
            min={0}
            max={200}
            value={max}
            onChange={(e) => {
              setMax(e.target.value);
              setPage(0);
            }}
          />
        </label>
      </div>
      <p role="status">
        {filtered.length} passende Gegenstände · Seite {current + 1}/{pages}
      </p>
      <div
        className="cc-search-results"
        onKeyDown={(e) => {
          if (
            ![
              "ArrowDown",
              "ArrowRight",
              "ArrowUp",
              "ArrowLeft",
              "Home",
              "End",
            ].includes(e.key)
          )
            return;
          const buttons = Array.from(
            e.currentTarget.querySelectorAll("button"),
          );
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? buttons.length - 1
                : Math.max(
                    0,
                    Math.min(
                      buttons.length - 1,
                      index +
                        (["ArrowUp", "ArrowLeft"].includes(e.key) ? -1 : 1),
                    ),
                  );
          e.preventDefault();
          buttons[next]?.focus();
        }}
      >
        {filtered.slice(current * 30, current * 30 + 30).map((i) => (
          <button type="button" key={i.id} onClick={() => onSelect(i)}>
            {i.iconUrl && <img src={i.iconUrl} alt="" loading="lazy" />}
            <span>
              {i.name}
              <small>
                {i.type || i.category} · Stufe {i.level ?? 0} · #{i.id}
              </small>
            </span>
          </button>
        ))}
      </div>
      <div className="cc-toolbar">
        <button
          type="button"
          disabled={!current}
          onClick={() => setPage(current - 1)}
        >
          Vorherige Gegenstände
        </button>
        <button
          type="button"
          disabled={current + 1 >= pages}
          onClick={() => setPage(current + 1)}
        >
          Weitere Gegenstände
        </button>
      </div>
      <small>
        Handelbarkeit laut Gegenstandsvorlage. Individuelle Accountbindungen und
        zeitliche Handelssperren im Spiel prüfen.
      </small>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
