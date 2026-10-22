import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const version = (await json("package.json")).version;
assert.equal(version, "0.7.0");
const units = await readFile(".data/profile-unit.log", "utf8");
const unitTests = [...units.matchAll(/# pass (\d+)/g)].reduce(
  (n, m) => n + Number(m[1]),
  0,
);
assert.equal(unitTests, 112);
assert.ok(!/# fail [1-9]|not ok /m.test(units));
const browser = await json("test-results/e2e.json");
assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.expected, 49);
assert.equal(browser.stats.skipped, 0);
assert.equal(
  (
    (await readFile(".data/profile-typecheck.log", "utf8")).match(
      /typecheck: Done/g,
    ) ?? []
  ).length,
  5,
);
assert.ok(
  !/\berror\b|\bwarning\b/i.test(
    await readFile(".data/profile-lint.log", "utf8"),
  ),
);
assert.match(
  await readFile(".data/profile-build.log", "utf8"),
  /apps\/desktop build: Done/,
);
assert.match(
  await readFile(".data/build-v0.7.0-final.log", "utf8"),
  /Finished 1 bundle/,
);
const [signature, packages, production, upgrade, native] = await Promise.all(
  [
    "release-v7-signature-test",
    "packages-v7-test",
    "production-ui-v7-test",
    "service-upgrade-v7-test",
    "native-v7-test",
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
    production.passed.length >= 12 &&
    !production.errors.length &&
    !production.missingAssets.length,
);
assert.ok(upgrade.serviceUpgradePassed && upgrade.fromVersion === "0.6.0");
if (native.skipped)
  assert.match(native.reason, /Existing user Companion process or listener/);
else assert.ok(native.isolatedProfile && native.passed.length >= 7);
const preservedPaths = [
  "apps/desktop/public",
  "packages/core",
  "packages/game-data/assets",
  "design/class-images/import-report.json",
];
const changedPreservedFiles = execFileSync(
  "git",
  ["diff", "--name-only", "d1736db", "--", ...preservedPaths],
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
  baseline: "d1736db",
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
  existingAssetsAndCoreUnchanged: true,
  newImagesDownloaded: 0,
  installerSha256: signature.sha256,
  nativeUi: native,
  limitations: [
    "Existing nineteen portraits retained; no licensed full-body class illustrations available",
    "Native 0.7 smoke test skipped when a user instance was running; production Chromium checks do not establish interactive WebView2 behavior",
    "Physical multi-monitor/DPI and live Discord authentication remain untested",
    "Existing incomplete patch-verified dungeon strategies and four missing cosmetic catalog images remain",
  ],
};
await writeFile(
  "docs/PROFILE_UI_VALIDATION.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
