import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const source = readFileSync("packages/game-data/assets/builder-data.json"),
  data = JSON.parse(source);
const catalog = {
  sourceSha256: createHash("sha256").update(source).digest("hex"),
  versions: Object.fromEntries(
    Object.entries(data.versions).map(([version, v]) => [
      version,
      { items: v.items, sets: v.sets },
    ]),
  ),
};
writeFileSync(
  "packages/community/src/builder-catalog.json",
  JSON.stringify(catalog) + "\n",
);
console.log(
  "Shared builder catalog generated from existing versioned game data.",
);
