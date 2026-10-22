import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  buildInput,
  calculateBuild,
  compatible,
  effectSQL,
  effectFilterSchema,
  statDefinitions,
  type Build,
  type BuildInput,
  type BuilderItem,
  type BuilderSet,
  type BuilderSpell,
  type GameClass,
} from "@dofus/core";
import type { GameDataStore } from "@dofus/game-data";
import { PersonalStore, ConflictError } from "./store.js";
export interface VersionData {
  catalogEffects?: {
    itemId: number;
    effects: import("@dofus/core").NumericEffect[];
  }[];
  items: BuilderItem[];
  sets: BuilderSet[];
  spells: BuilderSpell[];
  report: unknown;
  classes: GameClass[];
}
interface Dataset {
  schema: number;
  versions: Record<string, VersionData>;
}
const versionSchema = z.enum(["3.6.12.16", "3.7.12.12"]).default("3.7.12.12");
export class BuilderStore {
  dataset: Dataset;
  items = new Map<string, Map<number, BuilderItem>>();
  sets = new Map<string, Map<number, BuilderSet>>();
  constructor(
    readonly personal: PersonalStore,
    readonly game: GameDataStore,
    path?: string,
  ) {
    const paths = [
      path,
      process.env.COMPANION_BUILDER_DATA,
      join(dirname(fileURLToPath(import.meta.url)), "builder-data.json"),
      resolve("packages/game-data/assets/builder-data.json"),
      resolve("../../packages/game-data/assets/builder-data.json"),
    ].filter((p): p is string => !!p);
    const file = paths.find((p) => existsSync(p));
    this.dataset = file
      ? JSON.parse(readFileSync(file, "utf8"))
      : { schema: 1, versions: {} };
    if (this.dataset.schema !== 1)
      throw Error("Unbekanntes Builder-Datenformat");
    if (!game.classes().length) {
      for (const c of this.dataset.versions["3.7.12.12"]?.classes ?? [])
        game.db
          .prepare("INSERT OR IGNORE INTO classes VALUES(?,?,?)")
          .run(
            c.id,
            [c.nameDe, c.nameFr, c.nameEn, ...c.aliases]
              .join(" ")
              .normalize("NFKD")
              .replace(/\p{M}/gu, "")
              .toLowerCase(),
            JSON.stringify(c),
          );
    }
    personal.db
      .exec(`CREATE TABLE IF NOT EXISTS builder_projects(id TEXT PRIMARY KEY,character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,revision INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 0,content TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS builder_active_character ON builder_projects(character_id) WHERE active=1 AND character_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS builder_character ON builder_projects(character_id);
      CREATE TABLE IF NOT EXISTS builder_target_profiles(id TEXT PRIMARY KEY,content TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS builder_shares(id TEXT PRIMARY KEY,build_id TEXT NOT NULL REFERENCES builder_projects(id) ON DELETE CASCADE,content TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,leased_at INTEGER,error TEXT);
      INSERT OR IGNORE INTO migrations VALUES(3,datetime('now'));`);
    game.db
      .exec(`CREATE TABLE IF NOT EXISTS builder_items(version TEXT NOT NULL,id INTEGER NOT NULL,name TEXT NOT NULL,search_text TEXT NOT NULL,level INTEGER NOT NULL,type_id INTEGER NOT NULL,set_name TEXT NOT NULL,content TEXT NOT NULL,PRIMARY KEY(version,id));
      CREATE INDEX IF NOT EXISTS builder_item_search ON builder_items(version,level,type_id,name);
      CREATE TABLE IF NOT EXISTS builder_item_effects(version TEXT NOT NULL,item_id INTEGER NOT NULL,effect_id INTEGER NOT NULL,value_min INTEGER NOT NULL,value_max INTEGER NOT NULL,active INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS builder_effect_coverage(version TEXT NOT NULL,item_id INTEGER NOT NULL,PRIMARY KEY(version,item_id));
      CREATE INDEX IF NOT EXISTS builder_effect_lookup ON builder_item_effects(version,item_id,effect_id,active,value_min,value_max);
      CREATE INDEX IF NOT EXISTS builder_effect_filter ON builder_item_effects(version,effect_id,active,value_max,item_id);`);
    const hash = createHash("sha256")
      .update(JSON.stringify(this.dataset))
      .digest("hex");
    const previous = game.db
      .prepare("SELECT value FROM game_meta WHERE key='builder_data_hash'")
      .get() as { value: string } | undefined;
    for (const [version, data] of Object.entries(this.dataset.versions)) {
      this.items.set(version, new Map(data.items.map((i) => [i.id, i])));
      this.sets.set(version, new Map(data.sets.map((s) => [s.id, s])));
    }
    if (previous?.value !== hash) {
      game.db.exec("BEGIN IMMEDIATE");
      try {
        game.db.exec(
          "DELETE FROM builder_items; DELETE FROM builder_item_effects; DELETE FROM builder_effect_coverage;",
        );
        const item = game.db.prepare(
            "INSERT INTO builder_items VALUES(?,?,?,?,?,?,?,?)",
          ),
          effect = game.db.prepare(
            "INSERT INTO builder_item_effects VALUES(?,?,?,?,?,?)",
          );
        for (const [version, data] of Object.entries(this.dataset.versions))
          for (const i of data.items) {
            if (i.effectsKnown)
              game.db
                .prepare(
                  "INSERT OR IGNORE INTO builder_effect_coverage VALUES(?,?)",
                )
                .run(version, i.id);
            item.run(
              version,
              i.id,
              i.name,
              i.name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase(),
              i.level,
              i.typeId,
              i.setName,
              JSON.stringify(i),
            );
            for (const e of i.effects)
              effect.run(version, i.id, e.id, e.min, e.max, e.active ? 1 : 0);
          }
        for (const [version, data] of Object.entries(this.dataset.versions))
          for (const item of data.catalogEffects ?? []) {
            game.db
              .prepare(
                "INSERT OR IGNORE INTO builder_effect_coverage VALUES(?,?)",
              )
              .run(version, item.itemId);
            for (const e of item.effects)
              effect.run(
                version,
                item.itemId,
                e.id,
                e.min,
                e.max,
                e.active ? 1 : 0,
              );
          }
        game.db
          .prepare("INSERT OR REPLACE INTO game_meta VALUES(?,?)")
          .run("builder_data_hash", hash);
        game.db.exec("COMMIT");
      } catch (e) {
        game.db.exec("ROLLBACK");
        throw e;
      }
    }
  }
  list(characterId?: string) {
    return (
      this.personal.db
        .prepare(
          "SELECT * FROM builder_projects" +
            (characterId ? " WHERE character_id=?" : "") +
            " ORDER BY updated_at DESC",
        )
        .all(...(characterId ? [characterId] : [])) as {
        id: string;
        character_id: string | null;
        content: string;
        active: number;
        revision: number;
      }[]
    ).map(
      (r) =>
        ({
          ...JSON.parse(r.content),
          id: r.id,
          characterId: r.character_id,
          active: !!r.active,
          revision: r.revision,
        }) as Build,
    );
  }
  get(id: string) {
    return this.list().find((b) => b.id === id);
  }
  validate(build: BuildInput) {
    const data = this.dataset.versions[build.gameVersion];
    if (!data)
      throw Object.assign(Error("Datenversion nicht installiert"), {
        statusCode: 400,
      });
    if (!data.classes.some((c) => c.id === build.classId))
      throw Object.assign(Error("Unbekannte Klassen-ID"), { statusCode: 400 });
    for (const buff of build.buffs) {
      if (
        Object.keys(buff.stats).some(
          (id) => !statDefinitions.some((s) => s[0] === +id),
        )
      )
        throw Object.assign(
          Error("Buff enthält nicht unterstützte Effekt-IDs"),
          { statusCode: 400 },
        );
      if (
        buff.spellId &&
        !this.dataset.versions[buff.version ?? build.gameVersion]?.spells.some(
          (s) => s.id === buff.spellId,
        )
      )
        throw Object.assign(
          Error("Buff-Zauber ist in der angegebenen Version nicht vorhanden"),
          { statusCode: 400 },
        );
    }
    for (const [slot, instance] of Object.entries(build.equipment)) {
      const item = this.items.get(build.gameVersion)!.get(instance.itemId);
      if (!item || !compatible(item, slot))
        throw Object.assign(
          Error(
            `Gegenstand ${instance.itemId} passt nicht in Slot ${slot} / Datenversion`,
          ),
          { statusCode: 400 },
        );
      if (
        (slot.startsWith("dofus") || slot === "companion") &&
        (Object.values(instance.exos).some((v) => v !== 0) ||
          Object.entries(instance.rolls).some(
            ([id, v]) => v !== item.effects.find((e) => e.id === +id)?.max,
          ))
      )
        throw Object.assign(
          Error(
            "Dofus, Trophäen und Begleiter können nicht durch Schmiedmagie verändert werden",
          ),
          { statusCode: 400 },
        );
      for (const id of Object.keys(instance.rolls))
        if (!item.effects.some((e) => e.id === +id && !e.active))
          throw Object.assign(
            Error("Veränderter Roll ohne Originaleffekt: Exomagie verwenden"),
            { statusCode: 400 },
          );
      for (const id of Object.keys(instance.exos))
        if (!statDefinitions.some((s) => s[0] === +id))
          throw Object.assign(Error("Unbekannter Exomagie-Effekt"), {
            statusCode: 400,
          });
    }
    if (
      build.characterId &&
      !this.personal.characters().some((c) => c.id === build.characterId)
    )
      throw Object.assign(Error("Charakter nicht gefunden"), {
        statusCode: 400,
      });
    const character = this.personal
      .characters()
      .find((c) => c.id === build.characterId);
    if (character?.classId && character.classId !== build.classId)
      throw Object.assign(
        Error("Buildklasse passt nicht zum zugeordneten Charakter"),
        { statusCode: 400 },
      );
  }
  save(input: BuildInput, id: string = randomUUID(), revision = 0) {
    this.validate(input);
    const existing = this.get(id);
    if ((existing?.revision ?? 0) !== revision)
      throw new ConflictError(existing);
    const now = new Date().toISOString();
    const build: Build = {
      ...input,
      id,
      revision: revision + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.personal.db.exec("BEGIN IMMEDIATE");
    try {
      if (build.active && build.characterId)
        this.personal.db
          .prepare("UPDATE builder_projects SET active=0 WHERE character_id=?")
          .run(build.characterId);
      this.personal.db
        .prepare(
          "INSERT INTO builder_projects VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET character_id=excluded.character_id,revision=excluded.revision,active=excluded.active,content=excluded.content,updated_at=excluded.updated_at",
        )
        .run(
          id,
          build.characterId,
          build.revision,
          build.active ? 1 : 0,
          JSON.stringify(build),
          build.createdAt,
          now,
        );
      this.personal.db.exec("COMMIT");
    } catch (e) {
      this.personal.db.exec("ROLLBACK");
      throw e;
    }
    return build;
  }
  calculate(build: BuildInput) {
    this.validate(build);
    return calculateBuild(
      build,
      this.items.get(build.gameVersion)!,
      this.sets.get(build.gameVersion)!,
    );
  }
}
export const builderQuery = z.object({
  version: versionSchema,
  q: z.string().max(150).default(""),
  slot: z
    .string()
    .regex(
      /^(hat|cape|amulet|ring[12]?|belt|boots|weapon|shield|companion|dofus[1-6]?)$/,
    )
    .optional(),
  typeId: z.coerce.number().int().positive().optional(),
  setName: z.string().max(100).optional(),
  minLevel: z.coerce.number().int().min(0).max(200).default(0),
  maxLevel: z.coerce.number().int().min(0).max(200).default(200),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  sort: z.enum(["name", "level-asc", "level-desc"]).default("name"),
  effects: z.string().max(6000).optional(),
  effectMode: z.enum(["and", "or"]).default("and"),
});
export function parseEffects(raw?: string) {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw Object.assign(Error("Ungültiges Effektfilter-JSON"), {
      statusCode: 400,
    });
  }
  return z.array(effectFilterSchema).max(50).parse(value);
}
export function registerBuilder(app: FastifyInstance, store: BuilderStore) {
  app.get("/api/builder/versions", () => ({
    data: Object.entries(store.dataset.versions).map(([version, d]) => ({
      version,
      report: d.report,
      classes: d.classes,
      types: [
        ...new Map(
          d.items.map((i) => [i.typeId, { id: i.typeId, name: i.type }]),
        ).values(),
      ],
    })),
  }));
  app.get("/api/builder/items", (request) => {
    const f = builderQuery.parse(request.query);
    const filters = parseEffects(f.effects);
    const where = ["version=?", "level>=?", "level<=?"];
    const params: (string | number)[] = [f.version, f.minLevel, f.maxLevel];
    if (f.q) {
      where.push("(search_text LIKE ? ESCAPE '\\' OR id=?)");
      params.push(
        "%" +
          f.q
            .normalize("NFKD")
            .replace(/\p{M}/gu, "")
            .toLowerCase()
            .replace(/[\\%_]/g, "\\$&") +
          "%",
        Number(f.q) || 0,
      );
    }
    if (f.slot) {
      where.push(
        "EXISTS(SELECT 1 FROM json_each(json_extract(builder_items.content,'$.slots')) WHERE value=?)",
      );
      params.push(
        f.slot.replace(/^ring[12]$/, "ring").replace(/^dofus[1-6]$/, "dofus"),
      );
    }
    if (f.typeId) {
      where.push("type_id=?");
      params.push(f.typeId);
    }
    if (f.setName) {
      where.push("set_name LIKE ?");
      params.push("%" + f.setName + "%");
    }
    const effects = effectSQL(
      filters,
      f.effectMode,
      "builder_items.id",
      f.version,
    );
    where.push(effects.clause);
    params.push(...effects.params);
    const clause = where.join(" AND "),
      order =
        f.sort === "level-desc"
          ? "level DESC,name,id"
          : f.sort === "level-asc"
            ? "level ASC,name,id"
            : "name COLLATE NOCASE,id";
    const total = (
      store.game.db
        .prepare("SELECT count(*) n FROM builder_items WHERE " + clause)
        .get(...params) as { n: number }
    ).n;
    const data = (
      store.game.db
        .prepare(
          "SELECT content FROM builder_items WHERE " +
            clause +
            " ORDER BY " +
            order +
            " LIMIT ? OFFSET ?",
        )
        .all(...params, f.pageSize, (f.page - 1) * f.pageSize) as {
        content: string;
      }[]
    ).map((r) => JSON.parse(r.content));
    return { data, total, page: f.page, pageSize: f.pageSize };
  });
  app.get("/api/builder/catalog", (request) => {
    const { version } = z
      .object({ version: versionSchema })
      .parse(request.query);
    const d = store.dataset.versions[version];
    return { data: { items: d?.items ?? [], sets: d?.sets ?? [] } };
  });
  app.get("/api/builder/sets", (request) => {
    const f = z
      .object({
        version: versionSchema,
        q: z.string().max(150).default(""),
        limit: z.coerce.number().int().min(1).max(100).default(40),
        page: z.coerce.number().int().min(1).default(1),
      })
      .parse(request.query);
    const data = store.dataset.versions[f.version];
    const term = f.q.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
    const sets = (data?.sets ?? []).filter((s) =>
      `${s.name} ${s.id}`
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .includes(term),
    );
    return {
      data: sets
        .slice((f.page - 1) * f.limit, f.page * f.limit)
        .map((s) => ({
          ...s,
          items: (data?.items ?? [])
            .filter((i) => i.setId === s.id)
            .map((i) => ({
              id: i.id,
              name: i.name,
              imageUrl: i.imageUrl,
              level: i.level,
            })),
        })),
      total: sets.length,
      version: f.version,
    };
  });
  app.get("/api/builder/sets/:id", (request, reply) => {
    const version = z
        .object({ version: versionSchema })
        .parse(request.query).version,
      id = z.coerce
        .number()
        .int()
        .positive()
        .parse((request.params as { id: string }).id),
      data = store.dataset.versions[version],
      set = data?.sets.find((s) => s.id === id);
    return set
      ? {
          data: { ...set, items: data.items.filter((i) => i.setId === id) },
          version,
        }
      : reply
          .code(404)
          .send({ error: "Set ist in diesem Datenstand nicht enthalten." });
  });
  app.get("/api/builder/spells", (request) => {
    const f = z
      .object({
        version: versionSchema,
        classId: z.coerce.number().int().positive(),
      })
      .parse(request.query);
    return {
      data:
        store.dataset.versions[f.version]?.spells.filter(
          (s) => s.classId === f.classId,
        ) ?? [],
    };
  });
  app.get("/api/builder/builds", (request) => {
    const f = z
      .object({ characterId: z.string().uuid().optional() })
      .parse(request.query);
    return { data: store.list(f.characterId) };
  });
  app.get("/api/builder/builds/:id", (request, reply) => {
    const id = z
      .string()
      .uuid()
      .parse((request.params as { id: string }).id);
    const build = store.get(id);
    return build
      ? { data: build }
      : reply.code(404).send({ error: "Build nicht gefunden" });
  });
  app.get("/api/builder/builds/:id/summary", (request, reply) => {
    const id = z
      .string()
      .uuid()
      .parse((request.params as { id: string }).id);
    const build = store.get(id);
    if (!build) return reply.code(404).send({ error: "Build nicht gefunden" });
    return {
      data: {
        build,
        calculation: store.calculate(build),
        equipment: Object.entries(build.equipment).map(([slot, x]) => ({
          slot,
          ...store.items.get(build.gameVersion)?.get(x.itemId),
        })),
        character:
          store.personal.characters().find((c) => c.id === build.characterId) ??
          null,
      },
    };
  });
  app.post("/api/builder/builds/:id/share", (request, reply) => {
    const id = z
        .string()
        .uuid()
        .parse((request.params as { id: string }).id),
      build = store.get(id);
    if (!build) return reply.code(404).send({ error: "Build nicht gefunden" });
    const count = (
      store.personal.db
        .prepare(
          "SELECT count(*) n FROM builder_shares WHERE status IN ('pending','leased')",
        )
        .get() as { n: number }
    ).n;
    if (count >= 20)
      return reply.code(429).send({
        error: "Zu viele ausstehende Freigaben. Discord-Bot zuerst verbinden.",
      });
    const jobId = randomUUID();
    store.personal.db
      .prepare(
        "INSERT INTO builder_shares(id,build_id,content,created_at) VALUES(?,?,?,?)",
      )
      .run(jobId, id, JSON.stringify(build), Date.now());
    return {
      data: {
        id: jobId,
        status: "pending",
        destination: "configured-companion-owner",
      },
    };
  });
  app.post("/api/builder/shares/claim", () => {
    const db = store.personal.db;
    db.exec("BEGIN IMMEDIATE");
    try {
      const now = Date.now();
      db.prepare(
        "UPDATE builder_shares SET status='pending' WHERE status='leased' AND leased_at<?",
      ).run(now - 300000);
      const row = db
        .prepare(
          "SELECT id,content FROM builder_shares WHERE status='pending' ORDER BY created_at LIMIT 1",
        )
        .get() as { id: string; content: string } | undefined;
      if (!row) {
        db.exec("COMMIT");
        return { data: null };
      }
      db.prepare(
        "UPDATE builder_shares SET status='leased',leased_at=? WHERE id=?",
      ).run(now, row.id);
      db.exec("COMMIT");
      const build = JSON.parse(row.content) as Build;
      return {
        data: {
          id: row.id,
          build,
          calculation: store.calculate(build),
          equipment: Object.entries(build.equipment).map(([slot, x]) => ({
            slot,
            ...store.items.get(build.gameVersion)?.get(x.itemId),
          })),
          character:
            store.personal
              .characters()
              .find((c) => c.id === build.characterId) ?? null,
        },
      };
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  });
  app.post("/api/builder/shares/:id/ack", (request) => {
    const id = z
        .string()
        .uuid()
        .parse((request.params as { id: string }).id),
      body = z
        .object({
          delivered: z.boolean(),
          error: z.string().max(500).optional(),
        })
        .parse(request.body);
    store.personal.db
      .prepare(
        "UPDATE builder_shares SET status=?,error=? WHERE id=? AND status='leased'",
      )
      .run(body.delivered ? "delivered" : "failed", body.error ?? null, id);
    return { data: { id } };
  });
  app.post("/api/builder/builds", (request) => {
    const raw = buildInput
      .extend({ id: z.string().uuid().optional() })
      .parse(request.body);
    const input = buildInput.parse(raw);
    const old = raw.id ? store.get(raw.id) : undefined;
    if (old && JSON.stringify(buildInput.parse(old)) === JSON.stringify(input))
      return { data: old };
    return { data: store.save(input, raw.id) };
  });
  app.put("/api/builder/builds/:id", (request) => {
    const id = z
      .string()
      .uuid()
      .parse((request.params as { id: string }).id);
    const input = buildInput
      .extend({ expectedRevision: z.number().int().min(1) })
      .parse(request.body);
    if (!store.get(id))
      throw Object.assign(Error("Build nicht gefunden"), { statusCode: 404 });
    return { data: store.save(input, id, input.expectedRevision) };
  });
  app.delete("/api/builder/builds/:id", (request, reply) => {
    const id = z
      .string()
      .uuid()
      .parse((request.params as { id: string }).id);
    store.personal.db
      .prepare("DELETE FROM builder_projects WHERE id=?")
      .run(id);
    return reply.code(204).send();
  });
  app.post("/api/builder/calculate", (request) => ({
    data: store.calculate(buildInput.parse(request.body)),
  }));
  app.get("/api/builder/targets", () => ({
    data: (
      store.personal.db
        .prepare("SELECT id,content FROM builder_target_profiles")
        .all() as { id: string; content: string }[]
    ).map((r) => ({ id: r.id, ...JSON.parse(r.content) })),
  }));
  app.post("/api/builder/targets", (request) => {
    const input = buildInput.shape.target.parse(request.body);
    const id = randomUUID();
    store.personal.db
      .prepare("INSERT INTO builder_target_profiles VALUES(?,?)")
      .run(id, JSON.stringify(input));
    return { data: { id, ...input } };
  });
}
