import { useEffect, useMemo, useState, useRef } from "react";
import {
  X,
  ArrowUpRight,
  Check,
  Clipboard,
  Download,
  Hammer,
  Save,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import { materials, profit } from "@dofus/core";
import type { Config, Item } from "../../client";
import { read, write } from "../../storage";
import { request, message } from "../shared/request";
import ItemImage from "../shared/ItemImage";
import ItemSearchBar from "../items/ItemSearchBar";
import ItemSummaryCard from "../items/ItemSummaryCard";
import type { CatalogDetail, CatalogItem } from "../items/types";
import "../items/items.css";
import "./craft.css";
import { navigatePath } from "../routing";
type Prices = Record<number, number>;
interface Project {
  id: string;
  name: string;
  itemId: number;
  category: string;
  quantity: number;
  server: string;
  prices: Prices;
  stock: Prices;
  sale?: number;
  tax: number;
  updatedAt: string;
}
interface SavedCraft {
  prices: Prices;
  stock: Prices;
  server: string;
  savedAt: string;
}
export default function CraftingPage({
  config,
  item: initialItem,
  navigateItem,
  onNotice,
  onClear,
  characterId,
}: {
  characterId?: string;
  onClear?: () => void;
  config: Config;
  item: Item | null;
  navigateItem: (id: number, category?: string) => void;
  onNotice?: (message: string) => void;
}) {
  const [professionLevels, setProfessionLevels] = useState<
    { jobId: number; level: number }[]
  >([]);
  useEffect(() => {
    setProfessionLevels([]);
    if (!characterId) return;
    const c = new AbortController();
    void request<{ levels: { jobId: number; level: number }[] }>(
      `/api/profession-personal/${characterId}`,
      config,
      c.signal,
    )
      .then((r) => {
        if (!c.signal.aborted) setProfessionLevels(r.data.levels);
      })
      .catch(() => {});
    return () => c.abort();
  }, [config, characterId]);
  const selectionRevision = useRef(0);
  function clearSelection() {
    selectionRevision.current++;
    setItem(null);
    setSearch("");
    setQuantity(1);
    setSale(undefined);
    setTax(2);
    setMissingOnly(false);
    setSort("name");
    setProjectName("");
    setError("");
    setLoading(false);
    onClear?.();
  }
  const [item, setItem] = useState<CatalogDetail | null>(
      initialItem as CatalogDetail | null,
    ),
    [search, setSearch] = useState(""),
    [quantity, setQuantity] = useState(1),
    [prices, setPrices] = useState<Prices>({}),
    [stock, setStock] = useState<Prices>({}),
    [sale, setSale] = useState<number | undefined>(),
    [tax, setTax] = useState(2),
    [server, setServer] = useState(""),
    [profiles, setProfiles] = useState<Record<string, SavedCraft>>({}),
    [projects, setProjects] = useState<Project[]>([]),
    [projectName, setProjectName] = useState(""),
    [savedAt, setSavedAt] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [missingOnly, setMissingOnly] = useState(false),
    [sort, setSort] = useState<"name" | "value">("name");
  useEffect(() => {
    selectionRevision.current++;
    setItem(initialItem as CatalogDetail | null);
  }, [initialItem]);
  useEffect(() => {
    void Promise.all([
      read<SavedCraft | null>("craft", null),
      read<Record<string, SavedCraft>>("craft:servers", {}),
      read<Project[]>("craft:projects", []),
    ])
      .then(([legacy, saved, list]) => {
        setProfiles(saved);
        setProjects(list);
        if (legacy) {
          setPrices(legacy.prices ?? {});
          setStock(legacy.stock ?? {});
          setServer(legacy.server ?? "");
          setSavedAt(legacy.savedAt ?? "");
        }
      })
      .catch((e) => setError(message(e)));
  }, []);
  useEffect(() => {
    if (!item?.id) return;
    const revision = selectionRevision.current;
    const c = new AbortController();
    void request<CatalogDetail>(
      `/api/items/${item.id}?lang=de&category=${item.category}`,
      config,
      c.signal,
    )
      .then((r) => {
        if (!c.signal.aborted && revision === selectionRevision.current)
          setItem(r.data);
      })
      .catch((e) => {
        if (!c.signal.aborted && revision === selectionRevision.current)
          setError(message(e));
      });
    return () => c.abort();
  }, [item?.id, item?.category, config.url, config.token]);
  async function choose(selected: CatalogItem) {
    const revision = ++selectionRevision.current;
    setLoading(true);
    setError("");
    try {
      const result = await request<CatalogDetail>(
        `/api/items/${selected.id}?lang=de&category=${selected.category}`,
        config,
      );
      if (revision !== selectionRevision.current) return;
      setItem(result.data);
      setSearch("");
      setQuantity(1);
      setSale(undefined);
      setTax(2);
      setProjectName("");
      setMissingOnly(false);
    } catch (e) {
      if (revision === selectionRevision.current) setError(message(e));
    } finally {
      if (revision === selectionRevision.current) setLoading(false);
    }
  }
  const needs = useMemo(
    () =>
      materials(
        item?.recipe.length ? [{ recipe: item.recipe, quantity }] : [],
        stock,
      ),
    [item, quantity, stock],
  );
  const rows = needs.map((need) => {
    const material = item!.recipe.find((r) => r.itemId === need.itemId)!;
    return {
      ...need,
      ...material,
      price: prices[need.itemId],
      stock: stock[need.itemId] ?? 0,
    };
  });
  const complete = rows.length > 0 && rows.every((r) => r.price !== undefined);
  const knownCost = rows.reduce(
    (sum, r) => sum + r.required * (r.price ?? 0),
    0,
  );
  const knownBuy = rows.reduce((sum, r) => sum + r.missing * (r.price ?? 0), 0);
  const buyComplete = rows.every(
    (r) => r.missing === 0 || r.price !== undefined,
  );
  const calculation =
    complete && sale !== undefined
      ? profit(knownCost, sale * quantity, tax)
      : null;
  const visibleRows = rows
    .filter((r) => !missingOnly || r.missing > 0)
    .sort((a, b) =>
      sort === "value"
        ? b.missing * (b.price ?? 0) - a.missing * (a.price ?? 0)
        : (a.name ?? "").localeCompare(b.name ?? "", "de"),
    );
  async function savePrices() {
    const saved = { prices, stock, server, savedAt: new Date().toISOString() };
    const next = { ...profiles, [server.trim() || "Ohne Server"]: saved };
    await write("craft", saved);
    await write("craft:servers", next);
    setProfiles(next);
    setSavedAt(saved.savedAt);
    onNotice?.("Preise und Materialbestand lokal gespeichert.");
  }
  async function saveProject() {
    if (!item) return;
    const project: Project = {
      id: crypto.randomUUID(),
      name: projectName.trim() || `${quantity} × ${item.name}`,
      itemId: item.id,
      category: item.category,
      quantity,
      server,
      prices,
      stock,
      sale,
      tax,
      updatedAt: new Date().toISOString(),
    };
    const next = [project, ...projects];
    await write("craft:projects", next);
    setProjects(next);
    setProjectName("");
    onNotice?.("Crafting-Projekt lokal gespeichert.");
  }
  async function loadProject(project: Project) {
    const revision = ++selectionRevision.current;
    setLoading(true);
    setError("");
    try {
      const response = await request<CatalogDetail>(
        `/api/items/${project.itemId}?category=${project.category}&lang=de`,
        config,
      );
      if (revision !== selectionRevision.current) return;
      setItem(response.data);
      setQuantity(project.quantity);
      setServer(project.server);
      setPrices(project.prices);
      setStock(project.stock);
      setSale(project.sale);
      setTax(project.tax);
    } catch (e) {
      if (revision === selectionRevision.current) setError(message(e));
    } finally {
      if (revision === selectionRevision.current) setLoading(false);
    }
  }
  const listText = rows
    .filter((r) => r.missing > 0)
    .map((r) => `${r.missing} × ${r.name || "Materialdaten fehlen"}`)
    .join("\n");
  function exportCsv() {
    const cells = (v: string | number) =>
      `"${String(v)
        .replace(/^[=+@-]/, "'$&")
        .replace(/"/g, '""')}"`;
    const content =
      "\uFEFF" +
      [
        [
          "Material",
          "Bedarf",
          "Bestand",
          "Fehlend",
          "Preis pro Stück",
          "Server",
        ],
        ...rows.map((r) => [
          r.name || "Materialdaten fehlen",
          r.required,
          r.stock,
          r.missing,
          r.price ?? "Unbekannt",
          server,
        ]),
      ]
        .map((row) => row.map(cells).join(";"))
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "dofus-materialliste.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="v2-crafting-page">
      <div className="v2-page-intro">
        <span className="eyebrow">WERKSTATT</span>
        <h2>Plane dein nächstes Meisterstück.</h2>
        <p>
          Rezepte aus dem vollständigen Katalog. Dein Bestand, deine Preise und
          eine ehrliche Kalkulation.
        </p>
        <button className="secondary" onClick={() => navigatePath("/market")}>
          <ArrowUpRight size={16} /> Marktjournal & Kamas öffnen
        </button>
      </div>
      <ItemSearchBar
        config={config}
        value={search}
        onChange={(value) => {
          selectionRevision.current++;
          setLoading(false);
          setSearch(value);
        }}
        onSubmit={(q) => setSearch(q)}
        onSelect={(i) => void choose(i)}
        placeholder="Gegenstand mit Rezept suchen …"
        label="Crafting-Gegenstand suchen"
        filters={{}}
      />
      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}
      {loading && <p role="status">Gegenstand und Rezept werden geladen …</p>}
      {item ? (
        <>
          <div className="craft-selection">
            <button
              type="button"
              className="icon-button craft-clear"
              title="Auswahl aufheben"
              aria-label="Auswahl aufheben"
              onClick={clearSelection}
            >
              <X size={18} />
            </button>
            <ItemSummaryCard item={item} compact />
          </div>
          <section className="panel">
            <div className="panel-title">
              <span>
                <Hammer size={18} /> Materialbedarf
              </span>
              <span className="pill">{item.recipe.length} Rezeptzutaten</span>
            </div>
            {item.crafting?.map((r) => {
              const level = professionLevels.find(
                (l) => l.jobId === r.jobId,
              )?.level;
              return (
                <p key={r.jobId}>
                  {r.jobName} · benötigt Stufe {r.level} ·{" "}
                  {level === undefined
                    ? "Berufsstufe nicht erfasst"
                    : level >= r.level
                      ? `Mit deiner Stufe ${level} herstellbar`
                      : `Deine Stufe ${level} reicht noch nicht aus`}
                </p>
              );
            })}
            <div className="v2-craft-inputs">
              <label>
                Herstellungsmenge
                <input
                  aria-label="Herstellungsmenge"
                  type="number"
                  min={1}
                  max={100000}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.max(
                        1,
                        Math.min(
                          100000,
                          Math.trunc(Number(e.target.value) || 1),
                        ),
                      ),
                    )
                  }
                />
              </label>
              <label>
                Server
                <input
                  aria-label="Preise für Server"
                  list="v2-server-profiles"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  placeholder="Dein Server"
                />
                <datalist id="v2-server-profiles">
                  {Object.keys(profiles).map((name) => (
                    <option value={name} key={name} />
                  ))}
                </datalist>
              </label>
              <button
                className="secondary"
                onClick={() => {
                  const profile = profiles[server.trim() || "Ohne Server"];
                  setPrices(profile?.prices ?? {});
                  setStock(profile?.stock ?? {});
                  setSavedAt(profile?.savedAt ?? "");
                }}
              >
                Serverprofil laden
              </button>
              <label>
                Verkaufspreis / Stück
                <input
                  aria-label="Verkaufspreis pro Stück"
                  type="number"
                  min={0}
                  value={sale ?? ""}
                  placeholder="Unbekannt"
                  onChange={(e) =>
                    setSale(
                      e.target.value === ""
                        ? undefined
                        : Math.max(0, Number(e.target.value)),
                    )
                  }
                />
              </label>
              <label>
                Gebühr (%)
                <input
                  aria-label="Verkaufsgebühr"
                  type="number"
                  min={0}
                  max={100}
                  value={tax}
                  onChange={(e) =>
                    setTax(Math.max(0, Math.min(100, Number(e.target.value))))
                  }
                />
              </label>
            </div>
            <div className="v2-craft-toolbar">
              <label className="v2-checkbox">
                <input
                  type="checkbox"
                  checked={missingOnly}
                  onChange={(e) => setMissingOnly(e.target.checked)}
                />{" "}
                Nur fehlende Materialien
              </label>
              <select
                aria-label="Materialien sortieren"
                value={sort}
                onChange={(e) => setSort(e.target.value as "name" | "value")}
              >
                <option value="name">Materialname A–Z</option>
                <option value="value">Höchster Zukaufwert zuerst</option>
              </select>
            </div>
            <div className="v2-craft-table-scroll">
              <table className="v2-craft-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Bedarf</th>
                    <th>Bestand</th>
                    <th>Fehlend</th>
                    <th>Preis / Stück</th>
                    <th>Zukauf</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => (
                    <tr key={r.itemId}>
                      <td>
                        <button
                          className="v2-material-link"
                          onClick={() => navigateItem(r.itemId, r.category)}
                        >
                          <ItemImage url={r.imageUrl} size={39} />
                          <span>
                            <strong>{r.name ?? "Materialdaten fehlen"}</strong>
                            <small>
                              {r.type ?? "Material"}
                              {r.level !== undefined
                                ? ` · Stufe ${r.level}`
                                : ""}
                            </small>
                          </span>
                          <ArrowUpRight size={13} />
                        </button>
                      </td>
                      <td>{r.required.toLocaleString("de-DE")}</td>
                      <td>
                        <input
                          aria-label={`Bestand ${r.name ?? r.itemId}`}
                          type="number"
                          min={0}
                          value={r.stock}
                          onChange={(e) =>
                            setStock({
                              ...stock,
                              [r.itemId]: Math.max(
                                0,
                                Math.trunc(Number(e.target.value)),
                              ),
                            })
                          }
                        />
                      </td>
                      <td>
                        <span
                          className={r.missing ? "v2-missing" : "v2-complete"}
                        >
                          {r.missing ? (
                            r.missing.toLocaleString("de-DE")
                          ) : (
                            <>
                              <Check size={13} /> Vollständig
                            </>
                          )}
                        </span>
                        {r.missing > 0 && (
                          <button
                            className="text-button"
                            onClick={() =>
                              navigatePath(
                                `/farming?itemId=${r.itemId}&quantity=${r.missing}`,
                              )
                            }
                          >
                            Fehlende Ressourcen farmen
                          </button>
                        )}
                      </td>
                      <td>
                        <input
                          aria-label={`Preis ${r.name ?? r.itemId}`}
                          type="number"
                          min={0}
                          value={r.price ?? ""}
                          placeholder="Unbekannt"
                          onChange={(e) => {
                            const next = { ...prices };
                            if (e.target.value === "") delete next[r.itemId];
                            else
                              next[r.itemId] = Math.max(
                                0,
                                Number(e.target.value),
                              );
                            setPrices(next);
                          }}
                        />
                      </td>
                      <td>
                        {r.missing === 0 ? (
                          "0 K"
                        ) : r.price === undefined ? (
                          <span className="v2-unknown">Unbekannt</span>
                        ) : (
                          `${(r.missing * r.price).toLocaleString("de-DE")} K`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!item.recipe.length && (
              <div className="v2-empty">
                <ShoppingBasket size={32} />
                <h3>Kein Herstellungsrezept hinterlegt</h3>
                <p>
                  Wähle einen anderen Gegenstand. Materialmengen werden nicht
                  erfunden.
                </p>
              </div>
            )}
            <div className="v2-craft-totals">
              <Metric
                label="Materialwert"
                value={
                  complete
                    ? `${knownCost.toLocaleString("de-DE")} K`
                    : "Preise unvollständig"
                }
                description="Alle benötigten Materialien, auch vorhandene"
              />
              <Metric
                label="Noch einzukaufen"
                value={
                  buyComplete && rows.length
                    ? `${knownBuy.toLocaleString("de-DE")} K`
                    : "Preise unvollständig"
                }
                description="Bestand bereits berücksichtigt"
              />
              <Metric
                label="Gewinn nach Gebühren"
                value={
                  calculation
                    ? `${calculation.profit.toLocaleString("de-DE")} K`
                    : "Nicht berechenbar"
                }
                description={
                  calculation
                    ? `${calculation.fees.toLocaleString("de-DE")} K Gebühren`
                    : "Materialpreise und Verkaufspreis erforderlich"
                }
              />
              <Metric
                label="Gewinnmarge"
                value={
                  calculation
                    ? `${calculation.marginPercent.toFixed(1)} %`
                    : "—"
                }
                description="Gewinn bezogen auf Verkaufserlös"
              />
            </div>
            <div className="toolbar">
              <button onClick={() => void savePrices()}>
                <Save size={15} /> Preise & Bestand speichern
              </button>
              <button
                className="secondary"
                disabled={!rows.length}
                onClick={() => void navigator.clipboard.writeText(listText)}
              >
                <Clipboard size={15} /> Einkaufsliste kopieren
              </button>
              <button
                className="secondary"
                disabled={!rows.length}
                onClick={exportCsv}
              >
                <Download size={15} /> CSV exportieren
              </button>
            </div>
            <small>
              Quelle der Preise: deine manuelle Eingabe · Server:{" "}
              {server || "nicht angegeben"} · Stand:{" "}
              {savedAt
                ? new Date(savedAt).toLocaleString("de-DE")
                : "noch nicht gespeichert"}
              . Fehlende Preise werden niemals als bestätigte Nullpreise
              behandelt.
            </small>
          </section>
          <section className="panel">
            <div className="panel-title">
              <span>
                <Save size={17} /> Crafting-Projekte
              </span>
              <span className="pill">Lokal gespeichert</span>
            </div>
            <div className="toolbar">
              <input
                aria-label="Projektname"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={`${quantity} × ${item.name}`}
                maxLength={120}
              />
              <button
                onClick={() => void saveProject()}
                disabled={!item.recipe.length}
              >
                Projekt speichern
              </button>
            </div>
            {projects.map((project) => (
              <div className="v2-project-row" key={project.id}>
                <button
                  className="v2-project-open"
                  onClick={() => void loadProject(project)}
                >
                  <strong>{project.name}</strong>
                  <small>
                    {project.server || "Ohne Server"} ·{" "}
                    {new Date(project.updatedAt).toLocaleDateString("de-DE")}
                  </small>
                </button>
                <button
                  className="icon-button"
                  aria-label={`Projekt ${project.name} löschen`}
                  onClick={() => {
                    const next = projects.filter((p) => p.id !== project.id);
                    setProjects(next);
                    void write("craft:projects", next);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </section>
        </>
      ) : (
        <section className="panel v2-empty">
          <Hammer size={36} />
          <h3>Ein gutes Rezept ist der Anfang.</h3>
          <p>
            Wähle oben einen Gegenstand aus der Suchvorschau oder öffne in einer
            Itemdetailansicht „Rezept planen“.
          </p>
          {projects.map((project) => (
            <button
              className="secondary"
              key={project.id}
              onClick={() => void loadProject(project)}
            >
              {project.name}
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="v2-craft-metric">
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{description}</span>
    </div>
  );
}
