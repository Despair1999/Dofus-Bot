import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { verifiedDownload } from "./download.js";
import {
  createCatalogSchema,
  importCatalog,
  catalogStatus,
  searchCatalog,
  getCatalogItem,
  catalogTypes,
  classCatalog,
  enrichQuestRelations,
  questCategories,
  fetchCatalogSupplement,
  type CatalogFilters,
  type CatalogSupplement,
} from "./catalog.js";
import { matchCandidates, similarity } from "@dofus/core";
export type { CatalogItem, CatalogFilters } from "./catalog.js";
export interface Objective {
  id: number;
  typeId: number;
  mapId: number | null;
  coordinates: { x: number; y: number } | null;
  parameters: Record<string, unknown>;
  description: string;
  npc?: { id: number; name: string | null };
  monster?: { id: number; name: string | null; quantity: number };
  material?: {
    itemId: number;
    quantity: number;
    name: string;
    category?: string;
    imageUrl?: string;
  };
}
export interface QuestStep {
  id: number;
  name: string;
  description: string;
  objectives: Objective[];
}
export interface Quest {
  guideUrl?: string;
  id: number;
  name: string;
  nameFr: string;
  level: number;
  requirements: string;
  steps: QuestStep[];
  source: string;
  version: string;
  updatedAt: string;
  categoryIds?: string[];
  achievements?: {
    id: number;
    name: string;
    description: string;
    categoryId: string;
  }[];
  materials?: {
    itemId: number;
    quantity: number;
    name: string;
    category?: string;
    imageUrl?: string;
    stepId: number;
    objectiveId: number;
  }[];
  startPositions?: {
    mapId: number;
    npcId: number;
    npcName: string | null;
    coordinates: { x: number; y: number; worldMap?: number } | null;
  }[];
  rewards?: {
    stepId: number;
    kamasRatio: number;
    experienceRatio: number;
    levelMin: number;
    levelMax: number;
    items: {
      itemId: number;
      quantity: number;
      name: string;
      imageUrl?: string;
      category?: string;
    }[];
  }[];
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
  progress: { phase: string; percent: number; message: string } = {
    phase: "idle",
    percent: 0,
    message: "Bereit",
  };
  constructor(public readonly path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS game_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS quests(id INTEGER PRIMARY KEY,name TEXT NOT NULL,name_fr TEXT NOT NULL,search_text TEXT NOT NULL,content TEXT NOT NULL,hash TEXT NOT NULL); CREATE TABLE IF NOT EXISTS game_imports(id INTEGER PRIMARY KEY,version TEXT NOT NULL,report TEXT NOT NULL,created_at TEXT NOT NULL);",
    );
    createCatalogSchema(this.db);
  }
  close() {
    this.db.close();
  }
  /** Installs only public game data; personal.sqlite and frontend records are never touched. */
  installBundledCatalog(seedPath: string) {
    if (this.status().itemCount > 0) return false;
    this.db.prepare("ATTACH DATABASE ? AS catalog_seed").run(seedPath);
    try {
      const integrity = this.db
        .prepare("PRAGMA catalog_seed.quick_check")
        .get() as Row;
      if (Object.values(integrity)[0] !== "ok")
        throw new Error("Gebündelter Katalog ist beschädigt");
      const count = (
        this.db
          .prepare("SELECT count(*) n FROM catalog_seed.catalog_items")
          .get() as Row
      ).n;
      if (count < 1000)
        throw new Error("Unvollständiger gebündelter Katalog abgelehnt");
      this.db.exec("BEGIN IMMEDIATE; PRAGMA defer_foreign_keys=ON");
      try {
        const tables = [
          "quest_category_links",
          "quest_categories",
          "recipe_ingredients",
          "catalog_search_tokens",
          "catalog_items",
          "item_types",
          "classes",
          "quests",
          "game_meta",
        ];
        for (const table of tables) this.db.exec(`DELETE FROM ${table}`);
        for (const table of tables.reverse())
          this.db.exec(
            `INSERT INTO ${table} SELECT * FROM catalog_seed.${table}`,
          );
        this.db.exec("COMMIT");
        return true;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    } finally {
      this.db.exec("DETACH DATABASE catalog_seed");
    }
  }
  status() {
    return {
      ...catalogStatus(this.db),
      progress: this.progress,
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
  searchItems(filters: CatalogFilters = {}) {
    return {
      ...searchCatalog(this.db, filters),
      source: "Lokaler DOFUS-Katalog",
      version: this.status().version,
    };
  }
  getItem(id: number) {
    return getCatalogItem(this.db, id);
  }
  itemTypes() {
    return catalogTypes(this.db);
  }
  classes() {
    return classCatalog(this.db);
  }
  questCategories() {
    return questCategories(this.db);
  }
  recognize(text: string, kind: "items" | "quests") {
    const candidates =
      kind === "items"
        ? (
            this.db
              .prepare("SELECT id,name,name_fr,name_en FROM catalog_items")
              .all() as Row[]
          ).map((i) => ({
            id: i.id,
            name: i.name,
            aliases: [i.name_fr, i.name_en],
          }))
        : (
            this.db.prepare("SELECT id,name,name_fr FROM quests").all() as Row[]
          ).map((q) => ({ id: q.id, name: q.name, aliases: [q.name_fr] }));
    return matchCandidates(text, candidates).map(({ candidate, score }) => {
      const quest = kind === "quests" ? this.getQuest(candidate.id) : undefined;
      const lines = text
        .split(/[\r\n]+/)
        .filter((line) => line.trim().length > 3);
      const steps = quest?.steps
        .map((step, index) => ({
          index,
          name: step.name,
          score: Math.max(
            0,
            ...[
              step.name,
              ...step.objectives.map((o) => o.description),
            ].flatMap((value) => lines.map((line) => similarity(line, value))),
          ),
        }))
        .sort((a, b) => b.score - a.score);
      const best = steps?.[0];
      const suggested =
        best &&
        best.score >= 0.3 &&
        (!steps?.[1] || best.score > steps[1].score)
          ? best
          : undefined;
      return {
        ...candidate,
        score,
        needsConfirmation: true,
        ...(suggested
          ? {
              stepSuggestion: suggested.index,
              stepLabel: suggested.name,
              stepScore: suggested.score,
            }
          : {}),
      };
    });
  }
  searchQuestPage(
    filters: {
      q?: string;
      lang?: "de" | "fr";
      categoryId?: string;
      minLevel?: number;
      maxLevel?: number;
      page?: number;
      pageSize?: number;
      ids?: number[];
      excludeIds?: number[];
    } = {},
  ) {
    const q = normalizeText(filters.q ?? "");
    const clauses: string[] = [],
      params: (string | number)[] = [];
    if (q) {
      clauses.push("q.search_text LIKE ?");
      params.push("%" + q + "%");
    }
    if (filters.categoryId) {
      const all = this.questCategories();
      const ids = new Set<string>([filters.categoryId]);
      for (let i = 0; i < all.length; i++)
        for (const c of all)
          if (c.parentId && ids.has(c.parentId)) ids.add(c.id);
      clauses.push(
        `q.id IN (SELECT quest_id FROM quest_category_links WHERE category_id IN (${[...ids].map(() => "?").join(",")}))`,
      );
      params.push(...ids);
    }
    if (filters.minLevel !== undefined) {
      clauses.push("json_extract(q.content,'$.level')>=?");
      params.push(filters.minLevel);
    }
    if (filters.maxLevel !== undefined) {
      clauses.push("json_extract(q.content,'$.level')<=?");
      params.push(filters.maxLevel);
    }
    if (filters.ids) {
      if (!filters.ids.length)
        return {
          data: [],
          total: 0,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 30,
        };
      clauses.push(`q.id IN (${filters.ids.map(() => "?").join(",")})`);
      params.push(...filters.ids);
    }
    if (filters.excludeIds?.length) {
      clauses.push(
        `q.id NOT IN (${filters.excludeIds.map(() => "?").join(",")})`,
      );
      params.push(...filters.excludeIds);
    }
    const clause = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
    const total = Number(
      (
        this.db
          .prepare("SELECT count(*) n FROM quests q " + clause)
          .get(...params) as Row
      ).n,
    );
    const page = Math.max(1, filters.page ?? 1),
      pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 30));
    const data = (
      this.db
        .prepare(
          "SELECT content FROM quests q " +
            clause +
            " ORDER BY q.name LIMIT ? OFFSET ?",
        )
        .all(...params, pageSize, (page - 1) * pageSize) as Row[]
    ).map((r) => {
      const quest = JSON.parse(r.content) as Quest;
      if (filters.lang === "fr" && quest.nameFr) quest.name = quest.nameFr;
      return quest;
    });
    return { data, total, page, pageSize };
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
    if (!row) return undefined;
    const quest = JSON.parse(row.content) as Quest;
    const guides: Record<string, string> = {
      "Destination Astrub":
        "https://www.dofuspourlesnoobs.com/destination-astrub.html",
      "Réponses à tout":
        "https://www.dofuspourlesnoobs.com/reacuteponses-agrave-tout.html",
    };
    quest.guideUrl = guides[quest.nameFr];
    return quest;
  }
  importSqlite(
    sourcePath: string,
    version: string,
    supplement?: CatalogSupplement,
  ): ImportReport {
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
      const previousHashes = new Map(old);
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
        this.progress = {
          phase: "import",
          percent: 80,
          message: "Importiere vollständigen Itemkatalog und Klassen",
        };
        importCatalog(src, this.db, version, supplement);
        enrichQuestRelations(src, this.db);
        report.added = 0;
        report.changed = 0;
        const hashUpdate = this.db.prepare(
          "UPDATE quests SET hash=? WHERE id=?",
        );
        for (const row of this.db
          .prepare("SELECT id,content FROM quests")
          .all() as Row[]) {
          const value = JSON.parse(row.content);
          delete value.version;
          delete value.updatedAt;
          const hash = createHash("sha256")
            .update(JSON.stringify(value))
            .digest("hex");
          hashUpdate.run(hash, row.id);
          if (!previousHashes.has(row.id)) report.added++;
          else if (previousHashes.get(row.id) !== hash) report.changed++;
        }
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
        this.progress = {
          phase: "complete",
          percent: 100,
          message: "Spieldaten erfolgreich importiert",
        };
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
      const temporary = join(
        dirname(this.path),
        "downloads",
        asset.digest.slice(7) + ".sqlite",
      );
      await verifiedDownload(
        url.href,
        temporary,
        asset.size,
        asset.digest,
        (percent) => {
          this.progress = {
            phase: "download",
            percent,
            message: "Lade und prüfe Spieldaten (Fortsetzen möglich)",
          };
        },
      );
      this.progress = {
        phase: "download",
        percent: 70,
        message: "Lade verifizierte Dofusdude-Itemdaten",
      };
      const supplement = await fetchCatalogSupplement();
      return this.importSqlite(temporary, release.tag_name, supplement);
    } finally {
      this.updating = false;
    }
  }
}
