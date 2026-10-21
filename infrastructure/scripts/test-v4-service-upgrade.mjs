import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { expect } from "@playwright/test";

const version = JSON.parse(await readFile("package.json", "utf8")).version;
const directory = await mkdtemp(resolve(".data/service-v4-upgrade-"));
await copyFile(
  "apps/desktop/src-tauri/resources/catalog-seed.sqlite",
  join(directory, "game-data.sqlite"),
);
const listener = createServer();
listener.listen(0, "127.0.0.1");
await once(listener, "listening");
const port = listener.address().port;
await new Promise((done) => listener.close(done));
const token = randomUUID() + randomUUID(),
  origin = `http://127.0.0.1:${port}`;
let child;
async function start(old = false) {
  const service = resolve(
    old ? ".data/portable-0.3.0/service" : "apps/desktop/src-tauri/resources",
  );
  child = spawn(join(service, "node.exe"), ["backend.mjs"], {
    cwd: service,
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      DATA_DIR: directory,
      PORT: String(port),
      HOST: "127.0.0.1",
      COMPANION_TOKEN: token,
      COMPANION_CATALOG_SEED: "",
    },
  });
  await expect
    .poll(
      async () => {
        if (child.exitCode !== null)
          throw Error(`Service ended ${child.exitCode}`);
        try {
          return (await (await fetch(origin + "/health")).json()).version;
        } catch {
          return "";
        }
      },
      { timeout: 30000 },
    )
    .toBe(old ? "0.3.0" : version);
}
async function stop() {
  if (child?.exitCode === null) {
    const ended = once(child, "exit");
    child.kill();
    await ended;
  }
}
async function api(path, body, method = body ? "POST" : "GET") {
  const response = await fetch(origin + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  assert.ok(response.ok, `${path}: ${JSON.stringify(result)}`);
  return result.data;
}
try {
  await start(true);
  const character = await api("/api/characters", {
    name: "V4-Migrationsfixture",
    server: "Test",
    className: "Cra",
    classId: 9,
    level: 123,
  });
  await api(
    `/api/characters/${character.id}/progress`,
    {
      questId: 945,
      step: 0,
      status: "paused",
      expectedVersion: 0,
      mutationId: randomUUID(),
    },
    "PUT",
  );
  const build = await api("/api/builder/builds", {
    name: "Set vor Upgrade",
    characterId: character.id,
    classId: 9,
    level: 123,
    gameVersion: "3.7.12.12",
    equipment: { ring1: { itemId: 2469, rolls: {}, exos: { 8: 1 } } },
    active: true,
  });
  const progress = await api(`/api/characters/${character.id}/progress`),
    summary = await api(`/api/builder/builds/${build.id}/summary`);
  await stop();
  await start();
  assert.deepEqual(
    (await api("/api/characters")).find((c) => c.id === character.id),
    character,
  );
  assert.deepEqual(
    await api(`/api/characters/${character.id}/progress`),
    progress,
  );
  assert.deepEqual(await api(`/api/builder/builds/${build.id}`), build);
  assert.deepEqual(
    (await api(`/api/builder/builds/${build.id}/summary`)).calculation,
    summary.calculation,
  );
  await api(
    `/api/profession-personal/${character.id}/levels`,
    { jobId: 24, level: 40 },
    "PUT",
  );
  await api(
    `/api/profession-personal/${character.id}/quests/945`,
    { quantity: 4, completed: false },
    "PUT",
  );
  const marker = await api("/api/world/personal/markers", {
    mapId: 91751943,
    name: "Persönlicher Wegpunkt",
    kind: "waypoint",
  });
  const report = await api("/api/dungeons/report");
  assert.equal(report.catalogDungeons, 187);
  const world = await api("/api/world/status");
  assert.ok(world.version.includes("3.7"));
  await stop();
  await start();
  assert.deepEqual(await api(`/api/builder/builds/${build.id}`), build);
  assert.deepEqual(
    await api(`/api/characters/${character.id}/progress`),
    progress,
  );
  assert.ok(
    (await api("/api/world/personal/markers")).some((m) => m.id === marker.id),
  );
  const profession = await api(`/api/profession-personal/${character.id}`);
  assert.equal(profession.levels.find((j) => j.jobId === 24).level, 40);
  assert.equal(profession.quests.find((q) => q.questId === 945).quantity, 4);
  const result = {
    testedAt: new Date().toISOString(),
    fromVersion: "0.3.0",
    version,
    scope:
      "Real old/new bundled Windows Node services, isolated SQLite fixture and loopback APIs; no productive user database modified",
    serviceUpgradePassed: true,
    existingCharacterPreserved: true,
    existingQuestProgressPreserved: true,
    existingBuildAndCalculationPreserved: true,
    newProfessionsAndMarkersPersistAfterRestart: true,
    worldAndDungeonDataLoadedOffline: true,
  };
  await writeFile(
    "docs/service-upgrade-v4-test.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  await stop();
}
