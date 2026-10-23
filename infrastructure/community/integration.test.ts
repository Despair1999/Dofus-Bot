import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  initializeApp as initializeAdmin,
  deleteApp as deleteAdmin,
} from "firebase-admin/app";
import { getAuth as adminAuth } from "firebase-admin/auth";
import {
  getFirestore as adminFirestore,
  FieldValue,
} from "firebase-admin/firestore";
import { deleteApp } from "firebase/app";
import { where } from "firebase/firestore";
import { CommunityService } from "../../packages/community/src/firebase";
import { SyncEngine, type LocalStore } from "../../packages/community/src/sync";

const projectId = "demo-dofus-community",
  admin = initializeAdmin({ projectId }, "integration"),
  clients: CommunityService[] = [];
let env: RulesTestEnvironment;
const client = (name: string) => {
  const c = new CommunityService(
    {
      projectId,
      apiKey: "emulator-only",
      authDomain: "localhost",
      storageBucket: `${projectId}.appspot.com`,
    },
    { name, emulator: true },
  );
  clients.push(c);
  return c;
};
function local(): LocalStore {
  const values = new Map<string, unknown>();
  return {
    async read<T>(k: string, f: T) {
      return (values.get(k) as T) ?? f;
    },
    async write(k, v) {
      values.set(k, v);
    },
    async keys() {
      return [...values.keys()];
    },
  };
}
before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
  await env.clearFirestore();
  await env.clearStorage();
  await fetch(
    `http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`,
    { method: "DELETE" },
  );
  const d = adminFirestore(admin);
  await d.doc("platform/legal").set({
    registrationEnabled: true,
    privacyUrl: "https://example.test/privacy",
    termsUrl: "https://example.test/terms",
    legalVersion: "test-v1",
    revision: 1,
    lastAudit: "",
    updatedAt: FieldValue.serverTimestamp(),
  });
  await d.doc("platform/config").set({
    guildName: "Integration",
    server: "Test",
    description: "",
    discordUrl: "",
    emblem: "",
    rules: "Private rules",
    admission: "",
    revision: 1,
    lastAudit: "",
    updatedAt: FieldValue.serverTimestamp(),
  });
});
after(async () => {
  await Promise.all(clients.map((c) => deleteApp(c.app)));
  await env?.cleanup();
  await deleteAdmin(admin);
});
let first: CommunityService, second: CommunityService, owner: CommunityService;
const email = "player@example.test",
  password = "emulator-only-password-123",
  profile = {
    dofusName: "Nehra",
    discordName: "nehra99",
    server: "Test",
    mainCharacterId: "",
  };
