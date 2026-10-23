import { test } from "node:test";
import assert from "node:assert/strict";
import { PersonalStore } from "../src/store.js";
import { GameDataStore } from "@dofus/game-data";
import { createApp } from "../src/app.js";
const token = "community-integration-local-secret-at-least-32-chars";
const h = (uid?: string) => ({
  authorization: `Bearer ${token}`,
  ...(uid ? { "x-companion-account": uid } : {}),
});

test("durable mutation counter only acknowledges the exact mirrored revision", async () => {
  const personal = new PersonalStore(":memory:"),
    game = new GameDataStore(":memory:"),
    app = await createApp({ personal, game, token });
  const snapshot = async () =>
    (
      await app.inject({ url: "/api/account/replica", headers: h("counter") })
    ).json().data.__sync[0];
  const acknowledge = (revision: number) =>
    app.inject({
      method: "POST",
      url: "/api/account/replica-ack",
      headers: h("counter"),
      payload: { revision },
    });
  try {
    assert.deepEqual(await snapshot(), {
      dirty_revision: 0,
      mirrored_revision: 0,
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/characters",
      headers: h("counter"),
      payload: {
        name: "Recovery",
        className: "Féca",
        classId: 1,
        level: 200,
        server: "Test",
        omegaLevel: 0,
      },
    });
    assert.equal(response.statusCode, 201, response.body);
    const revision = (await snapshot()).dirty_revision;
    assert.ok(revision > 0);
    assert.equal(
      (await acknowledge(revision - 1)).json().data.acknowledged,
      false,
    );
    assert.equal((await snapshot()).mirrored_revision, 0);
    assert.equal((await acknowledge(revision)).json().data.acknowledged, true);
    assert.deepEqual(await snapshot(), {
      dirty_revision: revision,
      mirrored_revision: revision,
    });
    assert.deepEqual(
      (
        await app.inject({ url: "/api/account/replica", headers: h("other") })
      ).json().data.__sync[0],
      { dirty_revision: 0, mirrored_revision: 0 },
    );
  } finally {
    await app.close();
    personal.close();
    game.close();
  }
});
test("account namespace keeps guest, A and B isolated under concurrent requests", async () => {
  const personal = new PersonalStore(":memory:"),
    game = new GameDataStore(":memory:"),
    app = await createApp({ personal, game, token });
  try {
    const input = {
      name: "Guest",
      className: "Féca",
      classId: 1,
      level: 200,
      server: "Test",
      omegaLevel: 10,
    };
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/characters",
          headers: h(),
          payload: input,
        })
      ).statusCode,
      201,
    );
    const before = (
      await app.inject({ url: "/api/characters", headers: h("A") })
    ).json().data;
    assert.equal(before.length, 0);
    const create = await app.inject({
      method: "POST",
      url: "/api/characters",
      headers: h("A"),
      payload: { ...input, name: "Account A" },
    });
    assert.equal(create.statusCode, 201, create.body);
    const response = await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        app.inject({ url: "/api/characters", headers: h(i % 2 ? "A" : "B") }),
      ),
    );
    response.forEach((r, i) =>
      assert.deepEqual(
        r.json().data.map((c: { name: string }) => c.name),
        i % 2 ? ["Account A"] : [],
      ),
    );
    assert.deepEqual(
      (await app.inject({ url: "/api/characters", headers: h() }))
        .json()
        .data.map((c: { name: string }) => c.name),
      ["Guest"],
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/classes",
          headers: { "x-companion-account": "A" },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (await app.inject({ url: "/api/characters", headers: h("../../escape") }))
        .statusCode,
      400,
    );
  } finally {
    await app.close();
    personal.close();
    game.close();
  }
});
test("replica endpoint validates tables, imports atomically and backs up previous rows", async () => {
  const personal = new PersonalStore(":memory:"),
    game = new GameDataStore(":memory:"),
    app = await createApp({ personal, game, token });
  try {
    const row = {
      id: "c",
      name: "Cloud",
      server: "Test",
      class_name: "Féca",
      level: 200,
      omega_level: 5,
      version: 1,
      updated_at: new Date().toISOString(),
      class_id: 1,
    };
    const apply = await app.inject({
      method: "PUT",
      url: "/api/account/replica",
      headers: h("A"),
      payload: { table: "characters", rows: [row] },
    });
    assert.equal(apply.statusCode, 200, apply.body);
    assert.equal(
      (await app.inject({ url: "/api/characters", headers: h("A") })).json()
        .data[0].id,
      "c",
    );
    const bad = await app.inject({
      method: "PUT",
      url: "/api/account/replica",
      headers: h("A"),
      payload: { table: "characters", rows: [{ ...row, level: 999 }] },
    });
    assert.equal(bad.statusCode, 500);
    assert.equal(
      (await app.inject({ url: "/api/characters", headers: h("A") })).json()
        .data[0].level,
      200,
    );
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: "/api/account/replica",
          headers: h("A"),
          payload: { table: "roles;DELETE FROM characters", rows: [] },
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({ url: "/api/account/replica", headers: h("B") })
      ).json().data.characters.length,
      0,
    );
  } finally {
    await app.close();
    personal.close();
    game.close();
  }
});
