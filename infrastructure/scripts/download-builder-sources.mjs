import { readFile, writeFile, stat } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
const sources = JSON.parse(
  await readFile("design/builder-sources.json", "utf8"),
);
const downloads = [
  ["v6.0_3.7.12.12", "dofus.sqlite", ".data/upstream.sqlite"],
  ["v6.0_3.6.12.16", "dofus.sqlite", ".data/upstream-3.6.sqlite"],
  ["v6.0_3.7.12.12", "images-spell.zip", ".data/images-spell.zip"],
];
const historical = JSON.parse(
  await readFile("design/builder-raw-assets.json", "utf8"),
);
for (const a of historical)
  downloads.push(["v6.0_3.6.12.16", a.name, ".data/3.6-" + a.name]);
for (const [tag, name, path] of downloads) {
  const asset =
    sources.find((s) => s.tag === tag).assets.find((a) => a.name === name) ??
    historical.find((a) => a.name === name);
  let exists = false;
  try {
    exists = (await stat(path)).size === asset.size;
  } catch {
    /* first download */
  }
  if (!exists) {
    const response = await fetch(asset.url);
    if (!response.ok) throw Error(`Source HTTP ${response.status}`);
    await pipeline(response.body, createWriteStream(path));
  }
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  if (hash.digest("hex") !== asset.sha256)
    throw Error(`Source digest mismatch: ${path}`);
  console.log(`Verified ${tag} ${name}`);
}
await writeFile(
  "design/builder-sources.json",
  JSON.stringify(sources, null, 2),
);
