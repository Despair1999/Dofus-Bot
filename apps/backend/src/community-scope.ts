import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { PersonalStore } from "./store.js";
import type { FastifyInstance } from "fastify";

// Local namespaces do not grant remote permissions. Every request still needs the existing bearer secret.
export function scopePersonal(app: FastifyInstance, guest: PersonalStore) {
  const context = new AsyncLocalStorage<PersonalStore>();
  const stores = new Map<string, PersonalStore>();
  const scoped = new Proxy(guest, {
    get(target, property) {
      const current = context.getStore() ?? target;
      const value = Reflect.get(current, property);
      return typeof value === "function" ? value.bind(current) : value;
    },
  });
  app.addHook("onRequest", (request, reply, done) => {
    const uid = request.headers["x-companion-account"];
    if (!uid) {
      context.run(guest, done);
      return;
    }
    if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
      void reply.code(400).send({ error: "Ungültiger Accountbereich." });
      return;
    }
    // Authentication runs before this hook; public routes cannot select an account without bearer authorization.
    if (!request.headers.authorization) {
      void reply
        .code(401)
        .send({ error: "Verbindungsschlüssel erforderlich." });
      return;
    }
    let store = stores.get(uid);
    if (!store) {
      if (stores.size >= 12) {
        void reply
          .code(429)
          .send({ error: "Zu viele lokale Accounts. Dienst neu starten." });
        return;
      }
      const folder = join(dirname(guest.path), "accounts");
      mkdirSync(folder, { recursive: true });
      store = new PersonalStore(
        guest.path === ":memory:" ? ":memory:" : join(folder, uid + ".sqlite"),
      );
      // Clone table/index definitions only. Guest personal rows remain in the guest database.
      const definitions = guest.db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END",
        )
        .all() as { sql: string }[];
      for (const definition of definitions)
        store.db.exec(
          definition.sql.replace(
            /^CREATE (UNIQUE )?(TABLE|INDEX) /i,
            "CREATE $1$2 IF NOT EXISTS ",
          ),
        );
      stores.set(uid, store);
    }
    context.run(store, done);
  });
  app.addHook("onClose", async () => {
    stores.forEach((s) => s.close());
  });
  return scoped;
}

export const replicatedTables = [
  "characters",
  "character_quests",
  "builder_projects",
  "builder_target_profiles",
  "world_markers",
  "world_saved_routes",
  "dungeon_preparations",
  "character_professions",
  "profession_quest_progress",
] as const;
export function replica(personal: PersonalStore) {
  const result: Record<string, unknown[]> = {};
  for (const table of replicatedTables)
    result[table] = personal.db.prepare(`SELECT * FROM ${table}`).all();
  result.__sync = personal.db
    .prepare(
      "SELECT dirty_revision,mirrored_revision FROM community_sync_state WHERE id=1",
    )
    .all();
  return result;
}
