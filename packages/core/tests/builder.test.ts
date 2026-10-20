import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildInput,
  calculateBuild,
  compatible,
  damageLine,
  matchesEffects,
  requirementStatus,
  simulateSpell,
  type BuilderItem,
  type BuilderSet,
  type BuilderSpell,
  type SpellEffect,
  type SpellLevel,
} from "../src/index.js";
import { optimizeBuild } from "../src/optimizer.js";
const data = JSON.parse(
  readFileSync(
    new URL("../../game-data/assets/builder-data.json", import.meta.url),
    "utf8",
  ),
).versions as Record<
  string,
  {
    items: BuilderItem[];
    sets: BuilderSet[];
    spells: BuilderSpell[];
    report: {
      coverage: {
        classId: number;
        count: number;
        missingLevels: number[];
        missingIcons: number[];
      }[];
      unresolvedEffectReferences: string[];
    };
  }
>;
const version = "3.7.12.12",
  items = new Map(data[version].items.map((i) => [i.id, i])),
  sets = new Map(data[version].sets.map((s) => [s.id, s]));
const fresh = () =>
  buildInput.parse({
    name: "Prüfbuild",
    classId: 11,
    level: 200,
    gameVersion: version,
  });
const instance = (itemId: number) => ({ itemId, rolls: {}, exos: {} });
const direct = (changes: Partial<SpellEffect> = {}): SpellEffect => ({
  actionId: 99,
  min: 11,
  max: 13,
  description: "",
  element: "fire",
  kind: "damage",
  supported: true,
  targetMask: "a,A",
  duration: 0,
  delay: 0,
  zone: {},
  ...changes,
});
test("new builds never share mutable default equipment, targets, scrolls or buffs", () => {
  const a = fresh(),
    b = fresh();
  a.target.fixed[13] = 999;
  a.equipment.ring1 = instance(2469);
  a.scroll[45] = 100;
  a.buffs.push({ id: "one", name: "Manual", active: true, stats: { 32: 100 } });
  assert.deepEqual(b.target.fixed, {});
  assert.deepEqual(b.equipment, {});
  assert.deepEqual(b.scroll, {});
  assert.deepEqual(b.buffs, []);
});
test("temporary AP and MP buffs do not violate permanent equipment caps", () => {
  const b = fresh();
  b.buffs = [
    {
      id: "combat",
      name: "Manuelle Kampfannahme",
      active: true,
      stats: { 12: 7, 8: 4 },
    },
  ];
  const c = calculateBuild(b, items, sets);
  assert.equal(c.total[12], 14);
  assert.equal(c.total[8], 7);
  assert.equal(c.permanent[12], 7);
  assert.ok(!c.warnings.some((w) => w.includes("Ausrüstungsgrenze")));
});
test("Dofus and trophies cannot be certified with illegal maging", () => {
  const b = fresh();
  b.equipment.dofus1 = { itemId: 16333, rolls: {}, exos: { 8: 1 } };
  assert.ok(
    calculateBuild(b, items, sets).warnings.some((w) =>
      w.includes("Schmiedmagie"),
    ),
  );
});
test("source coverage: all 19 classes in each version, all levels/icons, no unresolved historical IDs", () => {
  for (const d of Object.values(data)) {
    assert.equal(d.report.coverage.length, 19);
    assert.ok(
      d.report.coverage.every(
        (c) =>
          c.count === 44 && !c.missingIcons.length && !c.missingLevels.length,
      ),
    );
    assert.deepEqual(d.report.unresolvedEffectReferences, []);
  }
});
test("original Gelano adds exactly one AP and removal restores the base", () => {
  const b = fresh();
  assert.equal(calculateBuild(b, items, sets).total[12], 7);
  b.equipment.ring1 = instance(2469);
  assert.equal(calculateBuild(b, items, sets).total[12], 8);
  delete b.equipment.ring1;
  assert.equal(calculateBuild(b, items, sets).total[12], 7);
  assert.equal(compatible(items.get(2469)!, "hat"), false);
  assert.equal(compatible(items.get(2469)!, "ring2"), true);
});
test("real King Jellix set activates only the correct tier and removal recalculates", () => {
  const b = fresh();
  const parts = data[version].items.filter((i) => i.setId === 6);
  for (const item of parts.slice(0, 3)) {
    const slot = item.slots[0] === "ring" ? "ring1" : item.slots[0];
    b.equipment[slot] = instance(item.id);
  }
  const c = calculateBuild(b, items, sets),
    count = new Set(Object.values(b.equipment).map((x) => x.itemId)).size;
  assert.equal(c.activeSets.find((s) => s.id === 6)?.count, count);
  assert.equal(c.bonuses[13], count === 3 ? 30 : 20);
  const slot = Object.keys(b.equipment)[0];
  delete b.equipment[slot];
  const reduced = calculateBuild(b, items, sets);
  assert.equal(reduced.bonuses[13], count === 3 ? 20 : undefined);
});
test("historical Gelano and set tiers resolve using original JSON rather than rounded references", () => {
  const d = data["3.6.12.16"],
    map = new Map(d.items.map((i) => [i.id, i]));
  assert.equal(map.get(2469)?.effects.find((e) => e.id === 12)?.max, 1);
  assert.equal(
    d.sets.find((s) => s.id === 6)?.tiers[2].find((e) => e.id === 13)?.max,
    20,
  );
  assert.equal(map.get(2469)?.version, "3.6.12.16");
});
test("duplicate set rings cannot count twice or certify an invalid combination", () => {
  const b = fresh();
  b.equipment.ring1 = instance(2469);
  b.equipment.ring2 = instance(2469);
  const c = calculateBuild(b, items, sets);
  assert.equal(c.activeSets.find((s) => s.id === 6)?.count, 1);
  assert.ok(c.warnings.some((w) => w.includes("mehrfach")));
  assert.equal(c.valid, false);
});
test("maging uses a private instance; AP roll overmages count towards exo limits", () => {
  const b = fresh(),
    before = JSON.stringify(items.get(2469));
  b.equipment.ring1 = { itemId: 2469, rolls: { 12: 3 }, exos: { 8: 1 } };
  const c = calculateBuild(b, items, sets);
  assert.equal(c.total[12], 10);
  assert.equal(c.total[8], 4);
  assert.ok(c.warnings.some((w) => w.includes("Exomagie")));
  assert.equal(JSON.stringify(items.get(2469)), before);
});
test("characteristic point costs, level AP and scroll bounds are checked", () => {
  const b = fresh();
  b.level = 99;
  assert.equal(calculateBuild(b, items, sets).total[12], 6);
  b.characteristics = { 45: 300 };
  assert.ok(
    calculateBuild(b, items, sets).warnings.some((w) =>
      w.includes("Eigenschaftspunkte"),
    ),
  );
  b.level = 200;
  b.scroll = { 45: 101 };
  assert.ok(
    calculateBuild(b, items, sets).warnings.some((w) =>
      w.includes("Scrollwert"),
    ),
  );
});
test("buff activation changes totals and deactivation reverses it", () => {
  const b = fresh();
  b.buffs = [
    {
      id: "manual",
      name: "Manuelle Annahme",
      active: true,
      stats: { 32: 100 },
    },
  ];
  assert.equal(calculateBuild(b, items, sets).total[32], 100);
  b.buffs[0].active = false;
  assert.equal(calculateBuild(b, items, sets).total[32], undefined);
});
test("AND OR absence and signed range filters use numeric identities", () => {
  const e = items.get(2469)!.effects;
  assert.equal(matchesEffects(e, [{ id: 12, min: 1, absent: false }]), true);
  assert.equal(
    matchesEffects(e, [
      { id: 12, absent: false },
      { id: 8, absent: false },
    ]),
    false,
  );
  assert.equal(
    matchesEffects(
      e,
      [
        { id: 12, absent: false },
        { id: 8, absent: false },
      ],
      "or",
    ),
    true,
  );
  assert.equal(matchesEffects(e, [{ id: 8, absent: true }]), true);
  const negative = data[version].items
    .flatMap((i) => i.effects)
    .find((e) => !e.active && e.max < 0)!;
  assert.ok(negative);
  assert.equal(
    matchesEffects([negative], [{ id: negative.id, max: -1, absent: false }]),
    true,
  );
});
test("requirements retain boolean grammar and never certify unknown conditions", () => {
  assert.equal(
    requirementStatus("(CS>100&CI>50)|PL>199", { 45: 120, 13: 60 }, 50),
    true,
  );
  assert.equal(requirementStatus("CS>200", { 45: 120 }, 200), false);
  assert.equal(requirementStatus("Pz<3", { 45: 120 }, 200), null);
  assert.equal(requirementStatus("CS>1;DROP TABLE", {}, 200), null);
});
test("independent Dofus Builds worked example: 11–13 fire -> 93–104", () => {
  const b = fresh();
  const r = damageLine(
    direct(),
    { 13: 300, 32: 50, 61: 25, 93: 15, 40: 10 },
    b.target,
  )!;
  assert.equal(r.min, 93);
  assert.equal(r.max, 104);
  assert.equal(r.average, 98 + 2 / 3);
});
test("independent Dofus pour les Noobs critical fire worked example: 245", () => {
  const r = damageLine(
    direct({ min: 12, max: 12 }),
    { 13: 777, 32: 100, 30: 9, 61: 78, 38: 41 },
    fresh().target,
    true,
  )!;
  assert.equal(r.min, 245);
});
test("fixed resistance precedes percentage; neutral and earth stay separate", () => {
  const target = fresh().target;
  target.fixed[13] = 12;
  target.percent[13] = -7;
  const r = damageLine(direct({ min: 259, max: 259 }), {}, target)!;
  assert.equal(r.min, 264);
  target.percent[0] = 50;
  target.percent[45] = 0;
  assert.equal(
    damageLine(direct({ element: "neutral", min: 100, max: 100 }), {}, target)!
      .min,
    50,
  );
  assert.equal(
    damageLine(direct({ element: "earth", min: 100, max: 100 }), {}, target)!
      .min,
    100,
  );
});
test("multi-line critical probability and unknown lines never yield fake exact totals", () => {
  const b = fresh();
  const l: SpellLevel = {
    id: 1,
    grade: 1,
    level: 1,
    ap: 3,
    minRange: 1,
    maxRange: 6,
    critical: 25,
    effects: [direct({ min: 10, max: 10 }), direct({ min: 20, max: 20 })],
    criticalEffects: [
      direct({ min: 15, max: 15 }),
      direct({ min: 25, max: 25 }),
    ],
    restrictions: {},
  };
  const r = simulateSpell(l, {}, b.target);
  assert.equal(r.expected, 32.5);
  assert.equal(r.normalTotal?.min, 30);
  l.effects.push(direct({ supported: false, reason: "Portalmechanik" }));
  assert.equal(simulateSpell(l, {}, b.target).normalTotal, null);
  assert.equal(simulateSpell(l, {}, b.target).expected, null);
});
test("healing does not enter the damage total; life steal remains a separate value", () => {
  const target = fresh().target;
  assert.equal(
    damageLine(direct({ min: 20, max: 20, kind: "steal" }), {}, target)?.steal
      ?.min,
    10,
  );
  assert.equal(
    damageLine(
      direct({ min: 20, max: 20, kind: "heal" }),
      { 13: 100, 121: 5 },
      target,
    )?.min,
    45,
  );
});
test("optimizer searches deterministically, honors exclusions, budget and impossible constraints", () => {
  const b = fresh();
  const pool = [items.get(2469)!];
  const options = {
    objective: 12,
    minimums: { 12: 8 },
    excluded: [],
    preferred: [],
    lockedSlots: [],
    allowedDofus: null,
    budget: null,
    allowExoAP: false,
    allowExoMP: false,
    width: 10,
  };
  const result = optimizeBuild(b, pool, [], options);
  assert.ok(result.results.length);
  assert.ok(
    result.results.every(
      (r) => r.calculation.valid && r.calculation.total[12] >= 8,
    ),
  );
  assert.equal(
    optimizeBuild(b, pool, [], { ...options, excluded: [2469] }).results.length,
    0,
  );
  assert.equal(
    optimizeBuild(b, pool, [], { ...options, minimums: { 12: 999 } }).results
      .length,
    0,
  );
  assert.equal(
    optimizeBuild(b, pool, [], { ...options, budget: 1 }).results.length,
    0,
  );
  assert.deepEqual(result, optimizeBuild(b, pool, [], options));
});
