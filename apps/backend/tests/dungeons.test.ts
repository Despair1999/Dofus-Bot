import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameDataStore } from "@dofus/game-data";
import { createApp } from "../src/app.js";
import { PersonalStore } from "../src/store.js";
import { DungeonStore } from "../src/dungeons.js";
const dir = mkdtempSync(join(tmpdir(), "companion-dungeon-")),
  personal = new PersonalStore(join(dir, "personal.sqlite")),
  game = new GameDataStore(join(dir, "game.sqlite"));
const token = "dungeon-test-secret-00000000000000000000000",
  headers = { authorization: `Bearer ${token}` };
const character = personal.createCharacter({
  name: "Minen-Test",
  server: "Test",
  className: "Cra",
  level: 200,
});
let app: Awaited<ReturnType<typeof createApp>>;
before(async () => {
  app = await createApp({ personal, game, token });
  await app.ready();
});
after(async () => {
  await app.close();
  personal.close();
  game.close();
  rmSync(dir, { recursive: true, force: true });
});
test("imported datasets have unique IDs, valid version-isolated boss references and real statistics", () => {
  const store = new DungeonStore(personal);
  for (const version of ["3.6.12.16", "3.7.12.12"]) {
    const data = store.version(version),
      ids = new Set(data.dungeons.map((d) => d.id)),
      monsters = new Set(data.monsters.map((m) => m.id));
    assert.equal(ids.size, data.dungeons.length);
    assert.equal(data.dungeons.length, 187);
    for (const dungeon of data.dungeons)
      for (const boss of dungeon.bossIds) assert.ok(monsters.has(boss));
    assert.equal(data.report.invalidBossReferences, 0);
    assert.equal(
      data.report.verifiedMechanics,
      version === "3.7.12.12" ? 4 : 0,
    );
    assert.equal(data.report.roomCompositions, 0);
    assert.ok(
      data.monsters.some(
        (m) => m.spells.length && m.drops.length && m.grades.length,
      ),
    );
    assert.ok(data.source.endsWith(`v6.0_${version}/dofus.sqlite`));
  }
  assert.notEqual(
    store.version("3.6.12.16").report.monsterGrades,
    store.version("3.7.12.12").report.monsterGrades,
  );
});
test("search supports French boss aliases, pagination and explicit absent version", async () => {
  const response = await app.inject({
    url: "/api/dungeons?q=Bouftou%20Royal&pageSize=1",
  });
  assert.equal(response.statusCode, 200);
  assert.ok(response.json().data.some((d: any) => d.bossIds.includes(147)));
  assert.equal(
    (await app.inject({ url: "/api/dungeons?version=3.99.1.1" })).statusCode,
    404,
  );
  assert.equal(
    (await app.inject({ url: "/api/dungeons/999999" })).statusCode,
    404,
  );
});
test("all private preparation and profession reads require bearer authentication", async () => {
  for (const url of [
    `/api/dungeon-personal/${character.id}/1`,
    `/api/profession-personal/${character.id}`,
  ])
    assert.equal((await app.inject({ url })).statusCode, 401);
});
test("Piocher imports current objective amount, miner level and exact source start map", async () => {
  const q = (await app.inject({ url: "/api/profession-quests" }))
    .json()
    .data.find((v: any) => v.id === 945);
  assert.equal(q.quantity, 10);
  assert.equal(q.itemId, 13289);
  assert.equal(q.jobId, 24);
  assert.equal(q.minJobLevel, 40);
  assert.equal(q.minCharacterLevel, 20);
  assert.deepEqual([q.start.x, q.start.y], [21, 14]);
  assert.deepEqual(q.regionAreaIds, [0]);
  assert.ok(q.gatheringItemId);
  assert.equal(q.warnings.length, 2);
});
test("profession progress and levels persist and reject premature completion", async () => {
  const url = `/api/profession-personal/${character.id}`;
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: `${url}/levels`,
        headers,
        payload: { jobId: 24, level: 40 },
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: `${url}/quests/945`,
        headers,
        payload: { quantity: 9, completed: true },
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: `${url}/quests/945`,
        headers,
        payload: { quantity: 10, completed: true },
      })
    ).statusCode,
    200,
  );
  const result = (await app.inject({ url, headers })).json().data;
  assert.equal(result.levels[0].level, 40);
  assert.equal(result.quests[0].quantity, 10);
  assert.ok(result.quests[0].completedAt);
});
test("editorial verification rejects missing/version-mismatched references and dangling rooms", async () => {
  const payload = {
    status: "verified",
    mechanics: ["Testredaktion"],
    strategy: [],
    sources: [],
    rooms: [],
  };
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: "/api/dungeons/1/editorial",
        headers,
        payload,
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: "/api/dungeons/1/editorial",
        headers,
        payload: {
          ...payload,
          sources: [
            {
              url: "https://example.org/evidence",
              version: "3.6.12.16",
              checkedAt: new Date().toISOString(),
            },
          ],
        },
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: "/api/dungeons/1/editorial",
        headers,
        payload: {
          ...payload,
          status: "draft",
          rooms: [
            { mapId: 99999, order: 1, type: "room", players: 4, monsters: [] },
          ],
        },
      })
    ).statusCode,
    400,
  );
});
test("editorial entries stay in their own version and preparation checklists persist", async () => {
  const payload = {
    status: "partial",
    mechanics: ["Redaktionelle Testnotiz"],
    strategy: [],
    sources: [],
    rooms: [],
  };
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: "/api/dungeons/1/editorial",
        headers,
        payload,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url: "/api/dungeons/1" })).json().data.editorial
      .mechanics.length,
    1,
  );
  assert.equal(
    (await app.inject({ url: "/api/dungeons/1?version=3.6.12.16" })).json().data
      .editorial.mechanics.length,
    0,
  );
  const checklist = Object.fromEntries(
    [
      "access",
      "key",
      "build",
      "equipment",
      "mechanics",
      "achievements",
      "group",
      "travel",
    ].map((k) => [k, k === "key"]),
  );
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: `/api/dungeon-personal/${character.id}/1`,
        headers,
        payload: { favorite: true, players: 6, checklist },
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        url: `/api/dungeon-personal/${character.id}/1`,
        headers,
      })
    ).json().data.players,
    6,
  );
});
