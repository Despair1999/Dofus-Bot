import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { githubRequest, githubUpload, repository } from "./github-client.mjs";

const version = JSON.parse(await readFile("package.json", "utf8")).version;
const tag = `v${version}`,
  base = `/repos/${repository}`;
const installer = `DOFUS-Companion-${version}-setup.exe`;
const assets = [
  installer,
  installer + ".sig",
  `Dofus-Companion-${version}-setup.zip`,
  `Dofus-Companion-${version}-portable.zip`,
  `game-catalog-v${version}.sqlite`,
];
const notes = ["0.4.0", "0.5.0", "0.6.0"].includes(version)
  ? await readFile(`docs/RELEASE_v${version}.md`, "utf8")
  : "Neuer Ausrüstungs-Builder mit echten Items, gemeinsamen Attributfiltern, Setboni, individuellen Rolls und Exomagie, Charakter-Sets, Vergleichen und Hintergrund-Optimierer. Klassenbilder aus der bereitgestellten ZIP. Getrennte Zauberkataloge für DOFUS 3.6.12.16 und 3.7.12.12 mit lokalen Icons. Schadensvorschau für unterstützte direkte Effekte; komplexe Mechaniken werden ausdrücklich markiert. Offline-Entwürfe und Synchronisierung, JSON-Austausch und private Discord-Builder-Funktionen. Bestehende Daten und der signierte Updatekanal bleiben erhalten. Details und Grenzen: BUILDER_TEST_REPORT.md und DAMAGE_ENGINE_SPEC.md.";
const signature = (
  await readFile(resolve("artifacts", installer + ".sig"), "utf8")
).trim();
if (
  !Buffer.from(signature, "base64")
    .toString("utf8")
    .startsWith("untrusted comment:")
)
  throw new Error("Missing Minisign signature");
const nativeReport = JSON.parse(
  await readFile(
    version === "0.6.0"
      ? "docs/native-v6-test.json"
      : version === "0.5.0"
        ? "docs/native-v5-test.json"
        : version === "0.4.0"
          ? "docs/native-v4-test.json"
          : "docs/native-v2-test.json",
    "utf8",
  ),
);
if (
  !["0.5.0", "0.6.0"].includes(version) &&
  nativeReport.passed.length < (version === "0.4.0" ? 4 : 7)
)
  throw new Error("Native release validation is incomplete");
