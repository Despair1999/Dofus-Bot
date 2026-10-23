import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
  initializeApp,
  applicationDefault,
  deleteApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { deleteApp as deleteClient } from "firebase/app";
import { chromium } from "@playwright/test";
import {
  CommunityService,
  type PlatformConfig,
} from "../../packages/community/src/firebase";
import { firebaseConfig } from "../../packages/community/src/config";
if (!process.argv.includes("--apply")) {
  console.log(
    "Dry run: isolated temporary verified Auth fixtures; real browser settings/Storage/profile checks; preserve existing guild content and clean fixtures. Requires --apply.",
  );
  process.exit(0);
}
const base =
  process.argv.find((a) => a.startsWith("--base="))?.slice(7) ??
  "http://127.0.0.1:1420";
assert.ok(
  ["http://127.0.0.1:1420", "https://dofus-companion.web.app"].includes(base),
);
assert.ok(
  !process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT === "dofus-companion",
);
const admin = initializeApp(
    { projectId: "dofus-companion", credential: applicationDefault() },
    "hub-acceptance",
  ),
  auth = getAuth(admin),
  db = getFirestore(admin);
const run = randomUUID(),
  ids = [`hub-qa-${run}-a`, `hub-qa-${run}-b`],
  password = randomBytes(32).toString("base64url"),
  clients: CommunityService[] = [],
  uploaded: string[] = [];
const report: Record<string, unknown> = {
  checkedAt: new Date().toISOString(),
  projectId: "dofus-companion",
  base,
  passed: false,
  cleanupComplete: false,
};
const oldGuild = (await db.doc("platform/config").get()).data()!,
  oldLegal = (await db.doc("platform/legal").get()).data()!;
