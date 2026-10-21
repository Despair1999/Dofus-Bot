import { readFile, writeFile } from "node:fs/promises";
// Store factual link mappings and aggregate counts only, never guide text/images.
const dataset = JSON.parse(
  await readFile("packages/game-data/assets/dungeon-data.json", "utf8"),
);
const current = dataset.versions["3.7.12.12"];
const norm = (s) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const strip = (s) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .trim();
const sources = [],
  links = [];
for (const url of [
  "https://www.dofuspourlesnoobs.com/donjons.html",
  "https://dofus-portals.fr/donjons/",
]) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const html = await response.text();
    const bodies = [...html.matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gi)];
    const rawRows = bodies.flatMap((b) =>
      [...b[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]),
    );
    const rows = rawRows.filter((row) =>
      url.includes("pourlesnoobs")
        ? /\btd>\s*<img[^>]+alt=/i.test(row)
        : /href=["'][^"']*\/donjons\//i.test(row),
    );
    let matched = 0;
    for (const row of rows) {
      const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
        (m) => m[1],
      );
      const first = row.match(
        /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
      );
      if (!first) continue;
      const name = strip(first[2]),
        boss = strip(cells[url.includes("pourlesnoobs") ? 2 : 1] || "");
      const possible = current.dungeons.filter(
        (d) =>
          norm(d.nameFr) === norm(name) ||
          d.bossIds.some(
            (id) =>
              norm(current.monsters.find((m) => m.id === id)?.nameFr || "") ===
              norm(boss),
          ),
      );
      if (possible.length !== 1) continue;
      matched++;
      links.push({
        dungeonId: possible[0].id,
        url: new URL(first[1], url).href,
        source: url,
        removedReference: /existe plus/i.test(row),
      });
    }
    sources.push({
      url,
      status: response.status,
      dungeonRows: rows.length,
      removedRows: rows.filter((r) => /existe plus/i.test(r)).length,
      matchedRows: matched,
    });
  } catch (error) {
    sources.push({ url, error: error.message });
  }
}
const report = {
  checkedAt: new Date().toISOString(),
  sources,
  uniqueMappedDungeons: new Set(links.map((l) => l.dungeonId)).size,
  note: "Directory presence does not verify activity or mechanics for a game version.",
};
await writeFile(
  "docs/DUNGEON_DIRECTORY_AUDIT.json",
  JSON.stringify(report, null, 2),
);
await writeFile(
  "packages/game-data/assets/dungeon-guide-index.json",
  JSON.stringify({ report, links }, null, 2),
);
console.log(report);
