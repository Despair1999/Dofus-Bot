import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  collection,
  query,
  limit,
  serverTimestamp,
  runTransaction,
  where,
} from "firebase/firestore";
let env: RulesTestEnvironment;
const uid = "member",
  other = "outsider",
  owner = "owner",
  now = Math.floor(Date.now() / 1000);
const db = (id: string, verified = true, authTime = now) =>
  env
    .authenticatedContext(id, { email_verified: verified, auth_time: authTime })
    .firestore();
const settings = {
  guildName: "",
  server: "",
  description: "",
  discordUrl: "",
  emblem: "",
  rules: "",
  admission: "",
  revision: 1,
  lastAudit: "",
  updatedAt: new Date(),
};
const listing = (visibility = "guild") => ({
  id: "l",
  ownerUid: uid,
  itemId: 1,
  itemName: "Test",
  iconUrl: "",
  quantity: 5,
  available: 5,
  price: 10,
  server: "Test",
  type: "sell",
  visibility,
  description: "",
  status: "open",
  revision: 1,
  lastReservation: "",
  lastAudit: "",
  updatedAt: new Date(),
});
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-dofus-community",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    await setDoc(doc(d, "platform/config"), settings);
    await setDoc(doc(d, "platform/legal"), {
      registrationEnabled: false,
      privacyUrl: "",
      termsUrl: "",
      legalVersion: "",
      revision: 1,
      lastAudit: "",
      updatedAt: new Date(),
    });
    for (const id of [uid, owner])
      await setDoc(doc(d, `memberships/${id}`), {
        uid: id,
        status: "approved",
        rank: "",
        displayName: "",
        revision: 1,
        lastAudit: "",
        updatedAt: new Date(),
      });
    for (const id of [uid, owner, other]) {
      await setDoc(doc(d, `profiles/${id}`), {
        uid: id,
        dofusName: "Spieler",
        discordName: "spieler99",
        server: "Test",
        mainCharacterId: "",
        updatedAt: new Date(),
      });
      await setDoc(doc(d, `users/${id}/account/consent`), {
        legalVersion: "seed",
        legalAcceptedAt: new Date(),
      });
    }
    await setDoc(doc(d, `roles/${owner}`), { role: "owner" });
    await setDoc(doc(d, "listings/l"), listing());
  });
});
after(async () => env?.cleanup());
test("anonymous visitor can read configuration but no guild data", async () => {
  const d = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(d, "platform/legal")));
  await assertFails(getDoc(doc(d, "memberships/member")));
});
test("unverified user cannot read private cloud records", async () =>
  assertFails(getDoc(doc(db(uid, false), `users/${uid}/records/r`))));
