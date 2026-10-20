import { DatabaseSync } from "node:sqlite";
import { writeFile } from "node:fs/promises";
const db = new DatabaseSync(".data/game-data.sqlite", { readOnly: true });
const results = [];
for (const category of [
  "equipment",
  "resources",
  "consumables",
  "quest",
  "cosmetics",
]) {
  const rows = db
    .prepare(
      "SELECT content FROM catalog_items WHERE category=? AND icon_id>0 ORDER BY id LIMIT 4",
    )
    .all(category);
  for (const row of rows) {
    const item = JSON.parse(String(row.content));
    try {
      const response = await fetch(item.imageUrl, {
        signal: AbortSignal.timeout(15000),
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      const png =
        bytes.length > 8 &&
        [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
      results.push({
        id: item.id,
        name: item.name,
        category,
        iconId: item.iconId,
        url: item.imageUrl,
        status: response.status,
        png,
        bytes: bytes.length,
      });
    } catch (error) {
      results.push({ id: item.id, category, error: String(error) });
    }
  }
}
db.close();
await writeFile(
  "design/image-audit-v2.json",
  JSON.stringify(
    {
      testedAt: new Date().toISOString(),
      scope:
        "4 original-ID image samples per category; not a full HTTP availability audit",
      results,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    samples: results.length,
    validPng: results.filter((r) => "png" in r && r.png).length,
  }),
);
