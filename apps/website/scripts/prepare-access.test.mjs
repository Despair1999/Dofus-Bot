import test from "node:test";
import assert from "node:assert/strict";
import { prepareAccess } from "./prepare-access.mjs";

test("preview redeploy retains the live verifier without obtaining the password", async () => {
  const expected = await prepareAccess({
    password: "test-preview-only-password",
  });
  let called = false;
  const result = await prepareAccess({
    reuseLive: true,
    fetcher: async (url, options) => {
      called = true;
      assert.equal(url, "https://dofus-companion.web.app/access-config.json");
      assert.equal(options.redirect, "error");
      return new Response(JSON.stringify(expected));
    },
  });
  assert.ok(called);
  assert.deepEqual(result, expected);
});

test("preview reuse fails closed for unavailable, malformed or weak verifiers", async () => {
  const valid = await prepareAccess({ password: "test-preview-only-password" });
  for (const response of [
    new Response("", { status: 404 }),
    new Response("<html>"),
    new Response("x".repeat(2049)),
    new Response("null"),
    new Response(JSON.stringify({ ...valid, iterations: 1 })),
    new Response(JSON.stringify({ ...valid, verifier: "" })),
  ])
    await assert.rejects(
      prepareAccess({ reuseLive: true, fetcher: async () => response }),
    );
  await assert.rejects(
    prepareAccess({ reuseLive: true, password: "do-not-rotate-on-redeploy" }),
  );
  await assert.rejects(prepareAccess({}));
});
