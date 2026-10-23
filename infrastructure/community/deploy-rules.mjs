import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getSecurityRules } from "firebase-admin/security-rules";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const projectId = "dofus-companion",
  bucket = "dofus-companion.firebasestorage.app";
if (!process.argv.includes("--apply")) {
  console.log(
    "Dry run: publish exactly the reviewed local Firestore and Storage rules, without changing or deleting indexes. Requires --apply and trusted ADC.",
  );
  process.exit(0);
}
initializeApp({ projectId, credential: applicationDefault() });
const rules = getSecurityRules(),
  stamp = Date.now();
mkdirSync(".data/community-production-before", { recursive: true });
const [beforeFirestore, beforeStorage] = await Promise.all([
  rules.getFirestoreRuleset(),
  rules.getStorageRuleset(bucket),
]);
for (const [label, source] of [
  ["firestore", beforeFirestore],
  ["storage", beforeStorage],
])
  writeFileSync(
    `.data/community-production-before/${label}-${stamp}.json`,
    JSON.stringify(source, null, 2),
  );
const fsSource = readFileSync("firestore.rules", "utf8"),
  storageSource = readFileSync("storage.rules", "utf8");
await rules.releaseFirestoreRulesetFromSource(fsSource);
await rules.releaseStorageRulesetFromSource(storageSource, bucket);
const [afterFs, afterStorage] = await Promise.all([
  rules.getFirestoreRuleset(),
  rules.getStorageRuleset(bucket),
]);
const sha = (s) => createHash("sha256").update(s).digest("hex");
const report = {
  checkedAt: new Date().toISOString(),
  projectId,
  bucket,
  firestore: {
    name: afterFs.name,
    matchesLocal:
      sha(afterFs.source.map((f) => f.content).join("\n")) === sha(fsSource),
  },
  storage: {
    name: afterStorage.name,
    matchesLocal:
      sha(afterStorage.source.map((f) => f.content).join("\n")) ===
      sha(storageSource),
  },
};
writeFileSync(
  ".data/community-production-rules.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (!report.firestore.matchesLocal || !report.storage.matchesLocal)
  throw Error("Deployed Rule sources differ from the reviewed files.");
