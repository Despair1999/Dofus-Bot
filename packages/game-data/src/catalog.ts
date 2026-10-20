import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";

type Row = Record<string, any>;
export type RawCategory =
  "equipment" | "resources" | "consumables" | "quest" | "cosmetics";
export interface CatalogItem {
  id: number;
  name: string;
  nameFr: string;
  nameEn: string;
  level: number;
  type: string;
  typeId: number;
  category: RawCategory;
  mainGroup: "equipment" | "resources";
  iconId: number;
  imageUrl?: string;
  description: string;
  effects: string[];
  rawEffects: unknown[];
  effectsAvailable: boolean;
  recipe: {
    itemId: number;
    quantity: number;
    category?: string;
    name?: string;
    imageUrl?: string;
    level?: number;
    type?: string;
  }[];
  requirements: string;
  weight: number;
  setId: number | null;
  setName: string;
  source: string;
  version: string;
}
export interface CatalogFilters {
  q?: string;
  category?: string;
  mainGroup?: string;
  typeId?: number;
  minLevel?: number;
  maxLevel?: number;
  sort?: string;
  page?: number;
  pageSize?: number;
}
export interface CatalogSupplement {
  items: Map<number, Row>;
  counts: Record<string, number>;
  version: string;
}
const categories: RawCategory[] = [
  "equipment",
  "consumables",
  "resources",
  "quest",
  "cosmetics",
  "resources",
];
export function normalized(text: string) {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("de")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
function parsed(value: unknown, fallback: any = []): any {
  if (value === undefined || value === null || value === "") return fallback;
  return typeof value === "string" ? JSON.parse(value) : value;
}
export function hasTable(db: DatabaseSync, name: string) {
  return !!db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
    .get(name);
}
export function createCatalogSchema(db: DatabaseSync) {
  db.exec(`
 CREATE TABLE IF NOT EXISTS catalog_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS item_types(id INTEGER PRIMARY KEY,name TEXT NOT NULL,name_fr TEXT NOT NULL,name_en TEXT NOT NULL,raw_category_id INTEGER NOT NULL,category TEXT NOT NULL,main_group TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS catalog_items(id INTEGER PRIMARY KEY,type_id INTEGER NOT NULL REFERENCES item_types(id),category TEXT NOT NULL,main_group TEXT NOT NULL,level INTEGER NOT NULL,name TEXT NOT NULL,name_fr TEXT NOT NULL,name_en TEXT NOT NULL,search_text TEXT NOT NULL,icon_id INTEGER NOT NULL,content TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS catalog_items_filter ON catalog_items(main_group,category,type_id,level);
 CREATE INDEX IF NOT EXISTS catalog_items_name ON catalog_items(name COLLATE NOCASE,id);
 CREATE TABLE IF NOT EXISTS catalog_search_tokens(token TEXT NOT NULL,item_id INTEGER NOT NULL,PRIMARY KEY(token,item_id)) WITHOUT ROWID;
 CREATE TABLE IF NOT EXISTS recipe_ingredients(result_id INTEGER NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,item_id INTEGER NOT NULL REFERENCES catalog_items(id),quantity INTEGER NOT NULL CHECK(quantity>0),position INTEGER NOT NULL,PRIMARY KEY(result_id,position));
 CREATE TABLE IF NOT EXISTS classes(id INTEGER PRIMARY KEY,search_text TEXT NOT NULL,content TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS quest_categories(id TEXT PRIMARY KEY,parent_id TEXT REFERENCES quest_categories(id) DEFERRABLE INITIALLY DEFERRED,name TEXT NOT NULL,kind TEXT NOT NULL,position INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS quest_category_links(quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,category_id TEXT NOT NULL REFERENCES quest_categories(id),PRIMARY KEY(quest_id,category_id));
 CREATE INDEX IF NOT EXISTS quest_category_lookup ON quest_category_links(category_id,quest_id);
 INSERT OR IGNORE INTO catalog_migrations VALUES(2,datetime('now'));
 `);
  db.function("catalog_distance", { deterministic: true }, (text, query) => {
    const q = String(query);
    return Math.min(
      ...String(text)
        .split(" ")
        .map((word) => {
          if (Math.abs(word.length - q.length) > 2) return 3;
          let previous = Array.from({ length: q.length + 1 }, (_, i) => i);
          let beforePrevious = previous;
          for (let i = 1; i <= word.length; i++) {
            const next = [i];
            for (let j = 1; j <= q.length; j++) {
              next[j] = Math.min(
                next[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + (word[i - 1] === q[j - 1] ? 0 : 1),
              );
              if (
                i > 1 &&
                j > 1 &&
                word[i - 1] === q[j - 2] &&
                word[i - 2] === q[j - 1]
              )
                next[j] = Math.min(next[j], beforePrevious[j - 2] + 1);
            }
            beforePrevious = previous;
            previous = next;
          }
          return previous[q.length];
        }),
    );
  });
}
function translator(src: DatabaseSync) {
  const statement = src.prepare(
    "SELECT value FROM translations WHERE id=? AND lang=?",
  );
  const cache = new Map<string, string>();
  return (id: unknown, lang = "de") => {
    if (!id) return "";
    const key = id + ":" + lang;
    if (!cache.has(key))
      cache.set(
        key,
        String(
          (statement.get(Number(id), lang) as Row | undefined)?.value ?? "",
        ),
      );
    return cache.get(key)!;
  };
}
function rows(src: DatabaseSync, name: string): Row[] {
  return hasTable(src, name)
    ? (src.prepare('SELECT * FROM "' + name + '"').all() as Row[])
    : [];
}
export function importCatalog(
  src: DatabaseSync,
  db: DatabaseSync,
  version: string,
  supplement?: CatalogSupplement,
) {
  if (!hasTable(src, "ItemData"))
    return {
      itemCount: 0,
      sourceItemCount: 0,
      apiItemCount: 0,
      missingImages: 0,
      missingRecipeTargets: 0,
      categoryCounts: {},
      classCount: 0,
    };
  const tr = translator(src);
  const typeRows = rows(src, "ItemTypeData");
  const typeMap = new Map(typeRows.map((t) => [t.id, t]));
  const allItems = [...rows(src, "ItemData"), ...rows(src, "WeaponData")];
  const sourceItems = new Map(allItems.map((i) => [i.id, i]));
  // Keep real source IDs whose type metadata is absent in the upstream release.
  const unknownTypeIds = [
    ...new Set(allItems.map((i) => i.typeId).filter((id) => !typeMap.has(id))),
  ];
  for (const id of unknownTypeIds) {
    const fallback = { id, nameId: 0, categoryId: -1 };
    typeRows.push(fallback);
    typeMap.set(id, fallback);
  }
  if (!sourceItems.size || !typeRows.length)
    throw new Error("Leerer Itemkatalog abgelehnt");
  db.exec(
    "DELETE FROM recipe_ingredients; DELETE FROM catalog_search_tokens; DELETE FROM catalog_items; DELETE FROM item_types; DELETE FROM classes; DELETE FROM quest_category_links; DELETE FROM quest_categories;",
  );
  const typeInsert = db.prepare("INSERT INTO item_types VALUES(?,?,?,?,?,?,?)");
  for (const t of typeRows) {
    const category = categories[t.categoryId] ?? "resources";
    typeInsert.run(
      t.id,
      tr(t.nameId) || tr(t.nameId, "fr") || `Unbekannter Typ ${t.id}`,
      tr(t.nameId, "fr"),
      tr(t.nameId, "en"),
      Number(t.categoryId ?? -1),
      category,
      category === "equipment" ? "equipment" : "resources",
    );
  }
  const sets = new Map(
    rows(src, "ItemSetData").map((r) => [r.id, tr(r.nameId)]),
  );
  const recipes = new Map<number, { itemId: number; quantity: number }[]>();
  const ingredients = new Map<string, number[]>();
  for (const r of rows(src, "RecipeData_ingredientIds_junction")) {
    const list = ingredients.get(r.RecipeData_id) ?? [];
    list.push(Number(r.target_id));
    ingredients.set(r.RecipeData_id, list);
  }
  for (const r of rows(src, "RecipeData")) {
    const ids = ingredients.get(r.id) ?? [];
    const quantities = parsed(r.quantities);
    if (ids.length !== quantities.length)
      throw new Error(
        `Rezept ${r.resultId}: Mengen und Materialien stimmen nicht überein`,
      );
    if (recipes.has(r.resultId)) continue;
    recipes.set(
      r.resultId,
      ids.map((itemId, i) => ({ itemId, quantity: Number(quantities[i]) })),
    );
  }
  let missingImages = 0,
    missingRecipeTargets = 0;
  const categoryCounts: Record<string, number> = {};
  const items = new Map<number, CatalogItem>();
  for (const [id, r] of sourceItems) {
    const type = typeMap.get(r.typeId);
    if (!type) throw new Error(`Unbekannter Originaltyp ${r.typeId}`);
    const extra = supplement?.items.get(id);
    const category = (extra?._category ??
      categories[type.categoryId] ??
      "resources") as RawCategory;
    const iconId = Number(r.iconId ?? 0);
    const imageUrl =
      extra?.image_urls?.icon ??
      (iconId > 0
        ? `https://api.dofusdu.de/dofus3/v1/img/item/${iconId}-64.png`
        : undefined);
    if (!imageUrl) missingImages++;
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    const recipe =
      extra?.recipe?.map((i: Row) => ({
        itemId: Number(i.item_ankama_id),
        quantity: Number(i.quantity),
      })) ??
      recipes.get(id) ??
      [];
    const item: CatalogItem = {
      id,
      name:
        tr(r.nameId) || tr(r.nameId, "fr") || `Unbenannter Gegenstand ${id}`,
      nameFr: tr(r.nameId, "fr"),
      nameEn: tr(r.nameId, "en"),
      level: Number(r.level ?? 0),
      type: tr(type.nameId) || tr(type.nameId, "fr") || `Typ ${r.typeId}`,
      typeId: Number(r.typeId),
      category,
      mainGroup: category === "equipment" ? "equipment" : "resources",
      iconId,
      imageUrl,
      description: extra?.description ?? tr(r.descriptionId),
      effects: (extra?.effects ?? []).map((e: Row) => String(e.formatted)),
      rawEffects: parsed(r.possibleEffects),
      effectsAvailable: !!extra,
      recipe,
      requirements: String(r.criterions ?? ""),
      weight: Number(r.realWeight ?? 0),
      setId: r.itemSetId > 0 ? r.itemSetId : null,
      setName: sets.get(r.itemSetId) ?? "",
      source: extra ? "dofus-sqlite + dofusdude" : "dofus-sqlite",
      version,
    };
    items.set(id, item);
  }
  // API-only records are retained only when their original type can be verified by ID; no fabricated type mapping.
  const unmatchedApiIds = [...(supplement?.items.keys() ?? [])].filter(
    (id) => !items.has(id),
  );
  const insert = db.prepare(
    "INSERT INTO catalog_items VALUES(?,?,?,?,?,?,?,?,?,?,?)",
  );
  const tokenInsert = db.prepare(
    "INSERT INTO catalog_search_tokens(token,item_id) VALUES(?,?)",
  );
  for (const item of items.values()) {
    item.recipe = item.recipe.map((r) => {
      const target = items.get(r.itemId);
      if (!target) {
        missingRecipeTargets++;
        return { ...r, name: "Materialdaten fehlen" };
      }
      return {
        ...r,
        name: target.name,
        category: target.category,
        imageUrl: target.imageUrl,
        level: target.level,
        type: target.type,
      };
    });
    const search = normalized(
      item.name + " " + item.nameFr + " " + item.nameEn,
    );
    insert.run(
      item.id,
      item.typeId,
      item.category,
      item.mainGroup,
      item.level,
      item.name,
      item.nameFr,
      item.nameEn,
      search,
      item.iconId,
      JSON.stringify(item),
    );
    for (const token of new Set(search.split(" ").filter(Boolean)))
      tokenInsert.run(token, item.id);
  }
  const recipeInsert = db.prepare(
    "INSERT INTO recipe_ingredients VALUES(?,?,?,?)",
  );
  for (const item of items.values())
    item.recipe.forEach((r, i) => {
      if (
        items.has(r.itemId) &&
        Number.isSafeInteger(r.quantity) &&
        r.quantity > 0
      )
        recipeInsert.run(item.id, r.itemId, r.quantity, i);
    });
  const classInsert = db.prepare("INSERT INTO classes VALUES(?,?,?)");
  const classRows = rows(src, "BreedData");
  for (const breed of classRows) {
    const name = tr(breed.shortNameId);
    const nameFr = tr(breed.shortNameId, "fr"),
      nameEn = tr(breed.shortNameId, "en");
    const initials = (name || nameEn).slice(0, 2).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="24" fill="#263c31"/><circle cx="48" cy="42" r="26" fill="none" stroke="#b9e779" stroke-width="2"/><text x="48" y="51" font-size="24" font-family="sans-serif" text-anchor="middle" fill="#d9edb8">${initials}</text><text x="48" y="83" font-size="10" text-anchor="middle" fill="#9bac99">${breed.id}</text></svg>`;
    const icon =
      "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
    const content = {
      id: breed.id,
      classId: breed.id,
      name,
      nameDe: name,
      nameFr,
      nameEn,
      aliases: [name, nameFr, nameEn],
      icon,
      portrait: icon,
      placeholder: true,
      source: "dofus-sqlite BreedData; eigenes neutrales Symbol",
    };
    classInsert.run(
      breed.id,
      normalized([name, nameFr, nameEn].join(" ")),
      JSON.stringify(content),
    );
  }
  const quality = {
    unknownTypeIds,
    itemCount: items.size,
    sourceItemCount: allItems.length,
    uniqueSourceItemCount: sourceItems.size,
    apiItemCount: supplement?.items.size ?? 0,
    apiCategoryCounts: supplement?.counts ?? {},
    unmatchedApiIds,
    missingImages,
    missingRecipeTargets,
    categoryCounts,
    classCount: classRows.length,
    recipeCount: recipes.size,
    formattedEffectsCount: [...items.values()].filter((i) => i.effectsAvailable)
      .length,
  };
  db.prepare("INSERT OR REPLACE INTO game_meta VALUES(?,?)").run(
    "catalog_quality",
    JSON.stringify(quality),
  );
  return quality;
}
export function catalogStatus(db: DatabaseSync) {
  const row = db
    .prepare("SELECT value FROM game_meta WHERE key='catalog_quality'")
    .get() as Row | undefined;
  return row ? JSON.parse(row.value) : { itemCount: 0, classCount: 0 };
}
export function searchCatalog(db: DatabaseSync, f: CatalogFilters = {}) {
  const page = Math.max(1, Math.trunc(f.page ?? 1)),
    pageSize = Math.max(1, Math.min(100, Math.trunc(f.pageSize ?? 30)));
  const q = normalized(f.q ?? "");
  const where: string[] = [],
    params: (string | number)[] = [];
  if (f.category) {
    where.push("category=?");
    params.push(f.category);
  }
  if (f.mainGroup) {
    where.push("main_group=?");
    params.push(f.mainGroup);
  }
  if (f.typeId) {
    where.push("type_id=?");
    params.push(f.typeId);
  }
  if (f.minLevel !== undefined) {
    where.push("level>=?");
    params.push(f.minLevel);
  }
  if (f.maxLevel !== undefined) {
    where.push("level<=?");
    params.push(f.maxLevel);
  }
  if (q) {
    const tokens = q.split(" ").filter(Boolean);
    const tokenQueries = tokens.map(
      () =>
        "SELECT item_id FROM catalog_search_tokens WHERE token>=? AND token<?",
    );
    where.push(
      "(id IN (" +
        tokenQueries.join(" INTERSECT ") +
        ") OR search_text LIKE ? ESCAPE '\\')",
    );
    for (const token of tokens) params.push(token, token + "\uffff");
    params.push("%" + q.replace(/[\\%_]/g, "\\$&") + "%");
  }
  let clause = where.length ? "WHERE " + where.join(" AND ") : "";
  let total = Number(
    (
      db
        .prepare("SELECT count(*) n FROM catalog_items " + clause)
        .get(...params) as Row
    ).n,
  );
  let fuzzy = false;
  // A single missing character may be OCR noise. Narrow candidates by an intact prefix, then rank by edit distance.
  if (!total && q.length >= 4 && q.length <= 60) {
    where[where.length - 1] = "catalog_distance(search_text,?)<=?";
    params.splice(
      params.length - (q.split(" ").filter(Boolean).length * 2 + 1),
      q.split(" ").filter(Boolean).length * 2 + 1,
      q,
      q.length > 7 ? 2 : 1,
    );
    clause = "WHERE " + where.join(" AND ");
    fuzzy = true;
    total = Number(
      (
        db
          .prepare("SELECT count(*) n FROM catalog_items " + clause)
          .get(...params) as Row
      ).n,
    );
  }
  const order =
    (fuzzy ? "catalog_distance(search_text,'" + q + "')," : "") +
    (f.sort === "level-asc"
      ? "level ASC,name COLLATE NOCASE,id"
      : f.sort === "level-desc"
        ? "level DESC,name COLLATE NOCASE,id"
        : "name COLLATE NOCASE,id");
  const data = (
    db
      .prepare(
        "SELECT content FROM catalog_items " +
          clause +
          " ORDER BY " +
          order +
          " LIMIT ? OFFSET ?",
      )
      .all(...params, pageSize, (page - 1) * pageSize) as Row[]
  ).map((r) => {
    const i = JSON.parse(r.content) as CatalogItem;
    return {
      id: i.id,
      name: i.name,
      nameFr: i.nameFr,
      nameEn: i.nameEn,
      level: i.level,
      type: i.type,
      typeId: i.typeId,
      category: i.category,
      mainGroup: i.mainGroup,
      iconId: i.iconId,
      imageUrl: i.imageUrl,
    };
  });
  return { data, total, page, pageSize, fuzzy };
}
export function getCatalogItem(
  db: DatabaseSync,
  id: number,
): CatalogItem | undefined {
  const row = db
    .prepare("SELECT content FROM catalog_items WHERE id=?")
    .get(id) as Row | undefined;
  return row ? JSON.parse(row.content) : undefined;
}
export function catalogTypes(db: DatabaseSync) {
  return (
    db
      .prepare(
        "SELECT t.*,count(i.id) count FROM item_types t LEFT JOIN catalog_items i ON i.type_id=t.id GROUP BY t.id ORDER BY t.name",
      )
      .all() as Row[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    nameFr: r.name_fr,
    nameEn: r.name_en,
    category: r.category,
    rawCategoryId: r.raw_category_id,
    mainGroup: r.main_group,
    count: r.count,
  }));
}
export function classCatalog(db: DatabaseSync) {
  return (
    db.prepare("SELECT content FROM classes ORDER BY id").all() as Row[]
  ).map((r) => JSON.parse(r.content));
}
export function enrichQuestRelations(src: DatabaseSync, db: DatabaseSync) {
  const tr = translator(src);
  const rawQuests = new Map(rows(src, "QuestData").map((r) => [r.id, r]));
  const cats = rows(src, "AchievementCategoryData");
  const achievements = new Map(
    rows(src, "AchievementData").map((r) => [r.id, r]),
  );
  const questAchievements = new Map<number, Row[]>();
  for (const objective of rows(src, "AchievementObjectiveData")) {
    for (const match of String(objective.criterion).matchAll(/\bQf=(\d+)/g)) {
      const questId = Number(match[1]);
      const achievement = achievements.get(objective.achievementId);
      if (!rawQuests.has(questId) || !achievement) continue;
      const list = questAchievements.get(questId) ?? [];
      if (!list.some((a) => a.id === achievement.id)) list.push(achievement);
      questAchievements.set(questId, list);
    }
  }
  const needed = new Set<number>();
  const catMap = new Map(cats.map((c) => [c.id, c]));
  for (const list of questAchievements.values())
    for (const a of list) {
      let c = catMap.get(a.categoryId);
      const visited = new Set();
      while (c && !visited.has(c.id)) {
        visited.add(c.id);
        needed.add(c.id);
        c = catMap.get(c.parentId);
      }
    }
  const catInsert = db.prepare(
    "INSERT INTO quest_categories VALUES(?,?,?,?,?)",
  );
  for (const c of cats)
    if (needed.has(c.id))
      catInsert.run(
        "achievement:" + c.id,
        needed.has(c.parentId) ? "achievement:" + c.parentId : null,
        tr(c.nameId) || tr(c.nameId, "fr") || `Kategorie ${c.id}`,
        "achievement",
        Number(c.order ?? 0),
      );
  for (const c of rows(src, "QuestCategoryData"))
    catInsert.run(
      "quest:" + c.id,
      null,
      tr(c.nameId) || tr(c.nameId, "fr") || `Questgebiet ${c.id}`,
      "quest",
      Number(c.order ?? 0),
    );
  const rewards = new Map<number, Row[]>();
  for (const r of rows(src, "QuestStepRewardData")) {
    const list = rewards.get(r.stepId) ?? [];
    list.push(r);
    rewards.set(r.stepId, list);
  }
  const maps = new Map(rows(src, "MapInformationData").map((r) => [r.id, r]));
  const npcs = new Map(rows(src, "NpcData").map((r) => [r.id, tr(r.nameId)]));
  const monsters = new Map(
    rows(src, "MonsterData").map((r) => [r.id, tr(r.nameId)]),
  );
  const objectiveTables = [
    "QuestObjectiveBringItemToNpcData",
    "QuestObjectiveCraftItemData",
    "QuestObjectiveGoToNpcData",
    "QuestObjectiveFightMonsterData",
  ];
  const typed = new Map<number, { table: string; row: Row }>();
  for (const table of objectiveTables)
    for (const row of rows(src, table)) typed.set(row.id, { table, row });
  const update = db.prepare("UPDATE quests SET content=?,hash=? WHERE id=?");
  const link = db.prepare(
    "INSERT OR IGNORE INTO quest_category_links VALUES(?,?)",
  );
  for (const row of db
    .prepare("SELECT id,content FROM quests")
    .all() as Row[]) {
    const quest = JSON.parse(row.content);
    const raw = rawQuests.get(row.id);
    if (!raw) continue;
    const list = questAchievements.get(row.id) ?? [];
    quest.categoryIds = [
      "quest:" + raw.categoryId,
      ...list.map((a) => "achievement:" + a.categoryId),
    ];
    quest.achievements = list.map((a) => ({
      id: a.id,
      name: tr(a.nameId) || tr(a.nameId, "fr"),
      description: tr(a.descriptionId),
      categoryId: "achievement:" + a.categoryId,
      sourceCriterion: "AchievementObjectiveData Qf=<Quest-ID>",
    }));
    quest.startPositions = parsed(raw.startPosition).map((p: Row) => {
      const map = maps.get(p.mapId);
      return {
        ...p,
        npcName: npcs.get(p.npcId) ?? null,
        coordinates: map
          ? { x: map.posX, y: map.posY, worldMap: map.worldMap }
          : null,
      };
    });
    quest.materials = [];
    quest.rewards = [];
    for (const step of quest.steps) {
      for (const objective of step.objectives) {
        const item = typed.get(objective.id);
        const p = objective.parameters ?? {};
        const map = maps.get(objective.mapId);
        if (!objective.coordinates && map)
          objective.coordinates = {
            x: map.posX,
            y: map.posY,
            worldMap: map.worldMap,
          };
        if (item?.table === "QuestObjectiveGoToNpcData") {
          objective.npc = {
            id: p.parameter0,
            name: npcs.get(p.parameter0) ?? null,
          };
          if (objective.npc.name)
            objective.description = `Sprich mit ${objective.npc.name}.`;
        }
        if (item?.table === "QuestObjectiveFightMonsterData") {
          objective.monster = {
            id: p.parameter0,
            name: monsters.get(p.parameter0) ?? null,
            quantity: p.parameter1,
          };
          if (objective.monster.name)
            objective.description = `Besiege ${p.parameter1} × ${objective.monster.name}.`;
        }
        if (
          item?.table === "QuestObjectiveBringItemToNpcData" ||
          item?.table === "QuestObjectiveCraftItemData"
        ) {
          const itemId =
            item.table === "QuestObjectiveBringItemToNpcData"
              ? p.parameter1
              : p.parameter0;
          const quantity =
            item.table === "QuestObjectiveBringItemToNpcData"
              ? p.parameter2
              : p.parameter1;
          const material = getCatalogItem(db, itemId);
          objective.material = {
            itemId,
            quantity,
            name: material?.name ?? "Materialdaten fehlen",
            category: material?.category,
            imageUrl: material?.imageUrl,
          };
          quest.materials.push({
            ...objective.material,
            stepId: step.id,
            objectiveId: objective.id,
          });
          if (material)
            objective.description =
              item.table === "QuestObjectiveBringItemToNpcData"
                ? `Bringe ${quantity} × ${material.name}${npcs.get(p.parameter0) ? " zu " + npcs.get(p.parameter0) : ""}.`
                : `Stelle ${quantity} × ${material.name} her.`;
        }
      }
      for (const reward of rewards.get(step.id) ?? []) {
        quest.rewards.push({
          stepId: step.id,
          kamasRatio: reward.kamasRatio,
          experienceRatio: reward.experienceRatio,
          levelMin: reward.levelMin,
          levelMax: reward.levelMax,
          items: parsed(reward.itemsReward).map((i: Row) => {
            const pair = i.values?.Array ?? [];
            const item = getCatalogItem(db, Number(pair[0]));
            return {
              itemId: pair[0],
              quantity: pair[1],
              name: item?.name ?? "Materialdaten fehlen",
              imageUrl: item?.imageUrl,
              category: item?.category,
            };
          }),
        });
      }
    }
    for (const category of new Set<string>(quest.categoryIds)) {
      if (db.prepare("SELECT 1 FROM quest_categories WHERE id=?").get(category))
        link.run(quest.id, category);
    }
    const json = JSON.stringify(quest);
    update.run(json, createHash("sha256").update(json).digest("hex"), quest.id);
  }
}
export function questCategories(db: DatabaseSync) {
  return (
    db
      .prepare(
        "SELECT c.* FROM quest_categories c ORDER BY c.kind,c.position,c.name",
      )
      .all() as Row[]
  ).map((c) => ({
    id: c.id,
    parentId: c.parent_id,
    name: c.name,
    kind: c.kind,
    questCount: Number(
      (
        db
          .prepare(
            `WITH RECURSIVE descendants(id) AS (SELECT ? UNION SELECT c.id FROM quest_categories c JOIN descendants d ON c.parent_id=d.id) SELECT count(DISTINCT quest_id) n FROM quest_category_links WHERE category_id IN (SELECT id FROM descendants)`,
          )
          .get(c.id) as Row
      ).n,
    ),
    questIds: (
      db
        .prepare(
          "WITH RECURSIVE descendants(id) AS (SELECT ? UNION SELECT c.id FROM quest_categories c JOIN descendants d ON c.parent_id=d.id) SELECT DISTINCT quest_id FROM quest_category_links WHERE category_id IN (SELECT id FROM descendants) ORDER BY quest_id",
        )
        .all(c.id) as Row[]
    ).map((r) => r.quest_id),
  }));
}
export async function fetchCatalogSupplement(): Promise<CatalogSupplement> {
  const items = new Map<number, Row>(),
    counts: Record<string, number> = {};
  const versionResponse = await fetch(
    "https://api.dofusdu.de/dofus3/v1/meta/version",
    { signal: AbortSignal.timeout(15000) },
  );
  const versionBody = versionResponse.ok
    ? ((await versionResponse.json()) as Row)
    : {};
  const version = String(
    versionBody.version ?? versionBody.dofus_version ?? "unbekannt",
  );
  for (const category of [
    "equipment",
    "resources",
    "consumables",
    "quest",
    "cosmetics",
  ]) {
    const r = await fetch(
      `https://api.dofusdu.de/dofus3/v1/de/items/${category}/all`,
      {
        signal: AbortSignal.timeout(90000),
        headers: {
          Accept: "application/json",
          "User-Agent": "DofusCompanion/0.2",
        },
      },
    );
    if (!r.ok) throw new Error(`Dofusdude ${category}: HTTP ${r.status}`);
    const body = (await r.json()) as { items: Row[] };
    if (!Array.isArray(body.items) || !body.items.length)
      throw new Error(`Leerer API-Katalog ${category} abgelehnt`);
    counts[category] = body.items.length;
    for (const item of body.items) {
      if (
        !Number.isSafeInteger(item.ankama_id) ||
        typeof item.name !== "string"
      )
        throw new Error("Ungültiger API-Gegenstand");
      if (items.has(item.ankama_id))
        throw new Error("Doppelte API-Item-ID: " + item.ankama_id);
      items.set(item.ankama_id, { ...item, _category: category });
    }
  }
  return { items, counts, version };
}
