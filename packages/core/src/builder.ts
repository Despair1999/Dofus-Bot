import { z } from "zod";

export const statDefinitions = [
  [12, "AP", "Grundwerte"],
  [8, "MP", "Grundwerte"],
  [9, "Vitalität", "Grundwerte"],
  [10, "Weisheit", "Grundwerte"],
  [45, "Stärke", "Grundwerte"],
  [13, "Intelligenz", "Grundwerte"],
  [22, "Chance", "Grundwerte"],
  [36, "Beweglichkeit", "Grundwerte"],
  [32, "Power", "Grundwerte"],
  [24, "Initiative", "Weitere Werte"],
  [29, "Kritische Treffer %", "Weitere Werte"],
  [31, "Reichweite", "Weitere Werte"],
  [28, "Beschwörungen", "Weitere Werte"],
  [25, "Prospektion", "Weitere Werte"],
  [121, "Heilung", "Weitere Werte"],
  [26, "Tackle", "Weitere Werte"],
  [59, "Flucht", "Weitere Werte"],
  [64, "AP-Entzug", "Weitere Werte"],
  [50, "MP-Entzug", "Weitere Werte"],
  [75, "AP-Resistenz", "Weitere Werte"],
  [39, "MP-Resistenz", "Weitere Werte"],
  [30, "Allgemeiner Schaden", "Schaden"],
  [49, "Neutralschaden", "Schaden"],
  [48, "Erdschaden", "Schaden"],
  [61, "Feuerschaden", "Schaden"],
  [27, "Wasserschaden", "Schaden"],
  [47, "Luftschaden", "Schaden"],
  [38, "Kritischer Schaden", "Schaden"],
  [62, "Pushback-Schaden", "Schaden"],
  [93, "Zauberschaden %", "Schaden"],
  [41, "Waffenschaden %", "Schaden"],
  [71, "Distanzschaden %", "Schaden"],
  [40, "Nahkampfschaden %", "Schaden"],
  [106, "Fallen-Power", "Schaden"],
  [112, "Fallenschaden", "Schaden"],
  [34, "Neutralresistenz %", "Resistenzen"],
  [63, "Erdresistenz %", "Resistenzen"],
  [37, "Feuerresistenz %", "Resistenzen"],
  [17, "Wasserresistenz %", "Resistenzen"],
  [16, "Luftresistenz %", "Resistenzen"],
  [33, "Neutralresistenz fix", "Resistenzen"],
  [15, "Erdresistenz fix", "Resistenzen"],
  [14, "Feuerresistenz fix", "Resistenzen"],
  [82, "Wasserresistenz fix", "Resistenzen"],
  [60, "Luftresistenz fix", "Resistenzen"],
  [46, "Kritische Resistenz", "Resistenzen"],
  [70, "Pushback-Resistenz", "Resistenzen"],
  [108, "Distanzresistenz %", "Resistenzen"],
  [65, "Nahkampfresistenz %", "Resistenzen"],
] as const;
export type Stats = Record<number, number>;
export const classAssets = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20].map(
    (id) => [
      id,
      { portrait: `/classes/${id}.webp`, icon: `/classes/${id}-thumb.webp` },
    ],
  ),
);
export interface NumericEffect {
  id: number;
  min: number;
  max: number;
  label: string;
  active?: boolean;
}
export const slotDefinitions = [
  ["hat", "Hut"],
  ["cape", "Umhang"],
  ["amulet", "Amulett"],
  ["ring1", "Ring 1"],
  ["ring2", "Ring 2"],
  ["belt", "Gürtel"],
  ["boots", "Stiefel"],
  ["weapon", "Waffe"],
  ["shield", "Schild"],
  ["companion", "Reittier / Begleiter"],
  ...Array.from({ length: 6 }, (_, i) => [
    `dofus${i + 1}`,
    `Dofus / Trophäe ${i + 1}`,
  ]),
] as [string, string][];
export interface BuilderItem {
  id: number;
  name: string;
  level: number;
  typeId: number;
  type: string;
  imageUrl?: string;
  setId: number | null;
  setName: string;
  requirements: string;
  slots: string[];
  effects: NumericEffect[];
  effectsKnown: boolean;
  weapon?: {
    ap: number;
    minRange: number;
    maxRange: number;
    critical: number;
    criticalBonus: number;
  };
  version: string;
}
export interface BuilderSet {
  id: number;
  name: string;
  tiers: Record<number, NumericEffect[]>;
}
export interface SpellEffect {
  actionId: number;
  min: number;
  max: number;
  description: string;
  element?: string;
  kind?: "damage" | "steal" | "heal" | "buff";
  statId?: number;
  supported: boolean;
  reason?: string;
  targetMask: string;
  duration: number;
  delay: number;
  zone: Record<string, unknown>;
}
export interface SpellLevel {
  id: number;
  grade: number;
  level: number;
  ap: number;
  minRange: number;
  maxRange: number;
  critical: number;
  effects: SpellEffect[];
  criticalEffects: SpellEffect[];
  restrictions: Record<string, unknown>;
}
export interface BuilderSpell {
  id: number;
  classId: number;
  name: string;
  nameFr: string;
  nameEn: string;
  description: string;
  icon: string;
  version: string;
  variants: number[];
  levels: SpellLevel[];
}
const statsSchema = z.record(
  z.string().regex(/^\d+$/),
  z.number().int().min(-100000).max(100000),
);
const targetSchema = z.object({
  name: z.string().max(100).default("Keine Resistenzen"),
  hp: z.number().int().min(1).max(10000000).default(10000),
  percent: statsSchema.default(() => ({})),
  fixed: statsSchema.default(() => ({})),
  critical: z.number().int().min(-1000).max(1000).default(0),
  pushback: z.number().int().min(-1000).max(1000).default(0),
  distance: z.number().int().min(1).max(100).default(1),
  mode: z.enum(["pvp", "pvm"]).default("pvm"),
});
export const buildInput = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(2000).default(""),
  characterId: z.string().uuid().nullable().default(null),
  classId: z.number().int().min(1).max(20),
  level: z.number().int().min(1).max(200),
  gameVersion: z.enum(["3.6.12.16", "3.7.12.12"]),
  element: z
    .enum(["neutral", "earth", "fire", "water", "air", "hybrid"])
    .default("earth"),
  equipment: z
    .record(
      z.string().min(1).max(20),
      z.object({
        itemId: z.number().int().positive(),
        rolls: statsSchema.default(() => ({})),
        exos: statsSchema.default(() => ({})),
      }),
    )
    .refine(
      (e) =>
        Object.keys(e).every((k) => slotDefinitions.some((s) => s[0] === k)),
      "Unbekannter Slot",
    )
    .default(() => ({})),
  characteristics: statsSchema.default(() => ({})),
  scroll: statsSchema.default(() => ({})),
  prices: z
    .record(z.string().regex(/^\d+$/), z.number().min(0).max(1000000000000))
    .default(() => ({})),
  buffs: z
    .array(
      z.object({
        id: z.string().max(100),
        name: z.string().max(100),
        active: z.boolean(),
        stats: statsSchema,
        spellId: z.number().int().positive().optional(),
        version: z.string().max(30).optional(),
      }),
    )
    .max(100)
    .default(() => []),
  target: targetSchema.default(() => targetSchema.parse({})),
  active: z.boolean().default(false),
});
export type BuildInput = z.infer<typeof buildInput>;
export type Build = BuildInput & {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export const effectFilterSchema = z
  .object({
    id: z.number().int().min(0).max(10000),
    min: z.number().min(-100000).max(100000).optional(),
    max: z.number().min(-100000).max(100000).optional(),
    absent: z.boolean().default(false),
  })
  .refine(
    (f) => f.min === undefined || f.max === undefined || f.min <= f.max,
    "Ungültiger Wertebereich",
  );
export type EffectFilter = z.infer<typeof effectFilterSchema>;
export function decodeEffectFilters(raw?: string): EffectFilter[] {
  try {
    return raw
      ? z.array(effectFilterSchema).max(50).parse(JSON.parse(raw))
      : [];
  } catch {
    return [];
  }
}
/** Shared parameterized SQLite predicate for catalog, picker and optimizer candidates. */
export function effectSQL(
  filters: EffectFilter[],
  mode: string,
  itemColumn = "catalog_items.id",
  version = "3.7.12.12",
) {
  if (!["catalog_items.id", "builder_items.id"].includes(itemColumn))
    throw Error("Invalid item column");
  const params: (string | number)[] = [];
  const clauses = filters.map((f) => {
    params.push(version, f.id);
    let clause = `EXISTS(SELECT 1 FROM builder_item_effects e WHERE e.version=? AND e.item_id=${itemColumn} AND e.effect_id=? AND e.active=0`;
    if (!f.absent && f.min !== undefined) {
      clause += " AND e.value_max>=?";
      params.push(f.min);
    }
    if (!f.absent && f.max !== undefined) {
      clause += " AND e.value_min<=?";
      params.push(f.max);
    }
    return (f.absent ? "NOT " : "") + clause + ")";
  });
  return {
    clause: clauses.length
      ? `EXISTS(SELECT 1 FROM builder_effect_coverage c WHERE c.version=? AND c.item_id=${itemColumn}) AND (` +
        clauses.join(mode === "or" ? " OR " : " AND ") +
        ")"
      : "1",
    params: clauses.length ? [version, ...params] : params,
  };
}
export function matchesEffects(
  effects: NumericEffect[],
  filters: EffectFilter[],
  mode: "and" | "or" = "and",
) {
  const matches = filters.map((f) => {
    const e = effects.find((e) => e.id === f.id && !e.active);
    if (f.absent) return !e;
    return (
      !!e &&
      (f.min === undefined || e.max >= f.min) &&
      (f.max === undefined || e.min <= f.max)
    );
  });
  return (
    !matches.length ||
    (mode === "and" ? matches.every(Boolean) : matches.some(Boolean))
  );
}
const add = (to: Stats, from: Stats) => {
  for (const [id, v] of Object.entries(from))
    to[Number(id)] = (to[Number(id)] ?? 0) + v;
};
export function effectStats(
  effects: NumericEffect[],
  rolls: Stats = {},
): Stats {
  const stats: Stats = {};
  for (const e of effects)
    if (!e.active && statDefinitions.some((s) => s[0] === e.id))
      stats[e.id] = (stats[e.id] ?? 0) + (rolls[e.id] ?? e.max);
  return stats;
}
export function compatible(item: BuilderItem, slot: string) {
  return item.slots.includes(
    slot.replace(/^ring[12]$/, "ring").replace(/^dofus[1-6]$/, "dofus"),
  );
}
export function characteristicCost(value: number, stat: number) {
  if (stat === 9) return value;
  if (stat === 10) return value * 3;
  return (
    Math.min(value, 100) +
    Math.max(0, Math.min(value - 100, 100)) * 2 +
    Math.max(0, Math.min(value - 200, 100)) * 3 +
    Math.max(0, value - 300) * 4
  );
}
/** Evaluates only the audited characteristic criterion grammar. Unknown criteria stay unknown. */
export function requirementStatus(
  expression: string,
  stats: Stats,
  level: number,
): boolean | null {
  if (!expression) return true;
  const keys: Record<string, number> = {
    CS: 45,
    CI: 13,
    CC: 22,
    CA: 36,
    CW: 10,
    CV: 9,
    CP: 12,
    CM: 8,
    PO: 31,
  };
  const tokens = expression.match(/[A-Za-z]{2}[!<>=]+-?\d+|[&|()]/g) ?? [];
  if (tokens.join("") !== expression.replace(/\s/g, "")) return null;
  let i = 0;
  let unknown = false;
  const atom = (): boolean => {
    const t = tokens[i++];
    if (t === "(") {
      const v = or();
      if (tokens[i++] !== ")") throw Error();
      return v;
    }
    const m = t?.match(/^([A-Za-z]{2})([!<>=]+)(-?\d+)$/);
    if (!m) throw Error();
    const n =
      m[1] === "PL"
        ? level
        : keys[m[1]] !== undefined
          ? (stats[keys[m[1]]] ?? 0)
          : NaN;
    if (!Number.isFinite(n)) {
      unknown = true;
      return true;
    }
    const x = Number(m[3]);
    return m[2] === ">"
      ? n > x
      : m[2] === "<"
        ? n < x
        : m[2] === "="
          ? n === x
          : m[2] === "!"
            ? n !== x
            : m[2] === ">="
              ? n >= x
              : m[2] === "<="
                ? n <= x
                : ((unknown = true), true);
  };
  const and = (): boolean => {
    let v = atom();
    while (tokens[i] === "&") {
      i++;
      const r = atom();
      v = v && r;
    }
    return v;
  };
  const or = (): boolean => {
    let v = and();
    while (tokens[i] === "|") {
      i++;
      const r = and();
      v = v || r;
    }
    return v;
  };
  try {
    const result = or();
    return i === tokens.length && !unknown ? result : null;
  } catch {
    return null;
  }
}
export function calculateBuild(
  build: BuildInput,
  items: Map<number, BuilderItem>,
  sets: Map<number, BuilderSet>,
) {
  const base: Stats = { 12: build.level >= 100 ? 7 : 6, 8: 3, 28: 1, 25: 100 };
  const equipment: Stats = {},
    bonuses: Stats = {},
    buffs: Stats = {};
  const warnings: string[] = [],
    unknown: string[] = [];
  const setCounts = new Map<number, Set<number>>(),
    seen = new Set<number>();
  const exos: Stats = {};
  let spent = 0;
  for (const [id, v] of Object.entries(build.characteristics)) {
    if (![9, 10, 45, 13, 22, 36].includes(+id) || v < 0) {
      warnings.push("Ungültige Eigenschaftspunkte");
      continue;
    }
    spent += characteristicCost(v, +id);
    base[+id] = (base[+id] ?? 0) + v;
  }
  if (spent > 5 * (build.level - 1))
    warnings.push(
      `Eigenschaftspunkte überschritten: ${spent} / ${5 * (build.level - 1)}`,
    );
  for (const [id, v] of Object.entries(build.scroll)) {
    if (![9, 10, 45, 13, 22, 36].includes(+id) || v < 0 || v > 100)
      warnings.push("Scrollwert außerhalb 0–100");
    else base[+id] = (base[+id] ?? 0) + v;
  }
  for (const [slot, instance] of Object.entries(build.equipment)) {
    const item = items.get(instance.itemId);
    if (!item) {
      warnings.push(`Gegenstand ${instance.itemId} fehlt in diesem Datenstand`);
      continue;
    }
    if (item.version !== build.gameVersion)
      warnings.push(`${item.name}: abweichende Datenversion`);
    if (!compatible(item, slot))
      warnings.push(`${item.name}: inkompatibler Slot`);
    if (
      (slot.startsWith("dofus") || slot === "companion") &&
      (Object.values(instance.exos).some((v) => v !== 0) ||
        Object.entries(instance.rolls).some(
          ([id, v]) => v !== item.effects.find((e) => e.id === +id)?.max,
        ))
    )
      warnings.push(
        `${item.name}: Schmiedmagie für Dofus/Trophäen/Begleiter nicht zulässig`,
      );
    if (item.level > build.level)
      warnings.push(`${item.name}: benötigt Stufe ${item.level}`);
    if (seen.has(item.id) && (item.setId !== null || slot.startsWith("dofus")))
      warnings.push(`${item.name}: nicht mehrfach ausrüstbar`);
    seen.add(item.id);
    if (!item.effectsKnown) unknown.push(`${item.name}: Effekte fehlen`);
    add(equipment, effectStats(item.effects, instance.rolls));
    add(equipment, instance.exos);
    add(exos, instance.exos);
    for (const e of item.effects) {
      const roll = instance.rolls[e.id];
      if (roll !== undefined) {
        if (e.min >= 0 && roll < 0)
          warnings.push(`${item.name}: negativer Roll für positiven Effekt`);
        if ([12, 8, 31].includes(e.id) && roll > e.max)
          exos[e.id] = (exos[e.id] ?? 0) + roll - e.max;
      }
    }
    if (Object.values(instance.exos).some((v) => v < 0))
      warnings.push(
        `${item.name}: negative Exomagie nicht als gültige Ausrüstung verifiziert`,
      );
    const metadata = new Set([
      0, 1, 35, 76, 80, 81, 83, 84, 92, 115, 117, 128, 139, 157, 191, 222,
    ]);
    if (
      item.effects.some(
        (e) =>
          !statDefinitions.some((s) => s[0] === e.id) &&
          !metadata.has(e.id) &&
          !(
            item.weapon &&
            e.active &&
            [189, 194, 195, 198, 214].includes(e.id)
          ),
      )
    )
      unknown.push(
        `${item.name}: spezielle Effekte nicht vollständig modelliert`,
      );
    if (item.setId !== null) {
      const ids = setCounts.get(item.setId) ?? new Set();
      ids.add(item.id);
      setCounts.set(item.setId, ids);
    }
  }
  const activeSets: {
    id: number;
    name: string;
    count: number;
    effects: NumericEffect[];
  }[] = [];
  for (const [id, ids] of setCounts) {
    const set = sets.get(id);
    if (!set) {
      if (ids.size > 1) unknown.push(`Set ${id}: Boni fehlen`);
      continue;
    }
    const tier = Object.keys(set.tiers)
      .map(Number)
      .filter((n) => n <= ids.size)
      .sort((a, b) => b - a)[0];
    const effects = set.tiers[tier] ?? [];
    add(bonuses, effectStats(effects));
    activeSets.push({ id, name: set.name, count: ids.size, effects });
  }
  for (const buff of build.buffs)
    if (buff.active) {
      if (buff.version && buff.version !== build.gameVersion)
        warnings.push(`${buff.name}: abweichende Buffversion`);
      else add(buffs, buff.stats);
    }
  const permanent = { ...base };
  add(permanent, equipment);
  add(permanent, bonuses);
  const total = { ...permanent };
  add(total, buffs);
  total[24] =
    (total[24] ?? 0) +
    [45, 13, 22, 36].reduce((s, id) => s + (total[id] ?? 0), 0);
  total[25] = (total[25] ?? 0) + Math.floor((total[22] ?? 0) / 10);
  for (const id of [75, 39, 64, 50])
    total[id] = (total[id] ?? 0) + Math.floor((total[10] ?? 0) / 10);
  for (const id of [26, 59])
    total[id] = (total[id] ?? 0) + Math.floor((total[36] ?? 0) / 10);
  for (const [id, max] of [
    [12, 12],
    [8, 6],
    [31, 6],
  ])
    if ((permanent[id] ?? 0) > max)
      warnings.push(
        `${statDefinitions.find((s) => s[0] === id)?.[1]} über Ausrüstungsgrenze ${max}`,
      );
  for (const id of [12, 8, 31])
    if ((exos[id] ?? 0) > 1)
      warnings.push("Exomagie-Grenze: höchstens +1 AP / MP / RW");
  for (const instance of Object.values(build.equipment)) {
    const item = items.get(instance.itemId);
    if (!item) continue;
    const result = requirementStatus(item.requirements, permanent, build.level);
    if (result === false)
      warnings.push(
        `${item.name}: Voraussetzung nicht erfüllt (${item.requirements})`,
      );
    if (result === null)
      unknown.push(
        `${item.name}: Bedingung nicht vollständig ausgewertet (${item.requirements})`,
      );
  }
  return {
    total,
    permanent,
    base,
    equipment,
    bonuses,
    buffs,
    hp: 50 + build.level * 5 + (total[9] ?? 0),
    activeSets,
    warnings,
    unknown,
    spent,
    valid: !warnings.length && !unknown.length,
  };
}
const elementStat: Record<string, number> = {
  neutral: 45,
  earth: 45,
  fire: 13,
  water: 22,
  air: 36,
};
const elementDamage: Record<string, number> = {
  neutral: 49,
  earth: 48,
  fire: 61,
  water: 27,
  air: 47,
};
/** Audited direct, immediate damage only; conditional, delayed and triggered lines return null. */
export function damageLine(
  effect: SpellEffect,
  stats: Stats,
  target: BuildInput["target"],
  critical = false,
  weapon = false,
) {
  if (
    !effect.supported ||
    !effect.element ||
    !["damage", "steal", "heal"].includes(effect.kind ?? "")
  )
    return null;
  const heal = effect.kind === "heal";
  const elemental = stats[elementStat[effect.element]!] ?? 0;
  const resistanceKey =
    effect.element === "neutral" ? 0 : elementStat[effect.element]!;
  if (
    effect.max - effect.min > 10000 ||
    effect.min < 0 ||
    elemental < 0 ||
    (stats[32] ?? 0) < 0
  )
    return null;
  const range = (base: number, resist: boolean) => {
    let value =
      Math.floor(
        (base *
          (100 +
            Math.max(0, elemental) +
            (heal ? 0 : Math.max(0, stats[32] ?? 0)))) /
          100,
      ) +
      (heal
        ? (stats[121] ?? 0)
        : (stats[30] ?? 0) +
          (stats[elementDamage[effect.element!]!] ?? 0) +
          (critical ? (stats[38] ?? 0) : 0));
    if (!heal) {
      value = Math.floor(
        (value * (100 + (stats[weapon ? 41 : 93] ?? 0))) / 100,
      );
      value = Math.floor(
        (value * (100 + (stats[target.distance <= 1 ? 40 : 71] ?? 0))) / 100,
      );
      if (resist) {
        value = Math.max(
          0,
          value -
            (target.fixed[resistanceKey] ?? 0) -
            (critical ? target.critical : 0),
        );
        const cap = target.mode === "pvp" ? 50 : 100;
        value = Math.floor(
          (value * (100 - Math.min(cap, target.percent[resistanceKey] ?? 0))) /
            100,
        );
      }
    }
    return Math.max(0, value);
  };
  const minimum = range(effect.min, true),
    maximum = range(effect.max, true);
  let sum = 0;
  for (let roll = effect.min; roll <= effect.max; roll++)
    sum += range(roll, true);
  return {
    min: minimum,
    max: maximum,
    average: sum / (effect.max - effect.min + 1),
    withoutResistance: {
      min: range(effect.min, false),
      max: range(effect.max, false),
    },
    steal:
      effect.kind === "steal"
        ? { min: Math.floor(minimum / 2), max: Math.floor(maximum / 2) }
        : null,
  };
}
export function simulateSpell(
  level: SpellLevel,
  stats: Stats,
  target: BuildInput["target"],
  weapon = false,
) {
  const unavailable =
    level.ap > (stats[12] ?? Infinity) ||
    !!level.restrictions.statesCriterion ||
    target.distance < level.minRange ||
    target.distance > level.maxRange + (weapon ? 0 : (stats[31] ?? 0));
  const prepare = (e: SpellEffect) =>
    unavailable
      ? {
          ...e,
          supported: false,
          reason:
            "Zustandsbedingung oder Zielreichweite ist nicht erfüllt / nicht verifiziert.",
        }
      : e;
  const normal = level.effects.map(prepare).map((e) => ({
    effect: e,
    result: damageLine(e, stats, target, false, weapon),
  }));
  const critical = level.criticalEffects.map(prepare).map((e) => ({
    effect: e,
    result: damageLine(e, stats, target, true, weapon),
  }));
  const complete = (lines: typeof normal) =>
    !lines.some((l) => !l.result && l.effect.kind !== "buff");
  const sum = (lines: typeof normal, key: "min" | "max" | "average") =>
    lines.reduce(
      (s, l) => s + (l.effect.kind === "heal" ? 0 : (l.result?.[key] ?? 0)),
      0,
    );
  const probability = level.criticalEffects.length
    ? Math.min(100, Math.max(0, level.critical + (stats[29] ?? 0))) / 100
    : 0;
  return {
    normal,
    critical,
    normalTotal: complete(normal)
      ? { min: sum(normal, "min"), max: sum(normal, "max") }
      : null,
    criticalTotal: complete(critical)
      ? { min: sum(critical, "min"), max: sum(critical, "max") }
      : null,
    probability,
    expected:
      complete(normal) && complete(critical)
        ? sum(normal, "average") * (1 - probability) +
          sum(critical, "average") * probability
        : null,
  };
}
