import test from "node:test";
import assert from "node:assert/strict";
import {
  canSell, emptyJournal, importJournal, itemKey, latestFor,
  marketAdvice, parseOcrPrice, portfolio, unitOffers, currentEstimate, validateLedger, bundleValue, calculateStockValue,
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

test("1000er Losgröße und Stückpreis werden korrekt verglichen", () => {
  const observation: Observation = {
    id: "1000", item, server: "Draconiros", at: "2026-10-23T09:00:00Z",
    source: "manual", packs: { 1: 200, 10: 1800, 100: 16500, 1000: 150000 }, note: "",
  };
  assert.equal(unitOffers(observation)[0].size, 1000);
  assert.equal(unitOffers(observation)[0].unit, 150);
  assert.equal(bundleValue(150, 1000), 150000);
});
test("Vorhandenen Lagerbestand ohne Einkauf buchen und bewerten", () => {
  const stock: Trade = {
    id: "opening", at: "2026-10-23T09:00:00Z", item, server: "Draconiros",
    kind: "stock-in", quantity: 2000, packSize: 1000, total: 0, fees: 0,
    costBasisKnown: false, valuationUnitPrice: 35, referenceAverage: 30, note: "",
  };
  const j = { ...emptyJournal(), trades: [stock] };
  assert.equal(validateLedger(j.trades), null);
  const pos = portfolio(j.trades)[0];
  assert.equal(pos.purchased, 0);
  assert.equal(pos.stockAdded, 2000);
  assert.equal(pos.quantity, 2000);
  assert.equal(pos.cost, 0);
  assert.equal(pos.unknownQuantity, 2000);
  assert.equal(currentEstimate(j, pos)?.value, 70000);
});
test("Bestandsentnahme ohne Verkauf: keine Realisierung, kein negativer Bestand", () => {
  const add: Trade = { ...buy("start", 100, 1000), kind: "stock-in", costBasisKnown: true };
  const remove: Trade = { ...sell("correct", 40, 0), kind: "stock-out", fees: 0 };
  const positions = portfolio([remove, add]);
  assert.equal(validateLedger([remove, add]), null);
  assert.equal(positions[0].quantity, 60);
  assert.equal(positions[0].cost, 600);
  assert.equal(positions[0].realized, 0);
  assert.equal(positions[0].sold, 0);
  assert.equal(positions[0].stockRemoved, 40);
  assert.match(validateLedger([remove]) ?? "", /überziehen/);
});
test("Fehlbuchung darf nicht gelöscht werden, wenn dadurch ein späterer Verkauf ungedeckt wird", () => {
  const first: Trade = { ...buy("opening", 50, 0), kind: "stock-in", costBasisKnown: false };
  const sold = sell("sold", 20, 600);
  assert.equal(validateLedger([sold, first]), null);
  assert.ok(validateLedger([sold]));
  assert.equal(portfolio([sold, first])[0].unknownSoldQuantity, 20);
});
test("Bestandsbuchungen bleiben im JSON Backup rückwärtskompatibel", () => {
  const stock: Trade = { ...buy("old", 10, 0), kind: "stock-in",
    costBasisKnown: false, valuationUnitPrice: 200, packSize: 10 };
  const journal = { ...emptyJournal(), trades: [stock] };
  assert.equal(importJournal(JSON.stringify(journal)).trades[0].kind, "stock-in");
  const legacy = { ...emptyJournal(), trades: [buy("legacy", 5, 200)] };
  assert.equal(importJournal(JSON.stringify(legacy)).trades[0].kind, "buy");
});

test("Stückzahl mal Einzelpreis ergibt automatisch den Gesamtwert", () => {
  assert.deepEqual(calculateStockValue("2500", "135"), { quantity: 2500, price: 135, value: 337500 });
  assert.deepEqual(calculateStockValue("1", "0"), { quantity: 1, price: 0, value: 0 });
});
test("Einzelpreis und tatsächlich vorhandene Anzahl sind Pflicht", () => {
  for (const [quantity, price] of [["", "135"], ["2500", ""], ["0", "135"],
    ["-3", "135"], ["10.5", "135"], ["12", "-1"], ["1", "abc"],
    ["9007199254740992", "3"], ["9007199254740991", "2"]]) {
    assert.equal(calculateStockValue(quantity, price), null, `Invalid: ${quantity} / ${price}`);
  }
});
test("Bestand und geschätzter Wert bleiben nach bestehender Lagerbuchung korrekt", () => {
  const additions: Trade[] = [
    { ...buy("stock-old", 120, 0), kind: "stock-in", valuationUnitPrice: 135, costBasisKnown: false },
    { ...buy("stock-new", 2500, 0), at: "2026-10-23T13:00:00Z", kind: "stock-in",
      valuationUnitPrice: 135, costBasisKnown: false },
  ];
  const journal = { ...emptyJournal(), trades: additions };
  const p = portfolio(journal.trades)[0];
  assert.equal(p.quantity, 2620);
  assert.equal(p.cost, 0);
  assert.equal(p.unknownQuantity, 2620);
  assert.equal(currentEstimate(journal, p)?.value, 353700);
});
