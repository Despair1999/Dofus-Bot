import { useEffect, useMemo, useState } from "react";
import {
  calculateBuild,
  simulateSpell,
  type Build,
  type BuilderItem,
  type BuilderSet,
  type BuilderSpell,
} from "@dofus/core";
import { cached, type Config } from "../client";
export default function DamageComparison({
  config,
  current,
  builds,
  items,
  sets,
}: {
  config: Config;
  current: Build;
  builds: Build[];
  items: Map<number, BuilderItem>;
  sets: Map<number, BuilderSet>;
}) {
  const [spells, setSpells] = useState<BuilderSpell[]>([]),
    [spellId, setSpellId] = useState(0),
    [rank, setRank] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void cached<BuilderSpell[]>(
      `/api/builder/spells?version=${current.gameVersion}&classId=${current.classId}`,
      config,
    )
      .then((r) => {
        if (!cancelled) {
          setSpells(r.data);
          setSpellId(r.data[0]?.id ?? 0);
          setRank(0);
        }
      })
      .catch((e) => setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [config, current.gameVersion, current.classId]);
  const spell = spells.find((s) => s.id === spellId);
  const level =
    spell?.levels.find((l) => l.id === rank) ??
    spell?.levels.filter((l) => l.level <= current.level).at(-1) ??
    spell?.levels[0];
  const rows = useMemo(
    () =>
      [current, ...builds].map((b) => {
        if (
          !level ||
          b.classId !== current.classId ||
          b.gameVersion !== current.gameVersion ||
          b.level < level.level
        )
          return { build: b, result: null };
        const sameConditions = {
          ...b,
          buffs: current.buffs,
          target: current.target,
        };
        return {
          build: b,
          result: simulateSpell(
            level,
            calculateBuild(sameConditions, items, sets).total,
            current.target,
          ),
        };
      }),
    [current, builds, level, items, sets],
  );
  const reference = rows[0]?.result?.expected;
  return (
    <section className="damage-comparison">
      <h3>Identischer Zauber, identisches Ziel</h3>
      <div className="builder-form-grid">
        <label>
          Vergleichszauber
          <select
            value={spellId}
            onChange={(e) => {
              setSpellId(+e.target.value);
              setRank(0);
            }}
          >
            {spells.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Zauberrang
          <select
            value={level?.id ?? ""}
            onChange={(e) => setRank(+e.target.value)}
          >
            {spell?.levels.map((l) => (
              <option key={l.id} value={l.id}>
                Rang {l.grade} · Stufe {l.level}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <p className="muted">
        Ziel: {current.target.name} · Abstand {current.target.distance} ·{" "}
        {current.gameVersion}. Alle Spalten verwenden die Buffs des aktuellen
        Entwurfs.
      </p>
      <div className="build-comparison">
        <table>
          <thead>
            <tr>
              <th>Build</th>
              <th>Normal</th>
              <th>Kritisch</th>
              <th>Erwartungswert</th>
              <th>Veränderung</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ build, result }) => (
              <tr key={build.id}>
                <td>{build.name}</td>
                <td>
                  {result?.normalTotal
                    ? `${result.normalTotal.min}–${result.normalTotal.max}`
                    : "Nicht vergleichbar / nicht vollständig unterstützt"}
                </td>
                <td>
                  {result?.criticalTotal
                    ? `${result.criticalTotal.min}–${result.criticalTotal.max}`
                    : "—"}
                </td>
                <td>{result?.expected?.toFixed(2) ?? "—"}</td>
                <td
                  className={
                    result?.expected != null && reference != null
                      ? result.expected >= reference
                        ? "positive"
                        : "negative"
                      : ""
                  }
                >
                  {result?.expected != null && reference != null
                    ? `${result.expected - reference >= 0 ? "+" : ""}${(result.expected - reference).toFixed(2)}${reference ? ` (${(((result.expected - reference) / reference) * 100).toFixed(1)} %)` : ""}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
