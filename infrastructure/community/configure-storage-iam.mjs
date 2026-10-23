import { applicationDefault } from "firebase-admin/app";
import { mkdirSync, writeFileSync } from "node:fs";

const project = "dofus-companion";
const role = "roles/firebaserules.firestoreServiceAgent";
const member =
  "serviceAccount:service-71206717810@gcp-sa-firebasestorage.iam.gserviceaccount.com";
const token = await applicationDefault().getAccessToken();
async function call(action, body) {
  const r = await fetch(
    `https://cloudresourcemanager.googleapis.com/v1/projects/${project}:${action}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!r.ok)
    throw Error(`Storage cross-service IAM ${action}: HTTP ${r.status}`);
  return r.json();
}
const current = await call("getIamPolicy", {
  options: { requestedPolicyVersion: 3 },
});
const exists = current.bindings?.some(
  (b) => b.role === role && !b.condition && b.members?.includes(member),
);
if (!process.argv.includes("--apply")) {
  console.log(
    JSON.stringify({
      project,
      role,
      member,
      alreadyConfigured: exists,
      dryRun: true,
    }),
  );
} else if (exists)
  console.log(
    "Exact Storage service-agent role already configured; no changes.",
  );
else {
  mkdirSync(".data/community-production-before", { recursive: true });
  writeFileSync(
    ".data/community-production-before/iam.json",
    JSON.stringify(current, null, 2),
  );
  // Preserve all existing bindings, conditions and policy etag; never add broad user roles.
  const policy = structuredClone(current);
  const binding = policy.bindings.find((b) => b.role === role && !b.condition);
  if (binding) binding.members.push(member);
  else policy.bindings.push({ role, members: [member] });
  await call("setIamPolicy", { policy });
  const after = await call("getIamPolicy", {
    options: { requestedPolicyVersion: 3 },
  });
  if (
    !after.bindings.some(
      (b) => b.role === role && !b.condition && b.members.includes(member),
    )
  )
    throw Error("IAM role verification failed.");
  console.log(
    "Exact Storage service-agent cross-service role applied and verified; all other bindings preserved.",
  );
}
