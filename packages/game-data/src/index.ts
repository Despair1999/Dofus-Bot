import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import {
  createWriteStream,
  mkdirSync,
  rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";

export interface Objective {
  id: number;
  typeId: number;
  mapId: number | null;
  coordinates: { x: number; y: number } | null;
  parameters: Record<string, unknown>;
  description: string;
}
export interface QuestStep {
  id: number;
  name: string;
  description: string;
  objectives: Objective[];
}
export interface Quest {
  id: number;
  name: string;
  nameFr: string;
  level: number;
  requirements: string;
  steps: QuestStep[];
  source: string;
  version: string;
  updatedAt: string;
}
export interface ImportReport {
  version: string;
  added: number;
  changed: number;
  removed: number;
  questCount: number;
  updatedAt: string;
}
type Row = Record<string, any>;
const SOURCE = "dofus-sqlite";
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("de")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
function parse(raw: unknown): any {
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}
function text(db: DatabaseSync, id: number, lang = "de"): string {
  const r = db
    .prepare("SELECT value FROM translations WHERE id=? AND lang=?")
    .get(id, lang) as Row | undefined;
  return r?.value ?? "";
}
function safeIdentifier(name: string): string {
  if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(name))
    throw new Error("Ungültiger Tabellenname");
  return '"' + name + '"';
}

