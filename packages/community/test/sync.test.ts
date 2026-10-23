import { test } from "node:test";
import assert from "node:assert/strict";
import { SyncEngine, type LocalStore, type CloudTransport } from "../src/sync";
import {
  type CloudRecord,
  profileSchema,
  characterSchema,
  reservationDelta,
  transitionReservation,
  syncable,
} from "../src/model";
import { applyFragment, changedFragments, fragments } from "../src/fragments";
function local(): LocalStore & { values: Map<string, unknown> } {
  const values = new Map<string, unknown>();
  return {
    values,
    async read<T>(k: string, f: T) {
      return structuredClone(values.get(k) ?? f) as T;
    },
    async write(k, v) {
      values.set(k, structuredClone(v));
    },
    async keys() {
      return [...values.keys()];
    },
  };
}
function transport(): CloudTransport & {
  rows: Map<string, CloudRecord>;
  offline: boolean;
} {
  return {
    rows: new Map(),
    offline: false,
    async put(m, deviceId) {
      if (this.offline) throw Error("offline");
      const current = this.rows.get(m.key);
      if (current?.mutationId === m.mutationId) return current;
      if ((current?.revision ?? 0) !== m.baseRevision) return current!;
      const next = { ...m, revision: m.baseRevision + 1, deviceId };
      this.rows.set(m.key, next);
      return next;
    },
  };
}
test("registration enforces DOFUS and Discord names and server", () => {
  assert.equal(
    profileSchema.safeParse({
      dofusName: "Nehra",
      discordName: "nehra99",
      server: "Draconiros",
    }).success,
    true,
  );
  for (const field of ["dofusName", "discordName", "server"])
    assert.equal(
      profileSchema.safeParse({
        dofusName: "Nehra",
        discordName: "nehra99",
        server: "Draconiros",
        [field]: "",
      }).success,
      false,
    );
});
test("omega requires level 200", () => {
  assert.equal(
    characterSchema.safeParse({
      id: "c",
      name: "Test",
      classId: 1,
      className: "Feca",
      level: 199,
      omegaLevel: 1,
      server: "Test",
    }).success,
    false,
  );
});
for (const key of [
  "config",
  "outbox",
  "builder:outbox",
  "overlay:position",
  "translator:apiKey",
  "cache:private",
  "community:device",
  "ui:monitors",
]) {
  test("credentials and device data excluded: " + key, () =>
    assert.equal(syncable(key), false),
  );
}
test("two devices exchange a build through revisioned records", async () => {
  const cloud = transport(),
    a = new SyncEngine("u", "a", local(), cloud),
    ls = local(),
    b = new SyncEngine("u", "b", ls, cloud);
  await a.init();
  await b.init();
  await a.capture("builder:draft:b", { id: "b", name: "set" });
  await a.flush();
  await b.receive([...cloud.rows.values()]);
  assert.deepEqual(await ls.read("builder:draft:b", null), {
    id: "b",
    name: "set",
  });
});
test("offline queue persists across restart and retries idempotently", async () => {
  const cloud = transport(),
    ls = local();
  let a = new SyncEngine("u", "a", ls, cloud);
  await a.init();
  await a.capture("favorites", [1]);
  cloud.offline = true;
  await a.flush();
  assert.equal(a.state.queue.length, 1);
  a.stop();
  a = new SyncEngine("u", "a", ls, cloud);
  await a.init();
  cloud.offline = false;
  await a.flush();
  await a.flush();
  assert.equal(cloud.rows.get("favorites")?.revision, 1);
  assert.equal(a.state.queue.length, 0);
});
test("simultaneous edits retain both versions until explicit resolution", async () => {
  const cloud = transport(),
    a = new SyncEngine("u", "a", local(), cloud),
    b = new SyncEngine("u", "b", local(), cloud);
  await a.init();
  await b.init();
  await a.capture("todos", [1]);
  await b.capture("todos", [2]);
  await a.flush();
  await b.flush();
  assert.equal(b.state.conflicts.length, 1);
  assert.equal(cloud.rows.get("todos")?.payload, "[1]");
  await b.resolve("todos", "local");
  await b.flush();
  assert.equal(cloud.rows.get("todos")?.payload, "[2]");
  assert.equal(cloud.rows.get("todos")?.revision, 2);
});
test("offline edits cannot silently resurrect a tombstone", async () => {
  const cloud = transport(),
    a = new SyncEngine("u", "a", local(), cloud),
    b = new SyncEngine("u", "b", local(), cloud);
  await a.init();
  await b.init();
  await a.capture("builder:draft:b", { id: "b" });
  await a.flush();
  await b.receive([...cloud.rows.values()]);
  await a.capture("builder:draft:b", null, true);
  await a.flush();
  await b.capture("builder:draft:b", { id: "b", old: true });
  await b.flush();
  assert.equal(b.state.conflicts.length, 1);
  assert.equal(cloud.rows.get("builder:draft:b")?.deleted, true);
});
test("acknowledged identical snapshots do not consume writes", async () => {
  const cloud = transport(),
    a = new SyncEngine("u", "a", local(), cloud);
  await a.init();
  await a.capture("favorites", [1]);
  await a.flush();
  await a.capture("favorites", [1]);
  assert.equal(a.state.queue.length, 0);
});
test("account switch stops old queued work", async () => {
  const cloud = transport(),
    a = new SyncEngine("u", "a", local(), cloud);
  await a.init();
  a.stop();
  await assert.rejects(() => a.capture("favorites", [1]));
  assert.equal(cloud.rows.size, 0);
});
test("market rows use stable IDs and synchronize only changed rows", () => {
  const before = {
      version: 1,
      observations: [],
      trades: [{ id: "a", quantity: 1 }],
      notes: [],
      targets: {},
    },
    after = { ...before, trades: [...before.trades, { id: "b", quantity: 2 }] };
  const changes = changedFragments(
    fragments("market:journal-v1", before),
    fragments("market:journal-v1", after),
  );
  assert.equal(changes.length, 1);
  assert.match(changes[0].key, /trades\/b$/);
  let value: unknown = before;
  value = applyFragment(value, changes[0].key, changes[0].value);
  assert.deepEqual(value, after);
  value = applyFragment(value, changes[0].key, changes[0].value);
  assert.deepEqual(value, after);
});
test("deleted journal rows have explicit tombstones", () => {
  const a = fragments("market:journal-v1", {
      trades: [{ id: "one" }],
      notes: [],
      observations: [],
      targets: {},
    }),
    b = fragments("market:journal-v1", {
      trades: [],
      notes: [],
      observations: [],
      targets: {},
    });
  assert.deepEqual(
    changedFragments(a, b).map((c) => c.deleted),
    [true],
  );
});
test("duplicate ledger identities are rejected", () =>
  assert.throws(() => fragments("characters", [{ id: "a" }, { id: "a" }])));
