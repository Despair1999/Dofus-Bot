import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
const [action, uid, value] = process.argv
  .slice(2)
  .filter((v) => v !== "--apply");
if (!["role", "discord-link"].includes(action) || !uid || !value)
  throw Error(
    "Aufruf: node infrastructure/community/operator.mjs role UID owner|admin|moderator|member [--apply] oder discord-link UID DISCORD_ID [--apply]",
  );
if (!process.argv.includes("--apply")) {
  console.log(
    "Dry run. Eine bestehende, verifizierte Auth-Identität wird vor der Änderung durch das Admin SDK geprüft. --apply erfordert vertrauenswürdige Application Default Credentials.",
  );
  process.exit(0);
}
initializeApp({
  projectId: "dofus-companion",
  credential: applicationDefault(),
});
const user = await getAuth().getUser(uid);
if (!user.emailVerified || user.disabled)
  throw Error("Bestätigte und aktive Firebase-Identität erforderlich.");
const db = getFirestore();
await db.runTransaction(async (tx) => {
  if (action === "role") {
    if (!["owner", "admin", "moderator", "member"].includes(value))
      throw Error("Ungültige Rolle.");
    const ref = db.doc(`roles/${uid}`),
      old = await tx.get(ref),
      owners = await tx.get(
        db.collection("roles").where("role", "==", "owner").limit(2),
      );
    if (old.data()?.role === "owner" && value !== "owner" && owners.size <= 1)
      throw Error("Der letzte Besitzer darf nicht herabgestuft werden.");
    tx.set(ref, {
      role: value,
      assignedBy: "trusted-operator",
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.create(db.collection("operatorAudit").doc(), {
      action: "role-change",
      uid,
      before: old.data()?.role ?? "member",
      after: value,
      createdAt: FieldValue.serverTimestamp(),
    });
  } else {
    if (!/^\d{17,22}$/.test(value))
      throw Error(
        "Eine echte Discord-Snowflake-ID ist erforderlich; ein Benutzername reicht nicht.",
      );
    const link = db.doc(`discordLinks/${value}`),
      identity = db.doc(`discordIdentities/${uid}`),
      [old, mapping] = await Promise.all([tx.get(link), tx.get(identity)]);
    if (old.exists && old.data().uid !== uid)
      throw Error(
        "Discord-ID ist bereits anderweitig zugeordnet. Zuerst getrennt prüfen und aufheben.",
      );
    if (mapping.exists && mapping.data().discordId !== value)
      throw Error("Account besitzt bereits eine andere Discord-Zuordnung.");
    tx.set(link, {
      uid,
      source: "operator-confirmed",
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(identity, {
      discordId: value,
      source: "operator-confirmed",
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.create(db.collection("operatorAudit").doc(), {
      action: "discord-link",
      uid,
      discordId: value,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
});
console.log(
  "Geschützte Betreiberänderung protokolliert. Es wurden keine Discord-Nachrichten versandt.",
);
