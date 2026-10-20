import { statDefinitions, type EffectFilter } from "@dofus/core";
export default function EffectFilters({
  value,
  onChange,
  mode = "and",
  onMode,
}: {
  value: EffectFilter[];
  onChange: (v: EffectFilter[]) => void;
  mode?: "and" | "or";
  onMode: (mode: "and" | "or") => void;
}) {
  function change(id: number, next: Partial<EffectFilter>) {
    onChange(value.map((f) => (f.id === id ? { ...f, ...next } : f)));
  }
  return (
    <details className="effect-filters">
      <summary>
        Attributfilter <span className="pill">{value.length} aktiv</span>
      </summary>
      <div className="toolbar">
        <label>
          Verknüpfung{" "}
          <select
            value={mode}
            onChange={(e) => onMode(e.target.value as "and" | "or")}
          >
            <option value="and">Alle Effekte (UND)</option>
            <option value="or">Mindestens ein Effekt (ODER)</option>
          </select>
        </label>
        <button className="secondary" onClick={() => onChange([])}>
          Effektfilter zurücksetzen
        </button>
      </div>
      <div className="effect-groups">
        {[...new Set(statDefinitions.map((s) => s[2]))].map((group) => (
          <fieldset key={group}>
            <legend>{group}</legend>
            {statDefinitions
              .filter((s) => s[2] === group)
              .map(([id, label]) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={value.some((f) => f.id === id)}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? [...value, { id, absent: false }]
                          : value.filter((f) => f.id !== id),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
          </fieldset>
        ))}
      </div>
      {value.map((f) => (
        <div className="effect-range" key={f.id}>
          <strong>{statDefinitions.find((s) => s[0] === f.id)?.[1]}</strong>
          <select
            aria-label={`Bedingung ${f.id}`}
            value={f.absent ? "absent" : "present"}
            onChange={(e) =>
              change(f.id, { absent: e.target.value === "absent" })
            }
          >
            <option value="present">Effekt vorhanden</option>
            <option value="absent">Effekt nicht vorhanden</option>
          </select>
          {!f.absent && (
            <>
              <input
                type="number"
                aria-label={`Minimum ${f.id}`}
                placeholder="Minimum"
                value={f.min ?? ""}
                onChange={(e) =>
                  change(f.id, {
                    min:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              />
              <input
                type="number"
                aria-label={`Maximum ${f.id}`}
                placeholder="Maximum"
                value={f.max ?? ""}
                onChange={(e) =>
                  change(f.id, {
                    max:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              />
              <button
                className="secondary"
                onClick={() => change(f.id, { min: 1, max: undefined })}
              >
                Positiv
              </button>
              <button
                className="secondary"
                onClick={() => change(f.id, { min: undefined, max: -1 })}
              >
                Negativ
              </button>
            </>
          )}
        </div>
      ))}
      <small>
        Wertebereiche prüfen die verfügbaren Item-Rolls. Gleiche Unter- und
        Obergrenze bedeutet exakter Wert.
      </small>
    </details>
  );
}
