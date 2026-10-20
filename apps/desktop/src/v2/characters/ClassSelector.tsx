import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Search, Shield } from "lucide-react";
import { normalize, type GameClass } from "@dofus/core";
export default function ClassSelector({
  classes,
  value,
  onChange,
  label = "Klasse",
  required = true,
}: {
  classes: GameClass[];
  value: number | null;
  onChange: (value: number) => void;
  label?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const parent = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  const selected = classes.find((c) => c.id === value);
  const matches = classes.filter((c) =>
    normalize([c.nameDe, c.nameFr, c.nameEn, ...c.aliases].join(" ")).includes(
      normalize(query),
    ),
  );
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!parent.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  function choose(index: number) {
    const entry = matches[index];
    if (entry) {
      onChange(entry.id);
      setOpen(false);
      setQuery("");
    }
  }
  return (
    <div className="v2-class-field" ref={parent}>
      <span className="v2-field-label" id={`${label}-label`}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <button
        type="button"
        role="combobox"
        aria-labelledby={`${label}-label`}
        aria-expanded={open}
        aria-controls={`${label}-list`}
        aria-haspopup="listbox"
        className="v2-class-trigger"
        onClick={() => {
          setOpen(!open);
          setActive(0);
        }}
      >
        {selected ? (
          <>
            <img src={selected.icon} alt="" />
            <span>
              {selected.nameDe}
              <small>
                {selected.nameFr !== selected.nameDe ? selected.nameFr : ""}
              </small>
            </span>
          </>
        ) : (
          <>
            <Shield size={23} />
            <span>Klasse auswählen</span>
          </>
        )}
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="v2-class-popover">
          <div className="v2-class-search">
            <Search size={15} />
            <input
              ref={input}
              value={query}
              aria-label="Klasse suchen"
              placeholder="Deutsch, Français, English …"
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((index) => Math.min(index + 1, matches.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((index) => Math.max(index - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  choose(active);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                }
              }}
            />
          </div>
          <div
            id={`${label}-list`}
            role="listbox"
            aria-label="Verfügbare Klassen"
          >
            {matches.map((c, index) => (
              <button
                type="button"
                key={c.id}
                role="option"
                aria-selected={value === c.id}
                className={index === active ? "highlighted" : ""}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
              >
                <img src={c.icon} alt="" />
                <span>
                  <strong>{c.nameDe}</strong>
                  <small>
                    {c.nameFr} · {c.nameEn}
                  </small>
                </span>
                {value === c.id && <Check size={15} />}
              </button>
            ))}
            {!matches.length && <p>Keine passende Klasse gefunden.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
