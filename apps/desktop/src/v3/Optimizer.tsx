import { useEffect, useRef, useState } from "react";
import {
  statDefinitions,
  type BuildInput,
  type BuilderItem,
  type BuilderSet,
  type OptimizeOptions,
  type optimizeBuild,
  type BuilderSpell,
} from "@dofus/core";
import { cached, type Config } from "../client";
import EffectFilters from "./EffectFilters";
type Result = ReturnType<typeof optimizeBuild>;
export default function Optimizer({
  build,
  items,
  sets,
  onUse,
  config,
}: {
  build: BuildInput;
  items: BuilderItem[];
  sets: BuilderSet[];
  onUse: (b: BuildInput) => void;
  config: Config;
}) {
  const [options, setOptions] = useState<OptimizeOptions>({
      objective: 45,
      minimums: { 12: 10, 8: 5 },
      excluded: [],
      preferred: [],
      lockedSlots: [],
      allowedDofus: null,
      budget: null,
      allowExoAP: false,
      allowExoMP: false,
    }),
    [result, setResult] = useState<Result | null>(null),
    [progress, setProgress] = useState(0),
    [running, setRunning] = useState(false),
    [error, setError] = useState("");
  const worker = useRef<Worker | null>(null);
  const [spells, setSpells] = useState<BuilderSpell[]>([]);
  useEffect(() => {
    let stopped = false;
    void cached<BuilderSpell[]>(
      `/api/builder/spells?version=${build.gameVersion}&classId=${build.classId}`,
      config,
    )
      .then((r) => {
        if (!stopped) {
          setSpells(r.data);
          setOptions((o) => ({ ...o, spell: undefined }));
        }
      })
      .catch(() => {});
    return () => {
      stopped = true;
    };
  }, [config, build.gameVersion, build.classId]);
  useEffect(() => () => worker.current?.terminate(), []);
  function run() {
    if (
      (options.objectiveMode === "damage" || options.minimumDamage) &&
      !options.spell
    ) {
      setError("Für das Schadensziel zuerst einen Zauber und Rang wählen.");
      return;
    }
    worker.current?.terminate();
    setRunning(true);
    setProgress(0);
    setError("");
    setResult(null);
    const w = new Worker(new URL("./optimizer.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    w.onmessage = (e) => {
      if (e.data.progress !== undefined) setProgress(e.data.progress);
      if (e.data.error) {
        setError(e.data.error);
        setRunning(false);
        w.terminate();
      }
      if (e.data.result) {
        setProgress(100);
        setResult(e.data.result);
        setRunning(false);
        w.terminate();
      }
    };
    w.onerror = (e) => {
      setError(e.message);
      setRunning(false);
      w.terminate();
    };
    w.postMessage({ build, items, sets, options });
  }
  const ids = (value: string) =>
    value
      .split(/[,\s]+/)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);
  return (
    <section className="panel">
      <span className="eyebrow">WERKSTATT</span>
      <h2>Build-Optimierer</h2>
      <p className="muted">
        Deterministische Suche im Hintergrund. Pro Slot werden bis zu 18
        passende Kandidaten und 60 Zwischenkombinationen geprüft. Vorschläge
        erfüllen alle ausgewerteten Bedingungen; eine globale Bestlösung wird
        nicht behauptet. Ungeklärte Itembedingungen und fehlende Effektwerte
        schließen Ergebnisse aus.
      </p>
      <div className="builder-form-grid">
        <label>
          Optimierungsart
          <select
            value={options.objectiveMode ?? "stat"}
            onChange={(e) =>
              setOptions((o) => ({
                ...o,
                objectiveMode: e.target
                  .value as OptimizeOptions["objectiveMode"],
              }))
            }
          >
            <option value="stat">Attribut maximieren</option>
            <option value="damage">Erwarteten Zauberschaden maximieren</option>
            <option value="balanced">Ausgewogene Elementarresistenzen</option>
            <option value="hybrid">Zwei stärkste Elemente (Hybrid)</option>
            <option value="cost">Günstigste bekannte Kombination</option>
          </select>
        </label>
        <label>
          Zauber für Schadensziel
          <select
            value={options.spell?.id ?? ""}
            onChange={(e) =>
              setOptions((o) => ({
                ...o,
                spell: spells
                  .flatMap((s) => s.levels)
                  .find((l) => l.id === +e.target.value),
              }))
            }
          >
            <option value="">Zauber und Rang wählen …</option>
            {spells.flatMap((s) =>
              s.levels
                .filter((l) => l.level <= build.level)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {s.name} · Rang {l.grade}
                  </option>
                )),
            )}
          </select>
        </label>
        <label>
          Mindestschaden (Erwartungswert)
          <input
            type="number"
            min="0"
            value={options.minimumDamage ?? ""}
            onChange={(e) =>
              setOptions((o) => ({
                ...o,
                minimumDamage: e.target.value ? +e.target.value : undefined,
              }))
            }
          />
        </label>
        <label>
          Ziel
          <select
            value={options.objective}
            onChange={(e) =>
              setOptions((o) => ({ ...o, objective: +e.target.value }))
            }
          >
            {statDefinitions.map(([id, name]) => (
              <option key={id} value={id}>
                {name} maximieren
              </option>
            ))}
          </select>
        </label>
        {[12, 8, 9, 31, 29, 45, 13, 22, 36, 63, 37, 17, 16, 34].map((id) => (
          <label key={id}>
            Mindestens {statDefinitions.find((s) => s[0] === id)?.[1]}
            <input
              type="number"
              min="0"
              value={options.minimums[id] ?? ""}
              onChange={(e) =>
                setOptions((o) => ({
                  ...o,
                  minimums: { ...o.minimums, [id]: +e.target.value },
                }))
              }
            />
          </label>
        ))}
        <label>
          Ausgeschlossene Item-IDs
          <input
            placeholder="2469, …"
            onChange={(e) =>
              setOptions((o) => ({ ...o, excluded: ids(e.target.value) }))
            }
          />
        </label>
        <label>
          Bevorzugte Item-IDs
          <input
            onChange={(e) =>
              setOptions((o) => ({ ...o, preferred: ids(e.target.value) }))
            }
          />
        </label>
        <label>
          Zugelassene Dofus/Trophäen (leer: alle)
          <input
            onChange={(e) =>
              setOptions((o) => ({
                ...o,
                allowedDofus: e.target.value.trim()
                  ? ids(e.target.value)
                  : null,
              }))
            }
          />
        </label>
        <label>
          Budget (nur eigene bekannte Preise)
          <input
            type="number"
            min="0"
            value={options.budget ?? ""}
            onChange={(e) =>
              setOptions((o) => ({
                ...o,
                budget: e.target.value === "" ? null : +e.target.value,
              }))
            }
          />
        </label>
      </div>
      <EffectFilters
        value={options.effectFilters ?? []}
        onChange={(effectFilters) =>
          setOptions((o) => ({ ...o, effectFilters }))
        }
        onMode={(effectMode) => setOptions((o) => ({ ...o, effectMode }))}
        mode={options.effectMode ?? "and"}
      />
      <div className="toolbar">
        <label>
          <input
            type="checkbox"
            checked={options.allowExoAP}
            onChange={(e) =>
              setOptions((o) => ({ ...o, allowExoAP: e.target.checked }))
            }
          />{" "}
          +1 AP-Exomagie zulassen
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.allowExoMP}
            onChange={(e) =>
              setOptions((o) => ({ ...o, allowExoMP: e.target.checked }))
            }
          />{" "}
          +1 MP-Exomagie zulassen
        </label>
      </div>
      <details>
        <summary>Vorhandene Ausrüstung fixieren</summary>
        {Object.keys(build.equipment).map((slot) => (
          <label key={slot}>
            <input
              type="checkbox"
              checked={options.lockedSlots.includes(slot)}
              onChange={(e) =>
                setOptions((o) => ({
                  ...o,
                  lockedSlots: e.target.checked
                    ? [...o.lockedSlots, slot]
                    : o.lockedSlots.filter((s) => s !== slot),
                }))
              }
            />
            {slot}
          </label>
        ))}
      </details>
      <div className="toolbar">
        <button disabled={running || !items.length} onClick={run}>
          Gültige Builds suchen
        </button>
        {running && (
          <button
            className="secondary"
            onClick={() => {
              worker.current?.terminate();
              setRunning(false);
              setError("Suche abgebrochen.");
            }}
          >
            Abbrechen
          </button>
        )}
        <progress max="100" value={progress} />
        <span>{progress}%</span>
      </div>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <p>
            {result.message} {result.assessed.toLocaleString("de")} Kandidaten
            geprüft.
          </p>
          {result.unmet.map((x) => (
            <p className="warning-text" key={x.id}>
              {statDefinitions.find((s) => s[0] === x.id)?.[1]}: gefunden{" "}
              {x.found}, gewünscht {x.requested}
            </p>
          ))}
          {result.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
          <div className="builder-saved-grid">
            {result.results.map((r, i) => (
              <article className="builder-result" key={i}>
                <h3>Vorschlag {i + 1}</h3>
                <strong>
                  {r.calculation.total[12]} AP · {r.calculation.total[8]} MP ·{" "}
                  {r.calculation.hp} LP
                </strong>
                <p>Bewertung: {r.score.toFixed(0)}</p>
                <small>
                  {Object.values(r.build.equipment)
                    .map((x) => items.find((i) => i.id === x.itemId)?.name)
                    .join(" · ")}
                </small>
                <button
                  onClick={() =>
                    onUse({
                      ...r.build,
                      name: build.name + " – Vorschlag " + (i + 1),
                      active: false,
                    })
                  }
                >
                  Im Builder öffnen
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
