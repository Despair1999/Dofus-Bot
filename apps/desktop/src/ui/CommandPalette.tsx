import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, MapPin, Search } from "lucide-react";
import type { Config } from "../client";
import { request } from "../v2/shared/request";
import { navigatePath } from "../v2/routing";
import ItemImage from "../v2/shared/ItemImage";
import { useGameAssets } from "../gameAssets";
import { Modal } from "./primitives";
import { navigationItems, viewPath } from "./navigation";

type Result = {
  key: string;
  category: string;
  name: string;
  description: string;
  path: string;
  image?: string;
  itemId?: number;
  iconId?: number;
  monsterId?: number;
};
export default function CommandPalette({
  config,
  onClose,
}: {
  config: Config;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Result[]>([]),
    [selected, setSelected] = useState(0),
    [loading, setLoading] = useState(false),
    [errors, setErrors] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null),
    assets = useGameAssets();
  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    const controller = new AbortController(),
      term = query.trim(),
      q = encodeURIComponent(term);
    const actions: Result[] = navigationItems
      .filter((i) =>
        `${i.label} ${i.description}`
          .toLowerCase()
          .includes(term.toLowerCase()),
      )
      .map((i) => ({
        key: i.id,
        category: "Module & Aktionen",
        name: i.label,
        description: i.description,
        path: viewPath(i.id),
      }));
    const coordinates = term.match(
      /^\[?\s*(-?\d{1,3})\s*[,;]\s*(-?\d{1,3})\s*\]?$/,
    );
    if (coordinates)
      actions.unshift({
        key: "coordinates",
        category: "Kartenkoordinaten",
        name: `[${coordinates[1]}, ${coordinates[2]}]`,
        description: "Auf der Weltkarte markieren",
        path: `/world?x=${+coordinates[1]}&y=${+coordinates[2]}`,
      });
    setResults(actions);
    setSelected(0);
    setErrors([]);
    setLoading(term.length >= 2);
    if (term.length < 2) return () => controller.abort();
    const timer = setTimeout(() => {
      const sources: [string, string, (v: any) => Result[]][] = [
        [
          "Gegenstände",
          `/api/items?q=${q}&pageSize=5`,
          (v) =>
            v.map((x: any) => ({
              key: `item-${x.id}`,
              category: "Gegenstände",
              name: x.name,
              description: `Stufe ${x.level} · ${x.type ?? "Gegenstand"}`,
              path: `/items/${x.id}`,
              image: x.imageUrl,
              itemId: x.id,
            })),
        ],
        [
          "Sets",
          `/api/builder/sets?q=${q}&limit=4`,
          (v) =>
            v.map((x: any) => ({
              key: `set-${x.id}`,
              category: "Sets",
              name: x.name,
              description: `${x.items.length} Ausrüstungsteile · Setboni anzeigen`,
              path: `/sets/${x.id}`,
              image: x.items[0]?.imageUrl,
            })),
        ],
        [
          "Monster",
          `/api/monsters?q=${q}&pageSize=4`,
          (v) =>
            v.map((x: any) => ({
              key: `monster-${x.id}`,
              category: "Monster",
              name: x.name,
              description: `Stufe ${x.level} · Bestiarium`,
              path: `/monsters/${x.id}`,
              monsterId: x.id,
            })),
        ],
        [
          "Dungeons",
          `/api/dungeons?q=${q}&pageSize=4`,
          (v) =>
            v.map((x: any) => ({
              key: `dungeon-${x.id}`,
              category: "Dungeons",
              name: x.name,
              description: `Stufe ${x.level} · ${x.region}`,
              path: `/dungeons/${x.id}`,
              monsterId: x.bossIds[0],
            })),
        ],
        [
          "Quests",
          `/api/quests?q=${q}&pageSize=4`,
          (v) =>
            v.map((x: any) => ({
              key: `quest-${x.id}`,
              category: "Quests",
              name: x.name,
              description: "Schritte, Ziele und Fortschritt",
              path: `/quests/${x.id}`,
            })),
        ],
        [
          "Ressourcen",
          `/api/world/resources?q=${q}`,
          (v) =>
            [...new Map(v.map((x: any) => [x.itemId, x])).values()]
              .slice(0, 5)
              .map((x: any) => ({
                key: `resource-${x.id}`,
                category: "Ressourcen",
                name: x.name,
                description: `${x.jobName} · Stufe ${x.level} · Farmroute vorbereiten`,
                path: `/farming?resourceId=${x.id}`,
                iconId: x.iconId,
              })),
        ],
        [
          "Berufe",
          "/api/professions",
          (v) =>
            v
              .filter((x: any) =>
                x.name.toLowerCase().includes(term.toLowerCase()),
              )
              .slice(0, 4)
              .map((x: any) => ({
                key: `job-${x.id}`,
                category: "Berufe",
                name: x.name,
                description: "Berufslevel & Sammelquests",
                path: `/professions?jobId=${x.id}`,
              })),
        ],
        [
          "Gespeicherte Builds",
          "/api/builder/builds",
          (v) =>
            v
              .filter((x: any) =>
                x.name.toLowerCase().includes(term.toLowerCase()),
              )
              .slice(0, 4)
              .map((x: any) => ({
                key: `build-${x.id}`,
                category: "Gespeicherte Builds",
                name: x.name,
                description: `Stufe ${x.level} · Im Builder öffnen`,
                path: `/builder/${x.id}`,
              })),
        ],
      ];
      void Promise.allSettled(
        sources.map(async ([name, url, map]) => ({
          name,
          values: map(
            (await request<any[]>(url, config, controller.signal)).data,
          ),
        })),
      ).then((values) => {
        if (controller.signal.aborted) return;
        const merged = [...actions],
          unavailable: string[] = [];
        values.forEach((value, index) =>
          value.status === "fulfilled"
            ? merged.push(...value.value.values)
            : unavailable.push(sources[index][0]),
        );
        setResults(merged);
        setErrors(unavailable);
        setLoading(false);
      });
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, config]);
  useEffect(() => {
    document
      .getElementById(`command-option-${selected}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  function open(result: Result) {
    navigatePath(result.path);
    onClose();
  }
  return (
    <Modal
      title="Alles finden. Direkt weiter."
      onClose={onClose}
      className="command-palette"
    >
      <div className="command-input">
        <Search size={21} />
        <input
          ref={input}
          role="combobox"
          aria-label="Globale Suche"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls="command-results"
          aria-activedescendant={
            results[selected] ? `command-option-${selected}` : undefined
          }
          placeholder="Items, Bosse, Quests, Builds oder [x,y] …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelected((v) => Math.min(results.length - 1, v + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((v) => Math.max(0, v - 1));
            }
            if (e.key === "Enter" && results[selected]) {
              e.preventDefault();
              open(results[selected]);
            }
          }}
        />
        <kbd>Esc</kbd>
      </div>
      <div
        className="command-results"
        role="listbox"
        id="command-results"
        aria-label="Suchergebnisse"
        aria-busy={loading}
      >
        {results.map((result, index) => (
          <div key={result.key}>
            {(index === 0 ||
              results[index - 1].category !== result.category) && (
              <div className="command-category">{result.category}</div>
            )}
            <button
              role="option"
              aria-selected={index === selected}
              id={`command-option-${index}`}
              className={index === selected ? "selected" : ""}
              onMouseMove={() => setSelected(index)}
              onClick={() => open(result)}
            >
              {navigationItems.some((i) => i.id === result.key) ? (
                (() => {
                  const Icon = navigationItems.find(
                    (i) => i.id === result.key,
                  )!.icon;
                  return <Icon size={26} />;
                })()
              ) : result.key === "coordinates" ? (
                <MapPin size={26} />
              ) : (
                <ItemImage
                  url={
                    result.monsterId
                      ? assets?.monsters[String(result.monsterId)]
                      : result.image
                  }
                  itemId={result.itemId}
                  iconId={result.iconId}
                  name={result.name}
                  size={38}
                />
              )}
              <span>
                <strong>{result.name}</strong>
                <small>{result.description}</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          </div>
        ))}
        {!results.length && !loading && (
          <div className="ui-empty">
            <h3>Keine Treffer</h3>
            <p>
              Versuche einen anderen Namen, eine ID oder Koordinaten wie [7,
              -5].
            </p>
          </div>
        )}
        {loading && (
          <p className="command-status" role="status">
            Lokalen Datenbestand durchsuchen …
          </p>
        )}
      </div>
      <div className="command-footer">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> auswählen · <kbd>Enter</kbd> öffnen
        </span>
        <small>
          {errors.length
            ? `${errors.join(", ")} derzeit nicht erreichbar`
            : `${results.length} Treffer · Direkte Modulwechsel`}
        </small>
      </div>
    </Modal>
  );
}
