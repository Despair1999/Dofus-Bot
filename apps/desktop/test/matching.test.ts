import { test } from "node:test";
import assert from "node:assert/strict";
// Keep text recognition independent of browser storage for test execution.
import { normalize, matchText } from "../src/matching";
test("German and French normalization preserves words", () => {
  assert.equal(normalize("Épée — Stärke!"), "epee starke");
});
test("exact quest name in OCR outranks unrelated names", () => {
  const hits = matchText("Journal\nUne quête française\nObjectif", [
    { id: 1, name: "Une quête française" },
    { id: 2, name: "Eine andere Aufgabe" },
  ]);
  assert.equal(hits[0]?.id, 1);
  assert.ok(hits[0].score > 0.9);
});
test("empty screenshot never identifies a quest", () =>
  assert.deepEqual(matchText("", [{ id: 1, name: "Quest" }]), []));
test("French aliases use the same shared matching rules", () => {
  const hits = matchText("Épreuve de l’élève", [
    { id: 1, name: "Prüfung des Schülers", nameFr: "Épreuve de l’élève" },
  ]);
  assert.equal(hits[0]?.id, 1);
  assert.equal(hits[0]?.score, 1);
});
test("weak screenshot text leaves ambiguous candidates unselected", () =>
  assert.deepEqual(
    matchText("Journal", [{ id: 1, name: "Eine schwierige Quest" }]),
    [],
  ));
