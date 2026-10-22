import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const version = (await json("package.json")).version;
assert.equal(version, "0.6.0");
const units = await readFile(".data/redesign-unit.log", "utf8");
const unitTests = [...units.matchAll(/# pass (\d+)/g)].reduce(
  (n, m) => n + Number(m[1]),
  0,
);
assert.equal(unitTests, 108);
assert.ok(!/# fail [1-9]|not ok /m.test(units));
const e2e = await json("test-results/e2e.json");
assert.equal(e2e.stats.unexpected, 0);
assert.equal(e2e.stats.expected, 44);
assert.equal(e2e.stats.skipped, 0);
assert.equal(
  (
    (await readFile(".data/redesign-typecheck.log", "utf8")).match(
      /typecheck: Done/g,
    ) ?? []
  ).length,
  5,
);
assert.ok(
  !/\berror\b|\bwarning\b/i.test(
    await readFile(".data/redesign-lint-final.log", "utf8"),
  ),
);
assert.match(
  await readFile(".data/build-v0.6.0.log", "utf8"),
  /Finished 1 bundle/,
);
const signatures = await json("docs/release-v6-signature-test.json"),
  packages = await json("docs/packages-v6-test.json"),
  production = await json("docs/production-ui-v6-test.json"),
  upgrade = await json("docs/service-upgrade-v6-test.json"),
  native = await json("docs/native-v6-test.json"),
  lifecycle = await json("docs/native-v6-lifecycle.json"),
  assets = await json("docs/REDESIGN_ASSET_AUDIT.json");
for (const report of [
  signatures,
  packages,
  production,
  upgrade,
  native,
  lifecycle,
])
  assert.equal(report.version, version);
assert.ok(
  signatures.releaseSignatureVerified &&
    signatures.tamperedInstallerRejected &&
    signatures.existingUpdaterKeyPreserved,
);
assert.ok(
  packages.exactExecutableAndServicePayloadVerified &&
    packages.setupContainsExactSignedInstaller,
);
assert.ok(
  production.externalRequestsBlocked &&
    production.passed.length >= 9 &&
    !production.errors.length &&
    !production.missingAssets.length,
);
assert.ok(upgrade.serviceUpgradePassed && upgrade.fromVersion === "0.5.0");
assert.ok(
  native.isolatedProfile &&
    native.applicationId === "fr.dofus.companion.qa.v6" &&
    native.passed.length >= 7,
);
assert.ok(
  lifecycle.backendStopped &&
    lifecycle.workerProcessesRemaining === 0 &&
    lifecycle.onlyOwnedNativeProcessStopped,
);
assert.ok(
  assets.existingManifestUnchanged &&
    assets.newImagesDownloaded === 0 &&
    assets.broken.length === 0,
);
const installer = await readFile(
  `artifacts/DOFUS-Companion-${version}-setup.exe`,
);
assert.equal(
  signatures.sha256,
  createHash("sha256").update(installer).digest("hex"),
);
assert.ok(
  (await readFile("apps/desktop/public/game-assets/manifest.json")).equals(
    await readFile("apps/desktop/dist/game-assets/manifest.json"),
  ),
);
const report = {
  version,
  testedAt: new Date().toISOString(),
  unitTests,
  browserTests: e2e.stats.expected,
  typecheckPassed: true,
  lintPassed: true,
  windowsInstallerBuilt: true,
  releasePackagesVerified: true,
  productionUiPassed: true,
  productionUiChecks: production.passed.length,
  existingUpdaterKeyPreserved: true,
  serviceUpgradePassed: true,
  assetAuditPassed: true,
  assetFiles: assets.files,
  catalogRows: assets.catalog.total,
  missingLocalCatalogImages: assets.catalog.missingLocalImages.length,
  installerSha256: signatures.sha256,
  nativeUi: {
    isolatedProfile: true,
    applicationId: native.applicationId,
    passed: native.passed,
    ownedProcessesStopped: true,
    scope: native.scope,
  },
  limitations: [
    "Incomplete patch-verified strategy coverage",
    "Four cosmetic catalog icons and historical asset references remain unavailable locally",
    "Redistribution permissions for existing game assets are not independently established; no new game images downloaded",
    "Native runtime exercised through a separate QA application identifier; production installer separately signed and payload-checked",
    "Live Discord OAuth, physical DOFUS coexistence and all monitor/DPI combinations remain environment-dependent",
  ],
};
await writeFile(
  "docs/REDESIGN_VALIDATION.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
