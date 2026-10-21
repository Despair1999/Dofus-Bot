import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const sources = JSON.parse(await readFile("packages/game-data/assets/image-sources.json", "utf8"));
await mkdir(".data", { recursive: true });
await Promise.all(sources.assets.map(async asset => {
  const path = resolve(".data", asset.name);
  let bytes;
  try { bytes = await readFile(path); } catch (e) { if (e.code !== "ENOENT") throw e; }
  const valid = data => data && data.length === asset.size && "sha256:" + createHash("sha256").update(data).digest("hex") === asset.digest;
  if (!valid(bytes)) {
    const response = await fetch(asset.browser_download_url, { signal: AbortSignal.timeout(300000) });
    if (!response.ok) throw Error(`Archive ${asset.name}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (!valid(bytes)) throw Error(`Archive checksum rejected: ${asset.name}`);
    await writeFile(path, bytes);
  }
  console.log(`Verified ${asset.name} (${bytes.length} bytes)`);
}));
