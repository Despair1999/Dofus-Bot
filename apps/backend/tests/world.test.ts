import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { PersonalStore } from "../src/store.js";
import { registerWorld, WorldStore } from "../src/world.js";

test("map landmarks retain source identity, exact Zaap classification and world filtering", async () => {
  const personal = new PersonalStore(":memory:"),
    app = Fastify();
  const store = registerWorld(app, personal);
  try {
    const all = (await app.inject({ url: "/api/world/points" })).json().data;
    assert.equal(all.length, 834);
    assert.equal(
      new Set(all.map((p: { id: number }) => p.id)).size,
      all.length,
    );
    for (const p of all) {
      assert.ok(store.maps.has(p.mapId));
      assert.ok(store.dataset.worlds.some((w) => w.id === p.worldId));
    }
    const zaaps = (
      await app.inject({ url: "/api/world/points?kind=zaap&worldId=1" })
    ).json().data;
    assert.ok(zaaps.length > 0);
    assert.ok(
      zaaps.every(
        (p: { name: string; worldId: number; categoryId: number }) =>
          p.name === "Zaap" && p.worldId === 1 && p.categoryId === 9,
      ),
    );
  } finally {
    await app.close();
    personal.close();
  }
});

test("interior quest targets inherit their documented parent atlas without merging map identity", async () => {
  const personal = new PersonalStore(":memory:"),
    app = Fastify();
  const store = registerWorld(app, personal);
  try {
    const response = await app.inject({ url: "/api/world/maps/99353610" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      Object.fromEntries(
        ["id", "x", "y", "worldId", "sourceWorldId", "interior"].map((k) => [
          k,
          response.json().data[k],
        ]),
      ),
      {
        id: 99353610,
        x: -1,
        y: 2,
        worldId: 1,
        sourceWorldId: -1,
        interior: true,
      },
    );
    const sameCell = (
      await app.inject({
        url: "/api/world/maps?worldId=1&minX=-1&maxX=-1&minY=2&maxY=2&limit=5000",
      })
    ).json().data;
    assert.ok(sameCell.some((m: { id: number }) => m.id === 99353610));
    assert.equal(
      new Set(sameCell.map((m: { id: number }) => m.id)).size,
      sameCell.length,
    );
    assert.equal(store.dataset.report.missingWorldImages, 0);
  } finally {
    await app.close();
    personal.close();
  }
});

test("Piocher farm routes enforce Amakna and Bronze on the server", async () => {
  const personal = new PersonalStore(":memory:"),
    app = Fastify(),
    store = registerWorld(app, personal);
  try {
    const inside = store.dataset.maps.find((m) => m.areaId === 0 && m.id > 0)!,
      outside = store.dataset.maps.find((m) => m.areaId !== 0 && m.id > 0)!;
    for (const map of [inside, outside])
      await app.inject({
        method: "POST",
        url: "/api/world/personal/markers",
        payload: {
          mapId: map.id,
          name: "Bronze-Test",
          kind: "observation",
          resourceId: 26,
        },
      });
    const result = await app.inject({
      method: "POST",
      url: "/api/world/farm-route",
      payload: { startMapId: inside.id, resourceIds: [26], questId: 945 },
    });
    assert.equal(result.statusCode, 200);
    assert.equal(result.json().nodeCount, 1);
    assert.ok(
      result
        .json()
        .observations.every((m: { mapId: number }) => m.mapId === inside.id),
    );
    const bypass = await app.inject({
      method: "POST",
      url: "/api/world/farm-route",
      payload: {
        startMapId: inside.id,
        resourceIds: [26],
        questId: 945,
        areaIds: [outside.areaId],
      },
    });
    assert.equal(bypass.json().nodeCount, 0);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/world/farm-route",
          payload: { startMapId: inside.id, resourceIds: [444], questId: 945 },
        })
      ).statusCode,
      400,
    );
  } finally {
    await app.close();
    personal.close();
  }
});

test("Real world snapshot has consistent references, exact source provenance and unresolved interactions", async () => {
  const personal = new PersonalStore(":memory:"),
    app = Fastify();
  const store = registerWorld(app, personal);
  try {
    const dataset = store.dataset;
    assert.ok(dataset.maps.length > 10000);
    assert.ok(dataset.worlds.length > 1);
    assert.match(dataset.sourceSha256, /^[a-f0-9]{64}$/);
    assert.equal(
      new Set(dataset.maps.map((m) => m.id)).size,
      dataset.maps.length,
    );
    for (const edge of dataset.transitions)
      assert.ok(store.maps.has(edge.from) && store.maps.has(edge.to));
    assert.equal(
      dataset.interactions.every((i) => i.status === "unresolved"),
      true,
    );
    const response = await app.inject({
      url: "/api/world/maps?worldId=1&minX=0&maxX=1&minY=0&maxY=1",
    });
    assert.equal(response.statusCode, 200);
    const maps = response.json().data;
    assert.ok(
      maps.every(
        (m: { x: number; y: number; worldId: number }) =>
          m.worldId === 1 && m.x >= 0 && m.x <= 1 && m.y >= 0 && m.y <= 1,
      ),
    );
    const bulkIds = dataset.maps
      .filter((m) => m.id > 0)
      .slice(0, 3)
      .map((m) => m.id)
      .reverse();
    const bulk = await app.inject({
      url: `/api/world/maps?ids=${bulkIds.join(",")}`,
    });
    assert.deepEqual(
      bulk.json().data.map((m: { id: number }) => m.id),
      bulkIds,
    );
  } finally {
    await app.close();
    personal.close();
  }
});
test("Personal resource observations produce no fictitious initial farm nodes", async () => {
  const personal = new PersonalStore(":memory:"),
    app = Fastify();
  const store = registerWorld(app, personal);
  try {
    const start = store.dataset.maps.find((m) => m.id > 0)!;
    const resource = store.dataset.resources[0];
    const empty = await app.inject({
      method: "POST",
      url: "/api/world/farm-route",
      payload: { startMapId: start.id, resourceIds: [resource.id] },
    });
    assert.equal(empty.statusCode, 200);
    assert.equal(empty.json().nodeCount, 0);
    assert.deepEqual(empty.json().data.mapIds, [start.id]);
    const saved = await app.inject({
      method: "POST",
      url: "/api/world/personal/markers",
      payload: {
        mapId: start.id,
        name: "Eigene Beobachtung",
        kind: "observation",
        resourceId: resource.id,
      },
    });
    assert.equal(saved.statusCode, 200);
    const route = await app.inject({
      method: "POST",
      url: "/api/world/farm-route",
      payload: { startMapId: start.id, resourceIds: [resource.id] },
    });
    assert.equal(route.json().nodeCount, 1);
    const marker = saved.json().data;
    await app.inject({
      method: "DELETE",
      url: `/api/world/personal/markers/${marker.id}`,
    });
    assert.equal(
      (await app.inject({ url: "/api/world/personal/markers" })).json().data
        .length,
      0,
    );
    const invalid = await app.inject({
      method: "POST",
      url: "/api/world/personal/markers",
      payload: { mapId: 999999999999, name: "Ungültig", kind: "waypoint" },
    });
    assert.equal(invalid.statusCode, 400);
  } finally {
    await app.close();
    personal.close();
  }
});
test("Routes reject maps absent from the imported version", () => {
  const personal = new PersonalStore(":memory:"),
    store = new WorldStore(personal);
  try {
    assert.throws(() =>
      store.route({
        startMapId: 999999999999,
        targetMapIds: [],
        roundTrip: false,
        excludedMapIds: [],
      }),
    );
  } finally {
    store.close();
    personal.close();
  }
});
