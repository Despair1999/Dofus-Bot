import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { githubRequest, repository } from "./github-client.mjs";
const base = `/repos/${repository}/actions`;
const publicKey = await githubRequest("GET", base + "/secrets/public-key");
const encrypted = spawnSync(
  "python",
  [
    "-c",
    'import sys,json,base64; from pathlib import Path; from nacl.public import PublicKey,SealedBox; p=json.load(sys.stdin); print(base64.b64encode(SealedBox(PublicKey(base64.b64decode(p["publicKey"]))).encrypt(Path(p["privateKeyPath"]).read_bytes().strip())).decode())',
  ],
  {
    input: JSON.stringify({
      publicKey: publicKey.key,
      privateKeyPath: resolve("apps/desktop/.data/updater.key"),
    }),
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, PYTHONPATH: resolve(".data/python-tools") },
  },
);
if (encrypted.status !== 0 || !encrypted.stdout.trim())
  throw new Error(
    "Release secret encryption failed; no plaintext key was submitted.",
  );
await githubRequest("PUT", base + "/secrets/TAURI_SIGNING_PRIVATE_KEY", {
  key_id: publicKey.key_id,
  encrypted_value: encrypted.stdout.trim(),
});
const config = JSON.parse(
  await readFile("apps/desktop/src-tauri/tauri.conf.json", "utf8"),
);
const name = "TAURI_UPDATER_PUBLIC_KEY",
  value = config.plugins.updater.pubkey;
const variables = await githubRequest("GET", base + "/variables");
if (variables.variables.some((v) => v.name === name))
  await githubRequest("PATCH", base + "/variables/" + name, { name, value });
else await githubRequest("POST", base + "/variables", { name, value });
console.log(
  "GitHub Actions update signing secret and matching public variable configured; private key never logged.",
);
