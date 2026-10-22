import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { PersonalStore } from "../src/store.js";
import { registerWorld } from "../src/world.js";
import { registerDungeons } from "../src/dungeons.js";
import { characterInput } from "@dofus/core";
import { GameDataStore } from "@dofus/game-data";
import { createApp } from "../src/app.js";

test("public gathering data cannot expose private observations or profession levels", async () => {
  const p = new PersonalStore(":memory:"),
    game = new GameDataStore(":memory:"),
    token = "t".repeat(32),
    app = await createApp({ personal: p, game, token });
  try {
    const publicResult = await app.inject({
      url: "/api/world/gathering?resourceIds=128&includeUnconfirmed=true",
    });
    assert.equal(publicResult.statusCode, 200);
    assert.ok(
      publicResult
        .json()
        .data.every(
          (n: { verification: string }) =>
            n.verification !== "personal-observation",
        ),
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/world/gathering?resourceIds=128&includePersonal=true",
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/world/gathering?resourceIds=128&characterId=00000000-0000-4000-8000-000000000000",
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/world/gathering?resourceIds=128&includePersonal=true",
          headers: { authorization: `Bearer ${token}` },
        })
      ).statusCode,
      200,
    );
  } finally {
    await app.close();
    p.close();
    game.close();
  }
});

test("Omega is independent, retained for old clients, nullable and unavailable before level 200", () => {
  const p = new PersonalStore(":memory:");
  try {
    const c = p.createCharacter({
      name: "Omega",
      server: "QA",
      className: "Iop",
      level: 200,
    });
    assert.equal(p.characters()[0].omegaLevel, null);
    let updated = p.updateCharacter(c.id, { ...c, omegaLevel: 125 }, c.version);
    assert.equal(updated.level, 200);
    assert.equal(updated.omegaLevel, 125);
    updated = p.updateCharacter(
      c.id,
      { name: c.name, server: c.server, className: c.className, level: 200 },
      updated.version,
    );
    assert.equal(updated.omegaLevel, 125);
    assert.throws(() =>
      p.updateCharacter(c.id, { ...updated, level: 199 }, updated.version),
    );
    assert.throws(() => p.createCharacter({ ...c, level: 199, omegaLevel: 1 }));
    assert.equal(
      characterInput.safeParse({ ...c, omegaLevel: -1 }).success,
      false,
    );
    assert.equal(
      characterInput.safeParse({ ...c, omegaLevel: 1.5 }).success,
      false,
    );
    assert.equal(
      p.updateCharacter(c.id, { ...updated, omegaLevel: null }, updated.version)
        .omegaLevel,
      null,
    );
  } finally {
    p.close();
  }
});

test("all current professions persist independently per character and can return to unknown", async () => {
  const p = new PersonalStore(":memory:"),
    app = Fastify();
  registerDungeons(app, p);
  try {
    const jobs = (await app.inject({ url: "/api/professions" })).json().data;
    assert.equal(jobs.length, 22);
    assert.ok(jobs.some((j: { id: number }) => j.id === 44));
    assert.ok(!jobs.some((j: { id: number }) => j.id === 1));
    const a = p.createCharacter({
        name: "A",
        className: "Iop",
        server: "QA",
        level: 200,
      }),
      b = p.createCharacter({
        name: "B",
        className: "Iop",
        server: "QA",
        level: 200,
      });
    const url = `/api/profession-personal/${a.id}/levels`;
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url,
          payload: { jobId: 15, level: 125 },
        })
      ).statusCode,
      200,
    );
    assert.deepEqual(
      (await app.inject({ url: `/api/profession-personal/${a.id}` })).json()
        .data.levels,
      [{ jobId: 15, level: 125 }],
    );
    assert.deepEqual(
      (await app.inject({ url: `/api/profession-personal/${b.id}` })).json()
        .data.levels,
      [],
    );
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url,
          payload: { jobId: 1, level: 1 },
        })
      ).statusCode,
      400,
    );
    assert.notEqual(
      (
        await app.inject({
          method: "PUT",
          url,
          payload: { jobId: 15, level: 201 },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url,
          payload: { jobId: 15, level: null },
        })
      ).statusCode,
      200,
    );
    assert.deepEqual(
      (await app.inject({ url: `/api/profession-personal/${a.id}` })).json()
        .data.levels,
      [],
    );
  } finally {
    await app.close();
    p.close();
  }
});

test("fish positions use explicit source cells, never regional expansion or another patch without opt-in", async () => {
  const p = new PersonalStore(":memory:"),
    app = Fastify(),
    store = registerWorld(app, p);
  try {
    const node = store.dataset.gatheringNodes!.find((n) => n.jobId === 36)!,
      base = `/api/world/gathering?resourceIds=${node.resourceId}&worldId=${node.worldId}`;
    assert.deepEqual((await app.inject({ url: base })).json().data, []);
    const nodes = (
      await app.inject({ url: base + "&includeUnconfirmed=true" })
    ).json().data;
    assert.ok(nodes.length > 0);
    for (const n of nodes) {
      const map = store.maps.get(n.mapId)!;
      assert.equal(n.x, map.x);
      assert.equal(n.y, map.y);
      assert.equal(n.worldId, map.worldId);
      assert.equal(n.verification, "unconfirmed-version");
      assert.ok(n.cellId >= 0 && n.cellId < 560);
    }
    assert.deepEqual(
      (
        await app.inject({ url: base + "&includeUnconfirmed=true&maxLevel=0" })
      ).json().data,
      [],
    );
    const payload = { startMapId: node.mapId, resourceIds: [node.resourceId] };
    const strict = (
      await app.inject({
        method: "POST",
        url: "/api/world/farm-route",
        payload,
      })
    ).json();
    assert.equal(strict.nodeCount, 0);
    assert.equal(strict.data.complete, false);
    const documented = (
      await app.inject({
        method: "POST",
        url: "/api/world/farm-route",
        payload: { ...payload, includeUnconfirmed: true, maxStops: 5 },
      })
    ).json();
    assert.ok(documented.nodeCount > 0);
    assert.equal(
      documented.locationPrecision,
      "documented-unconfirmed-version",
    );
    assert.ok(documented.estimatedOrderMapIds.length <= 6);
    assert.equal(documented.data.transitions.length, documented.data.steps);
    assert.ok(
      documented.data.transitions.every((e: { from: number; to: number }) =>
        store.dataset.transitions.some(
          (v) => v.from === e.from && v.to === e.to,
        ),
      ),
    );
    const resources = (await app.inject({ url: "/api/world/resources" })).json()
      .data;
    assert.equal(
      new Set(
        resources.map(
          (r: { jobId: number; itemId: number; level: number }) =>
            `${r.jobId}:${r.itemId}:${r.level}`,
        ),
      ).size,
      resources.length,
    );
  } finally {
    await app.close();
    p.close();
  }
});
