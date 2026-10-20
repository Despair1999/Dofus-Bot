import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameDataStore, normalizeText } from "../src/index.js";
function fixture(path: string) {
  const db = new DatabaseSync(path);
  db.exec(
    `CREATE TABLE translations(id INTEGER,lang TEXT,value TEXT,PRIMARY KEY(id,lang)); CREATE TABLE QuestData(id INTEGER,nameId INTEGER,levelMin INTEGER,startCriterion TEXT); CREATE TABLE QuestStepData(id INTEGER,questId INTEGER,nameId INTEGER,descriptionId INTEGER);CREATE TABLE QuestObjectiveTypeData(id INTEGER,nameId INTEGER); CREATE TABLE QuestObjectiveFreeFormData(id INTEGER,stepId INTEGER,typeId INTEGER,mapId INTEGER,coords TEXT,parameters TEXT);INSERT INTO translations VALUES(1,'de','Prüfung des Schülers'),(1,'fr','Épreuve de l’élève'),(2,'de','Der Anfang'),(3,'de','Sprich mit dem Lehrer.'),(4,'de','Ein Ziel'),(5,'de','Kehre zurück.');INSERT INTO QuestData VALUES(18,1,5,'');INSERT INTO QuestStepData VALUES(55,18,2,3);INSERT INTO QuestObjectiveTypeData VALUES(10,4);INSERT INTO QuestObjectiveFreeFormData VALUES(100,55,10,123,'{"x":-2147483648,"y":-2147483648}','{"parameter0":5}');`,
  );
  db.close();
}
test("normalisiert französische/deutsche Akzente", () => {
  assert.equal(normalizeText("ÉPREUVE / Schüler!"), "epreuve schuler");
});

test("OCR suggests a known quest step without writing progress", () => {
  const dir = mkdtempSync(join(tmpdir(), "companion-ocr-"));
  const source = join(dir, "source.sqlite");
  fixture(source);
  const store = new GameDataStore(":memory:");
  try {
    store.importSqlite(source, "fixture");
    const match = store.recognize(
      "Prüfung des Schülers\nKehre zurück.",
      "quests",
    )[0];
    assert.equal(match.id, 18);
    assert.equal(match.stepSuggestion, 0);
    assert.equal(match.needsConfirmation, true);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("importiert reales Schema, sucht bilingual und erkennt Versionsänderungen", () => {
  const dir = mkdtempSync(join(tmpdir(), "companion-test-"));
  const source = join(dir, "source.sqlite");
  fixture(source);
  const store = new GameDataStore(join(dir, "normalized.sqlite"));
  try {
    assert.equal(store.importSqlite(source, "v1").added, 1);
    assert.equal(store.searchQuests("schuler")[0].id, 18);
    assert.equal(store.searchQuests("epreuve")[0].nameFr, "Épreuve de l’élève");
    const quest = store.getQuest(18)!;
    assert.equal(quest.steps[0].objectives[0].coordinates, null);
    assert.equal(quest.steps[0].objectives[0].description, "Kehre zurück.");
    assert.equal(store.importSqlite(source, "v2").changed, 0);
    const db = new DatabaseSync(source);
    db.exec("UPDATE translations SET value='Neue Beschreibung' WHERE id=3");
    db.close();
    assert.equal(store.importSqlite(source, "v3").changed, 1);
    assert.equal(store.getQuest(18)!.version, "v3");
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("fehlerhafter Import erhält stabilen Datenbestand", () => {
  const dir = mkdtempSync(join(tmpdir(), "companion-test-"));
  const source = join(dir, "source.sqlite");
  fixture(source);
  const store = new GameDataStore(":memory:");
  try {
    store.importSqlite(source, "stable");
    const db = new DatabaseSync(source);
    db.exec("DROP TABLE QuestStepData");
    db.close();
    assert.throws(() => store.importSqlite(source, "broken"), /Quellschema/);
    assert.equal(store.status().version, "stable");
    assert.equal(store.getQuest(18)!.steps.length, 1);
    assert.deepEqual(store.searchQuests("%"), []);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("Transaktionsfehler und entfernte Quests werden korrekt behandelt", () => {
  const dir = mkdtempSync(join(tmpdir(), "companion-test-"));
  const source = join(dir, "source.sqlite");
  fixture(source);
  const store = new GameDataStore(":memory:");
  try {
    store.importSqlite(source, "stable");
    let db = new DatabaseSync(source);
    db.exec("INSERT INTO QuestData VALUES(18,1,5,'')");
    db.close();
    assert.throws(() => store.importSqlite(source, "duplicate"), /UNIQUE/);
    assert.equal(store.status().version, "stable");
    assert.equal(store.status().questCount, 1);
    db = new DatabaseSync(source);
    db.exec("DELETE FROM QuestData;INSERT INTO QuestData VALUES(19,1,5,'')");
    db.close();
    const report = store.importSqlite(source, "replacement");
    assert.equal(report.removed, 1);
    assert.equal(report.added, 1);
    assert.equal(store.getQuest(18), undefined);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
