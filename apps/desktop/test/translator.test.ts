import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultLayouts, normalizeLayouts } from "../src/v2/overlay/model.js";
import {
  normalizeTranslator,
  translatorDefaults,
} from "../src/v4/translator/model.js";

test("old overlay layouts gain exactly two disabled independent translator cards", () => {
  const original = defaultLayouts();
  original.profiles[0].modules = original.profiles[0].modules.filter(
    (m) => !m.id.startsWith("translator-"),
  );
  const updated = normalizeLayouts(original);
  const cards = updated.profiles[0].modules.filter((m) =>
    m.id.startsWith("translator-"),
  );
  assert.equal(cards.length, 2);
  assert.ok(cards.every((m) => !m.enabled));
  assert.deepEqual(cards[0].translator, translatorDefaults());
  assert.deepEqual(cards[1].translator, translatorDefaults(true));
});

test("duplicate and unknown overlay translator IDs cannot create a third card", () => {
  const layouts = defaultLayouts();
  layouts.profiles[0].modules.push({
    ...layouts.profiles[0].modules.find((m) => m.id === "translator-incoming")!,
  });
  const result = normalizeLayouts(layouts);
  assert.equal(
    result.profiles[0].modules.filter((m) => m.id.startsWith("translator-"))
      .length,
    2,
  );
});

test("language validation prevents equal language pairs and preserves automatic/minimized flags", () => {
  assert.deepEqual(
    normalizeTranslator({
      source: "fr",
      target: "fr",
      automatic: true,
      minimized: true,
    }),
    { source: "fr", target: "de", automatic: true, minimized: true },
  );
  const incoming = translatorDefaults(),
    outgoing = translatorDefaults(true);
  incoming.source = "en";
  assert.equal(outgoing.source, "de");
});