test("real Auth emulator registration, profile, terms receipt, session and password reset", async () => {
  first = client("desktop-a");
  await assert.rejects(() =>
    first.register(email, password, password, profile, false),
  );
  assert.equal(first.auth.currentUser, null);
  await first.register(email, password, password, profile, true);
  assert.ok(first.uid);
  assert.equal(first.auth.currentUser!.emailVerified, false);
  const stored = await first.get<Record<string, unknown>>(
    `profiles/${first.uid}`,
  );
  assert.equal(stored!.dofusName, "Nehra");
  const receipt = await first.get<any>(`users/${first.uid}/account/consent`);
  assert.equal(receipt.legalVersion, "test-v1");
  assert.ok(receipt.legalAcceptedAt);
  assert.equal(stored!.legalVersion, undefined);
  await assert.rejects(() => first.records());
  await adminAuth(admin).updateUser(first.uid, { emailVerified: true });
  await first.refreshVerification();
  assert.equal(first.auth.currentUser!.emailVerified, true);
  await first.reset(email);
  await first.logout();
  assert.equal(first.auth.currentUser, null);
  await first.login(email, password);
  assert.equal(
    (await first.get<Record<string, unknown>>(`profiles/${first.uid}`))!
      .dofusName,
    "Nehra",
  );
  second = client("website-b");
  await second.login(email, password);
  assert.equal(second.uid, first.uid);
});
test("two independent Firebase clients exchange rows, replay offline queue and resolve revisions", async () => {
  const a = new SyncEngine(
      first.uid,
      "desktop",
      local(),
      first.transport(first.uid),
    ),
    ls = local(),
    b = new SyncEngine(second.uid, "website", ls, second.transport(second.uid));
  await a.init();
  await b.init();
  await a.capture("market:journal-v1::trades/a", {
    id: "a",
    quantity: 10,
    kind: "buy",
  });
  await a.flush();
  assert.equal(a.state.error, "");
  await b.receive(await second.records());
  assert.equal(
    (
      await ls.read<{ quantity: number }>("market:journal-v1::trades/a", {
        quantity: 0,
      })
    ).quantity,
    10,
  );
  await b.capture("market:journal-v1::trades/a", {
    id: "a",
    quantity: 20,
    kind: "buy",
  });
  await a.capture("market:journal-v1::trades/a", {
    id: "a",
    quantity: 30,
    kind: "buy",
  });
  await a.flush();
  await b.flush();
  assert.equal(b.state.conflicts.length, 1);
  await b.resolve("market:journal-v1::trades/a", "remote");
  assert.equal(b.state.conflicts.length, 0);
});
test("trusted owner role, personal reauthentication, membership approval and private guild reads", async () => {
  const user = await adminAuth(admin).createUser({
    email: "owner@example.test",
    password,
    emailVerified: true,
  });
  await adminFirestore(admin).doc(`roles/${user.uid}`).set({ role: "owner" });
  await adminFirestore(admin).doc(`memberships/${user.uid}`).set({
    uid: user.uid,
    status: "approved",
    rank: "",
    displayName: "",
    revision: 1,
    lastAudit: "",
    updatedAt: FieldValue.serverTimestamp(),
  });
  await adminFirestore(admin).doc(`profiles/${user.uid}`).set({
    uid: user.uid,
    dofusName: "Gildenleitung",
    discordName: "owner99",
    server: "Test",
    mainCharacterId: "",
    updatedAt: FieldValue.serverTimestamp(),
  });
  await adminFirestore(admin).doc(`users/${user.uid}/account/consent`).set({
    legalVersion: "test-v1",
    legalAcceptedAt: FieldValue.serverTimestamp(),
  });
  owner = client("owner-client");
  await owner.login("owner@example.test", password);
  assert.equal(await owner.role(), "owner");
  await assert.rejects(() => owner.reauthenticate("wrong-password"));
  await owner.reauthenticate(password);
  await assert.rejects(() => first.get("platform/config"));
  await first.requestMembership();
  const m = await owner.get<{ revision: number }>(`memberships/${first.uid}`);
  await owner.edit(
    `memberships/${first.uid}`,
    { status: "approved" },
    m!.revision,
    "Mitglied wurde geprüft",
    true,
  );
  const guild = await first.get<{ rules: string }>("platform/config");
  assert.equal(guild!.rules, "Private rules");
  const logs = await owner.page("audit");
  assert.ok(logs.items.length > 0);
  const notices = await first.page(`users/${first.uid}/notifications`);
  assert.ok(notices.items.length > 0);
});
test("Storage upload, authorized read, audited exchange and deletion of unused emblem", async () => {
  const blob = new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46])], {
    type: "image/webp",
  });
  await assert.rejects(() => first.uploadEmblem(blob));
  const path = await owner.uploadEmblem(blob);
  assert.ok((await first.readEmblem(path)).size > 0);
  const guild = await owner.get<any>("platform/config"),
    legal = await owner.get<any>("platform/legal");
  await owner.saveSettings(
    { ...legal, ...guild, emblem: path },
    "Gildenwappen eingerichtet",
  );
  await assert.rejects(() => owner.removeUnusedEmblem(path));
  const secondPath = await owner.uploadEmblem(blob);
  const updated = await owner.get<any>("platform/config");
  await owner.saveSettings(
    { ...legal, ...updated, emblem: secondPath },
    "Gildenwappen ausgetauscht",
  );
  await owner.removeUnusedEmblem(path);
  await assert.rejects(() => first.readEmblem(path));
  const latest = await owner.get<any>("platform/config");
  await owner.saveSettings(
    { ...legal, ...latest, emblem: "" },
    "Gildenwappen entfernt",
  );
  await owner.removeUnusedEmblem(secondPath);
});
test("marketplace request, atomic acceptance, completion and comment use the shared services", async () => {
  const seller = owner;
  const id = await seller.createListing({
    itemId: 1,
    itemName: "Test item",
    iconUrl: "",
    quantity: 5,
    price: 100,
    server: "Test",
    type: "sell",
    visibility: "guild",
    description: "",
  });
  await first.reserve(id, 3);
  const reservations = await first.page<any>("reservations", [
    where("buyerUid", "==", first.uid),
  ]);
  const reservation = reservations.items.find((r) => r.listingId === id);
  assert.ok(reservation);
  await seller.reservation(reservation.id, "accepted");
  assert.equal((await first.get<any>(`listings/${id}`)).available, 2);
  await seller.reservation(reservation.id, "completed");
  assert.equal((await first.get<any>(`listings/${id}`)).available, 2);
  await first.comment(id, "Interesse am Angebot");
  assert.equal((await first.page(`listings/${id}/comments`)).items.length, 1);
});
test("groups use capacity-safe joins, waiting lists, leaving and self-promotion", async () => {
  await first.createActivity({
    kind: "group",
    title: "Dungeon",
    description: "",
    server: "Test",
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    timezone: "Europe/Berlin",
    meeting: "[0,0]",
    dungeonId: 1,
    minLevel: 100,
    capacity: 1,
  });
  const page = await first.page<any>("activities", [
      where("kind", "==", "group"),
    ]),
    id = page.items[0].id;
  await first.participate(id, {
    characterId: "a",
    name: "Nehra",
    level: 200,
    role: "Tank",
  });
  await owner.participate(id, {
    characterId: "b",
    name: "Owner",
    level: 200,
    role: "Flexibel",
  });
  let activity = await first.get<any>(`activities/${id}`);
  assert.equal(activity.joined, 1);
  assert.equal(activity.participants[owner.uid].status, "waiting");
  await first.participate(id, null);
  await owner.participate(id, {
    characterId: "b",
    name: "Owner",
    level: 200,
    role: "Flexibel",
  });
  activity = await first.get<any>(`activities/${id}`);
  assert.equal(activity.joined, 1);
  assert.equal(activity.participants[owner.uid].status, "joined");
});
test("guild comment moderation is authorized and its nested target is audited", async () => {
  const offers = await first.page<any>("listings", [
      where("visibility", "==", "guild"),
    ]),
    id = offers.items[0].id;
  await first.comment(id, "Kommentar zur Moderation");
  const comments = await first.page<any>(`listings/${id}/comments`),
    comment = comments.items.find((c) => c.text === "Kommentar zur Moderation");
  assert.ok(comment);
  await assert.rejects(() =>
    first.edit(
      `listings/${id}/comments/${comment.id}`,
      { text: "[Kommentar moderiert]", moderated: true },
      comment.revision,
      "Nicht berechtigter Versuch",
      true,
    ),
  );
  await owner.edit(
    `listings/${id}/comments/${comment.id}`,
    { text: "[Kommentar moderiert]", moderated: true },
    comment.revision,
    "Gildenregeln durchgesetzt",
    true,
  );
  assert.equal(
    (await first.get<any>(`listings/${id}/comments/${comment.id}`)).moderated,
    true,
  );
});
test("administrative participant changes preserve capacity and require an exact audit", async () => {
  const groups = await first.page<any>("activities", [
      where("kind", "==", "group"),
    ]),
    e = groups.items[0];
  await owner.moderateParticipant(
    e.id,
    owner.uid,
    { ...e.participants[owner.uid], status: "waiting" },
    e.revision,
    "Warteliste administrativ korrigiert",
  );
  const updated = await first.get<any>(`activities/${e.id}`);
  assert.equal(updated.joined, 0);
  await assert.rejects(() =>
    first.moderateParticipant(
      e.id,
      owner.uid,
      null,
      updated.revision,
      "Unzulässige Moderatoraktion",
    ),
  );
  await owner.moderateParticipant(
    e.id,
    owner.uid,
    null,
    updated.revision,
    "Teilnehmer auf eigenen Wunsch entfernt",
  );
  assert.equal(
    (await first.get<any>(`activities/${e.id}`)).participants[owner.uid],
    undefined,
  );
});
test("archiving logically removes the guild, denies member reads, and restoration preserves data", async () => {
  const cfg = await owner.get<any>("platform/config"),
    legal = await owner.get<any>("platform/legal");
  await owner.saveSettings(
    { ...legal, ...cfg, archived: true },
    "Gilde vorübergehend archiviert",
  );
  await assert.rejects(() => first.get("platform/config"));
  await assert.rejects(() => first.page("activities"));
  const archived = await owner.get<any>("platform/config");
  assert.equal(archived.archived, true);
  await owner.saveSettings(
    { ...legal, ...archived, archived: false },
    "Bestehende Gilde wiederhergestellt",
  );
  assert.equal(
    (await first.get<any>("platform/config")).guildName,
    cfg.guildName,
  );
  assert.ok((await first.page("activities")).items.length > 0);
});

