import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
const root = resolve("apps/desktop/public");
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const manifest = await json(resolve(root, "game-assets/manifest.json"));
const retained = await json(resolve(root, "game-assets/retained-index.json"));
const spellImages = { ...retained.spells, ...manifest.spells };
const previous = JSON.parse(
  execFileSync(
    "git",
    ["show", "a26fc26:apps/desktop/public/game-assets/manifest.json"],
    { maxBuffer: 8e6, encoding: "utf8" },
  ),
);
if (JSON.stringify(manifest) !== JSON.stringify(previous))
  throw Error("Existing asset references changed");
const builder = await json("packages/game-data/assets/builder-data.json");
const dungeons = await json("packages/game-data/assets/dungeon-data.json");
const world = await json("packages/game-data/assets/world-data.json");
const catalogFile =
  process.env.COMPANION_CATALOG_PATH ?? "artifacts/game-catalog-v0.6.0.sqlite";
const db = new DatabaseSync(resolve(catalogFile), { readOnly: true });
const catalogRows = db
  .prepare("SELECT id,icon_id,category,main_group,content FROM catalog_items")
  .all();
const catalogCategories = {};
const catalogMissing = [];
for (const row of catalogRows) {
  const category = (catalogCategories[row.category] ??= {
    total: 0,
    localImages: 0,
    originalImageReferences: 0,
  });
  category.total++;
  if (manifest.items[String(row.icon_id)]) category.localImages++;
  else
    catalogMissing.push({
      id: row.id,
      iconId: row.icon_id,
      category: row.category,
    });
  if (JSON.parse(row.content).imageUrl) category.originalImageReferences++;
}
const catalog = {
  file: catalogFile,
  total: catalogRows.length,
  categories: catalogCategories,
  missingLocalImages: catalogMissing,
  questRecords: db.prepare("SELECT COUNT(*) AS n FROM quests").get().n,
  recipeIngredientRows: db
    .prepare("SELECT COUNT(*) AS n FROM recipe_ingredients")
    .get().n,
  sourceRowsReadOnly: true,
};
db.close();
const files = new Map();
const versions = {};
function track(url, kind) {
  if (!url?.startsWith("/")) return;
  const entry = files.get(url) ?? new Set();
  entry.add(kind);
  files.set(url, entry);
}
for (const [kind, entries] of Object.entries({
  worlds: manifest.worlds,
  items: manifest.items,
  monsters: manifest.monsters,
  spells: manifest.spells,
}))
  for (const v of Object.values(entries))
    track(typeof v === "string" ? v : v.url, kind);
for (const [version, data] of Object.entries(builder.versions)) {
  const missing = {
    items: [],
    classes: [],
    spells: [],
    monsters: [],
    dungeons: [],
  };
  for (const c of data.classes) {
    track(c.icon, "classes");
    track(c.portrait, "classes");
  }
  for (const s of data.spells) track(s.icon, "classSpells");
  for (const i of data.items) {
    const icon = Number(i.imageUrl?.match(/\/item\/(\d+)-/)?.[1]);
    if (!manifest.items[icon])
      missing.items.push({ id: i.id, iconId: icon || null });
  }
  const d = dungeons.versions[version];
  for (const m of d.monsters) {
    if (!manifest.monsters[m.id]) missing.monsters.push(m.id);
    for (const s of m.spells)
      if (s.iconId && !spellImages[s.iconId])
        missing.spells.push({
          monsterId: m.id,
          spellId: s.id,
          iconId: s.iconId,
        });
  }
  for (const entry of d.dungeons)
    if (!manifest.monsters[entry.illustrationMonsterId ?? entry.bossIds[0]])
      missing.dungeons.push({
        id: entry.id,
        reason: "No explicit boss or source-linked base variant",
      });
  versions[version] = {
    items: data.items.length,
    sets: data.sets.length,
    classes: data.classes.length,
    classSpells: data.spells.length,
    monsters: d.monsters.length,
    dungeons: d.dungeons.length,
    missing,
    artworkVersion: manifest.version,
    historicalArtworkNotice:
      version !== manifest.version.replace(/^v6\.0_/, ""),
  };
}
const broken = [],
  hashes = new Map();
let bytes = 0;
for (const [url, kinds] of files) {
  try {
    const path = resolve(root, "." + url),
      buffer = await readFile(path);
    const header = buffer.subarray(0, 12);
    if (
      !(
        header.toString("ascii", 0, 4) === "RIFF" &&
        header.toString("ascii", 8, 12) === "WEBP"
      ) &&
      !(buffer[0] === 137 && buffer.toString("ascii", 1, 4) === "PNG")
    )
      throw Error("Invalid image header");
    const hash = createHash("sha256").update(buffer).digest("hex");
    const list = hashes.get(hash) ?? [];
    list.push(url);
    hashes.set(hash, list);
    bytes += (await stat(path)).size;
  } catch (e) {
    broken.push({ url, kinds: [...kinds], reason: String(e.message) });
  }
}
const report = {
  testedAt: new Date().toISOString(),
  baseline: "a26fc26",
  existingManifestUnchanged: true,
  newImagesDownloaded: 0,
  source: manifest.source,
  archives: manifest.archives,
  rights: {
    status: "unresolved for redistribution",
    basis:
      "Existing local assets retained as requested; technical source references and archive checksums do not establish copyright permission. No additional game image files downloaded by this redesign; existing assets and references retained.",
  },
  files: files.size,
  bytes,
  broken,
  duplicateContent: [...hashes.values()].filter((v) => v.length > 1),
  versions,
  catalog,
  worlds: world.worlds.length,
  resourceReferences: world.resources.length,
  resourceImagesMissing: world.resources
    .filter((r) => !manifest.items[r.iconId])
    .map((r) => r.id),
  mapHints: world.points.length,
  identityRules: [
    "item.iconId",
    "monster.id -> source gfxId",
    "spell.iconId",
    "class.id",
    "WorldMapData.id plus original calibration",
    "HintData.id/mapId/worldMapId; exact category 9 + Zaap label",
  ],
  knownGaps: [
    "No explicit boss illustration for dungeon 96",
    "Historical values are isolated; artwork uses the retained current image pack where historically shared",
    "Exact resource spawns and complete patch-verified strategies remain unavailable",
    "An image header/ID audit does not validate visual semantics or ownership of every asset",
  ],
};
await writeFile(
  "docs/REDESIGN_ASSET_AUDIT.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    files: files.size,
    bytes,
    broken: broken.length,
    duplicateGroups: report.duplicateContent.length,
    versions: Object.fromEntries(
      Object.entries(versions).map(([v, d]) => [
        v,
        {
          ...d,
          missing: Object.fromEntries(
            Object.entries(d.missing).map(([k, a]) => [k, a.length]),
          ),
        },
      ]),
    ),
  }),
);
if (broken.length) process.exitCode = 1;
