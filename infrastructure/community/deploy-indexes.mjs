import { applicationDefault } from "firebase-admin/app";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const base =
  "https://firestore.googleapis.com/v1/projects/dofus-companion/databases/(default)/collectionGroups";
const token = await applicationDefault().getAccessToken();
async function api(url, method = "GET", body) {
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok)
    throw Error(
      `Firestore indexes HTTP ${r.status}: ${(await r.json()).error?.message ?? "request failed"}`,
    );
  return r.json();
}
async function list() {
  const rows = [];
  let page = "";
  do {
    const d = await api(
      base +
        "/-/indexes" +
        (page ? "?pageToken=" + encodeURIComponent(page) : ""),
    );
    rows.push(...(d.indexes ?? []));
    page = d.nextPageToken ?? "";
  } while (page);
  return rows;
}
function key(d) {
  const group =
    d.collectionGroup ?? d.name.split("/collectionGroups/")[1].split("/")[0];
  return JSON.stringify([
    group,
    d.queryScope,
    d.fields
      .filter((f) => f.fieldPath !== "__name__")
      .map((f) => [f.fieldPath, f.order ?? f.arrayConfig]),
  ]);
}
const desired = JSON.parse(
  readFileSync("firestore.indexes.json", "utf8"),
).indexes;
let current = await list();
const missing = desired.filter((d) => !current.some((c) => key(c) === key(d)));
if (process.argv.includes("--apply")) {
  mkdirSync(".data/community-production-before", { recursive: true });
  // Timestamped: repeated deploys must not replace the prior production snapshot.
  writeFileSync(
    `.data/community-production-before/indexes-${Date.now()}.json`,
    JSON.stringify(current, null, 2),
  );
  for (const d of missing) {
    await api(
      base + "/" + encodeURIComponent(d.collectionGroup) + "/indexes",
      "POST",
      { queryScope: d.queryScope, fields: d.fields },
    );
  }
  current = await list();
}
const status = desired.map((d) => ({
  collectionGroup: d.collectionGroup,
  fields: d.fields.map((f) => f.fieldPath),
  state: current.find((c) => key(c) === key(d))?.state ?? "MISSING",
}));
mkdirSync(".data", { recursive: true });
writeFileSync(
  ".data/community-production-indexes.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      dryRun: !process.argv.includes("--apply"),
      created: process.argv.includes("--apply") ? missing.length : 0,
      existingPreserved: current.length,
      status,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ missing: missing.length, status }, null, 2));