if (version === "0.6.0") {
  const check = JSON.parse(
    await readFile("docs/REDESIGN_VALIDATION.json", "utf8"),
  );
  const binary = await readFile(resolve("artifacts", installer));
  if (
    check.version !== version ||
    check.unitTests !== 108 ||
    check.browserTests !== 44 ||
    !check.typecheckPassed ||
    !check.lintPassed ||
    !check.windowsInstallerBuilt ||
    !check.releasePackagesVerified ||
    !check.productionUiPassed ||
    !check.existingUpdaterKeyPreserved ||
    !check.serviceUpgradePassed ||
    !check.assetAuditPassed ||
    !nativeReport.isolatedProfile ||
    nativeReport.passed.length < 7 ||
    check.installerSha256 !== createHash("sha256").update(binary).digest("hex")
  )
    throw Error("Redesign release acceptance is incomplete");
}
if (version === "0.5.0") {
  const acceptance = JSON.parse(
    await readFile("docs/release-v5-acceptance.json", "utf8"),
  );
  const signatureCheck = JSON.parse(
    await readFile("docs/release-v5-signature-test.json", "utf8"),
  );
  const upgrade = JSON.parse(
    await readFile("docs/service-upgrade-v5-test.json", "utf8"),
  );
  if (
    acceptance.version !== version ||
    nativeReport.version !== version ||
    acceptance.unitTests < 105 ||
    acceptance.browserTests < 37 ||
    !acceptance.typecheckPassed ||
    !acceptance.lintPassed ||
    !acceptance.productionArtworkMatchesSource ||
    !acceptance.windowsInstallerBuilt ||
    !acceptance.releasePackagesVerified ||
    !acceptance.productionUiPassed ||
    !signatureCheck.releaseSignatureVerified ||
    !signatureCheck.tamperedInstallerRejected ||
    signatureCheck.version !== version ||
    upgrade.version !== version ||
    !upgrade.serviceUpgradePassed ||
    (!nativeReport.skipped && nativeReport.passed.length < 7)
  )
    throw Error("Appearance/atlas release acceptance is incomplete");
}
if (version === "0.4.0") {
  const [signatureCheck, upgrade, guard, lifecycle] = await Promise.all(
    [
      "release-v4-signature-test",
      "service-upgrade-v4-test",
      "install-guard-v4-test",
      "native-v4-lifecycle",
    ].map(async (name) =>
      JSON.parse(await readFile(`docs/${name}.json`, "utf8")),
    ),
  );
  if (
    nativeReport.version !== version ||
    signatureCheck.version !== version ||
    upgrade.version !== version ||
    !signatureCheck.releaseSignatureVerified ||
    !signatureCheck.tamperedInstallerRejected ||
    !upgrade.serviceUpgradePassed ||
    !guard.legacyServiceReleased ||
    !guard.nodeExecutableReplaced ||
    !lifecycle.backendStopped ||
    lifecycle.workerProcessesRemaining !== 0
  )
    throw Error("World/translator release acceptance is incomplete");
}
if (version === "0.2.3") {
  const regression = JSON.parse(
    await readFile("docs/update-v0.2.3-test.json", "utf8"),
  );
  if (
    regression.version !== version ||
    !regression.nativeRegression.passed ||
    !regression.releaseSignatureVerified ||
    !regression.tamperedInstallerRejected
  )
    throw new Error(
      "Offline-start regression or signature validation is incomplete",
    );
}
if (version === "0.3.0") {
  const report = JSON.parse(
    await readFile("docs/builder-release-test.json", "utf8"),
  );
  if (
    report.version !== version ||
    !report.serviceUpgradePassed ||
    !report.releaseSignatureVerified ||
    !report.tamperedInstallerRejected ||
    nativeReport.version !== version
  )
    throw Error("Builder release acceptance is incomplete");
}
const source = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  windowsHide: true,
}).trim();
let release;
try {
  release = await githubRequest("GET", `${base}/releases/tags/${tag}`);
} catch (error) {
  if (!String(error).includes("404")) throw error;
}
if (!release) {
  try {
    const saved = JSON.parse(await readFile(".data/release-v2.json", "utf8"));
    if (saved.tag === tag)
      release = await githubRequest(
        "GET",
        `${base}/releases/${Number(saved.id)}`,
      );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
if (process.argv.includes("--publish")) {
  if (!release) throw new Error("No prepared release");
  for (const name of [...assets, "latest.json", "SHA256SUMS.txt"]) {
    const asset = release.assets.find((a) => a.name === name);
    if (!asset) throw new Error("Missing release asset: " + name);
    const bytes = await readFile(resolve("artifacts", name));
    const digest = "sha256:" + createHash("sha256").update(bytes).digest("hex");
    if (asset.size !== bytes.length || asset.digest !== digest)
      throw new Error("Uploaded asset digest mismatch: " + name);
  }
  const published = release.draft
    ? await githubRequest("PATCH", `${base}/releases/${release.id}`, {
        draft: false,
        make_latest: "true",
      })
    : release;
  console.log(
    JSON.stringify({
      published: !published.draft,
      url: published.html_url,
      tag,
    }),
  );
} else {
  if (release && !release.draft)
    throw new Error("Published release assets are immutable in this script");
  const latest = {
    version,
    notes,
    pub_date: new Date().toISOString(),
    platforms: {
      "windows-x86_64": {
        signature,
        url: `https://github.com/${repository}/releases/download/${tag}/${installer}`,
      },
    },
  };
  await writeFile("artifacts/latest.json", JSON.stringify(latest, null, 2));
  const hashes = [];
  for (const name of [...assets, "latest.json"]) {
    const bytes = await readFile(resolve("artifacts", name));
    hashes.push({
      name,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  await writeFile(
    "artifacts/SHA256SUMS.txt",
    hashes.map((a) => `${a.sha256}  ${a.name}`).join("\n") + "\n",
  );
  await writeFile(
    `docs/BUILD_v${version}_SHA256.json`,
    JSON.stringify({ version, builtFrom: source, files: hashes }, null, 2),
  );
  if (!release)
    release = await githubRequest("POST", `${base}/releases`, {
      tag_name: tag,
      target_commitish: source,
      name: `DOFUS Companion ${tag}`,
      draft: true,
      prerelease: false,
      body:
        notes +
        "\n\nWindows: Setup-ZIP entpacken und Setup starten oder das vollständige Portable-ZIP entpacken. Vorhandene Version: Einstellungen → Nach Updates suchen. Updatepaket mit demselben Schlüssel wie v0.1 signiert. Kein Authenticode-Zertifikat. Physische Mehrmonitor-/DPI-Tests und Discord-Liveanmeldung stehen aus.",
    });
  for (const name of [...assets, "latest.json", "SHA256SUMS.txt"]) {
    const old = release.assets.find((a) => a.name === name);
    if (old) await githubRequest("DELETE", `${base}/releases/assets/${old.id}`);
    const bytes = await readFile(resolve("artifacts", name));
    const uploaded = await githubUpload(
      release.id,
      basename(name),
      bytes,
      name.endsWith(".json") ? "application/json" : "application/octet-stream",
    );
    if (
      uploaded.size !== bytes.length ||
      uploaded.digest !==
        "sha256:" + createHash("sha256").update(bytes).digest("hex")
    )
      throw new Error("Upload integrity mismatch");
    console.log(`Verified upload: ${name} (${bytes.length} bytes)`);
  }
  await writeFile(
    ".data/release-v2.json",
    JSON.stringify(
      { id: release.id, tag, url: release.html_url, source },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ draft: true, url: release.html_url }));
}
