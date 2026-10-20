import {
  calculateBuild,
  compatible,
  effectStats,
  simulateSpell,
  matchesEffects,
  type EffectFilter,
  type SpellLevel,
  type BuildInput,
  type BuilderItem,
  type BuilderSet,
  type Stats,
} from "./builder.js";
export interface OptimizeOptions {
  objectiveMode?: "stat" | "damage" | "balanced" | "hybrid" | "cost";
  spell?: SpellLevel;
  minimumDamage?: number;
  effectFilters?: EffectFilter[];
  effectMode?: "and" | "or";
  objective: number;
  minimums: Stats;
  excluded: number[];
  preferred: number[];
  lockedSlots: string[];
  allowedDofus: number[] | null;
  budget: number | null;
  allowExoAP: boolean;
  allowExoMP: boolean;
  width?: number;
}
/** Deterministic bounded beam search. No claim of exhaustive/global optimality. */
export function optimizeBuild(
  build: BuildInput,
  items: BuilderItem[],
  sets: BuilderSet[],
  options: OptimizeOptions,
  progress: (v: number) => void = () => {},
) {
  const itemMap = new Map(items.map((i) => [i.id, i])),
    setMap = new Map(sets.map((s) => [s.id, s]));
  let assessed = 0;
  const damage = (c: ReturnType<typeof calculateBuild>) =>
    options.spell
      ? simulateSpell(options.spell, c.total, build.target).expected
      : null;
  const valueOf = (stats: Stats) =>
    options.objectiveMode === "balanced"
      ? Math.min(...[34, 63, 37, 17, 16].map((id) => stats[id] ?? 0)) * 10
      : options.objectiveMode === "hybrid"
        ? [45, 13, 22, 36]
            .map((id) => stats[id] ?? 0)
            .sort((a, b) => b - a)
            .slice(0, 2)
            .reduce((s, v) => s + v, 0)
        : (stats[options.objective] ?? 0);
  const score = (b: BuildInput) => {
    const c = calculateBuild(b, itemMap, setMap);
    const predicted = damage(c);
    let value =
      options.objectiveMode === "damage"
        ? (predicted ?? -100000)
        : options.objectiveMode === "cost"
          ? -Object.values(b.equipment).reduce(
              (s, x) => s + (b.prices[x.itemId] ?? 1000000000),
              0,
            ) / 1000
          : valueOf(c.total);
    if (options.minimumDamage && predicted !== null)
      value -= Math.max(0, options.minimumDamage - predicted) * 100;
    value -= c.unknown.length * 100000;
    for (const [id, cap] of [
      [12, 12],
      [8, 6],
      [31, 6],
    ])
      value -= Math.max(0, (c.permanent[id] ?? 0) - cap) * 2000;
    for (const [id, min] of Object.entries(options.minimums))
      value -= Math.max(0, min - (c.total[+id] ?? 0)) * 500;
    for (const x of Object.values(b.equipment))
      if (options.preferred.includes(x.itemId)) value += 10;
    for (const s of c.activeSets) value += s.count > 1 ? 3 : 0;
    return value;
  };
  const pool = items.filter(
    (i) =>
      i.version === build.gameVersion &&
      i.level <= build.level &&
      i.effectsKnown &&
      matchesEffects(
        i.effects,
        options.effectFilters ?? [],
        options.effectMode ?? "and",
      ) &&
      (options.objectiveMode !== "cost" || build.prices[i.id] !== undefined) &&
      !options.excluded.includes(i.id),
  );
  let beam = [
    {
      ...build,
      equipment: Object.fromEntries(
        Object.entries(build.equipment).filter(([s]) =>
          options.lockedSlots.includes(s),
        ),
      ),
    },
  ];
  const slots = [
    "amulet",
    "hat",
    "cape",
    "belt",
    "boots",
    "weapon",
    "shield",
    "companion",
    "ring1",
    "ring2",
    "dofus1",
    "dofus2",
    "dofus3",
    "dofus4",
    "dofus5",
    "dofus6",
  ].filter((s) => !options.lockedSlots.includes(s));
  for (const [index, slot] of slots.entries()) {
    const candidates = pool
      .filter(
        (i) =>
          compatible(i, slot) &&
          (!slot.startsWith("dofus") ||
            !options.allowedDofus ||
            options.allowedDofus.includes(i.id)),
      )
      .sort((a, b) => {
        const rank = (i: BuilderItem) => {
          const stats = effectStats(i.effects);
          return (
            (options.objectiveMode === "damage"
              ? [45, 13, 22, 36, 32].reduce(
                  (s, id) => s + (stats[id] ?? 0),
                  0,
                ) +
                [30, 49, 48, 61, 27, 47].reduce(
                  (s, id) => s + (stats[id] ?? 0) * 5,
                  0,
                )
              : valueOf(stats)) +
            Object.entries(options.minimums).reduce(
              (s, [id, min]) =>
                s +
                Math.min(min, Math.max(0, stats[+id] ?? 0)) *
                  (+id === 12 || +id === 8 ? 200 : 1),
              0,
            ) +
            (options.preferred.includes(i.id) ? 1000 : 0)
          );
        };
        return rank(b) - rank(a) || a.id - b.id;
      })
      .slice(0, 18);
    const next: { b: BuildInput; s: number }[] = [];
    for (const b of beam)
      for (const item of [null, ...candidates]) {
        if (
          item &&
          Object.values(b.equipment).some((x) => x.itemId === item.id) &&
          (item.setId !== null || slot.startsWith("dofus"))
        )
          continue;
        const candidate = {
          ...b,
          equipment: {
            ...b.equipment,
            ...(item
              ? { [slot]: { itemId: item.id, rolls: {}, exos: {} } }
              : {}),
          },
        };
        assessed++;
        if (options.budget !== null) {
          const equipment = Object.values(candidate.equipment);
          if (
            equipment.some((x) => candidate.prices[x.itemId] === undefined) ||
            equipment.reduce(
              (s, x) => s + (candidate.prices[x.itemId] ?? 0),
              0,
            ) > options.budget
          )
            continue;
        }
        next.push({ b: candidate, s: score(candidate) });
      }
    next.sort(
      (a, b) =>
        b.s - a.s ||
        JSON.stringify(a.b.equipment).localeCompare(
          JSON.stringify(b.b.equipment),
        ),
    );
    beam = next
      .slice(0, Math.min(200, Math.max(10, options.width ?? 60)))
      .map((x) => x.b);
    progress(Math.round(((index + 1) / slots.length) * 100));
    if (!beam.length) break;
  }
  for (const b of beam)
    for (const [id, allow] of [
      [12, options.allowExoAP],
      [8, options.allowExoMP],
    ] as const) {
      if (!allow) continue;
      const c = calculateBuild(b, itemMap, setMap);
      if ((c.total[id] ?? 0) >= (options.minimums[id] ?? 0)) continue;
      const slot = Object.entries(b.equipment).find(
        ([s, x]) =>
          !s.startsWith("dofus") &&
          s !== "companion" &&
          !options.lockedSlots.includes(s) &&
          !itemMap.get(x.itemId)!.effects.some((e) => e.id === id),
      );
      if (slot)
        b.equipment[slot[0]] = {
          ...slot[1],
          exos: { ...slot[1].exos, [id]: 1 },
        };
    }
  const evaluated = beam.map((b) => ({
    build: b,
    calculation: calculateBuild(b, itemMap, setMap),
    score: score(b),
    damage: damage(calculateBuild(b, itemMap, setMap)),
  }));
  const results = evaluated
    .filter(
      (r) =>
        r.calculation.valid &&
        (options.objectiveMode !== "damage" || r.damage !== null) &&
        (!options.minimumDamage ||
          (r.damage !== null && r.damage >= options.minimumDamage)) &&
        Object.entries(options.minimums).every(
          ([id, min]) => (r.calculation.total[+id] ?? 0) >= min,
        ),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const best = evaluated.sort((a, b) => b.score - a.score)[0];
  const unmet = best
    ? Object.entries(options.minimums)
        .filter(([id, min]) => (best.calculation.total[+id] ?? 0) < min)
        .map(([id, min]) => ({
          id: +id,
          requested: min,
          found: best.calculation.total[+id] ?? 0,
        }))
    : [];
  return {
    results,
    assessed,
    unmet,
    warnings: best?.calculation.warnings ?? [],
    message: results.length
      ? "Gültige Vorschläge im begrenzten Suchraum."
      : "Keine gültige Kombination im geprüften Suchraum. Kriterien reduzieren oder Kandidaten/Preise ergänzen.",
    bounded: true,
  };
}
