import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DungeonDataset, DungeonEditorial } from "@dofus/core";
import type { PersonalStore } from "./store.js";

const versionSchema = z
  .string()
  .regex(/^3\.\d+\.\d+\.\d+$/)
  .default("3.7.12.12");
const normalize = (value: string) =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const fail = (message: string, statusCode = 400) =>
  Object.assign(Error(message), { statusCode });
export class DungeonStore {
  dataset: DungeonDataset;
  constructor(
    readonly personal: PersonalStore,
    path?: string,
  ) {
    const paths = [
      path,
      process.env.COMPANION_DUNGEON_DATA,
      join(dirname(fileURLToPath(import.meta.url)), "dungeon-data.json"),
      resolve("packages/game-data/assets/dungeon-data.json"),
      resolve("../../packages/game-data/assets/dungeon-data.json"),
    ].filter((p): p is string => !!p);
    const file = paths.find((p) => existsSync(p));
    this.dataset = file
      ? JSON.parse(readFileSync(file, "utf8"))
      : { schema: 1, versions: {} };
    if (this.dataset.schema !== 1)
      throw Error("Unbekanntes Dungeon-Datenformat");
    personal.db
      .exec(`CREATE TABLE IF NOT EXISTS dungeon_editorial(version TEXT NOT NULL,dungeon_id INTEGER NOT NULL,content TEXT NOT NULL,PRIMARY KEY(version,dungeon_id));
    CREATE TABLE IF NOT EXISTS dungeon_preparations(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,version TEXT NOT NULL,dungeon_id INTEGER NOT NULL,content TEXT NOT NULL,PRIMARY KEY(character_id,version,dungeon_id));
    CREATE TABLE IF NOT EXISTS character_professions(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,job_id INTEGER NOT NULL,level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 200),PRIMARY KEY(character_id,job_id));
    CREATE TABLE IF NOT EXISTS profession_quest_progress(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,quest_id INTEGER NOT NULL,quantity INTEGER NOT NULL,completed_at TEXT,updated_at TEXT NOT NULL,PRIMARY KEY(character_id,quest_id));`);
  }
  version(version: string) {
    const data = this.dataset.versions[version];
    if (!data) throw fail("Dungeon-Datenversion nicht installiert", 404);
    return data;
  }
  editorial(version: string, id: number): DungeonEditorial {
    const row = this.personal.db
      .prepare(
        "SELECT content FROM dungeon_editorial WHERE version=? AND dungeon_id=?",
      )
      .get(version, id) as { content: string } | undefined;
    return row
      ? JSON.parse(row.content)
      : (this.version(version).editorial?.find((e) => e.dungeonId === id) ?? {
          version,
          dungeonId: id,
          status: "draft",
          mechanics: [],
          strategy: [],
          sources: [],
          rooms: [],
          reviewedAt: null,
        });
  }
  detail(version: string, id: number) {
    const data = this.version(version),
      dungeon = data.dungeons.find((d) => d.id === id);
    if (!dungeon) return null;
    return {
      ...dungeon,
      version,
      monsters: data.monsters.filter((m) => dungeon.monsterIds.includes(m.id)),
      editorial: this.editorial(version, id),
      importedAt: data.importedAt,
      sourceSha256: data.sourceSha256,
    };
  }
  report(version: string) {
    const data = this.version(version);
    const edits = data.dungeons.map((d) => this.editorial(version, d.id));
    return {
      ...data.report,
      sourcedStrategies: edits.filter(
        (e) => e.sources.length && e.strategy.length,
      ).length,
      verifiedStrategies: edits.filter(
        (e) => e.status === "verified" && e.strategy.length,
      ).length,
      verifiedMechanics: edits
        .filter((e) => e.status === "verified" || e.mechanicsVerified)
        .reduce((n, e) => n + e.mechanics.length, 0),
      roomCompositions: edits.reduce((n, e) => n + e.rooms.length, 0),
      incompleteStrategies: edits.filter(
        (e) => e.status !== "verified" || !e.strategy.length,
      ).length,
      source: data.source,
      sourceSha256: data.sourceSha256,
      importedAt: data.importedAt,
    };
  }
  character(id: string) {
    if (!this.personal.characters().some((c) => c.id === id))
      throw fail("Charakter nicht gefunden", 404);
  }
}
const sourceSchema = z.object({
  url: z
    .url()
    .refine((u) => u.startsWith("https://"), "HTTPS-Quellenlink erforderlich"),
  version: z.string().min(1).max(40),
  checkedAt: z.iso.datetime(),
});
const editorialSchema = z.object({
  status: z.enum(["draft", "partial", "verified"]),
  versionNote: z.string().max(1000).optional(),
  mechanicsVerified: z.boolean().optional(),
  mechanics: z.array(z.string().trim().min(1).max(3000)).max(100),
  strategy: z.array(z.string().trim().min(1).max(5000)).max(100),
  sources: z.array(sourceSchema).max(30),
  rooms: z
    .array(
      z.object({
        mapId: z.number().int().positive(),
        order: z.number().int().nonnegative(),
        type: z.enum(["room", "boss", "wave"]),
        players: z.number().int().min(1).max(8),
        monsters: z
          .array(
            z.object({
              id: z.number().int().positive(),
              count: z.number().int().min(1).max(20),
            }),
          )
          .max(30),
      }),
    )
    .max(100),
});
export function registerDungeons(
  app: FastifyInstance,
  personal: PersonalStore,
  path?: string,
) {
  const store = new DungeonStore(personal, path);
  const queryVersion = (value: unknown) =>
    z.object({ version: versionSchema }).parse(value).version;
  app.get("/api/dungeons/versions", () => ({
    data: Object.keys(store.dataset.versions),
  }));
  app.get("/api/dungeons/report", (request) => {
    const version = queryVersion(request.query);
    return { data: store.report(version), version };
  });
  app.get("/api/dungeons", (request) => {
    const f = z
      .object({
        version: versionSchema,
        q: z.string().max(150).default(""),
        category: z.enum(["all", "classic", "expedition"]).default("all"),
        minLevel: z.coerce.number().min(0).max(200).default(0),
        maxLevel: z.coerce.number().min(0).max(200).default(200),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(30),
      })
      .parse(request.query);
    const all = store
      .version(f.version)
      .dungeons.filter(
        (d) =>
          (f.category === "all" ||
            (f.category === "expedition"
              ? d.nameFr.startsWith("Expédition")
              : !d.nameFr.startsWith("Expédition"))) &&
          d.level >= f.minLevel &&
          d.level <= f.maxLevel &&
          normalize(
            [
              d.name,
              d.nameFr,
              d.nameEn,
              ...d.bossNames,
              d.region,
              d.entrance?.subAreaName,
            ].join(" "),
          ).includes(normalize(f.q)),
      );
    return {
      data: all.slice((f.page - 1) * f.pageSize, f.page * f.pageSize),
      total: all.length,
      page: f.page,
      pageSize: f.pageSize,
      version: f.version,
    };
  });
  app.get("/api/dungeons/:id", (request, reply) => {
    const id = z.coerce
        .number()
        .int()
        .positive()
        .parse((request.params as { id: string }).id),
      version = queryVersion(request.query),
      data = store.detail(version, id);
    return data
      ? { data, version }
      : reply.code(404).send({ error: "Dungeon nicht gefunden" });
  });
  app.put("/api/dungeons/:id/editorial", (request) => {
    const id = z.coerce
        .number()
        .int()
        .positive()
        .parse((request.params as { id: string }).id),
      version = queryVersion(request.query),
      detail = store.detail(version, id);
    if (!detail) throw fail("Dungeon nicht gefunden", 404);
    const input = editorialSchema.parse(request.body);
    if (
      (input.status === "verified" || input.mechanicsVerified) &&
      (!input.sources.length ||
        input.sources.some((s) => s.version !== version))
    )
      throw fail(
        "Verifizierte Inhalte benötigen ausschließlich Quellen für genau diese Spielversion.",
      );
    const monsterIds = new Set(
      store.version(version).monsters.map((m) => m.id),
    );
    if (
      input.rooms.some(
        (r) =>
          !detail.mapIds.includes(r.mapId) ||
          r.monsters.some((m) => !monsterIds.has(m.id)),
      )
    )
      throw fail("Raum oder Monster passt nicht zum importierten Datenstand.");
    const data = {
      ...input,
      version,
      dungeonId: id,
      reviewedAt: input.status === "verified" ? new Date().toISOString() : null,
    };
    personal.db
      .prepare(
        "INSERT INTO dungeon_editorial VALUES(?,?,?) ON CONFLICT(version,dungeon_id) DO UPDATE SET content=excluded.content",
      )
      .run(version, id, JSON.stringify(data));
    return { data };
  });
  app.get("/api/dungeon-personal/:characterId/:id", (request) => {
    const { characterId, id } = z
        .object({
          characterId: z.string().uuid(),
          id: z.coerce.number().int().positive(),
        })
        .parse(request.params),
      version = queryVersion(request.query);
    store.character(characterId);
    if (!store.detail(version, id)) throw fail("Dungeon nicht gefunden", 404);
    const row = personal.db
      .prepare(
        "SELECT content FROM dungeon_preparations WHERE character_id=? AND version=? AND dungeon_id=?",
      )
      .get(characterId, version, id) as { content: string } | undefined;
    return {
      data: row
        ? JSON.parse(row.content)
        : { favorite: false, checklist: {}, players: 4 },
    };
  });
  app.put("/api/dungeon-personal/:characterId/:id", (request) => {
    const { characterId, id } = z
        .object({
          characterId: z.string().uuid(),
          id: z.coerce.number().int().positive(),
        })
        .parse(request.params),
      version = queryVersion(request.query);
    store.character(characterId);
    if (!store.detail(version, id)) throw fail("Dungeon nicht gefunden", 404);
    const data = z
      .object({
        favorite: z.boolean(),
        players: z.number().int().min(1).max(8),
        checklist: z.record(
          z.enum([
            "access",
            "key",
            "build",
            "equipment",
            "mechanics",
            "achievements",
            "group",
            "travel",
          ]),
          z.boolean(),
        ),
      })
      .parse(request.body);
    personal.db
      .prepare(
        "INSERT INTO dungeon_preparations VALUES(?,?,?,?) ON CONFLICT(character_id,version,dungeon_id) DO UPDATE SET content=excluded.content",
      )
      .run(characterId, version, id, JSON.stringify(data));
    return { data };
  });
  app.get("/api/professions", (request) => ({
    data: store.version(queryVersion(request.query)).professions,
  }));
  app.get("/api/profession-quests", (request) => ({
    data: store.version(queryVersion(request.query)).professionQuests,
  }));
  app.get("/api/profession-personal/:characterId", (request) => {
    const characterId = z
      .string()
      .uuid()
      .parse((request.params as { characterId: string }).characterId);
    store.character(characterId);
    return {
      data: {
        levels: personal.db
          .prepare(
            "SELECT job_id AS jobId,level FROM character_professions WHERE character_id=?",
          )
          .all(characterId),
        quests: personal.db
          .prepare(
            "SELECT quest_id AS questId,quantity,completed_at AS completedAt,updated_at AS updatedAt FROM profession_quest_progress WHERE character_id=?",
          )
          .all(characterId),
      },
    };
  });
  app.put("/api/profession-personal/:characterId/levels", (request) => {
    const characterId = z
      .string()
      .uuid()
      .parse((request.params as { characterId: string }).characterId);
    store.character(characterId);
    const data = z
      .object({
        jobId: z.number().int(),
        level: z.number().int().min(1).max(200),
      })
      .parse(request.body);
    if (
      !Object.values(store.dataset.versions).some((v) =>
        v.professions.some((j) => j.id === data.jobId),
      )
    )
      throw fail("Unbekannter Sammelberuf");
    personal.db
      .prepare(
        "INSERT INTO character_professions VALUES(?,?,?) ON CONFLICT(character_id,job_id) DO UPDATE SET level=excluded.level",
      )
      .run(characterId, data.jobId, data.level);
    return { data };
  });
  app.put(
    "/api/profession-personal/:characterId/quests/:questId",
    (request) => {
      const { characterId, questId } = z
          .object({
            characterId: z.string().uuid(),
            questId: z.coerce.number().int().positive(),
          })
          .parse(request.params),
        version = queryVersion(request.query);
      store.character(characterId);
      const quest = store
        .version(version)
        .professionQuests.find((q) => q.id === questId);
      if (!quest) throw fail("Berufsquest nicht gefunden", 404);
      const input = z
        .object({ quantity: z.number().int().min(0), completed: z.boolean() })
        .parse(request.body);
      if (
        input.quantity > quest.quantity ||
        (input.completed && input.quantity < quest.quantity)
      )
        throw fail("Fortschritt passt nicht zur benötigten Menge.");
      const data = {
        questId,
        quantity: input.quantity,
        completedAt: input.completed ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      };
      personal.db
        .prepare(
          "INSERT INTO profession_quest_progress VALUES(?,?,?,?,?) ON CONFLICT(character_id,quest_id) DO UPDATE SET quantity=excluded.quantity,completed_at=excluded.completed_at,updated_at=excluded.updated_at",
        )
        .run(
          characterId,
          questId,
          data.quantity,
          data.completedAt,
          data.updatedAt,
        );
      return { data };
    },
  );
  return store;
}
