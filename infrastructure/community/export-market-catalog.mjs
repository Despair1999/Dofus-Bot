import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const cache = ".data/community-item-tradability.json";
if (process.argv.includes("--refresh") || !existsSync(cache)) {
  const fetchPage = async (skip) => {
    const url = new URL("https://api.dofusdb.fr/items");
    url.searchParams.set("$limit", "50");
    url.searchParams.set("$skip", String(skip));
    url.searchParams.set("$sort[id]", "1");
    for (const key of [
      "id",
      "m_flags",
      "typeId",
      "level",
      "exchangeable",
      "isSaleable",
    ])
      url.searchParams.append("$select[]", key);
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (response.status === 429 || response.status >= 500) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      assert.ok(response.ok, `DOFUSDB ${response.status}`);
      return response.json();
    }
    throw Error(`DOFUSDB page ${skip} unavailable`);
  };
  const first = await fetchPage(0),
    pages = [first];
  assert.ok(first.limit === 50 && first.total > 10000);
  let next = 50;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (next < first.total) {
        const skip = next;
        next += 50;
        const page = await fetchPage(skip);
        assert.equal(page.total, first.total);
        pages.push(page);
        await new Promise((r) => setTimeout(r, 100));
      }
    }),
  );
  const items = pages
    .flatMap((p) => p.data)
    .map(({ id, m_flags, typeId, level, exchangeable, isSaleable }) => ({
      id,
      m_flags,
      typeId,
      level,
      exchangeable,
      isSaleable,
    }))
    .sort((a, b) => a.id - b.id);
  assert.equal(items.length, first.total);
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  writeFileSync(
    cache,
    JSON.stringify({
      source: "https://api.dofusdb.fr/items",
      checkedAt: new Date().toISOString(),
      items,
    }),
  );
}
const verified = JSON.parse(readFileSync(cache, "utf8")),
  flags = new Map(verified.items.map((i) => [i.id, i]));
const upstream = new DatabaseSync(".data/upstream.sqlite", { readOnly: true }),
  catalog = new DatabaseSync(
    "apps/desktop/src-tauri/resources/catalog-seed.sqlite",
    { readOnly: true },
  );
const originals = new Map(
  [
    ...upstream.prepare("SELECT id,m_flags,typeId,level FROM ItemData").all(),
    ...upstream.prepare("SELECT id,m_flags,typeId,level FROM WeaponData").all(),
  ].map((i) => [i.id, i]),
);
const result = [],
  counts = {},
  excluded = { nonExchangeable: 0, unverified: 0 };
for (const row of catalog
  .prepare("SELECT content FROM catalog_items ORDER BY id")
  .all()) {
  const item = JSON.parse(row.content),
    source = originals.get(item.id),
    verified = flags.get(item.id);
  if (
    !verified ||
    !source ||
    source.m_flags !== verified.m_flags ||
    source.typeId !== verified.typeId ||
    source.level !== verified.level
  ) {
    excluded.unverified++;
    continue;
  }
  if (verified.exchangeable !== true) {
    excluded.nonExchangeable++;
    continue;
  }
  result.push({
    id: item.id,
    name: item.name,
    nameFr: item.nameFr,
    nameEn: item.nameEn,
    iconUrl: item.imageUrl || "",
    level: item.level,
    category: item.category,
    type: item.type,
    typeId: item.typeId,
    tradeable: true,
  });
  counts[item.category] = (counts[item.category] || 0) + 1;
}
assert.ok(result.length > 10000);
assert.equal(
  excluded.unverified,
  0,
  "Every supported source item needs verified trade metadata",
);
const output = JSON.stringify(result) + "\n";
for (const path of [
  "apps/website/public/community-items.json",
  "apps/desktop/public/community-items.json",
])
  writeFileSync(path, output);
writeFileSync(
  "design/community-market-catalog.json",
  JSON.stringify(
    {
      checkedAt: verified.checkedAt,
      source: verified.source,
      sourceItems: originals.size,
      verifiedItems: verified.items.length,
      items: result.length,
      counts,
      excluded,
      sha256: createHash("sha256").update(output).digest("hex"),
      scope:
        "Template exchangeability; individual account bindings must be checked by the listing author.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({ items: result.length, counts, excluded }, null, 2),
);
