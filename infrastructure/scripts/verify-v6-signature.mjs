import { readFile, writeFile } from "node:fs/promises";
import { createHash, createPublicKey, verify } from "node:crypto";
import assert from "node:assert/strict";

const version = JSON.parse(await readFile("package.json", "utf8")).version;
const config = JSON.parse(
  await readFile("apps/desktop/src-tauri/tauri.conf.json", "utf8"),
);
const publicText = Buffer.from(config.plugins.updater.pubkey, "base64")
  .toString("utf8")
  .trim()
  .split(/\r?\n/);
const publicBytes = Buffer.from(publicText[1], "base64");
assert.equal(publicBytes.length, 42, "Expected Minisign Ed25519 public key");
const key = createPublicKey({
  key: Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    publicBytes.subarray(10),
  ]),
  format: "der",
  type: "spki",
});
const installer = await readFile(
  `artifacts/DOFUS-Companion-${version}-setup.exe`,
);
const encoded = (
  await readFile(`artifacts/DOFUS-Companion-${version}-setup.exe.sig`, "utf8")
).trim();
const lines = Buffer.from(encoded, "base64")
  .toString("utf8")
  .trim()
  .split(/\r?\n/);
assert.ok(lines[0].startsWith("untrusted comment:"));
assert.ok(lines[2].startsWith("trusted comment: "));
const signature = Buffer.from(lines[1], "base64");
assert.equal(signature.length, 74);
assert.ok(
  signature.subarray(2, 10).equals(publicBytes.subarray(2, 10)),
  "Signature must use installed updater key ID",
);
const mode = signature.subarray(0, 2).toString("ascii");
assert.ok(["ED", "Ed"].includes(mode), "Unsupported signature algorithm");
const message = (bytes) =>
  mode === "ED" ? createHash("blake2b512").update(bytes).digest() : bytes;
assert.equal(
  verify(null, message(installer), key, signature.subarray(10)),
  true,
  "Installer signature rejected",
);
const trusted = Buffer.concat([
  signature.subarray(10),
  Buffer.from(lines[2].slice("trusted comment: ".length)),
]);
assert.equal(
  verify(null, trusted, key, Buffer.from(lines[3], "base64")),
  true,
  "Trusted comment signature rejected",
);
const tampered = Buffer.from(installer);
tampered[Math.floor(tampered.length / 2)] ^= 1;
assert.equal(
  verify(null, message(tampered), key, signature.subarray(10)),
  false,
  "Tampered installer must be rejected",
);
const report = {
  testedAt: new Date().toISOString(),
  version,
  algorithm: mode,
  releaseSignatureVerified: true,
  trustedCommentVerified: true,
  tamperedInstallerRejected: true,
  existingUpdaterKeyPreserved: true,
  installerBytes: installer.length,
  sha256: createHash("sha256").update(installer).digest("hex"),
  scope:
    "Independent Node Ed25519/Minisign verification; does not claim a downloaded installed-updater transition",
};
await writeFile(
  "docs/release-v6-signature-test.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