export class GameDataStore {
  private db: DatabaseSync;
  private updating = false;
  constructor(public readonly path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS game_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS quests(id INTEGER PRIMARY KEY,name TEXT NOT NULL,name_fr TEXT NOT NULL,search_text TEXT NOT NULL,content TEXT NOT NULL,hash TEXT NOT NULL); CREATE TABLE IF NOT EXISTS game_imports(id INTEGER PRIMARY KEY,version TEXT NOT NULL,report TEXT NOT NULL,created_at TEXT NOT NULL);",
    );
  }
  close() {
    this.db.close();
  }
  status() {
    return {
      source: SOURCE,
      version:
        (
          this.db
            .prepare("SELECT value FROM game_meta WHERE key='version'")
            .get() as Row | undefined
        )?.value ?? null,
      questCount: Number(
        (this.db.prepare("SELECT count(*) n FROM quests").get() as Row).n,
      ),
      updatedAt:
        (
          this.db
            .prepare("SELECT value FROM game_meta WHERE key='updatedAt'")
            .get() as Row | undefined
        )?.value ?? null,
    };
  }
  searchQuests(query: string, lang: "de" | "fr" = "de", limit = 30): Quest[] {
    const q = normalizeText(query).slice(0, 200);
    if (query.trim() && !q) return [];
    const count = Math.max(1, Math.min(100, Math.trunc(limit) || 30));
    const rows = this.db
      .prepare(
        "SELECT content FROM quests WHERE search_text LIKE ? ESCAPE '\\' ORDER BY name LIMIT ?",
      )
      .all("%" + q.replace(/[\\%_]/g, "\\$&") + "%", count) as Row[];
    return rows.map((r) => {
      const quest = JSON.parse(r.content) as Quest;
      if (lang === "fr" && quest.nameFr) quest.name = quest.nameFr;
      return quest;
    });
  }
  getQuest(id: number): Quest | undefined {
    const row = this.db
      .prepare("SELECT content FROM quests WHERE id=?")
      .get(id) as Row | undefined;
    return row ? JSON.parse(row.content) : undefined;
  }
  importSqlite(sourcePath: string, version: string): ImportReport {
    if (!version || version.length > 100)
      throw new Error("Datenversion erforderlich");
    const src = new DatabaseSync(sourcePath, { readOnly: true });
    try {
      const check = src.prepare("PRAGMA quick_check").get() as Row;
      if (Object.values(check)[0] !== "ok")
        throw new Error("SQLite-Integritätsprüfung fehlgeschlagen");
      const tables = new Set(
        (
          src
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .all() as Row[]
        ).map((r) => r.name),
      );
      for (const t of [
        "QuestData",
        "QuestStepData",
        "translations",
        "QuestObjectiveTypeData",
      ])
        if (!tables.has(t))
          throw new Error("Nicht unterstütztes Quellschema: " + t);
      const objectiveTables = [...tables].filter(
        (t) =>
          /^QuestObjective[A-Za-z]*Data$/.test(t) &&
          t !== "QuestObjectiveTypeData",
      );
      if (!objectiveTables.length)
        throw new Error("Keine Questzieltabellen vorhanden");
      const objectives = new Map<number, Objective[]>();
      for (const table of objectiveTables) {
        for (const row of src
          .prepare("SELECT * FROM " + safeIdentifier(table))
          .all() as Row[]) {
          const p = parse(row.parameters) as Record<string, unknown>;
          const raw = parse(row.coords);
          const coordinates =
            raw &&
            Number.isFinite(raw.x) &&
            Number.isFinite(raw.y) &&
            Math.abs(raw.x) < 10000 &&
            Math.abs(raw.y) < 10000
              ? raw
              : null;
          const type = src
            .prepare("SELECT nameId FROM QuestObjectiveTypeData WHERE id=?")
            .get(row.typeId) as Row | undefined;
          let description = type ? text(src, type.nameId) : "";
          // Parameter meanings differ between objective subtypes: retain raw parameters instead of inventing instructions.
          if (
            table === "QuestObjectiveFreeFormData" &&
            typeof p.parameter0 === "number"
          )
            description = text(src, p.parameter0) || description;
          const list = objectives.get(row.stepId) ?? [];
          list.push({
            id: row.id,
            typeId: row.typeId,
            mapId: row.mapId || null,
            coordinates,
            parameters: p,
            description,
          });
          objectives.set(row.stepId, list);
        }
      }
      const steps = new Map<number, QuestStep[]>();
      for (const row of src
        .prepare("SELECT * FROM QuestStepData ORDER BY id")
        .all() as Row[]) {
        const list = steps.get(row.questId) ?? [];
        list.push({
          id: row.id,
          name: text(src, row.nameId) || text(src, row.nameId, "fr"),
          description:
            text(src, row.descriptionId) || text(src, row.descriptionId, "fr"),
          objectives: objectives.get(row.id) ?? [],
        });
        steps.set(row.questId, list);
      }
      const quests = src
        .prepare("SELECT * FROM QuestData ORDER BY id")
        .all() as Row[];
      if (!quests.length) throw new Error("Leerer Import abgelehnt");
      const updatedAt = new Date().toISOString();
      const old = new Map(
        (this.db.prepare("SELECT id,hash FROM quests").all() as Row[]).map(
          (r) => [r.id, r.hash],
        ),
      );
      const report: ImportReport = {
        version,
        added: 0,
        changed: 0,
        removed: 0,
        questCount: quests.length,
        updatedAt,
      };
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.exec("DELETE FROM quests");
        const insert = this.db.prepare(
          "INSERT INTO quests(id,name,name_fr,search_text,content,hash) VALUES(?,?,?,?,?,?)",
        );
        for (const row of quests) {
          const nameFr = text(src, row.nameId, "fr");
          const name = text(src, row.nameId) || nameFr;
          const content: Quest = {
            id: row.id,
            name,
            nameFr,
            level: row.levelMin,
            requirements: row.startCriterion ?? "",
            steps: steps.get(row.id) ?? [],
            source: SOURCE,
            version,
            updatedAt,
          };
          const hash = createHash("sha256")
            .update(
              JSON.stringify({
                ...content,
                version: undefined,
                updatedAt: undefined,
              }),
            )
            .digest("hex");
          if (!old.has(row.id)) report.added++;
          else if (old.get(row.id) !== hash) report.changed++;
          old.delete(row.id);
          insert.run(
            row.id,
            name,
            nameFr,
            normalizeText(name + " " + nameFr),
            JSON.stringify(content),
            hash,
          );
        }
        report.removed = old.size;
        const meta = this.db.prepare(
          "INSERT OR REPLACE INTO game_meta(key,value) VALUES(?,?)",
        );
        meta.run("version", version);
        meta.run("updatedAt", updatedAt);
        this.db
          .prepare(
            "INSERT INTO game_imports(version,report,created_at) VALUES(?,?,?)",
          )
          .run(version, JSON.stringify(report), updatedAt);
        this.db.exec("COMMIT");
        return report;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    } finally {
      src.close();
    }
  }
  async updateLatest(): Promise<ImportReport> {
    if (this.updating) throw new Error("Ein Datenimport läuft bereits");
    this.updating = true;
    const temporary = join(
      tmpdir(),
      "dofus-import-" + randomUUID() + ".sqlite",
    );
    try {
      const response = await fetch(
        "https://api.github.com/repos/ledouxm/dofus-sqlite/releases/latest",
        {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "Dofus-Companion/0.1",
          },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok)
        throw new Error("GitHub-Release nicht verfügbar: " + response.status);
      const release = (await response.json()) as {
        tag_name: string;
        prerelease: boolean;
        draft: boolean;
        assets: {
          name: string;
          size: number;
          digest?: string;
          browser_download_url: string;
        }[];
      };
      const asset = release.assets?.find((a) => a.name === "dofus.sqlite");
      if (
        release.draft ||
        release.prerelease ||
        !asset ||
        asset.size > 800_000_000 ||
        asset.size < 1024
      )
        throw new Error("Kein geeignetes Datenbank-Release");
      const url = new URL(asset.browser_download_url);
      if (
        url.origin !== "https://github.com" ||
        !url.pathname.startsWith("/ledouxm/dofus-sqlite/releases/download/")
      )
        throw new Error("Unerwartete Downloadquelle");
      if (!asset.digest?.match(/^sha256:[a-f0-9]{64}$/))
        throw new Error(
          "Release ohne überprüfbare SHA-256-Prüfsumme abgelehnt",
        );
      const download = await fetch(url, {
        signal: AbortSignal.timeout(180000),
      });
      if (!download.ok || !download.body)
        throw new Error("Download fehlgeschlagen: " + download.status);
      let size = 0;
      const hash = createHash("sha256");
      const verify = new Transform({
        transform(chunk, _enc, cb) {
          size += chunk.length;
          if (size > asset.size) {
            cb(new Error("Download größer als angekündigt"));
            return;
          }
          hash.update(chunk);
          cb(null, chunk);
        },
      });
      await pipeline(
        Readable.fromWeb(download.body as any),
        verify,
        createWriteStream(temporary, { flags: "wx" }),
      );
      if (
        size !== asset.size ||
        "sha256:" + hash.digest("hex") !== asset.digest
      )
        throw new Error("Download-Prüfsumme oder Dateigröße stimmt nicht");
      return this.importSqlite(temporary, release.tag_name);
    } finally {
      rmSync(temporary, { force: true });
      this.updating = false;
    }
  }
}
