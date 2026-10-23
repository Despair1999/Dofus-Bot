import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const projectId = "dofus-companion";
if (
  process.env.GOOGLE_CLOUD_PROJECT &&
  process.env.GOOGLE_CLOUD_PROJECT !== projectId
)
  throw Error("Falsches Zielprojekt.");
const apply = process.argv.includes("--apply");
if (!apply) {
  console.log(
    "Dry run: creates the configured owner role only after resolving sunbired@gmail.com through Firebase Admin Authentication and checking emailVerified. Existing guild configuration is preserved. Use --apply with trusted Application Default Credentials.",
  );
  process.exit(0);
}
initializeApp({ projectId, credential: applicationDefault() });
const user = await getAuth().getUserByEmail("sunbired@gmail.com");
if (!user.emailVerified || user.disabled)
  throw Error(
    "Der vorgesehene Besitzer muss eine bestätigte, aktive Firebase-Auth-Identität besitzen.",
  );
const db = getFirestore();
await db.runTransaction(async (tx) => {
  const legal = db.doc("platform/legal"),
    config = db.doc("platform/config"),
    role = db.doc(`roles/${user.uid}`),
    membership = db.doc(`memberships/${user.uid}`);
  const [current, existingRole, existingMembership, existingLegal] =
    await Promise.all([
      tx.get(config),
      tx.get(role),
      tx.get(membership),
      tx.get(legal),
    ]);
  if (existingRole.exists && existingRole.data().role !== "owner")
    throw Error(
      "Vorhandene abweichende Rolle: explizite Betreiberprüfung erforderlich.",
    );
  if (!existingLegal.exists)
    tx.create(legal, {
      registrationEnabled: false,
      privacyUrl: "",
      termsUrl: "",
      legalVersion: "",
      guildActive: true,
      revision: 1,
      lastAudit: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
  if (!current.exists)
    tx.create(config, {
      guildName: "",
      server: "",
      description: "",
      discordUrl: "",
      emblem: "",
      rules: "",
      admission: "",
      archived: false,
      revision: 1,
      lastAudit: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
  if (!existingRole.exists)
    tx.create(role, {
      role: "owner",
      assignedBy: "trusted-operator-bootstrap",
      updatedAt: FieldValue.serverTimestamp(),
    });
  if (!existingMembership.exists)
    tx.create(membership, {
      uid: user.uid,
      status: "approved",
      rank: "",
      displayName: "",
      revision: 1,
      lastAudit: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
  tx.create(db.collection("operatorAudit").doc(), {
    action: "owner-bootstrap",
    uid: user.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
});
console.log(
  "Besitzerrolle geprüft/eingerichtet; vorhandene Gildeneinstellungen wurden erhalten. Keine rechtliche Registrierung freigegeben.",
);
