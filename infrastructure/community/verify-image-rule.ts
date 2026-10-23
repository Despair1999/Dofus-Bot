import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { deleteApp } from "firebase/app";
import { CommunityService } from "../../packages/community/src/firebase";
import { firebaseConfig } from "../../packages/community/src/config";
if (!process.argv.includes("--apply")) {
  console.log(
    "Dry run: bounded production icon-origin Rules probe with one synthetic account; no email sent. Requires --apply.",
  );
  process.exit(0);
}
const run = randomUUID(),
  admin = initializeApp(
    { projectId: "dofus-companion", credential: applicationDefault() },
    run,
  ),
  auth = getAuth(admin),
  db = getFirestore(admin);
const password = randomUUID() + randomUUID(),
  email = `sunbired+companionqa-image-${run.slice(0, 8)}@gmail.com`;
const user = await auth.createUser({ email, password, emailVerified: true }),
  c = new CommunityService(firebaseConfig, { name: run });
let passed = false;
try {
  await db
    .doc(`profiles/${user.uid}`)
    .create({
      uid: user.uid,
      dofusName: "QA Image Origin",
      discordName: "qa-unverified",
      server: "QA",
      mainCharacterId: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
  await db
    .doc(`memberships/${user.uid}`)
    .create({
      uid: user.uid,
      status: "approved",
      rank: "",
      displayName: "",
      revision: 1,
      lastAudit: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
  await c.login(email, password);
  const input = {
    itemId: 1,
    itemName: "QA – keine echte Anzeige",
    quantity: 1,
    price: 0,
    server: "QA",
    type: "sell",
    visibility: "guild",
    description: "Temporärer Zugriffstest",
  };
  for (const iconUrl of [
    "https://tracker.example/collect",
    "https://api.dofusdu.de.evil.example/icon",
    "https://api.dofusdu.de@evil.example/icon",
  ])
    await assert.rejects(() => c.createListing({ ...input, iconUrl }));
  await c.createListing({
    ...input,
    iconUrl: "https://api.dofusdu.de/dofus3/v1/img/item/1-64.png",
  });
  passed = true;
} finally {
  const rows = await db
    .collection("listings")
    .where("ownerUid", "==", user.uid)
    .get();
  for (const row of rows.docs) await db.recursiveDelete(row.ref);
  await db.doc(`profiles/${user.uid}`).delete();
  await db.doc(`memberships/${user.uid}`).delete();
  await auth.deleteUser(user.uid);
  await deleteApp(c.app);
  writeFileSync(
    "test-results/community-image-rule-production.json",
    JSON.stringify(
      {
        passed,
        checkedAt: new Date().toISOString(),
        fixturesRemoved: true,
        unapprovedOriginsDenied: true,
        canonicalImageAccepted: passed,
      },
      null,
      2,
    ),
  );
}
console.log(
  "Production image-origin Rules verified; synthetic fixtures removed.",
);
process.exit(passed ? 0 : 1);
