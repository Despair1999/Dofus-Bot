import assert from "node:assert/strict";
import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve("apps/desktop/public");
const manifest = JSON.parse(await readFile(resolve(root, "game-assets/manifest.json"), "utf8"));
const world = JSON.parse(await readFile("packages/game-data/assets/world-data.json", "utf8"));
const dungeons = JSON.parse(await readFile("packages/game-data/assets/dungeon-data.json", "utf8")).versions["3.7.12.12"];
let bytes = 0;
const paths = new Set([
  ...Object.values(manifest.worlds).map(w => w.url),
  ...Object.values(manifest.monsters), ...Object.values(manifest.items), ...Object.values(manifest.spells),
]);
for (const url of paths) {
  assert.match(url, /^\/game-assets\/(worlds|monsters|items|spells)\/\d+\.webp$/);
  const file = resolve(root, "." + url);
  const data = await readFile(file);
  assert.equal(data.toString("ascii", 0, 4), "RIFF", url);
  assert.equal(data.toString("ascii", 8, 12), "WEBP", url);
  bytes += (await stat(file)).size;
}
for (const w of Object.values(manifest.worlds)) {
  assert.ok([w.x, w.y, w.width, w.height, w.aspect].every(Number.isFinite));
  assert.ok(w.width > 0 && w.height > 0 && w.aspect > 0);
}
const bossIds = [...new Set(dungeons.dungeons.flatMap(d => d.bossIds))];
assert.ok(bossIds.every(id => manifest.monsters[id]), "Every explicitly referenced boss must have an image");
assert.ok(world.worlds.every(w => manifest.worlds[w.id]), "Every selectable world must have artwork");
assert.ok(world.resources.every(r => manifest.items[r.iconId]), "All gatherable resources need local images");
assert.ok(dungeons.professionQuests.every(q => manifest.items[manifest.itemIcons[q.itemId]]), "All profession quest items need images");
const report = {
  version: JSON.parse(await readFile("package.json", "utf8")).version,
  testedAt: new Date().toISOString(),
  source: manifest.source, archiveSha256: manifest.archives,
  worlds: Object.keys(manifest.worlds).length,
  monsters: Object.keys(manifest.monsters).length,
  bosses: bossIds.length, resources: world.resources.length,
  professionQuestItems: dungeons.professionQuests.length,
  itemIcons: Object.keys(manifest.items).length,
  spellIcons: Object.keys(manifest.spells).length,
  uniqueFiles: paths.size, bytes,
  completeReferencedBossCoverage: true,
  completeGatherableAndProfessionQuestCoverage: true,
  imagePathsAndWebpHeadersVerified: true,
  missingDungeonIllustrations: dungeons.dungeons.filter(d => !manifest.monsters[d.illustrationMonsterId]).map(d => ({id:d.id, name:d.name, reason:"No explicit boss or matching base-dungeon reference"})),
  sourcedShortGuides: dungeons.editorial.filter(e => e.sources.length && e.strategy.length).length,
  fullyPatchVerifiedStrategies: dungeons.editorial.filter(e => e.status === "verified" && e.strategy.length).length,
};
await writeFile("docs/artwork-v5-test.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
