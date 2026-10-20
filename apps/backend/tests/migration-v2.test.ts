import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PersonalStore } from "../src/store.js";

test("v0.1 profiles and quest progress survive additive class migration, including unknown legacy classes", () => {
  const folder = mkdtempSync(join(tmpdir(), "companion-upgrade-"));
  const path = join(folder, "personal.sqlite");
  const old = new DatabaseSync(path);
  old.exec(`CREATE TABLE characters(id TEXT PRIMARY KEY,name TEXT NOT NULL,server TEXT NOT NULL,class_name TEXT NOT NULL,level INTEGER NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL);
 INSERT INTO characters VALUES('known','Existing','Server','Sacrieur',100,7,'2026-01-01'),('unknown','Legacy','Server','Custom class',42,3,'2026-01-02');`);
  old.close();
  let store = new PersonalStore(path);
  try {
    store.db.exec(
      "INSERT INTO character_quests VALUES('known',1697,2,'paused',9,'2026-01-01')",
    );
    store.migrateClasses([
      {
        id: 11,
        classId: 11,
        name: "Sacrieur",
        nameDe: "Sacrieur",
        nameFr: "Sacrieur",
        nameEn: "Sacrier",
        aliases: ["Sacrieur", "Sacrier"],
        icon: "",
        portrait: "",
        placeholder: true,
        source: "explicit test fixture",
      },
    ]);
    const known = store.characters().find((c) => c.id === "known")!;
    assert.equal(known.classId, 11);
    assert.equal(known.level, 100);
    assert.equal(known.version, 7);
    assert.equal(known.name, "Existing");
    assert.equal(
      store.characters().find((c) => c.id === "unknown")!.className,
      "Custom class",
    );
    assert.equal(
      store.characters().find((c) => c.id === "unknown")!.classId,
      null,
    );
    assert.equal(store.progress("known")[0].step, 2);
    assert.equal(store.progress("known")[0].version, 9);
    store.close();
    store = new PersonalStore(path);
    assert.equal(store.characters().length, 2);
    assert.equal(store.progress("known")[0].status, "paused");
  } finally {
    store.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