report.discordLinkWasEmpty = oldGuild.discordUrl === "";
const ownerBefore = await auth.getUserByEmail("sunbired@gmail.com");
const browser = await chromium.launch({ headless: true });
async function settings(c: CommunityService) {
  const [legal, guild] = await Promise.all([
    c.get<any>("platform/legal"),
    c.get<any>("platform/config"),
  ]);
  return {
    ...legal,
    ...guild,
    legalRevision: legal.revision,
  } as PlatformConfig;
}
try {
  for (const [index, id] of ids.entries()) {
    await auth.createUser({
      uid: id,
      email: `sunbired+${id}@gmail.com`,
      password,
      emailVerified: true,
    });
    await db.doc(`profiles/${id}`).create({
      uid: id,
      dofusName: `Companion QA ${index + 1}`,
      discordName: "companion-qa",
      server: "Companion-QA",
      mainCharacterId: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
    await db.doc(`memberships/${id}`).create({
      uid: id,
      status: "approved",
      rank: "",
      displayName: "",
      revision: 1,
      lastAudit: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (index === 0)
      await db.doc(`roles/${id}`).create({
        role: "owner",
        assignedBy: "bounded-hub-production-acceptance",
      });
    const c = new CommunityService(firebaseConfig, {
      name: `hub-${run}-${index}`,
    });
    clients.push(c);
    await c.login(`sunbired+${id}@gmail.com`, password);
  }
  const [a, b] = clients;
  await a.reauthenticate(password);
  await a.saveGuildProfile(
    {
      personalStatus: "Companion QA – temporär",
      biography: "Temporäre Abnahme\nKeine echten Spielerangaben",
    },
    1,
  );
  const visible = await b.get<any>(`memberships/${a.uid}`);
  assert.equal(
    visible.biography,
    "Temporäre Abnahme\nKeine echten Spielerangaben",
  );
  await assert.rejects(() =>
    b.edit(
      `memberships/${a.uid}`,
      { biography: "Verbotene Änderung" },
      visible.revision,
    ),
  );
  await assert.rejects(() =>
    a.saveGuildProfile(
      { personalStatus: "", biography: "", role: "owner" },
      visible.revision,
    ),
  );
  await a.edit(
    `memberships/${b.uid}`,
    { biography: "Auditierte QA-Moderation" },
    1,
    "Produktionsabnahme: ausschließlich temporäres Testprofil moderieren",
    true,
  );
  assert.ok((await b.get<any>(`memberships/${b.uid}`)).lastAudit);
  await a.saveGuildProfile(
    { personalStatus: "", biography: "" },
    visible.revision,
  );
  report.profileBoundaries = true;
  report.auditedModeration = true;
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  await page.addInitScript(() =>
    sessionStorage.setItem("dofus-companion-preview-v1", "granted"),
  );
  await page.goto(base + "/community/account");
  await page
    .getByLabel("E-Mail", { exact: true })
    .fill(`sunbired+${ids[0]}@gmail.com`);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page
    .locator(".cc-account-grid form")
    .getByRole("button", { name: "Anmelden", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Administration öffnen", exact: true })
    .click();
  await page
    .getByLabel("Dein persönliches Accountpasswort", { exact: true })
    .fill(password);
  await page
    .getByRole("button", { name: "Sicher entsperren", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Gildeneinstellungen", exact: true })
    .click();
  assert.equal(
    await page
      .getByLabel("Discord-Einladungslink", { exact: true })
      .inputValue(),
    oldGuild.discordUrl,
  );
  await page
    .getByLabel("Änderungsgrund", { exact: true })
    .fill("Produktionsabnahme 0.11.0: unveränderte fachliche Gildenfelder");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", {
      name: "Änderungen bestätigen & speichern",
      exact: true,
    })
    .click();
  await page
    .getByText("Gildenkonfiguration gespeichert.", { exact: true })
    .waitFor();
  const after = (await db.doc("platform/config").get()).data()!;
  for (const key of [
    "guildName",
    "server",
    "description",
    "discordUrl",
    "emblem",
    "rules",
    "admission",
    "archived",
  ])
    assert.deepEqual(after[key], oldGuild[key]);
  assert.equal(
    (await db.doc("platform/legal").get()).data()!.revision,
    oldLegal.revision,
  );
  report.browserSettingsSaved = true;
  report.optionalDiscordPreserved = true;
  report.legalPolicyUnchanged = true;
  const blob = new Blob(
    [readFileSync("apps/desktop/public/classes/1-thumb.webp")],
    { type: "image/webp" },
  );
  const path = await a.uploadEmblem(blob);
  uploaded.push(path);
  const token = await a.auth.currentUser!.getIdToken();
  const browserRead = await page.evaluate(
    async ({ path, token }) => {
      const url = `https://firebasestorage.googleapis.com/v0/b/dofus-companion.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media`;
      const r = await fetch(url, {
        headers: { Authorization: `Firebase ${token}` },
      });
      const bytes = await r.arrayBuffer();
      return { status: r.status, size: bytes.byteLength };
    },
    { path, token },
  );
  assert.equal(browserRead.status, 200);
  assert.equal(browserRead.size, blob.size);
  report.authenticatedBrowserStorage = true;
  await assert.rejects(() => b.uploadEmblem(blob));
  report.nonAdminUploadDenied = true;
  await a.removeUnusedEmblem(path);
  await assert.rejects(() => b.readEmblem(path));
  report.unusedUploadRemoved = true;
  // Existing guild imagery is never replaced by this production probe.
  assert.equal((await settings(a)).emblem, oldGuild.emblem);
  report.passed = true;
} finally {
  await browser.close();
  for (const path of uploaded)
    await clients[0]?.removeUnusedEmblem(path).catch(() => {});
  for (const c of clients) {
    await c.logout().catch(() => {});
    await deleteClient(c.app);
  }
  for (const id of ids) {
    assert.ok(id.startsWith(`hub-qa-${run}-`));
    await db.doc(`roles/${id}`).delete();
    await db.doc(`memberships/${id}`).delete();
    await db.doc(`profiles/${id}`).delete();
    await db.recursiveDelete(db.doc(`users/${id}`));
    await auth.deleteUser(id).catch(() => {});
  }
  const ownerAfter = await auth.getUserByEmail("sunbired@gmail.com");
  assert.equal(ownerAfter.uid, ownerBefore.uid);
  assert.equal(ownerAfter.emailVerified, ownerBefore.emailVerified);
  report.ownerPreserved = true;
  report.cleanupComplete = true;
  writeFileSync(
    ".data/guild-hub-production-acceptance.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await deleteApp(admin);
}
