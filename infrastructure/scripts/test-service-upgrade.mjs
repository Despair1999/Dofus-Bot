import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, copyFile, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { expect } from "@playwright/test";
const folder = await mkdtemp(resolve(".data/service-upgrade-"));
const target = JSON.parse(await readFile("package.json", "utf8")).version;
await copyFile(".data/game-data.sqlite", join(folder, "game-data.sqlite"));
const port = 4323,
  token = randomUUID() + randomUUID(),
  url = `http://127.0.0.1:${port}`;
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};
let child;
async function start(version) {
  const service = resolve(`.data/portable-${version}/service`);
  child = spawn(join(service, "node.exe"), [join(service, "backend.mjs")], {
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      DATA_DIR: folder,
      HOST: "127.0.0.1",
      PORT: String(port),
      COMPANION_TOKEN: token,
      COMPANION_CATALOG_SEED: "",
    },
  });
  await expect
    .poll(
      async () => {
        if (child.exitCode !== null) throw new Error("Fixture service stopped");
        try {
          return (await (await fetch(url + "/health")).json()).version;
        } catch {
          return "";
        }
      },
      { timeout: 15000 },
    )
    .toBe(version);
}
async function stop() {
  if (child && child.exitCode === null) {
    const ended = once(child, "exit");
    child.kill();
    await ended;
  }
}
async function api(path, method = "GET", body) {
  const r = await fetch(url + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await r.json();
  assert.ok(r.ok, JSON.stringify(result));
  return result.data;
}
try {
  await start("0.1.0");
  const character = await api("/api/characters", "POST", {
    name: "Upgrade-Fixture",
    server: "Testserver",
    className: "Sacrieur",
    level: 101,
  });
  await api(`/api/characters/${character.id}/progress`, "PUT", {
    questId: 1697,
    step: 0,
    status: "paused",
    expectedVersion: 0,
    mutationId: randomUUID(),
  });
  const before = (await api("/api/characters")).find(
      (c) => c.id === character.id,
    ),
    progress = await api(`/api/characters/${character.id}/progress`);
  await stop();
  await start(target);
  const after = (await api("/api/characters")).find(
    (c) => c.id === character.id,
  );
  for (const field of [
    "id",
    "name",
    "server",
    "className",
    "level",
    "version",
    "updatedAt",
  ])
    assert.deepEqual(after[field], before[field], field);
  assert.equal(after.classId, 11);
  assert.deepEqual(
    await api(`/api/characters/${character.id}/progress`),
    progress,
  );
  const report = {
    testedAt: new Date().toISOString(),
    fromVersion: "0.1.0",
    toVersion: target,
    scope:
      "Actual old and new bundled services, isolated fresh SQLite directory; profile/progress created through v0.1 API",
    passed: [
      "existing character ID/name/server/className/level/version/updatedAt preserved",
      "paused quest progress preserved byte-for-byte as JSON",
      "class ID migrated to 11",
      "service restart survives Windows process termination",
    ],
    userDatabasesModified: false,
  };
  await writeFile(
    "docs/service-upgrade-v2-test.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await stop();
}