test("owner alone can read personal data; administrators cannot", async () => {
  await assertSucceeds(getDoc(doc(db(uid), `users/${uid}/records/r`)));
  await assertFails(getDoc(doc(db(owner), `users/${uid}/records/r`)));
  await assertFails(getDoc(doc(db(other), `users/${uid}/records/r`)));
});
test("private records enforce monotonic revisions and owner", async () => {
  const d = db(uid),
    ref = doc(d, `users/${uid}/records/r`),
    r = {
      key: "favorites",
      payload: "[]",
      revision: 1,
      mutationId: "m",
      deviceId: "d",
      deleted: false,
      updatedAt: serverTimestamp(),
    };
  await assertSucceeds(setDoc(ref, r));
  await assertFails(
    updateDoc(ref, { revision: 3, updatedAt: serverTimestamp() }),
  );
  await assertSucceeds(
    updateDoc(ref, {
      revision: 2,
      deleted: true,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(setDoc(doc(db(other), `users/${uid}/records/x`), r));
});
test("self escalation and self approval are denied", async () => {
  await assertFails(
    setDoc(doc(db(other), `roles/${other}`), { role: "owner" }),
  );
  await assertFails(
    updateDoc(doc(db(uid), `memberships/${uid}`), {
      status: "approved",
      revision: 2,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(deleteDoc(doc(db(owner), `roles/${owner}`)));
});
test("outsiders cannot read guild listings; verified users can read global", async () => {
  await assertFails(getDoc(doc(db(other), "listings/l")));
  await env.withSecurityRulesDisabled((c) =>
    setDoc(doc(c.firestore(), "listings/g"), { ...listing("global"), id: "g" }),
  );
  await assertSucceeds(getDoc(doc(db(other), "listings/g")));
});
test("bounded queries and visibility filters are required", async () => {
  await assertFails(getDocs(collection(db(uid), "listings")));
  await assertSucceeds(
    getDocs(
      query(
        collection(db(other), "listings"),
        where("visibility", "==", "global"),
        limit(25),
      ),
    ),
  );
});
test("fresh owner edit requires exact immutable audit in same batch", async () => {
  const d = db(owner),
    ref = doc(d, "platform/config"),
    before = (await getDoc(ref)).data()!,
    after = {
      ...before,
      guildName: "Gilde",
      revision: 2,
      lastAudit: "a",
      updatedAt: serverTimestamp(),
    };
  await assertFails(setDoc(ref, after));
  const batch = writeBatch(d);
  batch.set(ref, after);
  batch.set(doc(d, "audit/a"), {
    actorUid: owner,
    target: "platform/config",
    before,
    after,
    reason: "Einrichtung",
    createdAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(doc(d, "audit/a"), { reason: "Manipuliert" }));
  await assertFails(deleteDoc(doc(d, "audit/a")));
});
test("stale admin authentication cannot perform privileged mutations", async () => {
  const d = db(owner, true, now - 1000);
  await assertFails(
    updateDoc(doc(d, "platform/config"), {
      guildName: "Manipuliert",
      revision: 2,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(getDocs(query(collection(d, "audit"), limit(25))));
});
test("fake admin UI does not grant database privileges", async () =>
  assertFails(
    updateDoc(doc(db(other), "platform/config"), {
      guildName: "x",
      revision: 2,
      updatedAt: serverTimestamp(),
    }),
  ));
test("registration stays blocked without approved legal configuration", async () => {
  const d = db("signup"),
    batch = writeBatch(d);
  batch.set(doc(d, "profiles/signup"), {
    uid: "signup",
    dofusName: "Test",
    discordName: "test99",
    server: "Test",
    mainCharacterId: "",
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(d, "users/signup/account/consent"), {
    legalVersion: "v1",
    legalAcceptedAt: serverTimestamp(),
  });
  await assertFails(batch.commit());
});
test("profile validation blocks roles, forged verification and missing names", async () => {
  await env.withSecurityRulesDisabled((c) =>
    updateDoc(doc(c.firestore(), "platform/legal"), {
      registrationEnabled: true,
      legalVersion: "v1",
      privacyUrl: "https://example.org/privacy",
      termsUrl: "https://example.org/terms",
    }),
  );
  const d = db("signup"),
    p = {
      uid: "signup",
      dofusName: "Test",
      discordName: "test99",
      server: "Test",
      mainCharacterId: "",
      updatedAt: serverTimestamp(),
    };
  const create = async (profile: Record<string, unknown>) => {
    const batch = writeBatch(d);
    batch.set(doc(d, "profiles/signup"), profile);
    batch.set(doc(d, "users/signup/account/consent"), {
      legalVersion: "v1",
      legalAcceptedAt: serverTimestamp(),
    });
    await batch.commit();
  };
  await assertFails(create({ ...p, role: "admin" }));
  await assertFails(create({ ...p, discordName: "" }));
  await assertSucceeds(create(p));
  await assertFails(
    updateDoc(doc(d, "profiles/signup"), {
      discordUserId: "123",
      verified: true,
    }),
  );
});
test("legal consent receipts are private even from administrators", async () => {
  await assertSucceeds(getDoc(doc(db(uid), `users/${uid}/account/consent`)));
  await assertFails(getDoc(doc(db(owner), `users/${uid}/account/consent`)));
  await assertFails(getDoc(doc(db(other), `users/${uid}/account/consent`)));
});

test("unbounded or spoofed notifications are rejected", async () => {
  await assertFails(
    setDoc(doc(db(other), `users/${uid}/notifications/n`), {
      kind: "membership",
      subjectId: uid,
      text: "Hi",
      read: false,
      actorUid: other,
      createdAt: serverTimestamp(),
    }),
  );
});
async function seedReservation(id: string, quantity: number, buyer = "buyer") {
  await env.withSecurityRulesDisabled((c) =>
    setDoc(doc(c.firestore(), `reservations/${id}`), {
      id,
      listingId: "l",
      sellerUid: uid,
      buyerUid: buyer,
      quantity,
      state: "requested",
      revision: 1,
      lastAudit: "",
      updatedAt: new Date(),
    }),
  );
}
async function accept(id: string) {
  const d = db(uid);
  return runTransaction(d, async (tx) => {
    const rr = doc(d, `reservations/${id}`),
      lr = doc(d, "listings/l"),
      r = await tx.get(rr),
      l = await tx.get(lr);
    if (l.data()!.available < r.data()!.quantity) throw Error("insufficient");
    tx.update(rr, {
      state: "accepted",
      revision: r.data()!.revision + 1,
      updatedAt: serverTimestamp(),
    });
    tx.update(lr, {
      available: l.data()!.available - r.data()!.quantity,
      lastReservation: id,
      revision: l.data()!.revision + 1,
      updatedAt: serverTimestamp(),
    });
  });
}
test("seller cannot forge inventory without reservation", async () =>
  assertFails(
    updateDoc(doc(db(uid), "listings/l"), {
      available: 100,
      revision: 2,
      updatedAt: serverTimestamp(),
    }),
  ));
test("reservations cannot change inventory without atomic counterpart", async () => {
  await seedReservation("r", 3);
  await assertFails(
    updateDoc(doc(db(uid), "reservations/r"), {
      state: "accepted",
      revision: 2,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(accept("r"));
  assert.equal((await getDoc(doc(db(uid), "listings/l"))).data()!.available, 2);
});
test("concurrent reservations cannot oversell", async () => {
  await seedReservation("r1", 4, "b1");
  await seedReservation("r2", 4, "b2");
  const results = await Promise.allSettled([accept("r1"), accept("r2")]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await getDoc(doc(db(uid), "listings/l"))).data()!.available, 1);
});
test("buyers cannot approve their own reservations", async () => {
  await seedReservation("r", 2, other);
  await assertFails(
    updateDoc(doc(db(other), "reservations/r"), {
      state: "accepted",
      revision: 2,
      updatedAt: serverTimestamp(),
    }),
  );
});
test("guild admin cannot edit another user's global listing", async () => {
  await env.withSecurityRulesDisabled((c) =>
    setDoc(doc(c.firestore(), "listings/l"), listing("global")),
  );
  await assertFails(
    updateDoc(doc(db(owner), "listings/l"), {
      price: 1,
      revision: 2,
      updatedAt: serverTimestamp(),
    }),
  );
});
test("removed guild members lose access immediately", async () => {
  await assertSucceeds(getDoc(doc(db(uid), "listings/l")));
  await env.withSecurityRulesDisabled((c) =>
    Promise.all([
      updateDoc(doc(c.firestore(), `memberships/${uid}`), {
        status: "removed",
      }),
      setDoc(doc(c.firestore(), "listings/foreign"), {
        ...listing(),
        id: "foreign",
        ownerUid: owner,
      }),
    ]),
  );
  await assertFails(getDoc(doc(db(uid), "listings/foreign")));
  // Former members must still be able to close their own trading obligations.
  await assertSucceeds(getDoc(doc(db(uid), "listings/l")));
});
test("activity capacity and self-only participation are enforced", async () => {
  const d = db(uid),
    event = {
      id: "e",
      kind: "group",
      ownerUid: uid,
      title: "Run",
      description: "",
      server: "Test",
      startsAt: new Date().toISOString(),
      timezone: "Europe/Berlin",
      meeting: "",
      dungeonId: 1,
      minLevel: 100,
      capacity: 1,
      joined: 0,
      participants: {},
      status: "open",
      revision: 1,
      lastAudit: "",
      updatedAt: serverTimestamp(),
    };
  await assertSucceeds(setDoc(doc(d, "activities/e"), event));
  await assertFails(
    updateDoc(doc(d, "activities/e"), {
      participants: {
        [other]: {
          characterId: "c",
          name: "Test",
          level: 200,
          role: "Tank",
          status: "joined",
        },
      },
      joined: 1,
      revision: 2,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    updateDoc(doc(d, "activities/e"), {
      participants: {
        [uid]: {
          characterId: "c",
          name: "Test",
          level: 200,
          role: "Tank",
          status: "joined",
        },
      },
      joined: 1,
      revision: 2,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(d, "activities/e"), {
      joined: 2,
      revision: 3,
      updatedAt: serverTimestamp(),
    }),
  );
});
