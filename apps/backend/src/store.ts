import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type {
  Character,
  CharacterInput,
  Progress,
  GameClass,
} from "@dofus/core";

export class ConflictError extends Error {
  constructor(public current: unknown) {
    super("Der Datensatz wurde inzwischen geändert. Bitte Konflikt auflösen.");
  }
}

export class PersonalStore {
  readonly db: DatabaseSync;
  constructor(readonly path: string) {
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS community_sync_state(id INTEGER PRIMARY KEY CHECK(id=1),dirty_revision INTEGER NOT NULL,mirrored_revision INTEGER NOT NULL);
      INSERT OR IGNORE INTO community_sync_state VALUES(1,0,0);
      CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS characters(id TEXT PRIMARY KEY, name TEXT NOT NULL, server TEXT NOT NULL, class_name TEXT NOT NULL, level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 200), version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS character_quests(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE, quest_id INTEGER NOT NULL, step INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','paused','completed')), version INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(character_id,quest_id));
      CREATE TABLE IF NOT EXISTS mutations(id TEXT PRIMARY KEY, payload TEXT NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY, body TEXT NOT NULL, fetched_at TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS activity_logs(id INTEGER PRIMARY KEY, action TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS quest_progress_status ON character_quests(status);
      INSERT OR IGNORE INTO migrations VALUES(1,datetime('now'));`);
    const columns = this.db.prepare("PRAGMA table_info(characters)").all() as {
      name: string;
    }[];
    if (!columns.some((c) => c.name === "class_id"))
      this.db.exec(
        "ALTER TABLE characters ADD COLUMN class_id INTEGER; INSERT OR IGNORE INTO migrations VALUES(2,datetime('now'));",
      );
    if (!columns.some((c) => c.name === "omega_level"))
      this.db.exec(
        "ALTER TABLE characters ADD COLUMN omega_level INTEGER CHECK(omega_level IS NULL OR omega_level>=0); INSERT OR IGNORE INTO migrations VALUES(4,datetime('now'));",
      );
  }
  migrateClasses(classes: GameClass[]) {
    const normalize = (s: string) =>
      s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();
    for (const character of this.characters().filter(
      (c) => c.classId == null,
    )) {
      const matches = classes.filter((c) =>
        c.aliases.some((a) => normalize(a) === normalize(character.className)),
      );
      if (matches.length === 1)
        this.db
          .prepare("UPDATE characters SET class_id=? WHERE id=?")
          .run(matches[0].id, character.id);
    }
  }
  characters(): Character[] {
    return this.db
      .prepare(
        "SELECT id,name,server,class_name AS className,class_id AS classId,level,omega_level AS omegaLevel,version,updated_at AS updatedAt FROM characters ORDER BY updated_at DESC",
      )
      .all() as unknown as Character[];
  }
  createCharacter(input: CharacterInput): Character {
    if (input.omegaLevel && input.level !== 200)
      throw Object.assign(
        Error("Omega-Level ist erst ab Charakterstufe 200 verfügbar."),
        { statusCode: 400 },
      );
    const character = {
      ...input,
      id: randomUUID(),
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        "INSERT INTO characters(id,name,server,class_name,level,version,updated_at,class_id,omega_level) VALUES(?,?,?,?,?,?,?,?,?)",
      )
      .run(
        character.id,
        character.name,
        character.server,
        character.className,
        character.level,
        character.version,
        character.updatedAt,
        input.classId ?? null,
        input.omegaLevel ?? null,
      );
    this.audit("character.created", character.id);
    return character;
  }
  updateCharacter(
    id: string,
    input: CharacterInput,
    expectedVersion: number,
  ): Character {
    const omega =
      input.omegaLevel === undefined
        ? this.characters().find((c) => c.id === id)?.omegaLevel
        : input.omegaLevel;
    if (omega && input.level !== 200)
      throw Object.assign(
        Error("Omega-Level ist erst ab Charakterstufe 200 verfügbar."),
        { statusCode: 400 },
      );
    const result = this.db
      .prepare(
        "UPDATE characters SET name=?,server=?,class_name=?,level=?,class_id=?,omega_level=?,version=version+1,updated_at=? WHERE id=? AND version=?",
      )
      .run(
        input.name,
        input.server,
        input.className,
        input.level,
        input.classId ?? null,
        input.omegaLevel === undefined
          ? (this.characters().find((c) => c.id === id)?.omegaLevel ?? null)
          : input.omegaLevel,
        new Date().toISOString(),
        id,
        expectedVersion,
      );
    const current = this.characters().find((c) => c.id === id);
    if (!result.changes) throw new ConflictError(current ?? null);
    this.audit("character.updated", id);
    return current!;
  }
  deleteCharacter(id: string) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (
        this.db
          .prepare(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='builder_projects'",
          )
          .get()
      ) {
        const now = new Date().toISOString();
        this.db
          .prepare(
            "UPDATE builder_projects SET active=0,revision=revision+1,updated_at=?,content=json_set(content,'$.characterId',NULL,'$.active',0,'$.updatedAt',?) WHERE character_id=?",
          )
          .run(now, now, id);
      }
      this.db.prepare("DELETE FROM characters WHERE id=?").run(id);
      this.db
        .prepare(
          "DELETE FROM mutations WHERE json_extract(payload,'$.characterId')=?",
        )
        .run(id);
      this.db
        .prepare("DELETE FROM activity_logs WHERE subject=? OR subject LIKE ?")
        .run(id, id + ":%");
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  progress(id: string): Progress[] {
    return this.db
      .prepare(
        "SELECT character_id AS characterId,quest_id AS questId,step,status,version,updated_at AS updatedAt FROM character_quests WHERE character_id=? ORDER BY updated_at DESC",
      )
      .all(id) as unknown as Progress[];
  }
  saveProgress(
    characterId: string,
    input: {
      questId: number;
      step: number;
      status: Progress["status"];
      expectedVersion: number;
      mutationId: string;
    },
  ): Progress {
    const payload = JSON.stringify({ characterId, ...input });
    const prior = this.db
      .prepare("SELECT payload,result FROM mutations WHERE id=?")
      .get(input.mutationId) as { payload: string; result: string } | undefined;
    if (prior) {
      if (prior.payload !== payload) throw new ConflictError(null);
      return JSON.parse(prior.result) as Progress;
    }
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.progress(characterId).find(
        (p) => p.questId === input.questId,
      );
      if ((current?.version ?? 0) !== input.expectedVersion)
        throw new ConflictError(current ?? null);
      const result: Progress = {
        characterId,
        questId: input.questId,
        step: input.step,
        status: input.status,
        version: (current?.version ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      this.db
        .prepare(
          "INSERT INTO character_quests VALUES(?,?,?,?,?,?) ON CONFLICT(character_id,quest_id) DO UPDATE SET step=excluded.step,status=excluded.status,version=excluded.version,updated_at=excluded.updated_at",
        )
        .run(
          characterId,
          result.questId,
          result.step,
          result.status,
          result.version,
          result.updatedAt,
        );
      this.db
        .prepare("INSERT INTO mutations VALUES(?,?,?,?)")
        .run(
          input.mutationId,
          payload,
          JSON.stringify(result),
          result.updatedAt,
        );
      this.audit("quest.progress", `${characterId}:${result.questId}`);
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  cacheGet(key: string) {
    return this.db
      .prepare(
        "SELECT body,fetched_at AS fetchedAt,expires_at AS expiresAt FROM cache WHERE key=?",
      )
      .get(key) as
      { body: string; fetchedAt: string; expiresAt: number } | undefined;
  }
  cachePut(key: string, body: unknown, ttl: number) {
    this.db
      .prepare(
        "INSERT INTO cache VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET body=excluded.body,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at",
      )
      .run(
        key,
        JSON.stringify(body),
        new Date().toISOString(),
        Date.now() + ttl,
      );
  }
  audit(action: string, subject: string) {
    this.db
      .prepare(
        "INSERT INTO activity_logs(action,subject,created_at) VALUES(?,?,?)",
      )
      .run(action, subject, new Date().toISOString());
  }
  export() {
    return {
      characters: this.characters(),
      progress: this.db.prepare("SELECT * FROM character_quests").all(),
      builds: this.db
        .prepare(
          "SELECT content,character_id,active,revision FROM builder_projects",
        )
        .all()
        .map((row) => ({
          ...JSON.parse(String(row.content)),
          characterId: row.character_id,
          active: !!row.active,
          revision: row.revision,
        })),
      builderTargets: this.db
        .prepare("SELECT content FROM builder_target_profiles")
        .all()
        .map((row) => JSON.parse(String(row.content))),
      exportedAt: new Date().toISOString(),
    };
  }
  close() {
    this.db.close();
  }
}
