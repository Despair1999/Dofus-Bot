import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Source versions are explicit: never relabel a historical database as current.
const manifests = JSON.parse(
  await readFile("packages/game-data/assets/dungeon-sources.json", "utf8"),
);
const inputs = process.argv.slice(2);
const specifications = inputs.length
  ? inputs.map((value) => {
      const split = value.indexOf("=");
      if (split < 0) throw Error("Expected version=path");
      return { version: value.slice(0, split), path: value.slice(split + 1) };
    })
  : [
      { version: "3.6.12.16", path: ".data/upstream-3.6.sqlite" },
      { version: "3.7.12.12", path: ".data/upstream.sqlite" },
    ];
const versions = {};
let guideIndex = { links: [] };
try {
  guideIndex = JSON.parse(
    await readFile(
      "packages/game-data/assets/dungeon-guide-index.json",
      "utf8",
    ),
  );
} catch {
  /* directory links optional for fully offline import */
}
const editorialSeed = JSON.parse(
  await readFile("packages/game-data/assets/dungeon-editorial.json", "utf8"),
);
for (const specification of specifications) {
  const { version, path } = specification;
  const manifest = manifests
    .find((m) => m.tag === `v6.0_${version}`)
    ?.assets.find((a) => a.name === "dofus.sqlite");
  if (!manifest) throw Error(`No pinned source manifest for ${version}`);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  const sha256 = hash.digest("hex");
  if (sha256 !== manifest.sha256) throw Error(`Checksum mismatch ${path}`);
  const db = new DatabaseSync(path, { readOnly: true });
  if (Object.values(db.prepare("PRAGMA quick_check").get())[0] !== "ok")
    throw Error("Invalid source SQLite");
  const textQuery = db.prepare(
    "SELECT value FROM translations WHERE id=? AND lang=?",
  );
  const text = (id, lang = "de") => textQuery.get(id, lang)?.value ?? "";
  const names = (row) => ({
    name: text(row.nameId) || text(row.nameId, "fr") || `#${row.id}`,
    nameFr: text(row.nameId, "fr"),
    nameEn: text(row.nameId, "en"),
  });
  const parse = (value) => JSON.parse(value || "[]");
  const areas = new Map(
    db
      .prepare("SELECT * FROM AreaData")
      .all()
      .map((row) => [row.id, { ...row, ...names(row) }]),
  );
  const subareas = new Map(
    db
      .prepare("SELECT * FROM SubAreaData")
      .all()
      .map((row) => [row.id, { ...row, ...names(row) }]),
  );
  const mapQuery = db.prepare("SELECT * FROM MapInformationData WHERE id=?");
  const position = (mapId) => {
    const row = mapQuery.get(mapId);
    if (!row) return null;
    const sub = subareas.get(row.subAreaId);
    return {
      mapId,
      x: row.posX,
      y: row.posY,
      worldId: row.worldMap,
      subAreaId: row.subAreaId,
      subAreaName: sub?.name || "",
      areaId: sub?.areaId ?? -1,
      areaName: areas.get(sub?.areaId)?.name || "",
    };
  };
  const itemQuery = db.prepare("SELECT * FROM ItemData WHERE id=?");
  const item = (id) => {
    const row = itemQuery.get(id);
    return {
      id,
      name: row ? names(row).name : `#${id}`,
      iconId: row?.iconId ?? 0,
    };
  };
  const achievementQuery = db.prepare(
    "SELECT * FROM AchievementData WHERE id=?",
  );
  const mapIdsQuery = db.prepare(
    "SELECT target_id FROM DungeonData_mapIds_junction WHERE DungeonData_id=? ORDER BY target_id",
  );
  const dungeons = db
    .prepare("SELECT * FROM DungeonData ORDER BY id")
    .all()
    .map((row) => {
      const bossIds = parse(row.bosses),
        mapIds = mapIdsQuery.all(row.id).map((r) => r.target_id);
      const dungeonSubareas = [...subareas.values()].filter(
        (s) => s.dungeonId === row.id,
      );
      return {
        id: row.id,
        ...names(row),
        level: row.optimalPlayerLevel,
        minLevel: row.minLevel,
        difficulty: row.difficulty,
        status: "catalog-present",
        guideUrls: guideIndex.links
          .filter((l) => l.dungeonId === row.id)
          .map((l) => l.url),
        bossIds,
        bossNames: [],
        entrance: position(row.entranceMapId),
        region: position(row.entranceMapId)?.areaName || "",
        mapIds,
        monsterIds: [
          ...new Set([
            ...bossIds,
            ...dungeonSubareas.flatMap((s) => parse(s.monsters)),
          ]),
        ],
        keys: parse(row.requiredObjects).map((v) => ({
          ...item(v.id),
          quantity: v.quantity,
        })),
        achievements: parse(row.achievements).map((id) => {
          const a = achievementQuery.get(id);
          return {
            id,
            name: a ? names(a).name : `#${id}`,
            description: a ? text(a.descriptionId) : "",
            points: a?.points ?? 0,
          };
        }),
        source: manifest.url,
        roomStatus: "unknown-composition-and-order",
        strategyStatus: "editorial-review-required",
      };
    });
  const monsterIds = new Set(dungeons.flatMap((d) => d.monsterIds));
  const spellQuery = db.prepare("SELECT * FROM SpellData WHERE id=?");
  const ranksBySpell = new Map();
  for (const row of db
    .prepare("SELECT * FROM SpellLevelData ORDER BY grade")
    .all()) {
    const list = ranksBySpell.get(row.spellId) || [];
    list.push(row);
    ranksBySpell.set(row.spellId, list);
  }
  const recipesByItem = new Map();
  for (const row of db
    .prepare(
      "SELECT j.target_id,r.resultId FROM RecipeData_ingredientIds_junction j JOIN RecipeData r ON r.id=j.RecipeData_id",
    )
    .all()) {
    const list = recipesByItem.get(row.target_id) || [];
    list.push(row.resultId);
    recipesByItem.set(row.target_id, list);
  }
  // Different schema versions may not export recipe ingredient junctions.
  const monsters = db
    .prepare("SELECT * FROM MonsterData")
    .all()
    .filter((m) => monsterIds.has(m.id))
    .map((row) => ({
      id: row.id,
      ...names(row),
      gfxId: row.gfxId,
      image: null,
      imageStatus: "not-bundled-rights-review",
      grades: parse(row.grades).map((g) => ({
        grade: g.grade,
        level: g.level,
        lifePoints: g.lifePoints,
        actionPoints: g.actionPoints,
        movementPoints: g.movementPoints,
        resistances: {
          neutral: g.reductionNeutral,
          earth: g.reductionEarth,
          fire: g.reductionFire,
          water: g.reductionWater,
          air: g.reductionAir,
        },
      })),
      subAreaIds: parse(row.subareas),
      spells: parse(row.spells)
        .map((id) => {
          const s = spellQuery.get(id);
          if (!s) return null;
          return {
            id,
            name: names(s).name,
            description: text(s.descriptionId),
            iconId: s.iconId,
            ranks: (ranksBySpell.get(id) || []).map((r) => ({
              grade: r.grade,
              apCost: r.apCost,
              minRange: r.minRange,
              range: r.range,
              maxCastPerTurn: r.maxCastPerTurn,
              maxCastPerTarget: r.maxCastPerTarget,
              minCastInterval: r.minCastInterval,
              effects: parse(r.effects),
            })),
          };
        })
        .filter(Boolean),
      drops: parse(row.drops).map((d) => ({
        itemId: d.objectId,
        name: item(d.objectId).name,
        iconId: item(d.objectId).iconId,
        rates: [1, 2, 3, 4, 5].map((n) => d[`percentDropForGrade${n}`]),
        conditions: d.criterions,
        count: d.count,
        recipes: recipesByItem.get(d.objectId) || [],
      })),
    }));
  const byMonster = new Map(monsters.map((m) => [m.id, m]));
  for (const dungeon of dungeons)
    dungeon.bossNames = dungeon.bossIds.map(
      (id) => byMonster.get(id)?.name || `#${id}`,
    );
  const jobs = new Map(
    db
      .prepare("SELECT * FROM JobData")
      .all()
      .map((row) => [row.id, { id: row.id, ...names(row) }]),
  );
  const quests = db
    .prepare(
      "SELECT q.* FROM QuestData q JOIN translations t ON t.id=q.nameId AND t.lang='fr' WHERE t.value LIKE '%votre métier%'",
    )
    .all();
  const bringQuery = db.prepare(
    "SELECT b.* FROM QuestObjectiveBringItemToNpcData b JOIN QuestStepData s ON s.id=b.stepId WHERE s.questId=?",
  );
  const npcQuery = db.prepare("SELECT * FROM NpcData WHERE id=?");
  const bronze =
    db
      .prepare(
        "SELECT i.id FROM ItemData i JOIN translations t ON i.nameId=t.id AND t.lang='fr' WHERE t.value='Bronze'",
      )
      .get()?.id ?? null;
  const professionQuests = quests.map((q) => {
    const objective = bringQuery.get(q.id);
    const params = JSON.parse(objective.parameters);
    const job = /PJ>(\d+),(\d+)/.exec(q.startCriterion),
      player = /PL>(\d+)/.exec(q.startCriterion);
    const startData = parse(q.startPosition)[0];
    const npc = npcQuery.get(startData?.npcId ?? params.parameter0);
    const positionValue = position(startData?.mapId);
    return {
      id: q.id,
      ...names(q),
      jobId: Number(job?.[1]),
      jobName: jobs.get(Number(job?.[1]))?.name || "",
      minJobLevel: Number(job?.[2]) + 1,
      minCharacterLevel: Number(player?.[1]) + 1,
      repeatType: q.repeatType,
      repeatLimit: q.repeatLimit,
      start: positionValue,
      npc: npc ? names(npc).name : "",
      itemId: params.parameter1,
      itemName: item(params.parameter1).name,
      quantity: params.parameter2,
      source: manifest.url,
      guide:
        q.id === 945
          ? "https://www.dofuspourlesnoobs.com/piocher-c-est-votre-metier.html"
          : "https://www.dofuspourlesnoobs.com/",
      regionAreaIds: q.id === 945 ? [0] : [],
      gatheringItemId: q.id === 945 ? bronze : null,
      evidence:
        q.id === 945
          ? "Voraussetzungen, Start und Menge aus Spieldaten; Amakna-Beschränkung und tägliche Wiederholung durch externen Guide belegt (2020, keine Patchprüfung)."
          : "Strukturierte Spieldaten; genaue Sammelgebiete noch redaktionell zu prüfen.",
      warnings: [
        "Zielkoordinaten im Questziel weichen von der Startkarte ab; Startkarte wird separat ausgewiesen.",
        "repeatType ist ein Rohwert der Spielquelle; Tageswechsel und erneute Freischaltung werden nicht automatisch behauptet.",
      ],
    };
  });
  const invalidBossReferences = dungeons.reduce(
    (n, d) => n + d.bossIds.filter((id) => !byMonster.has(id)).length,
    0,
  );
  if (invalidBossReferences) throw Error("Dangling boss references");
  versions[version] = {
    source: manifest.url,
    sourceSha256: sha256,
    editorial: editorialSeed.filter((e) => e.version === version),
    importedAt: new Date().toISOString(),
    dungeons,
    monsters,
    professions: [...jobs.values()].filter((j) =>
      [2, 24, 26, 28, 36, 41].includes(j.id),
    ),
    professionQuests,
    report: {
      catalogDungeons: dungeons.length,
      bossReferences: dungeons.reduce((n, d) => n + d.bossIds.length, 0),
      uniqueBosses: new Set(dungeons.flatMap((d) => d.bossIds)).size,
      monsters: monsters.length,
      monsterGrades: monsters.reduce((n, m) => n + m.grades.length, 0),
      spells: new Set(monsters.flatMap((m) => m.spells.map((s) => s.id))).size,
      drops: monsters.reduce((n, m) => n + m.drops.length, 0),
      dungeonMaps: dungeons.reduce((n, d) => n + d.mapIds.length, 0),
      roomCompositions: 0,
      verifiedMechanics: editorialSeed
        .filter((e) => e.version === version && e.mechanicsVerified)
        .reduce((n, e) => n + e.mechanics.length, 0),
      verifiedStrategies: 0,
      missingImages: monsters.length,
      invalidBossReferences,
      professionQuests: professionQuests.length,
    },
  };
  db.close();
  console.log(version, versions[version].report);
}
const target = resolve("packages/game-data/assets/dungeon-data.json");
await mkdir(resolve("packages/game-data/assets"), { recursive: true });
await writeFile(`${target}.tmp`, JSON.stringify({ schema: 1, versions }));
await rename(`${target}.tmp`, target);
