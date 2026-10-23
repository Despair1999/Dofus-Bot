// Explicit, bounded live acceptance. Never runs in CI or on module import.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth as adminAuth } from "firebase-admin/auth";
import {
  getFirestore as adminFirestore,
  FieldValue,
} from "firebase-admin/firestore";
import { deleteApp } from "firebase/app";
import { doc, setDoc, where } from "firebase/firestore";
import {
  CommunityService,
  type PlatformConfig,
} from "../../packages/community/src/firebase";
import { firebaseConfig } from "../../packages/community/src/config";
import { SyncEngine, type LocalStore } from "../../packages/community/src/sync";
import type { Listing, Activity } from "../../packages/community/src/model";

if (!process.argv.includes("--apply")) {
  console.log(
    "Dry run: creates two temporary QA accounts at operator-controlled Gmail aliases, exercises client Rules, sync, marketplace, events and Storage, and removes only this run's fixtures. Real owner password and private data are never read. Requires --apply and trusted ADC.",
  );
  process.exit(0);
}
for (const name of [
  "FIREBASE_AUTH_EMULATOR_HOST",
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_STORAGE_EMULATOR_HOST",
])
  assert.ok(
    !process.env[name],
    "No emulator override is allowed in production acceptance.",
  );
const admin = initializeApp(
    { projectId: "dofus-companion", credential: applicationDefault() },
    "production-acceptance",
  ),
  db = adminFirestore(admin),
  auth = adminAuth(admin);
const run = randomUUID(),
  uidFixtures: string[] = [],
  clients: CommunityService[] = [],
  checks: string[] = [],
  uploaded: string[] = [];
const report = {
  run,
  projectId: "dofus-companion",
  startedAt: new Date().toISOString(),
  uidFixtures,
  checks,
  passed: false,
  cleanupComplete: false,
  ownerPreserved: true,
  emailVerification:
    "API request only; test verification state set by trusted operator, mailbox receipt not asserted",
  error: "",
};
mkdirSync(".data", { recursive: true });
const save = () =>
  writeFileSync(
    ".data/community-production-acceptance.json",
    JSON.stringify(report, null, 2),
  );
async function removeFixtureAuth(uid: string) {
  try {
    await auth.deleteUser(uid);
  } catch (error) {
    if ((error as { code: string }).code !== "auth/user-not-found") throw error;
  }
}
const client = (name: string) => {
  const c = new CommunityService(firebaseConfig, { name: run + name });
  clients.push(c);
  return c;
};
const local = (): LocalStore => {
  const m = new Map<string, unknown>();
  return {
    async read<T>(k: string, f: T) {
      return (m.get(k) ?? f) as T;
    },
    async write(k, v) {
      m.set(k, v);
    },
    async keys() {
      return [...m.keys()];
    },
  };
};
const oldLegal = (await db.doc("platform/legal").get()).data()!,
  oldConfig = (await db.doc("platform/config").get()).data()!;
const configBeforePath = `.data/community-production-before/config-${run}.json`;
mkdirSync(".data/community-production-before", { recursive: true });
writeFileSync(
  configBeforePath,
  JSON.stringify({ legal: oldLegal, config: oldConfig }, null, 2),
);
let configurationTouched = false,
  qaAdmin: CommunityService | undefined;
