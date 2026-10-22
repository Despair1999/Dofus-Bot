import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const version = (await json("package.json")).version;
assert.equal(version, "0.8.0");
const units = await readFile(".data/repair-unit.log", "utf8");
const unitTests = [...units.matchAll(/# pass (\d+)/g)].reduce(
  (n, m) => n + Number(m[1]),
  0,
);
assert.equal(unitTests, 117);
assert.ok(!/# fail [1-9]|not ok /m.test(units));
const browser = await json("test-results/e2e.json");
assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.expected, 54);
assert.equal(browser.stats.skipped, 0);
assert.equal(
  (
    (await readFile(".data/repair-typecheck.log", "utf8")).match(
      /typecheck: Done/g,
    ) ?? []
  ).length,
  5,
);
assert.ok(
  !/\berror\b|\bwarning\b/i.test(
    await readFile(".data/repair-lint.log", "utf8"),
  ),
);
assert.match(
  await readFile(".data/repair-build.log", "utf8"),
  /apps\/desktop build: Done/,
);
assert.match(
  await readFile(".data/build-v0.8.0-final.log", "utf8"),
  /Finished 1 bundle/,
);
const [signature, packages, production, upgrade, native] = await Promise.all(
  [
    "release-v8-signature-test",
    "packages-v8-test",
    "production-ui-v8-test",
    "service-upgrade-v8-test",
    "native-v8-test",
  ].map((name) => json(`docs/${name}.json`)),
);
for (const report of [signature, packages, production, upgrade, native])
  assert.equal(report.version, version);
assert.ok(
  signature.releaseSignatureVerified &&
    signature.tamperedInstallerRejected &&
    signature.existingUpdaterKeyPreserved,
);
assert.ok(
  packages.exactExecutableAndServicePayloadVerified &&
    packages.setupContainsExactSignedInstaller,
);
assert.ok(
  production.externalRequestsBlocked &&
    production.passed.length >= 15 &&
    !production.errors.length &&
    !production.missingAssets.length,
);
assert.ok(upgrade.serviceUpgradePassed && upgrade.fromVersion === "0.7.0");
if (native.skipped)
  assert.match(native.reason, /Existing user Companion process or listener/);
else assert.ok(native.isolatedProfile && native.passed.length >= 7);
const preservedPaths = [
  "apps/desktop/public",
  "packages/core/src/builder.ts",
  "design/class-images/import-report.json",
];
const changedPreservedFiles = execFileSync(
  "git",
  ["diff", "--name-only", "072c1c7", "--", ...preservedPaths],
  { encoding: "utf8", windowsHide: true },
).trim();
assert.equal(
  changedPreservedFiles,
  "",
  "Existing game images, core calculations and source catalogs must remain unchanged",
);
assert.ok(
  (await readFile("apps/desktop/public/game-assets/manifest.json")).equals(
    await readFile("apps/desktop/dist/game-assets/manifest.json"),
  ),
);
const audit = await json("docs/GATHERING_DATA_AUDIT.json"),
  world = await json("packages/game-data/assets/world-data.json");
assert.equal(world.gatheringNodes.length, 13987);
assert.equal(audit.counts.unconfirmedPatch, 13987);
assert.equal(audit.sourceVerifiedCurrentPatch, 0);
assert.equal(
  new Set(world.gatheringNodes.map((n) => n.id)).size,
  world.gatheringNodes.length,
);
const positions = new Map(world.maps.map((m) => [m.id, m]));
for (const n of world.gatheringNodes) {
  const m = positions.get(n.mapId);
  assert.ok(m);
  assert.equal(n.x, m.x);
  assert.equal(n.y, m.y);
  assert.equal(n.worldId, m.worldId);
  assert.equal(n.verification, "unconfirmed-version");
}
const oldWorld = JSON.parse(
  execFileSync(
    "git",
    ["show", "072c1c7:packages/game-data/assets/world-data.json"],
    { encoding: "utf8", windowsHide: true, maxBuffer: 30 * 1024 * 1024 },
  ),
);
for (const key of [
  "maps",
  "worlds",
  "resources",
  "transitions",
  "interactions",
  "points",
])
  assert.deepEqual(world[key], oldWorld[key]);
assert.equal(
  (await json("docs/QUEST_GUIDE_AUDIT.json")).verifiedArticles,
  1494,
);
assert.ok(upgrade.omegaAndCraftProfessionsPersist);
const oldDungeons = JSON.parse(
  execFileSync(
    "git",
    ["show", "072c1c7:packages/game-data/assets/dungeon-data.json"],
    { encoding: "utf8", windowsHide: true, maxBuffer: 30 * 1024 * 1024 },
  ),
);
const currentDungeons = await json(
  "packages/game-data/assets/dungeon-data.json",
);
for (const [version, old] of Object.entries(oldDungeons.versions)) {
  for (const key of ["dungeons", "monsters", "professionQuests", "editorial"])
    assert.deepEqual(currentDungeons.versions[version][key], old[key]);
}
const installer = await readFile(
  `artifacts/DOFUS-Companion-${version}-setup.exe`,
);
assert.equal(
  signature.sha256,
  createHash("sha256").update(installer).digest("hex"),
);
const report = {
  version,
  testedAt: new Date().toISOString(),
  baseline: "072c1c7",
  unitTests,
  browserTests: browser.stats.expected,
  typecheckPassed: true,
  lintPassed: true,
  monorepoBuildPassed: true,
  windowsInstallerBuilt: true,
  releasePackagesVerified: true,
  productionUiPassed: true,
  productionUiChecks: production.passed.length,
  existingUpdaterKeyPreserved: true,
  serviceUpgradePassed: true,
  assetAuditPassed: true,
  existingImagesAndCalculationsUnchanged: true,
  newImagesDownloaded: 0,
  gatheringAudit: await json("docs/GATHERING_DATA_AUDIT.json"),
  questGuideAudit: await json("docs/QUEST_GUIDE_AUDIT.json"),
  installerSha256: signature.sha256,
  nativeUi: native,
  limitations: [
    "13987 external source cells have an older patch and remain unconfirmed, hidden by default; no current-patch external spawn coverage is claimed",
    "482 quests have no uniquely verified direct article",
    "Native 0.8 smoke test skipped when a user instance was running; production Chromium checks do not establish interactive WebView2 behavior",
    "Physical multi-monitor/DPI and live Discord authentication remain untested",
    "Existing incomplete patch-verified dungeon strategies and four missing cosmetic catalog images remain",
  ],
};
await writeFile(
  "docs/REPAIR_VALIDATION.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
