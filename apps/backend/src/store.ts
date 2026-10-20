import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { Character, CharacterInput, Progress } from "@dofus/core";

export class ConflictError extends Error {
  constructor(public current: unknown) {
    super("Der Datensatz wurde inzwischen geändert. Bitte Konflikt auflösen.");
  }
}

export class PersonalStore {
  readonly db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS characters(id TEXT PRIMARY KEY, name TEXT NOT NULL, server TEXT NOT NULL, class_name TEXT NOT NULL, level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 200), version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS character_quests(character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE, quest_id INTEGER NOT NULL, step INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','paused','completed')), version INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(character_id,quest_id));
      CREATE TABLE IF NOT EXISTS mutations(id TEXT PRIMARY KEY, payload TEXT NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY, body TEXT NOT NULL, fetched_at TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS activity_logs(id INTEGER PRIMARY KEY, action TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS quest_progress_status ON character_quests(status);
      INSERT OR IGNORE INTO migrations VALUES(1,datetime('now'));`);
  }
  characters(): Character[] {
    return this.db
      .prepare(
        "SELECT id,name,server,class_name AS className,level,version,updated_at AS updatedAt FROM characters ORDER BY updated_at DESC",
      )
      .all() as unknown as Character[];
  }
  createCharacter(input: CharacterInput): Character {
    const character = {
      ...input,
      id: randomUUID(),
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    this.db
      .prepare("INSERT INTO characters VALUES(?,?,?,?,?,?,?)")
      .run(
        character.id,
        character.name,
        character.server,
        character.className,
        character.level,
        character.version,
        character.updatedAt,
      );
    this.audit("character.created", character.id);
    return character;
  }
  updateCharacter(
    id: string,
    input: CharacterInput,
    expectedVersion: number,
  ): Character {
    const result = this.db
      .prepare(
        "UPDATE characters SET name=?,server=?,class_name=?,level=?,version=version+1,updated_at=? WHERE id=? AND version=?",
      )
      .run(
        input.name,
        input.server,
        input.className,
        input.level,
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
      exportedAt: new Date().toISOString(),
    };
  }
  close() {
    this.db.close();
  }
}
