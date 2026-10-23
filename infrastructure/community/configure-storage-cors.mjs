import assert from "node:assert/strict";
import { applicationDefault } from "firebase-admin/app";
import { mkdirSync, writeFileSync } from "node:fs";
const bucket = "dofus-companion.firebasestorage.app";
const policy = {
  origin: [
    "https://dofus-companion.web.app",
    "https://dofus-companion.firebaseapp.com",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "tauri://localhost",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
  ],
  method: ["GET", "HEAD", "POST", "PUT", "DELETE"],
  responseHeader: [
    "Content-Type",
    "Content-Length",
    "ETag",
    "X-Goog-Upload-Status",
    "X-Goog-Upload-URL",
    "X-Goog-Upload-Offset",
  ],
  maxAgeSeconds: 3600,
};
const credential = applicationDefault(),
  token = await credential.getAccessToken();
const call = async (method, url, body) => {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  assert.ok(response.ok, `Storage configuration HTTP ${response.status}`);
  return response.json();
};
const url = `https://storage.googleapis.com/storage/v1/b/${bucket}`,
  before = await call("GET", url);
assert.equal(before.name, bucket);
const cors = [
  ...(before.cors ?? []).filter(
    (row) => JSON.stringify(row) !== JSON.stringify(policy),
  ),
  policy,
];
if (!process.argv.includes("--apply")) {
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        bucket,
        oldPolicies: before.cors?.length ?? 0,
        requiredPolicy: policy,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
mkdirSync(".data/community-production-before", { recursive: true });
writeFileSync(
  `.data/community-production-before/storage-cors-${Date.now()}.json`,
  JSON.stringify(before, null, 2),
);
const after = await call(
  "PATCH",
  `${url}?ifMetagenerationMatch=${before.metageneration}`,
  { cors },
);
assert.deepEqual(after.cors, cors);
assert.equal(after.location, before.location);
writeFileSync(
  ".data/community-storage-cors.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      bucket,
      origins: policy.origin,
      methods: policy.method,
      existingPoliciesPreserved: true,
      locationPreserved: true,
    },
    null,
    2,
  ),
);
console.log(
  "Storage CORS configured for the existing website and Windows app; prior policies and bucket location preserved.",
);
