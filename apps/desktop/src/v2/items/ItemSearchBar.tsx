import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { LoaderCircle, Search, X } from "lucide-react";
import type { Config } from "../../client";
import { normalize } from "@dofus/core";
import { request, message } from "../shared/request";
import ItemImage from "../shared/ItemImage";
import type { CatalogItem, ItemFilters } from "./types";
import "./items.css";
export function queryParams(
  query: string,
  filters: Partial<ItemFilters>,
  page = 1,
  pageSize = 30,
) {
  const p = new URLSearchParams({
    q: query.trim(),
    lang: "de",
    page: String(page),
    pageSize: String(pageSize),
  });
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined && value !== "") p.set(key, String(value));
  return p;
}
export default function ItemSearchBar({
  config,
  value,
  onChange,
  onSubmit,
  onSelect,
  filters = {},
  placeholder = "Gegenstände suchen …",
  label = "Gegenstände suchen",
  autoFocus = false,
}: {
  config: Config;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (query: string) => void;
  onSelect: (item: CatalogItem) => void;
  filters?: Partial<ItemFilters>;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
}) {
  const [results, setResults] = useState<CatalogItem[]>([]),
    [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [active, setActive] = useState(-1);
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    const controller = new AbortController();
    const seq = ++sequence.current;
    setActive(-1);
    if (value.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setError("");
      return () => controller.abort();
    }
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      void request<CatalogItem[]>(
        `/api/items?${queryParams(value, JSON.parse(filterKey) as Partial<ItemFilters>, 1, 8)}`,
        config,
        controller.signal,
      )
        .then((result) => {
          if (seq === sequence.current) {
            setResults(result.data);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted && seq === sequence.current) {
            setError(message(e));
            setResults([]);
            setLoading(false);
          }
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, filterKey, config.url, config.token]);
  useEffect(() => {
    function close(e: PointerEvent) {
      if (!container.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  function choose(item: CatalogItem) {
    setOpen(false);
    setActive(-1);
    onSelect(item);
  }
  function keyboard(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && active >= 0 && results[active]) choose(results[active]);
      else {
        setOpen(false);
        onSubmit(value.trim());
      }
    }
  }
  return (
    <div className="v2-search-container" ref={container}>
      <form
        className="v2-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(false);
          onSubmit(value.trim());
        }}
      >
        <Search size={20} />
        <input
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={open && value.trim().length >= 2}
          aria-controls={`${id}-options`}
          aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={keyboard}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
        />
        {loading && <LoaderCircle className="spin" size={17} />}{" "}
        {value && (
          <button
            type="button"
            className="icon-button"
            aria-label="Suchbegriff löschen"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            <X size={17} />
          </button>
        )}
        <button type="submit" disabled={value.trim().length < 2}>
          Suchen
        </button>
      </form>
      {open && value.trim().length >= 2 && (
        <div
          className="v2-autocomplete"
          role="listbox"
          id={`${id}-options`}
          aria-label="Suchvorschläge"
        >
          {loading && !results.length ? (
            <div className="v2-search-state">
              <LoaderCircle size={18} className="spin" /> Gegenstände werden
              gesucht …
            </div>
          ) : error ? (
            <div className="v2-search-state" role="alert">
              {error}
            </div>
          ) : !results.length ? (
            <div className="v2-search-state">
              Keine passenden Gegenstände in dieser Kategorie.
            </div>
          ) : (
            results.map((item, i) => (
              <button
                type="button"
                role="option"
                id={`${id}-${i}`}
                aria-selected={active === i}
                key={`${item.category}:${item.id}`}
                className={`v2-suggestion ${active === i ? "is-active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(item)}
              >
                <ItemImage url={item.imageUrl} />
                <span>
                  <strong>
                    <Highlight text={item.name} query={value} />
                  </strong>
                  <small>
                    Stufe {item.level} · {item.type}
                  </small>
                </span>
              </button>
            ))
          )}
          <button
            type="button"
            className="v2-all-results"
            onClick={() => {
              setOpen(false);
              onSubmit(value.trim());
            }}
          >
            Alle Ergebnisse für „{value.trim()}“ anzeigen
          </button>
        </div>
      )}
    </div>
  );
}
function Highlight({ text, query }: { text: string; query: string }) {
  const pos = normalize(text).indexOf(normalize(query));
  return pos < 0 ? (
    <>{text}</>
  ) : (
    <>
      {text.slice(0, pos)}
      <mark>{text.slice(pos, pos + query.length)}</mark>
      {text.slice(pos + query.length)}
    </>
  );
}
