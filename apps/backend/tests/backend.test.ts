import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { GameDataStore } from "@dofus/game-data";
import { PersonalStore } from "../src/store.js";
import { Dofusdude } from "../src/dofusdude.js";
import { createApp } from "../src/app.js";

const token = "integration-test-secret-with-at-least-32-characters";
const headers = { authorization: `Bearer ${token}` };
const fixtureItem = {
  ankama_id: 123,
  name: "Testgegenstand",
  level: 10,
  type: { name: "Ring" },
  item_subtype: { name_id: "equipment" },
  effects: [{ formatted: "1 Testeffekt" }],
  recipe: [{ item_ankama_id: 1, quantity: 2, item_subtype: "resources" }],
};

test("API persists characters and handles optimistic, idempotent progress", async () => {
  const directory = mkdtempSync(join(tmpdir(), "companion-test-"));
  const personal = new PersonalStore(join(directory, "personal.sqlite"));
  const path = join(directory, "game.sqlite"),
    game = new GameDataStore(path);
  const fixture = new DatabaseSync(path);
  const quest = {
    id: 123,
    name: "Testquest",
    nameFr: "Quête test",
    level: 1,
    requirements: "",
    steps: [{ id: 1, name: "Schritt", description: "Test", objectives: [] }],
    source: "test-fixture",
    version: "fixture",
    updatedAt: new Date().toISOString(),
  };
  fixture
    .prepare("INSERT INTO quests VALUES(?,?,?,?,?,?)")
    .run(
      123,
      "Testquest",
      "Quête test",
      "testquest",
      JSON.stringify(quest),
      "fixture",
    );
  fixture.close();
  const app = await createApp({
    personal,
    game,
    token,
    fetcher: async () => new Response(JSON.stringify([fixtureItem])),
  });
  try {
    assert.equal((await app.inject("/api/characters")).statusCode, 401);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/characters",
          headers,
          payload: { name: "", level: 201 },
        })
      ).statusCode,
      400,
    );
    const created = await app.inject({
      method: "POST",
      url: "/api/characters",
      headers,
      payload: {
        name: "Testheld",
        server: "Testserver",
        className: "Iop",
        level: 60,
      },
    });
    assert.equal(created.statusCode, 201);
    const character = created.json().data;
    assert.equal(
      (await app.inject({ url: "/api/characters", headers })).json().data
        .length,
      1,
    );
    const url = `/api/characters/${character.id}/progress`;
    const input = {
      questId: 123,
      step: 0,
      status: "active",
      expectedVersion: 0,
      mutationId: randomUUID(),
    };
    const first = await app.inject({
      method: "PUT",
      url,
      headers,
      payload: input,
    });
    assert.equal(first.statusCode, 200);
    assert.equal(first.json().data.version, 1);
    const duplicate = await app.inject({
      method: "PUT",
      url,
      headers,
      payload: input,
    });
    assert.deepEqual(duplicate.json(), first.json());
    const conflict = await app.inject({
      method: "PUT",
      url,
      headers,
      payload: { ...input, mutationId: randomUUID() },
    });
    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.json().current.version, 1);
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url,
          headers,
          payload: { ...input, questId: 999, mutationId: randomUUID() },
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url,
          headers,
          payload: {
            ...input,
            step: 200,
            expectedVersion: 1,
            mutationId: randomUUID(),
          },
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (await app.inject({ url: "/api/account/export", headers })).json().data
        .progress.length,
      1,
    );
    assert.equal(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/characters/${character.id}`,
          headers,
        })
      ).statusCode,
      204,
    );
    assert.equal(
      personal.db.prepare("SELECT count(*) n FROM mutations").get()?.n,
      0,
    );
    assert.equal(personal.progress(character.id).length, 0);
  } finally {
    await app.close();
    personal.close();
    game.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("item search validates upstream payload and uses persisted cache", async () => {
  const store = new PersonalStore(":memory:");
  let calls = 0;
  const api = new Dofusdude(store, async () => {
    calls++;
    return new Response(JSON.stringify([fixtureItem]));
  });
  const first = await api.search("Test");
  assert.equal(first.data[0]?.id, 123);
  assert.equal(first.cached, false);
  const second = await api.search("Test");
  assert.equal(second.cached, true);
  assert.equal(calls, 1);
  store.close();
});

test("category search uses documented category endpoint and retains category for details", async () => {
  const store = new PersonalStore(":memory:");
  let requested = "";
  const api = new Dofusdude(store, async (url) => {
    requested = String(url);
    return new Response(
      JSON.stringify([{ ...fixtureItem, item_subtype: undefined }]),
    );
  });
  const result = await api.search("Test", "de", "resources");
  assert.match(
    requested,
    /\/de\/items\/resources\/search\?query=Test&limit=30$/,
  );
  assert.equal(result.data[0]?.category, "resources");
  store.close();
});

test("expired cache survives upstream outage and is explicitly marked stale", async () => {
  const store = new PersonalStore(":memory:");
  store.cachePut("de/items/search?query=Test&limit=30", [fixtureItem], -1);
  const api = new Dofusdude(
    store,
    async () => new Response("", { status: 503 }),
  );
  const result = await api.search("Test");
  assert.equal(result.cached, true);
  assert.equal(result.stale, true);
  assert.equal(result.data[0]?.name, "Testgegenstand");
  store.close();
});

test("rate limiting honors Retry-After and opens circuit without repeating requests", async () => {
  const store = new PersonalStore(":memory:");
  let calls = 0;
  const api = new Dofusdude(store, async () => {
    calls++;
    return new Response("", { status: 429, headers: { "retry-after": "120" } });
  });
  await assert.rejects(() => api.search("A"), /begrenzt/);
  await assert.rejects(() => api.search("B"), /später/);
  assert.equal(calls, 1);
  assert.equal(api.status().circuitOpen, true);
  store.close();
});

test("malformed upstream data never becomes cache data", async () => {
  const store = new PersonalStore(":memory:");
  const api = new Dofusdude(
    store,
    async () => new Response(JSON.stringify([{ name: "Invalid item" }])),
  );
  await assert.rejects(() => api.search("Invalid"), /Antwortformat/);
  assert.equal(
    store.cacheGet("de/items/search?query=Invalid&limit=30"),
    undefined,
  );
  store.close();
});

test("SQLite state survives closing and reopening", () => {
  const directory = mkdtempSync(join(tmpdir(), "companion-persist-"));
  const path = join(directory, "personal.sqlite");
  const first = new PersonalStore(path);
  const c = first.createCharacter({
    name: "Persist",
    server: "Test",
    className: "Iop",
    level: 10,
  });
  first.close();
  const second = new PersonalStore(path);
  assert.equal(second.characters()[0]?.id, c.id);
  second.close();
  rmSync(directory, { recursive: true, force: true });
});
