import { readFileSync } from "node:fs";
const gate = JSON.parse(
  readFileSync(
    new URL("../../.github/community-release-gate.json", import.meta.url),
    "utf8",
  ),
);
const checks = [
  "securityReviewed",
  "ownerConfigured",
  "legalReviewed",
  "productionRulesVerified",
];
const missing = checks.filter((k) => gate[k] !== true);
if (missing.length || process.env.COMMUNITY_PUBLICATION_APPROVED !== "true") {
  console.error(
    "Veröffentlichung gesperrt:",
    missing.join(", ") || "explizite Betreiberfreigabe fehlt",
  );
  process.exit(1);
}
console.log(
  "Dokumentierte Voraussetzungen und explizite Veröffentlichungsfreigabe vorhanden.",
);
