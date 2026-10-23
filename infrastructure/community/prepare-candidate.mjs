import { readFileSync, writeFileSync } from "node:fs";
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const gate = read(".github/community-release-gate.json"),
  version = gate.candidateVersion;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error("Invalid candidate version");
console.log(
  `Prepare candidate ${version}; no tag, GitHub release, update manifest or deployment is published.`,
);
if (!process.argv.includes("--apply")) process.exit(0);
if (!process.env.TAURI_SIGNING_PRIVATE_KEY || !process.env.UPDATER_PUBLIC_KEY)
  throw Error("Candidate signing keys must be provided by the trusted build environment");
for (const path of [
  "package.json",
  "apps/desktop/package.json",
  "apps/backend/package.json",
  "apps/discord-bot/package.json",
  "apps/desktop/src-tauri/tauri.conf.json",
]) {
  const data = read(path);
  data.version = version;
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}
const cargo = "apps/desktop/src-tauri/Cargo.toml",
  text = readFileSync(cargo, "utf8");
writeFileSync(
  cargo,
  text.replace(/^(version\s*=\s*)"[^"]+"/m, `$1"${version}"`),
);
const configPath = "apps/desktop/src-tauri/tauri.conf.json",
  config = read(configPath);
config.plugins.updater.pubkey = process.env.UPDATER_PUBLIC_KEY;
config.bundle.createUpdaterArtifacts = true;
writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
