import { useEffect, useState } from "react";
import {
  simulateSpell,
  type BuilderSpell,
  type BuilderItem,
  type SpellLevel,
  type SpellEffect,
  type BuildInput,
  type Stats,
} from "@dofus/core";
import { cached, type Config } from "../client";
export function weaponLevel(item: BuilderItem): SpellLevel | null {
  if (!item.weapon) return null;
  const elements: Record<number, string> = {
    189: "air",
    194: "earth",
    195: "neutral",
    198: "fire",
    214: "water",
  };
  const effects = item.effects
    .filter((e) => e.active)
    .map(
      (e) =>
        ({
          actionId: e.id,
          min: e.min,
          max: e.max,
          description: e.label,
          element: elements[e.id],
          kind: elements[e.id] ? "damage" : undefined,
          supported: !!elements[e.id],
          reason: elements[e.id]
            ? undefined
            : "Waffenspezialeffekt nicht unterstützt",
          targetMask: "",
          duration: 0,
          delay: 0,
          zone: {},
        }) as SpellEffect,
    );
  return {
    id: item.id,
    grade: 1,
    level: item.level,
    ap: item.weapon.ap,
    minRange: item.weapon.minRange,
    maxRange: item.weapon.maxRange,
    critical: item.weapon.critical,
    effects,
    criticalEffects: effects.map((e) => ({
      ...e,
      min: e.min + item.weapon!.criticalBonus,
      max: e.max + item.weapon!.criticalBonus,
    })),
    restrictions: {},
  };
}
export default function SpellSimulator({
  config,
  build,
  stats,
  weapon,
  onBuff,
}: {
  config: Config;
  build: BuildInput;
  stats: Stats;
  weapon?: BuilderItem;
  onBuff: (spell: BuilderSpell, level: SpellLevel) => void;
}) {
  const [spells, setSpells] = useState<BuilderSpell[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [ranks, setRanks] = useState<Record<number, number>>({}),
    [kind, setKind] = useState("spells");
  useEffect(() => {
    let cancelled = false;
    setError("");
    void cached<BuilderSpell[]>(
      `/api/builder/spells?version=${build.gameVersion}&classId=${build.classId}`,
      config,
    )
      .then((r) => {
        if (!cancelled) setSpells(r.data);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [build.gameVersion, build.classId, config]);
  const selected =
    kind === "weapon"
      ? weapon && weaponLevel(weapon)
        ? [
            {
              id: weapon.id,
              classId: build.classId,
              name: weapon.name,
              nameFr: weapon.name,
              nameEn: weapon.name,
              description: "Waffenschaden",
              icon: weapon.imageUrl ?? "",
              version: build.gameVersion,
              variants: [],
              levels: [weaponLevel(weapon)!],
            },
          ]
        : []
      : spells.filter((s) =>
          [s.name, s.nameFr, s.nameEn].some((n) =>
            n.toLowerCase().includes(query.toLowerCase()),
          ),
        );
  return (
    <section className="panel spell-simulator">
      <header>
        <div>
          <span className="eyebrow">TRAININGSRAUM · {build.gameVersion}</span>
          <h2>Zauber & Waffenschaden</h2>
        </div>
        <span className="pill">{spells.length} Klassensprüche</span>
      </header>
      <div className="toolbar">
        <button
          className={kind === "spells" ? "" : "secondary"}
          onClick={() => setKind("spells")}
        >
          Zauber anzeigen
        </button>
        <button
          className={kind === "weapon" ? "" : "secondary"}
          onClick={() => setKind("weapon")}
        >
          Waffen anzeigen
        </button>
        <input
          aria-label="Zauber suchen"
          placeholder="Zauber suchen …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <p className="muted">
        Direkte Einzeltreffer gegen die gespeicherten Gegnerbedingungen.
        Bedingte Effekte, Zustände, Portale, Bomben, Glyphen und
        Flächenschadensabfall werden nicht als exakte Gesamtsumme ausgegeben.
        Buffs sind ausdrücklich aktivierte Simulationsannahmen.
      </p>
      {error && <p role="alert">{error}</p>}
      {!selected.length && (
        <div className="empty">
          {kind === "weapon"
            ? "Rüste eine Waffe aus, um deren Schaden zu prüfen."
            : "Keine Zauber gefunden."}
        </div>
      )}
      <div className="spell-grid">
        {selected.map((spell) => {
          const available = spell.levels.filter((l) => l.level <= build.level);
          const level =
            spell.levels.find((l) => l.id === ranks[spell.id]) ??
            available[available.length - 1] ??
            spell.levels[0];
          if (!level)
            return (
              <article key={spell.id}>
                Zauber {spell.name}: Stufen fehlen
              </article>
            );
          const result = simulateSpell(
            level,
            stats,
            build.target,
            kind === "weapon",
          );
          return (
            <article className="spell-card" key={spell.id}>
              <header>
                {spell.icon && <img loading="lazy" src={spell.icon} alt="" />}
                <div>
                  <h3>{spell.name}</h3>
                  <small>
                    #{spell.id} · {spell.version} · {level.ap} AP · RW{" "}
                    {level.minRange}–{level.maxRange}
                  </small>
                </div>
              </header>
              <p>{spell.description}</p>
              <label>
                Zauberrang
                <select
                  value={level.id}
                  onChange={(e) =>
                    setRanks((r) => ({
                      ...r,
                      [spell.id]: Number(e.target.value),
                    }))
                  }
                >
                  {spell.levels.map((l) => (
                    <option
                      key={l.id}
                      value={l.id}
                      disabled={l.level > build.level}
                    >
                      Rang {l.grade} · Stufe {l.level}
                      {l.level > build.level ? " (noch gesperrt)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {level.level > build.level && (
                <p className="warning-text">Benötigt Stufe {level.level}</p>
              )}
              <div className="damage-columns">
                {(["normal", "critical"] as const).map((mode) => (
                  <div key={mode}>
                    <h4>{mode === "normal" ? "Normal" : "Kritisch"}</h4>
                    {result[mode].map((line, index) => (
                      <div
                        className={`damage-line ${line.effect.element ?? ""}`}
                        key={index}
                      >
                        <small>
                          {line.effect.kind ?? "Spezialeffekt"} · Effekt{" "}
                          {line.effect.actionId}
                          {line.effect.element
                            ? " · " + line.effect.element
                            : ""}
                        </small>
                        {line.result ? (
                          <>
                            <strong>
                              {line.result.min} – {line.result.max}
                            </strong>
                            <small>
                              Ø {line.result.average.toFixed(1)} · ohne
                              Resistenz {line.result.withoutResistance.min}–
                              {line.result.withoutResistance.max}
                            </small>
                            {line.result.steal && (
                              <small>
                                Möglicher Lebensraub: {line.result.steal.min}–
                                {line.result.steal.max}
                              </small>
                            )}
                          </>
                        ) : (
                          <small className="warning-text">
                            {line.effect.reason ||
                              line.effect.description ||
                              "Diese Werte sind nicht verifiziert berechenbar."}
                          </small>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <footer>
                <span>KT {(result.probability * 100).toFixed(1)} %</span>
                <strong>
                  Erwarteter Schaden:{" "}
                  {result.expected === null
                    ? "nicht vollständig unterstützt"
                    : result.expected.toFixed(1)}
                </strong>
              </footer>
              {spell.variants.length > 0 && (
                <small>Varianten: {spell.variants.join(", ")}</small>
              )}
              {level.effects.some((e) => e.kind === "buff") && (
                <button
                  className="secondary"
                  onClick={() => onBuff(spell, level)}
                >
                  Buff als Annahme übernehmen
                </button>
              )}
              <details>
                <summary>Quelldaten & Einschränkungen</summary>
                <pre>
                  {JSON.stringify(
                    {
                      restrictions: level.restrictions,
                      effects: level.effects,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
