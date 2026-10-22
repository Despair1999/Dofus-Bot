import test from "node:test";
import assert from "node:assert/strict";
import {
  canSell, emptyJournal, importJournal, itemKey, latestFor,
  marketAdvice, parseOcrPrice, portfolio, unitOffers,
  type Observation, type Trade,
} from "../src/v4/market/model";

const item = { id: 123, category: "resources", name: "Geschliffener Saphir" };
const buy = (id: string, quantity: number, total: number, fees = 0): Trade => ({
  id, item, server: "Draconiros", at: "2026-10-22T10:00:00Z",
  kind: "buy", quantity, total, fees, note: "",
});
const sell = (id: string, quantity: number, total: number, fees = 0): Trade => ({
  id, item, server: "Draconiros", at: "2026-10-22T12:00:00Z",
  kind: "sell", quantity, total, fees, note: "",
});
test("Paketpreise werden je Stück verglichen", () => {
  const observation: Observation = {
    id: "one", item, server: "Draconiros", at: "2026-10-22T09:00:00Z",
    source: "manual", packs: { 1: 398, 10: 1997, 100: 29794 },
    average: 272, note: "",
  };
  assert.equal(unitOffers(observation)[0].size, 10);
  assert.equal(unitOffers(observation)[0].unit, 199.7);
});
test("FIFO rechnet Einkauf und Verkauf mit Gebühren korrekt ab", () => {
  const positions = portfolio([buy("b1", 10, 100, 5), sell("s1", 4, 80, 3)]);
  assert.equal(positions[0].quantity, 6);
  assert.equal(positions[0].cost, 63);
  assert.equal(positions[0].realized, 35);
});
test("Verkäufe dürfen Bestand nicht überschreiten", () => {
  const data = { ...emptyJournal(), trades: [buy("b", 5, 100)] };
  assert.equal(canSell(data, item, "Draconiros", 5), true);
  assert.equal(canSell(data, item, "Draconiros", 6), false);
  assert.equal(canSell(data, item, "anderer Server", 1), false);
});
test("Beobachtungen sind server- und itembezogen", () => {
  const observation: Observation = {
    id: "1", item, server: "Draconiros", at: "2026-10-22T09:00:00Z",
    source: "manual", packs: { 10: 2000 }, note: "",
  };
  const j = { ...emptyJournal(), observations: [observation] };
  assert.equal(latestFor(j, item, "Draconiros")?.id, "1");
  assert.equal(latestFor(j, item, "Tal Kasha"), undefined);
  assert.notEqual(itemKey(item, "Draconiros"), itemKey(item, "Tal Kasha"));
});
test("Hinweise basieren auf selbst eingetragenen Preisen", () => {
  const observation: Observation = {
    id: "1", item, server: "Draconiros", at: "2026-10-22T09:00:00Z",
    source: "manual", packs: { 10: 1900 }, average: 300, note: "",
  };
  const j = { ...emptyJournal(), observations: [observation], targets: {
    [itemKey(item, "Draconiros")]: { buyBelow: 200 },
  }};
  const tips = marketAdvice(j, item, "Draconiros", Date.parse("2026-10-22T10:00:00Z"));
  assert.ok(tips.some((tip) => tip.title.includes("Einkaufslimit")));
  assert.ok(tips.some((tip) => tip.title.includes("Referenzpreis")));
});
test("OCR schlägt nur eindeutig erkannte Durchschnittspreise vor", () => {
  assert.equal(parseOcrPrice("Durchschnittspreis: 1.297 Kamas"), 1297);
  assert.equal(parseOcrPrice("Unklare Zahl 32"), undefined);
});
test("Backups werden validiert", () => {
  const original = emptyJournal();
  assert.deepEqual(importJournal(JSON.stringify(original)), original);
  assert.throws(() => importJournal("{}"));
});