test("account deletion removes private data and blocks stale sync resurrection", async () => {
  const c = client("delete-account"),
    accountEmail = "delete@example.test";
  await c.register(
    accountEmail,
    password,
    password,
    { ...profile, dofusName: "DeleteTest" },
    true,
  );
  const uid = c.uid;
  await adminAuth(admin).updateUser(uid, { emailVerified: true });
  await c.refreshVerification();
  const engine = new SyncEngine(uid, "delete-test", local(), c.transport(uid));
  await engine.init();
  await engine.capture("characters::delete-test", {
    id: "delete-test",
    name: "DeleteTest",
  });
  await engine.flush();
  assert.equal(engine.state.error, "");
  assert.equal((await c.records()).length, 1);
  await c.deleteAccount(password);
  assert.equal(c.auth.currentUser, null);
  await assert.rejects(() => adminAuth(admin).getUser(uid));
  const db = adminFirestore(admin);
  assert.equal((await db.doc(`profiles/${uid}`).get()).exists, false);
  assert.equal(
    (await db.doc(`users/${uid}/account/consent`).get()).exists,
    false,
  );
  assert.equal((await db.collection(`users/${uid}/records`).get()).size, 0);
  assert.equal(
    (await db.doc(`accountDeletions/${uid}`).get()).data()!.state,
    "pending",
  );
  const stale = env
    .authenticatedContext(uid, { email_verified: true })
    .firestore();
  const { setDoc, doc, serverTimestamp } = await import("firebase/firestore");
  await assert.rejects(() =>
    setDoc(doc(stale, `users/${uid}/records/stale`), {
      key: "characters",
      payload: [],
      deleted: false,
      revision: 1,
      deviceId: "stale",
      updatedAt: serverTimestamp(),
    }),
  );
});
