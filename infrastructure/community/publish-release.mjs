import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  githubRequest,
  githubUpload,
  repository,
} from "../scripts/github-client.mjs";
const read = (p) => JSON.parse(readFileSync(p, "utf8")),
  sha = (b) => createHash("sha256").update(b).digest("hex");
const version = read("package.json").version,
  tag = `v${version}`,
  base = `/repos/${repository}`;
const installer = `DOFUS-Companion-${version}-setup.exe`;
const installedKey = JSON.parse(
  execFileSync(
    "git",
    [
      "show",
      "cb91d90481b01b5f114615c9d86e364a3a6bd3a7:apps/desktop/src-tauri/tauri.conf.json",
    ],
    { encoding: "utf8", windowsHide: true },
  ),
).plugins.updater.pubkey;
assert.equal(
  read("apps/desktop/src-tauri/tauri.conf.json").plugins.updater.pubkey,
  installedKey,
  "The updater trust key must remain identical to the released 0.9.2 baseline.",
);
assert.match(version, /^\d+\.\d+\.\d+$/);
for (const p of [
  "apps/desktop/package.json",
  "apps/backend/package.json",
  "apps/desktop/src-tauri/tauri.conf.json",
])
  assert.equal(read(p).version, version, `Version mismatch: ${p}`);
const signatureReport = read("test-results/community-candidate-signature.json"),
  native = read("test-results/community-native-acceptance.json"),
  upgrade = read("test-results/community-service-upgrade.json"),
  live = read(".data/community-production-acceptance.json"),
  regression = read("test-results/community-regression-summary.json");
assert.equal(signatureReport.version, version);
assert.ok(signatureReport.verified && signatureReport.tamperRejected);
assert.equal(
  sha(readFileSync(`artifacts/${installer}`)),
  signatureReport.sha256,
);
assert.ok(
  native.passed &&
    native.version === version &&
    native.installerSha256 === signatureReport.sha256,
);
assert.ok(
  upgrade.serviceUpgradePassed &&
    upgrade.version === version &&
    upgrade.existingCharacterPreserved &&
    upgrade.existingQuestProgressPreserved &&
    upgrade.existingBuildAndCalculationPreserved,
);
assert.ok(live.passed && live.cleanupComplete);
assert.ok(read("test-results/community-image-rule-production.json").passed);
assert.ok(
  regression.passed && regression.total === 54 && regression.failed === 0,
);
const assets = [
  installer,
  installer + ".sig",
  `Dofus-Companion-${version}-setup.zip`,
  `Dofus-Companion-${version}-portable.zip`,
  `game-catalog-v${version}.sqlite`,
];
for (const name of assets)
  assert.ok(
    readFileSync(`artifacts/${name}`).length > 0,
    `Missing release asset ${name}`,
  );
const signature = readFileSync(`artifacts/${installer}.sig`, "utf8").trim();
assert.ok(
  Buffer.from(signature, "base64")
    .toString("utf8")
    .startsWith("untrusted comment:"),
);
const catalog = read("design/catalog-bundle.json");
assert.equal(
  sha(readFileSync(`artifacts/game-catalog-v${version}.sqlite`)),
  catalog.sha256,
);
const notes = readFileSync(`docs/RELEASE_v${version}.md`, "utf8");
const priorLatest =
  process.argv.includes("--resume") && existsSync("artifacts/latest.json")
    ? read("artifacts/latest.json")
    : null;
