import test from "node:test";
import assert from "node:assert/strict";
import { operator, privacy, terms, LEGAL_VERSION } from "../legal-content";
test("operator contact remains exactly as supplied; no inferred house number or company", () => {
  assert.deepEqual(operator, {
    project: "DOFUS Companion",
    name: "Niklas Peter",
    address: "Koblenzer Straße, 54411 Hermeskeil",
    email: "sunbired@gmail.com",
  });
  assert.equal(LEGAL_VERSION, "2026-10-23");
});
test("information covers real data scope, private history, US processing and user rights", () => {
  const all = privacy.flatMap((s) => s.paragraphs).join(" ");
  for (const text of [
    "US-EAST1",
    "eur3",
    "Firebase Authentication",
    "Löschmarker",
    "Marktjournal",
    "Widerspruch",
    "Session Storage",
    "api.dofusdu.de",
  ])
    assert.ok(all.includes(text), text);
  assert.ok(terms.length >= 8);
});
