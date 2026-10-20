import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  createCatalogSchema,
  searchCatalog,
  questCategories,
  normalized,
} from "../src/catalog.js";

test("indexed multilingual token search, typo ranking, strict filters, and paginated totals", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE quests(id INTEGER PRIMARY KEY); CREATE TABLE game_meta(key TEXT PRIMARY KEY,value TEXT)",
  );
  createCatalogSchema(db);
  db.exec(
    "INSERT INTO item_types VALUES(1,'Ring','Anneau','Ring',0,'equipment','equipment')",
  );
  // Explicit test fixtures, never shipped as game data.
  for (let id = 1; id <= 65; id++) {
    const item = {
      id,
      name: id === 1 ? "Gelano" : "Test Ring " + id,
      nameFr: "Anneau test",
      nameEn: "Ring test",
      level: id,
      typeId: 1,
      type: "Ring",
      category: id === 2 ? "quest" : "equipment",
      mainGroup: id === 2 ? "resources" : "equipment",
      iconId: 0,
    };
    const text = normalized(item.name + " " + item.nameFr + " " + item.nameEn);
    db.prepare("INSERT INTO catalog_items VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(
      id,
      1,
      item.category,
      item.mainGroup,
      id,
      item.name,
      item.nameFr,
      item.nameEn,
      text,
      0,
      JSON.stringify(item),
    );
    for (const token of new Set(text.split(" ")))
      db.prepare("INSERT INTO catalog_search_tokens VALUES(?,?)").run(
        token,
        id,
      );
  }
  try {
    const result = searchCatalog(db, {
      mainGroup: "equipment",
      page: 2,
      pageSize: 30,
    });
    assert.equal(result.total, 64);
    assert.equal(result.data.length, 30);
    assert.equal(
      searchCatalog(db, { q: "anneau test", mainGroup: "equipment" }).total,
      64,
    );
    assert.equal(
      searchCatalog(db, { q: "Gelano", category: "quest" }).total,
      0,
    );
    const typo = searchCatalog(db, { q: "Gelnao", mainGroup: "equipment" });
    assert.equal(typo.fuzzy, true);
    assert.equal(typo.data[0].id, 1);
    assert.ok(
      searchCatalog(db, { minLevel: 50, maxLevel: 55 }).data.every(
        (i) => i.level >= 50 && i.level <= 55,
      ),
    );
    assert.equal(searchCatalog(db, { q: "%' OR 1=1 --" }).total, 0);
  } finally {
    db.close();
  }
});

test("quest parents include distinct quests from descendants", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE quests(id INTEGER PRIMARY KEY)");
  createCatalogSchema(db);
  db.exec(
    "INSERT INTO quests VALUES(1),(2); INSERT INTO quest_categories VALUES('root',NULL,'Root','quest',0),('child','root','Child','quest',1); INSERT INTO quest_category_links VALUES(1,'child'),(1,'root'),(2,'child')",
  );
  try {
    const root = questCategories(db).find((c) => c.id === "root")!;
    assert.equal(root.questCount, 2);
    assert.deepEqual(root.questIds, [1, 2]);
  } finally {
    db.close();
  }
});