if (priorLatest) assert.equal(priorLatest.version, version);
const latest = {
  version,
  notes,
  pub_date: priorLatest?.pub_date ?? new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `https://github.com/${repository}/releases/download/${tag}/${installer}`,
    },
  },
};
writeFileSync("artifacts/latest.json", JSON.stringify(latest, null, 2) + "\n");
assets.push("latest.json");
const validation = {
  version,
  installerSha256: signatureReport.sha256,
  updaterKeyPreserved: true,
  signatureVerified: true,
  tamperRejected: true,
  nativeChecks: native.checks,
  liveFirebaseAcceptance: true,
  liveFixturesRemoved: true,
  upgradeFrom: upgrade.fromVersion,
  existingDataPreserved: true,
  regression: { total: 54, failed: 0 },
  botLive: false,
};
writeFileSync(
  "artifacts/release-validation.json",
  JSON.stringify(validation, null, 2) + "\n",
);
assets.push("release-validation.json");
const hashes = Object.fromEntries(
  assets.map((name) => [name, sha(readFileSync(`artifacts/${name}`))]),
);
writeFileSync(
  "artifacts/SHA256SUMS.txt",
  Object.entries(hashes)
    .map(([n, h]) => `${h}  ${n}`)
    .join("\n") + "\n",
);
assets.push("SHA256SUMS.txt");
hashes["SHA256SUMS.txt"] = sha(readFileSync("artifacts/SHA256SUMS.txt"));
if (!process.argv.includes("--apply")) {
  console.log(
    JSON.stringify({ dryRun: true, tag, assets, validated: true }, null, 2),
  );
  process.exit(0);
}
execFileSync(
  process.execPath,
  ["infrastructure/community/publication-gate.mjs"],
  { stdio: "inherit", windowsHide: true },
);
const pullRequest = Number(
  process.argv.find((arg) => arg.startsWith("--pr="))?.slice(5),
);
assert.ok(
  Number.isInteger(pullRequest) && pullRequest > 0,
  "Pass the reviewed source PR explicitly with --pr=<number>.",
);
const pr = await githubRequest("GET", base + "/pulls/" + pullRequest);
assert.equal(
  pr.merged,
  true,
  "The source PR must be merged before publication.",
);
const main = await githubRequest("GET", base + "/commits/main");
assert.equal(
  pr.merge_commit_sha,
  main.sha,
  "Release only the reviewed merge commit; main has changed.",
);
const remotePackage = await githubRequest(
  "GET",
  base + "/contents/package.json?ref=" + main.sha,
);
assert.equal(
  JSON.parse(Buffer.from(remotePackage.content, "base64").toString("utf8"))
    .version,
  version,
);
const checked = await githubRequest(
  "GET",
  base + "/commits/" + pr.head.sha + "/check-runs?per_page=100",
);
// Check actual conclusions, never infer green from a successful local commit.
assert.ok(
  checked.check_runs.length > 0,
  "No CI evidence for the merged PR head.",
);
assert.ok(
  checked.check_runs.every(
    (c) =>
      c.status === "completed" &&
      ["success", "skipped", "neutral"].includes(c.conclusion),
  ),
  "PR CI is not fully successful.",
);
const reportPath = `.data/community-release-publication-${version}.json`;
const previous = existsSync(reportPath) ? read(reportPath) : null;
const releases = await githubRequest("GET", base + "/releases?per_page=100");
let release = releases.find((r) => r.tag_name === tag);
if (release) {
  assert.ok(
    process.argv.includes("--resume") &&
      previous?.releaseId === release.id &&
      release.draft,
    "Never modify an existing or published release.",
  );
  assert.equal(previous.targetCommit, main.sha);
} else {
  release = await githubRequest("POST", base + "/releases", {
    tag_name: tag,
    target_commitish: main.sha,
    name: `DOFUS Companion ${tag}`,
    body: notes,
    draft: true,
    prerelease: false,
  });
}
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      version,
      releaseId: release.id,
      targetCommit: main.sha,
      published: false,
      hashes,
    },
    null,
    2,
  ),
);
for (const name of assets) {
  const existing = release.assets?.find((a) => a.name === name);
  if (existing) {
    assert.equal(
      existing.digest,
      `sha256:${hashes[name]}`,
      `Refusing to replace ${name}`,
    );
    continue;
  }
  const bytes = readFileSync(`artifacts/${name}`),
    uploaded = await githubUpload(
      release.id,
      name,
      bytes,
      name.endsWith(".json") ? "application/json" : "application/octet-stream",
    );
  assert.equal(uploaded.size, bytes.length);
  assert.equal(
    uploaded.digest,
    `sha256:${hashes[name]}`,
    `Uploaded digest mismatch: ${name}`,
  );
  console.log(`Verified release upload: ${name}`);
}
const draft = await githubRequest("GET", base + "/releases/" + release.id);
assert.ok(draft.draft);
for (const name of assets) {
  const a = draft.assets.find((a) => a.name === name);
  assert.ok(a);
  assert.equal(a.digest, `sha256:${hashes[name]}`);
}
const published = await githubRequest(
  "PATCH",
  base + "/releases/" + release.id,
  { draft: false, make_latest: "true" },
);
assert.equal(published.draft, false);
assert.equal(published.tag_name, tag);
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      version,
      releaseId: release.id,
      targetCommit: main.sha,
      published: true,
      url: published.html_url,
      hashes,
      checkedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(`Published verified new release: ${published.html_url}`);
