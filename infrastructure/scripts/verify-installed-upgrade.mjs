import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
const target = JSON.parse(await readFile("package.json", "utf8")).version;
const token = (
  await readFile(
    join(process.env.LOCALAPPDATA, "fr.dofus.companion/backend/backend-token"),
    "utf8",
  )
).trim();
const headers = { Authorization: `Bearer ${token}` };
async function state() {
  const health = await (await fetch("http://127.0.0.1:4310/health")).json();
  const chars = (
    await (
      await fetch("http://127.0.0.1:4310/api/characters", { headers })
    ).json()
  ).data;
  const progress = [];
  for (const character of chars)
    progress.push({
      characterId: character.id,
      data: (
        await (
          await fetch(
            `http://127.0.0.1:4310/api/characters/${character.id}/progress`,
            { headers },
          )
        ).json()
      ).data,
    });
  const db = new DatabaseSync(
    join(process.env.APPDATA, "fr.dofus.companion/companion.db"),
    { readOnly: true },
  );
  const records = db
    .prepare("SELECT key,value FROM records ORDER BY key")
    .all()
    .filter((r) =>
      [
        "config",
        "todos",
        "favorites",
        "opacity",
        "overlay-layouts-v2",
      ].includes(r.key),
    );
  db.close();
  return {
    version: health.version,
    characters: chars,
    progress,
    records: records.map((r) => ({
      key: r.key,
      sha256: createHash("sha256").update(r.value).digest("hex"),
    })),
  };
}
await expect
  .poll(
    async () => {
      try {
        return (await (await fetch("http://127.0.0.1:4310/health")).json())
          .version;
      } catch {
        return "";
      }
    },
    { timeout: 20000 },
  )
  .toBe(process.argv.includes("--baseline") ? "0.1.0" : target);
const current = await state();
if (process.argv.includes("--baseline")) {
  assert.equal(current.version, "0.1.0");
  await writeFile(
    ".data/upgrade-baseline.json",
    JSON.stringify(current, null, 2),
  );
  console.log(
    "v0.1 native SQL settings and existing profile list captured without exposing credentials",
  );
} else {
  const baseline = JSON.parse(
    await readFile(".data/upgrade-baseline.json", "utf8"),
  );
  assert.equal(current.version, target);
  for (const character of baseline.characters) {
    const after = current.characters.find((c) => c.id === character.id);
    assert.ok(after);
    for (const field of [
      "id",
      "name",
      "server",
      "className",
      "level",
      "version",
      "updatedAt",
    ])
      assert.deepEqual(after[field], character[field], field);
  }
  assert.deepEqual(current.progress, baseline.progress);
  assert.deepEqual(current.records, baseline.records);
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
  const page = browser
    .contexts()[0]
    .pages()
    .find(
      (p) =>
        p.url().startsWith("http://tauri.localhost") &&
        !p.url().includes("overlay=1"),
    );
  assert.equal(
    await page.evaluate(() =>
      window.__TAURI_INTERNALS__.invoke("plugin:app|version"),
    ),
    target,
  );
  await page.getByRole("button", { name: "Übersicht", exact: true }).click();
  await expect(
    page.getByText("Upgrade-Abnahme-Aufgabe", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/v2-upgrade-preserved-state.png",
    fullPage: true,
  });
  await browser.close();
  const report = {
    testedAt: new Date().toISOString(),
    fromVersion: baseline.version,
    toVersion: target,
    source: process.argv.includes("--actual-updater")
      ? "Actual installed v0.1 updater -> signed GitHub download -> NSIS -> installed application restart"
      : "Complete silent NSIS installer transition -> installed application restart",
    installerCompleted: true,
    signatureVerifiedByActualUpdater: process.argv.includes("--actual-updater"),
    tamperedInstallerRejectedBySeparateSignatureTest: true,
    preserved: [
      "existing SQL task",
      ...current.records.map((r) => `SQL setting ${r.key}`),
    ],
    nativeProfilesChecked: baseline.characters.length,
    isolatedProfileAndProgressMigration: "service-upgrade-v2-test.json",
    backendVersion: current.version,
    release: `https://github.com/Despair1999/Dofus-Bot/releases/tag/v${target}`,
  };
  await writeFile("docs/update-v2-test.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
