import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const resources = resolve(root, "apps/desktop/src-tauri/resources");
const dataDir = await mkdtemp(join(tmpdir(), "companion-bundle-test-"));
const args = process.argv.slice(2);
const sourceIndex = args.indexOf("--game-data");
const gameDataSource =
  sourceIndex >= 0 ? resolve(args[sourceIndex + 1] ?? "") : null;
if (gameDataSource)
  await copyFile(gameDataSource, join(dataDir, "game-data.sqlite"));
const port = 4311;
const origin = `http://127.0.0.1:${port}`;
let output = "";
const child = spawn(
  resolve(resources, "node.exe"),
  [resolve(resources, "backend.mjs")],
  {
    cwd: dataDir,
    windowsHide: true,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      PORT: String(port),
      HOST: "127.0.0.1",
      COMPANION_TOKEN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
child.stdout.on("data", (buffer) => {
  output += buffer.toString();
});
child.stderr.on("data", (buffer) => {
  output += buffer.toString();
});
let spawnError;
child.once("error", (error) => {
  spawnError = error;
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null)
      throw new Error(
        `Gebündeltes Backend beendet (${child.exitCode}): ${output}`,
      );
    try {
      const health = await fetch(`${origin}/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (health.ok) {
        assert.equal((await health.json()).status, "ok");
        ready = true;
        break;
      }
    } catch {
      /* Server may still be opening databases. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Backend nicht startbereit: ${output}`);
  const token = (await readFile(join(dataDir, "backend-token"), "utf8")).trim();
  assert.ok(token.length >= 32);
  assert.equal((await fetch(`${origin}/api/characters`)).status, 401);
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  const created = await fetch(`${origin}/api/characters`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Bundle-Test",
      server: "Testserver",
      className: "Iop",
      level: 60,
    }),
  });
  assert.equal(created.status, 201);
  const character = (await created.json()).data;
  const items = await fetch(`${origin}/api/items?q=Gelano`, {
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(items.status, 200);
  const itemData = await items.json();
  assert.ok(itemData.data.some((item) => item.name === "Gelano"));
  const quests = await fetch(`${origin}/api/quests`);
  assert.equal(quests.status, 200);
  const questData = await quests.json();
  assert.ok(Array.isArray(questData.data));
  let progressVerified = false;
  if (gameDataSource) {
    assert.ok(questData.data.length > 0, "Importierte Questdaten erwartet");
    const quest = questData.data[0];
    const progressUrl = `${origin}/api/characters/${character.id}/progress`;
    const body = {
      questId: quest.id,
      step: 0,
      status: "active",
      expectedVersion: 0,
      mutationId: randomUUID(),
    };
    const saved = await fetch(progressUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
    assert.equal(saved.status, 200);
    const first = (await saved.json()).data;
    assert.equal(first.version, 1);
    const replay = await fetch(progressUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
    assert.deepEqual((await replay.json()).data, first);
    const conflict = await fetch(progressUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify({ ...body, mutationId: randomUUID() }),
    });
    assert.equal(conflict.status, 409);
    const stored = await fetch(progressUrl, { headers });
    assert.equal((await stored.json()).data[0].questId, quest.id);
    progressVerified = true;
  }
  const report = {
    test: "standalone-bundled-backend",
    passed: true,
    time: new Date().toISOString(),
    node: process.version,
    cwdOutsideRepository: true,
    health: true,
    unauthorizedRejected: true,
    characterCreated: true,
    liveItemCount: itemData.data.length,
    questCount: questData.questCount,
    importedQuestProgress: progressVerified,
    importedQuestIdempotency: progressVerified,
    importedQuestConflict: progressVerified,
  };
  await mkdir(resolve(root, "docs"), { recursive: true });
  await import("node:fs/promises").then((fs) =>
    fs.writeFile(
      resolve(root, "docs/bundled-backend-test.json"),
      JSON.stringify(report, null, 2),
    ),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (child.exitCode === null) {
    child.kill();
    await new Promise((resolve) => {
      child.once("exit", resolve);
      setTimeout(resolve, 5000);
    });
  }
  await rm(dataDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}