test("composite profession identities preserve separate jobs", () =>
  assert.equal(
    Object.keys(
      fragments("backend:character_professions", [
        { character_id: "a", job_id: 1, level: 10 },
        { character_id: "a", job_id: 2, level: 20 },
      ]),
    ).length,
    3,
  ));
test("reservation transitions preserve quantities", () => {
  const r = {
    id: "r",
    listingId: "l",
    buyerUid: "b",
    sellerUid: "s",
    quantity: 2,
    state: "requested" as const,
    revision: 1,
    lastAudit: "",
  };
  assert.throws(() => transitionReservation(r, "accepted", "b"));
  assert.equal(transitionReservation(r, "accepted", "s").state, "accepted");
  assert.equal(reservationDelta("requested", "accepted", 2), 2);
  assert.equal(reservationDelta("accepted", "completed", 2), 0);
  assert.equal(reservationDelta("accepted", "withdrawn", 2), -2);
  assert.throws(() =>
    transitionReservation({ ...r, state: "completed" }, "accepted", "s"),
  );
});
test("new local writes remain durable while a network mutation is in flight",async()=>{
 const cloud=transport(),ls=local();let release!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve;});
 const engine=new SyncEngine("u","device",ls,{async put(m,d){await wait;return cloud.put(m,d);}});await engine.init();
 await engine.capture("todos",[1]);const flush=engine.flush();
 await engine.capture("todos",[2]);
 const persisted=await ls.read<{queue:{payload:string}[]}>("community:sync:u",{queue:[]});assert.equal(persisted.queue[0].payload,"[2]");
 release();await flush;assert.equal(engine.state.queue[0].payload,"[2]");assert.equal(engine.state.queue[0].baseRevision,1);
 await engine.flush();assert.equal(cloud.rows.get("todos")?.payload,"[2]");assert.equal(engine.state.conflicts.length,0);
});
