import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { createPublicKey, createHash, verify } from "node:crypto";
import assert from "node:assert/strict";
const config = JSON.parse(
    readFileSync("apps/desktop/src-tauri/tauri.conf.json", "utf8"),
  ),
  folder = "apps/desktop/src-tauri/target/release/bundle/nsis";
const names = readdirSync(folder).filter((n) => n.endsWith(`_${config.version}_x64-setup.exe.sig`));
assert.equal(names.length, 1, "Exactly one signed installer expected");
const pub = Buffer.from(
  Buffer.from(config.plugins.updater.pubkey, "base64")
    .toString("utf8")
    .trim()
    .split(/\r?\n/)[1],
  "base64",
);
assert.equal(pub.length, 42);
const key = createPublicKey({
  key: Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    pub.subarray(10),
  ]),
  format: "der",
  type: "spki",
});
const lines = Buffer.from(
    readFileSync(`${folder}/${names[0]}`, "utf8").trim(),
    "base64",
  )
    .toString("utf8")
    .trim()
    .split(/\r?\n/),
  signature = Buffer.from(lines[1], "base64");
assert.equal(signature.length, 74);
assert.ok(
  signature.subarray(2, 10).equals(pub.subarray(2, 10)),
  "Updater key ID must match",
);
assert.ok(lines[2].startsWith("trusted comment: "));
const installer = readFileSync(`${folder}/${names[0].slice(0, -4)}`),
  algorithm = signature.subarray(0, 2).toString("ascii");
assert.ok(["ED", "Ed"].includes(algorithm));
const message = (bytes) =>
  algorithm === "ED" ? createHash("blake2b512").update(bytes).digest() : bytes;
assert.ok(
  verify(null, message(installer), key, signature.subarray(10)),
  "Installer signature rejected",
);
assert.ok(
  verify(
    null,
    Buffer.concat([
      signature.subarray(10),
      Buffer.from(lines[2].slice("trusted comment: ".length)),
    ]),
    key,
    Buffer.from(lines[3], "base64"),
  ),
  "Trusted signature rejected",
);
const tampered = Buffer.from(installer);
tampered[Math.floor(tampered.length / 2)] ^= 1;
assert.equal(
  verify(null, message(tampered), key, signature.subarray(10)),
  false,
  "Tampered installer must fail verification",
);
mkdirSync("test-results", { recursive: true });
writeFileSync(
  "test-results/community-candidate-signature.json",
  JSON.stringify(
    {
      version: config.version,
      file: names[0].slice(0, -4),
      sha256: createHash("sha256").update(installer).digest("hex"),
      verified: true,
      tamperRejected: true,
      publication: false,
    },
    null,
    2,
  ),
);
console.log(
  "Candidate updater signature and tamper rejection verified; nothing published.",
);
