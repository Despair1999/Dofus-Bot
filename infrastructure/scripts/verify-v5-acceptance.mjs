import assert from "node:assert/strict";
import { readFile, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";

const version = JSON.parse(await readFile("package.json", "utf8")).version;
assert.equal(version, "0.5.0");
const unit = await readFile(".data/polish-unit-final.log", "utf8");
const counts = [...unit.matchAll(/# tests (\d+)/g)].map(m => +m[1]);
const failures = [...unit.matchAll(/# fail (\d+)/g)].map(m => +m[1]);
assert.equal(counts.length, 5);
assert.equal(failures.reduce((a,b) => a+b,0), 0);
const unitTests = counts.reduce((a,b) => a+b,0);
assert.equal(unitTests, 105);
const e2e = JSON.parse(await readFile("test-results/e2e.json", "utf8"));
assert.equal(e2e.stats.unexpected, 0);
assert.equal(e2e.stats.skipped, 0);
assert.equal(e2e.stats.expected, 37);
const typecheck = await readFile(".data/polish-typecheck-release.log", "utf8");
assert.equal((typecheck.match(/typecheck: Done/g) ?? []).length, 5);
const lint = await readFile(".data/polish-lint-release.log", "utf8");
assert.ok(lint.includes("eslint .") && !/\berror\b|\bwarning\b/i.test(lint));
const build = await readFile(".data/build-v0.5.0.log", "utf8");
assert.match(build, /Finished 1 bundle/);
await access(`artifacts/DOFUS-Companion-${version}-setup.exe`);
await access(`artifacts/Dofus-Companion-${version}-portable.zip`);
const signature = JSON.parse(await readFile("docs/release-v5-signature-test.json", "utf8"));
assert.equal(signature.releaseSignatureVerified, true);
assert.equal(signature.tamperedInstallerRejected, true);
assert.equal(signature.sha256, createHash("sha256").update(await readFile(`artifacts/DOFUS-Companion-${version}-setup.exe`)).digest("hex"));
const source = await readFile("apps/desktop/public/game-assets/manifest.json");
const production = await readFile("apps/desktop/dist/game-assets/manifest.json");
assert.ok(source.equals(production));
const artwork = JSON.parse(await readFile("docs/artwork-v5-test.json", "utf8"));
assert.equal(artwork.completeReferencedBossCoverage, true);
assert.equal(artwork.completeGatherableAndProfessionQuestCoverage, true);
const upgrade = JSON.parse(await readFile("docs/service-upgrade-v5-test.json", "utf8"));
assert.equal(upgrade.serviceUpgradePassed, true);
const native = JSON.parse(await readFile("docs/native-v5-test.json", "utf8"));
assert.ok(native.skipped || native.passed.length >= 7);
const packages = JSON.parse(await readFile("docs/packages-v5-test.json", "utf8"));
assert.equal(packages.exactExecutableAndServicePayloadVerified, true);
assert.equal(packages.setupContainsExactSignedInstaller, true);
const productionUi = JSON.parse(await readFile("docs/production-ui-v5-test.json", "utf8"));
assert.equal(productionUi.version, version);
assert.equal(productionUi.externalRequestsBlocked, true);
assert.ok(productionUi.passed.length >= 5 && !productionUi.errors.length && !productionUi.missingAssets.length);
const report = {
  version, testedAt: new Date().toISOString(), unitTests, browserTests:e2e.stats.expected,
  typecheckPassed:true, lintPassed:true, windowsInstallerBuilt:true,
  productionArtworkMatchesSource:true, installerSha256:signature.sha256,
  releasePackagesVerified:true,
  productionUiPassed:true,
  existingUpdaterKeyPreserved:signature.existingUpdaterKeyPreserved,
  serviceUpgradePassed:true, nativeUi: native.skipped ? {skipped:true, reason:native.reason} : {passed:native.passed},
  limitations:["20 sourced short guides; no fully patch-verified complete strategy catalog", "Arachnas catalog entry has no explicit boss illustration", "No automatic installation over the user's running app"],
};
await writeFile("docs/release-v5-acceptance.json", JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report));
