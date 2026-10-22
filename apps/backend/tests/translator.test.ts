import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {
  LocalTranslator,
  registerTranslator,
  translationInput,
} from "../src/translator.js";

test("translation inputs support exactly six distinct language directions", () => {
  for (const source of ["de", "en", "fr"])
    for (const target of ["de", "en", "fr"])
      assert.equal(
        translationInput.safeParse({ source, target, text: "Test" }).success,
        source !== target,
      );
  assert.equal(
    translationInput.safeParse({ source: "es", target: "de", text: "Test" })
      .success,
    false,
  );
  assert.equal(
    translationInput.safeParse({
      source: "en",
      target: "de",
      text: "a".repeat(2001),
    }).success,
    false,
  );
});

test("missing local runtime gives useful status and install failure recovers", async () => {
  const translator = new LocalTranslator({
    python: "Z:/companion-missing-runtime/python.exe",
  });
  assert.equal((await translator.status()).runtimeAvailable, false);
  await translator.install();
  await new Promise((resolve) => setImmediate(resolve));
  const result = await translator.status();
  assert.equal(result.installing, false);
  assert.match(result.error!, /Runtime fehlt|runtime fehlt/i);
  await assert.rejects(
    translator.translate({ source: "fr", target: "de", text: "Bonjour" }),
    /runtime fehlt/i,
  );
  translator.close();
});

test("translator endpoint returns 503 for unavailable runtime, never fake text", async () => {
  const app = Fastify();
  await registerTranslator(
    app,
    new LocalTranslator({ python: "Z:/companion-missing-runtime/python.exe" }),
  );
  const response = await app.inject({
    method: "POST",
    url: "/api/translator/translate",
    payload: { source: "fr", target: "de", text: "Bonjour" },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().data, undefined);
  assert.match(response.json().error, /runtime fehlt/i);
  await app.close();
});