try {
  const owner = await auth.getUserByEmail("sunbired@gmail.com");
  assert.ok(owner.emailVerified && !owner.disabled);
  assert.equal(
    (await db.doc(`roles/${owner.uid}`).get()).data()?.role,
    "owner",
  );
  const roleRows = await db.collection("roles").get();
  assert.ok(
    roleRows.docs.every((d) =>
      ["owner", "admin", "moderator"].includes(d.data().role),
    ),
    "Unexpected technical role document.",
  );
  checks.push("verified live owner and valid role inventory");
  const indexReport = JSON.parse(
    readFileSync(".data/community-production-indexes.json", "utf8"),
  );
  assert.ok(
    indexReport.status.every((i: { state: string }) => i.state === "READY"),
    "All required indexes must be READY before live tests.",
  );
  const preflight = JSON.parse(
    readFileSync(".data/community-preflight.json", "utf8"),
  );
  assert.ok(
    preflight.firestoreRules.matchesLocal &&
      preflight.storageRules.matchesLocal &&
      preflight.crossServiceIAM.enabled,
    "Deployed Rules and cross-service IAM must match the reviewed sources.",
  );
  const anon = client("-anonymous");
  await assert.rejects(() => anon.get("platform/config"));
  checks.push("anonymous access denied");
  // Real onboarding is opened only for this bounded acceptance window and closed in finally.
  await db.doc("platform/legal").update({
    registrationEnabled: true,
    privacyUrl: "https://dofus-companion.web.app/datenschutz",
    termsUrl: "https://dofus-companion.web.app/nutzungsbedingungen",
    legalVersion: "2026-10-23",
    revision: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const password = randomUUID() + randomUUID(),
    a = client("-seller"),
    b = client("-buyer");
  const emailA = `sunbired+companionqa-${run.slice(0, 8)}-a@gmail.com`,
    emailB = `sunbired+companionqa-${run.slice(0, 8)}-b@gmail.com`;
  for (const [c, email, name] of [
    [a, emailA, "Companion QA Verkäufer"],
    [b, emailB, "Companion QA Käufer"],
  ] as const) {
    try {
      await c.register(
        email,
        password,
        password,
        {
          dofusName: name,
          discordName: "companion-qa-unverified",
          server: "Companion-QA",
          mainCharacterId: "",
        },
        true,
      );
    } finally {
      if (c.auth.currentUser) {
        uidFixtures.push(c.uid);
        save();
      }
    }
    assert.ok(c.auth.currentUser);
    await assert.rejects(() => c.get(`users/${c.uid}/records/nonexistent`));
    await auth.updateUser(c.uid, { emailVerified: true });
    await c.refreshVerification();
  }
  checks.push(
    "live email/password registration, consent receipt and verification boundary",
  );
  await assert.rejects(() =>
    setDoc(doc(b.db, `roles/${b.uid}`), { role: "owner" }),
  );
  await assert.rejects(() => b.get("platform/config"));
  await a.requestMembership();
  await b.requestMembership();
  await db.doc(`memberships/${a.uid}`).update({ status: "approved" });
  await db.doc(`roles/${a.uid}`).create({
    role: "admin",
    assignedBy: "bounded-production-acceptance",
    updatedAt: FieldValue.serverTimestamp(),
  });
  qaAdmin = a;
  await assert.rejects(() => a.reauthenticate("wrong-qa-password"));
  await a.reauthenticate(password);
  await a.edit(
    `memberships/${b.uid}`,
    { status: "approved" },
    1,
    "Produktionsabnahme: ausschließlich Testmitglied freigeben",
    true,
  );
  assert.equal((await b.get<any>(`memberships/${b.uid}`)).status, "approved");
  checks.push(
    "membership approval, negative role escalation, personal admin reauthentication and audit",
  );
  const engine = new SyncEngine(
    a.uid,
    "qa-device-a",
    local(),
    a.transport(a.uid),
  );
  await engine.init();
  await engine.capture("favorites", [{ id: run, type: "item" }]);
  await engine.flush();
  assert.equal(engine.state.error, "");
  const second = client("-second-device");
  await second.login(emailA, password);
  const records = await second.records();
  assert.ok(
    records.some((r) => r.key === "favorites" && r.payload.includes(run)),
  );
  await assert.rejects(() =>
    b.get(`users/${a.uid}/records/${encodeURIComponent("favorites")}`),
  );
  await engine.capture("favorites", [
    { id: run, type: "item", note: "offline queued" },
  ]);
  assert.ok(engine.state.queue.length > 0);
  await engine.flush();
  assert.equal(engine.state.queue.length, 0);
  checks.push(
    "two independent sessions, private sync and durable offline queue",
  );
  const baseOffer = {
    itemId: 1,
    itemName: "Companion QA – kein echtes Angebot",
    iconUrl: "",
    quantity: 5,
    price: 1,
    server: "Companion-QA",
    type: "sell",
    description: "Automatisierter, vorübergehender Funktionstest",
  };
  const id = await a.createListing({ ...baseOffer, visibility: "guild" });
  await b.comment(id, "Testkommentar für die Produktionsabnahme");
  await b.reserve(id, 2);
  const reservations = await a.page<any>("reservations", [
    where("sellerUid", "==", a.uid),
  ]);
  const reservation = reservations.items.find((r) => r.listingId === id)!;
  assert.ok(reservation);
  await a.reservation(reservation.id, "accepted");
  assert.equal((await a.get<Listing>(`listings/${id}`))!.available, 3);
  await a.reservation(reservation.id, "completed");
  const global = await b.createListing({ ...baseOffer, visibility: "global" });
  await assert.rejects(() =>
    a.edit(
      `listings/${global}`,
      { price: 100 },
      1,
      "Unzulässige Gildenadmin-Korrektur im globalen Markt",
      true,
    ),
  );
  checks.push(
    "internal and global listings, comments, atomic partial reservation and global moderation boundary",
  );
  const start = new Date(Date.now() + 86400000).toISOString();
  for (const kind of ["event", "group"] as const) {
    await a.createActivity({
      kind,
      title: "Companion QA – temporärer Test",
      description: "Keine echte Veranstaltung",
      server: "Companion-QA",
      startsAt: start,
      timezone: "Europe/Berlin",
      meeting: "QA",
      dungeonId: kind === "group" ? 1 : 0,
      minLevel: 1,
      capacity: 1,
    });
    const rows = await a.page<Activity>("activities", [
      where("kind", "==", kind),
      where("ownerUid", "==", a.uid),
    ]);
    const activity = rows.items[0];
    assert.ok(activity);
    await b.participate(activity.id, {
      characterId: "qa-character",
      name: "QA Charakter",
      level: 200,
      role: "Flexibel",
    });
    await a.participate(activity.id, {
      characterId: "qa-other",
      name: "QA Warteliste",
      level: 200,
      role: "Schaden",
    });
    assert.equal(
      (await a.get<Activity>(`activities/${activity.id}`))!.participants[a.uid]
        .status,
      "waiting",
    );
    await a.edit(
      `activities/${activity.id}`,
      { title: "Companion QA – geänderter Termin" },
      3,
      "Produktionsabnahme: Testaktivität ändern",
      true,
    );
  }
  checks.push(
    "events, dungeon groups, capacity, waiting list and audited organizer changes",
  );
  const image = new Blob(
    [readFileSync("apps/desktop/public/classes/1-thumb.webp")],
    { type: "image/webp" },
  );
  const emblem = await a.uploadEmblem(image);
  uploaded.push(emblem);
  await assert.rejects(() => anon.readEmblem(emblem));
  const merged = {
    ...(await a.get<any>("platform/legal")),
    ...(await a.get<any>("platform/config")),
  } as PlatformConfig;
  await a.saveSettings(
    { ...merged, emblem },
    "Produktionsabnahme: temporäres Testwappen",
  );
  configurationTouched = true;
  assert.ok((await b.readEmblem(emblem)).size > 0);
  await assert.rejects(() => a.removeUnusedEmblem(emblem));
  const nextEmblem = await a.uploadEmblem(image);
  uploaded.push(nextEmblem);
  const current = {
    ...(await a.get<any>("platform/legal")),
    ...(await a.get<any>("platform/config")),
  } as PlatformConfig;
  await a.saveSettings(
    { ...current, emblem: nextEmblem },
    "Produktionsabnahme: Testwappen ersetzen",
  );
  await a.removeUnusedEmblem(emblem);
  checks.push(
    "real Storage upload, authorized reads, referenced-image delete denial and emblem replacement",
  );
  const offer = await a.get<Listing>(`listings/${id}`);
  await a.edit(
    `listings/${id}`,
    { status: "withdrawn" },
    offer!.revision,
    "Testangebot abschließen",
  );
  const globalOffer = await b.get<Listing>(`listings/${global}`);
  await b.edit(
    `listings/${global}`,
    { status: "withdrawn" },
    globalOffer!.revision,
    "Testangebot abschließen",
  );
  const exported = await b.exportAccount();
  assert.ok(exported.profile);
  await b.deleteAccount(password);
  await assert.rejects(() => auth.getUser(uidFixtures[1]));
  checks.push("private export, real account deletion and Auth removal");
  report.passed = true;
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  console.error("Production acceptance failed:", report.error);
} finally {
  try {
    // Restore only this run's emblem, through the normal audited revision-checked API.
    // Concurrent administrator edits to other fields must never be overwritten.
    if (configurationTouched) {
      assert.ok(qaAdmin);
      const current = {
        ...(await qaAdmin.get<any>("platform/legal")),
        ...(await qaAdmin.get<any>("platform/config")),
      } as PlatformConfig;
      if (uploaded.includes(current.emblem))
        await qaAdmin.saveSettings(
          { ...current, emblem: oldConfig.emblem },
          "Produktionsabnahme: ursprüngliches Wappen wiederherstellen",
        );
    }
    const currentLegal = (await db.doc("platform/legal").get()).data()!;
    await db.doc("platform/legal").set({
      ...currentLegal,
      registrationEnabled: oldLegal.registrationEnabled,
      privacyUrl: oldLegal.privacyUrl,
      termsUrl: oldLegal.termsUrl,
      legalVersion: oldLegal.legalVersion,
      updatedAt: FieldValue.serverTimestamp(),
    });
    for (const path of uploaded) {
      try {
        await (
          await import("firebase-admin/storage")
        )
          .getStorage(admin)
          .bucket(firebaseConfig.storageBucket)
          .file(path)
          .delete({ ignoreNotFound: true });
      } catch {
        /* Report verification below catches surviving images. */
      }
    }
    for (const uid of uidFixtures) {
      for (const [collection, field] of [
        ["listings", "ownerUid"],
        ["activities", "ownerUid"],
        ["reservations", "buyerUid"],
        ["reservations", "sellerUid"],
        ["reports", "reporterUid"],
        ["audit", "actorUid"],
        ["guildAnnouncements", "actorUid"],
        ["activityAnnouncements", "actorUid"],
      ]) {
        const rows = await db
          .collection(collection)
          .where(field, "==", uid)
          .get();
        for (const row of rows.docs) {
          if (
            collection === "audit" &&
            String(row.data().target).startsWith("platform/")
          )
            continue;
          await db.recursiveDelete(row.ref);
        }
      }
      await db.recursiveDelete(db.doc(`users/${uid}`));
      for (const collection of [
        "profiles",
        "memberships",
        "roles",
        "guildCharacters",
        "accountDeletions",
      ])
        await db.doc(`${collection}/${uid}`).delete();
      await removeFixtureAuth(uid);
    }
    await db.collection("operatorAudit").add({
      action: "bounded-production-acceptance",
      run,
      passed: report.passed,
      fixturesRemoved: uidFixtures.length,
      createdAt: FieldValue.serverTimestamp(),
    });
    report.cleanupComplete = true;
  } catch (error) {
    report.cleanupComplete = false;
    report.error += "; cleanup: " + String(error);
  }
  for (const c of clients) await deleteApp(c.app);
  save();
  console.log(JSON.stringify(report, null, 2));
}
process.exit(report.passed && report.cleanupComplete ? 0 : 1);
