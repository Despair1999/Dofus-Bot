import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getSecurityRules } from "firebase-admin/security-rules";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const projectId = "dofus-companion",
  bucket = "dofus-companion.firebasestorage.app",
  credential = applicationDefault();
initializeApp({ projectId, credential });
const result = {
  projectId,
  bucket,
  checkedAt: new Date().toISOString(),
  readOnly: true,
};
const check = async (name, fn) => {
  try {
    result[name] = await fn();
  } catch (error) {
    result[name] = { ok: false, code: error.code ?? "unavailable" };
  }
};
const token = await credential.getAccessToken();
const google = async (url, method = "GET", body) => {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw Object.assign(Error("Read-only Google preflight failed"), {
      code: response.status,
    });
  return response.json();
};
await check("owner", async () => {
  const u = await getAuth().getUserByEmail("sunbired@gmail.com"),
    r = await getFirestore().doc(`roles/${u.uid}`).get();
  return {
    uid: u.uid,
    verified: u.emailVerified,
    disabled: u.disabled,
    role: r.data()?.role ?? "member",
  };
});
await check("registration", async () => ({
  enabled:
    (await getFirestore().doc("platform/legal").get()).data()
      ?.registrationEnabled === true,
}));
await check("storage", async () => {
  const d = await google(
    `https://storage.googleapis.com/storage/v1/b/${bucket}`,
  );
  const acl = await google(
    `https://storage.googleapis.com/storage/v1/b/${bucket}/defaultObjectAcl`,
  );
  const iam = await google(
    `https://storage.googleapis.com/storage/v1/b/${bucket}/iam`,
  );
  return {
    name: d.name,
    location: d.location,
    storageClass: d.storageClass,
    publicAccessPrevention: d.iamConfiguration?.publicAccessPrevention,
    defaultObjectsPublic: (acl.items ?? []).some((a) =>
      ["allUsers", "allAuthenticatedUsers"].includes(a.entity),
    ),
    publicBucketBinding: (iam.bindings ?? []).some((b) =>
      b.members?.some((m) => ["allUsers", "allAuthenticatedUsers"].includes(m)),
    ),
  };
});
await check("crossServiceIAM", async () => {
  const d = await google(
    `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`,
    "POST",
    {},
  );
  return {
    enabled: (d.bindings ?? []).some(
      (b) =>
        b.role === "roles/firebaserules.firestoreServiceAgent" &&
        b.members?.includes(
          "serviceAccount:service-71206717810@gcp-sa-firebasestorage.iam.gserviceaccount.com",
        ),
    ),
  };
});
const fingerprint = (s) => createHash("sha256").update(s).digest("hex");
for (const [name, file, get] of [
  [
    "firestoreRules",
    "firestore.rules",
    () => getSecurityRules().getFirestoreRuleset(),
  ],
  [
    "storageRules",
    "storage.rules",
    () => getSecurityRules().getStorageRuleset(bucket),
  ],
])
  await check(name, async () => {
    const rules = await get();
    const content = rules.source.map((f) => f.content).join("\n");
    return {
      name: rules.name,
      sha256: fingerprint(content),
      matchesLocal:
        fingerprint(content) === fingerprint(readFileSync(file, "utf8")),
    };
  });
mkdirSync(".data", { recursive: true });
writeFileSync(
  ".data/community-preflight.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
