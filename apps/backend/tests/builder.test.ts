import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameDataStore } from "@dofus/game-data";
import { buildInput, type Build } from "@dofus/core";
import { PersonalStore } from "../src/store.js";
import { BuilderStore } from "../src/builder.js";
import { createApp } from "../src/app.js";
const dir = mkdtempSync(join(tmpdir(), "companion-builder-"));
const personal = new PersonalStore(join(dir, "personal.sqlite")),
  game = new GameDataStore(join(dir, "game.sqlite"));
const token = "builder-integration-test-token-0000000000000",
  headers = { authorization: "Bearer " + token };
let app: Awaited<ReturnType<typeof createApp>>, store: BuilderStore;
let build: Build;
const character = personal.createCharacter({
  name: "Builder-Test",
  server: "Fixture",
  className: "Sacrieur",
  classId: 11,
  level: 200,
});
before(async () => {
  app = await createApp({ personal, game, token });
  store = new BuilderStore(personal, game);
  await app.ready();
});
after(async () => {
  await app.close();
  personal.close();
  game.close();
  rmSync(dir, { recursive: true, force: true });
});
test("private builds and target/sharing APIs require a valid bearer secret", async () => {
  for (const url of ["/api/builder/builds", "/api/builder/targets"])
    assert.equal((await app.inject({ url })).statusCode, 401);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/builder/shares/claim",
        payload: {},
      })
    ).statusCode,
    401,
  );
});
test("both data versions enumerate every class with spells and critical ranks", async () => {
  const versions = (await app.inject({ url: "/api/builder/versions" })).json()
    .data;
  assert.equal(versions.length, 2);
  for (const version of versions)
    for (const cls of version.classes) {
      const response = await app.inject({
        url: `/api/builder/spells?version=${version.version}&classId=${cls.id}`,
      });
      const spells = response.json().data;
      assert.equal(spells.length, 44);
      assert.ok(
        spells.every(
          (s: { version: string; levels: unknown[]; icon: string }) =>
            s.version === version.version && s.levels.length && s.icon,
        ),
      );
    }
});
test("slot compatibility, numeric effect filters and signed bounds use indexed source data", async () => {
  const filter = encodeURIComponent(JSON.stringify([{ id: 12, min: 1 }]));
  const result = (
    await app.inject({
      url: "/api/builder/items?slot=ring1&effects=" + filter + "&q=Gelano",
    })
  ).json();
  assert.equal(result.data[0].id, 2469);
  const hats = (
    await app.inject({ url: "/api/builder/items?slot=hat&q=Gelano" })
  ).json();
  assert.equal(hats.total, 0);
  assert.equal(
    (await app.inject({ url: "/api/builder/items?effects=not-json" }))
      .statusCode,
    400,
  );
});
test("build creation, character association, edits and optimistic conflicts persist", async () => {
  const input = buildInput.parse({
    name: "Set de test",
    characterId: character.id,
    classId: 11,
    level: 200,
    gameVersion: "3.7.12.12",
    equipment: { ring1: { itemId: 2469, rolls: {}, exos: {} } },
  });
  const r = await app.inject({
    method: "POST",
    url: "/api/builder/builds",
    headers,
    payload: input,
  });
  assert.equal(r.statusCode, 200);
  build = r.json().data;
  assert.equal(build.revision, 1);
  assert.equal(build.characterId, character.id);
  const edited = await app.inject({
    method: "PUT",
    url: "/api/builder/builds/" + build.id,
    headers,
    payload: { ...build, name: "Geändert", expectedRevision: 1 },
  });
  assert.equal(edited.statusCode, 200);
  build = edited.json().data;
  assert.equal(build.revision, 2);
  const conflict = await app.inject({
    method: "PUT",
    url: "/api/builder/builds/" + build.id,
    headers,
    payload: { ...build, expectedRevision: 1 },
  });
  assert.equal(conflict.statusCode, 409);
  const reopened = new PersonalStore(join(dir, "personal.sqlite"));
  assert.equal(
    JSON.parse(
      String(
        reopened.db
          .prepare("SELECT content FROM builder_projects WHERE id=?")
          .get(build.id)!.content,
      ),
    ).name,
    "Geändert",
  );
  reopened.close();
});
test("malformed slots, invalid IDs, cross-version buffs and item IDs cannot silently pass", async () => {
  const b = buildInput.parse(build);
  const bad = await app.inject({
    method: "POST",
    url: "/api/builder/builds",
    headers,
    payload: {
      ...b,
      equipment: { hat: { itemId: 2469, rolls: {}, exos: {} } },
    },
  });
  assert.equal(bad.statusCode, 400);
  const missing = await app.inject({
    method: "POST",
    url: "/api/builder/builds",
    headers,
    payload: {
      ...b,
      equipment: { ring1: { itemId: 999999999, rolls: {}, exos: {} } },
    },
  });
  assert.equal(missing.statusCode, 400);
  const calc = store.calculate({
    ...b,
    buffs: [
      {
        id: "wrong",
        name: "Wrong version",
        active: true,
        stats: { 32: 100 },
        version: "3.6.12.16",
      },
    ],
  });
  assert.ok(calc.warnings.some((w) => w.includes("Buffversion")));
  assert.equal(calc.total[32], undefined);
});
test("one active build per character, duplicate projects and source instances stay separate", async () => {
  const second = store.save({
    ...buildInput.parse(build),
    name: "Zweites Set",
    active: true,
  });
  store.save(
    { ...buildInput.parse(build), active: true },
    build.id,
    build.revision,
  );
  const all = store.list(character.id);
  assert.equal(all.length, 2);
  assert.equal(all.filter((b) => b.active).length, 1);
  assert.equal(all.find((b) => b.id === second.id)?.active, false);
});
test("sharing is a private immutable snapshot and claim/ack flow is durable", async () => {
  const r = await app.inject({
    method: "POST",
    url: "/api/builder/builds/" + build.id + "/share",
    headers,
    payload: {},
  });
  assert.equal(r.statusCode, 200);
  const claimed = (
    await app.inject({
      method: "POST",
      url: "/api/builder/shares/claim",
      headers,
      payload: {},
    })
  ).json().data;
  assert.equal(claimed.build.id, build.id);
  assert.equal(claimed.calculation.total[12], 8);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/builder/shares/claim",
        headers,
        payload: {},
      })
    ).json().data,
    null,
  );
  await app.inject({
    method: "POST",
    url: "/api/builder/shares/" + claimed.id + "/ack",
    headers,
    payload: { delivered: true },
  });
  assert.equal(
    personal.db
      .prepare("SELECT status FROM builder_shares WHERE id=?")
      .get(claimed.id)?.status,
    "delivered",
  );
});
test("character deletion requires an explicit policy and keep preserves all builds", async () => {
  assert.equal(
    (
      await app.inject({
        method: "DELETE",
        url: "/api/characters/" + character.id,
        headers,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await app.inject({
        method: "DELETE",
        url: "/api/characters/" + character.id + "?builds=keep",
        headers,
      })
    ).statusCode,
    204,
  );
  assert.equal(store.list().length, 2);
  assert.ok(store.list().every((b) => b.characterId === null));
});
