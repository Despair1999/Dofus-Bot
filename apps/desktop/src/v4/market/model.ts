/** Local, manually maintained DOFUS market journal. No game automation. */
export type ItemRef = {
  id?: number;
  name: string;
  category?: string;
  imageUrl?: string;
};
export type Observation = {
  id: string;
  item: ItemRef;
  server: string;
  at: string;
  source: "manual" | "ocr";
  packs: Record<string, number>;
  average?: number;
  volume?: number;
  note: string;
};
export type Trade = {
  id: string;
  item: ItemRef;
  server: string;
  at: string;
  kind: "buy" | "sell" | "stock-in" | "stock-out";
  /** Estimated current market price per unit on manual stock entry, not acquisition cost. */
  valuationUnitPrice?: number;
  packSize?: number;
  referenceAverage?: number;
  /** False when initial acquisition costs are unknown. */
  costBasisKnown?: boolean;
  quantity: number;
  total: number;
  fees: number;
  note: string;
};
export type JournalNote = {
  id: string;
  at: string;
  item: ItemRef | null;
  text: string;
};
export type Target = { buyBelow?: number; sellAbove?: number };
export type Journal = {
  version: 1;
  observations: Observation[];
  trades: Trade[];
  notes: JournalNote[];
  targets: Record<string, Target>;
};
export const emptyJournal = (): Journal => ({
  version: 1, observations: [], trades: [], notes: [], targets: {},
});
export const kama = (value: number): string =>
  Math.round(value).toLocaleString("de-DE") + " K";
export const itemKey = (item: ItemRef, server: string): string =>
  server.trim().toLowerCase() + ":" +
  (item.id !== undefined ? "id:" + item.id + ":" + (item.category ?? "") :
    "name:" + item.name.trim().toLowerCase());
export const isMoney = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;
export const isQuantity = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;
export const unitOffers = (observation: Observation) =>
  Object.entries(observation.packs)
    .map(([size, price]) => ({
      size: Number(size), total: price, unit: price / Number(size),
    }))
    .filter((entry) => isQuantity(entry.size) && isMoney(entry.total))
    .sort((a, b) => a.unit - b.unit);
export const latestFor = (journal: Journal, item: ItemRef, server: string) =>
  journal.observations.filter((o) => itemKey(o.item, o.server) === itemKey(item, server))
    .sort((a, b) => b.at.localeCompare(a.at))[0];

export type Position = {
  key: string;
  item: ItemRef;
  server: string;
  quantity: number;
  /** Documented acquisition costs only; exclude unknown historical costs. */
  cost: number;
  unknownQuantity: number;
  realized: number;
  unknownSoldQuantity: number;
  sold: number;
  purchased: number;
  stockAdded: number;
  stockRemoved: number;
};
type Lot = { quantity: number; cost: number; known: boolean };
const isInbound = (trade: Trade) => trade.kind === "buy" || trade.kind === "stock-in";
const isOutbound = (trade: Trade) => trade.kind === "sell" || trade.kind === "stock-out";
const orderedTrades = (trades: Trade[]) => trades.map((trade, index) => ({ trade, index }))
  .sort((a, b) => a.trade.at.localeCompare(b.trade.at) || b.index - a.index)
  .map(({ trade }) => trade);

/** FIFO: adds existing stock without inventing a purchase, removes stock without booking a sale. */
export function portfolio(trades: Trade[]): Position[] {
  const positions = new Map<string, Position>();
  const lots = new Map<string, Lot[]>();
  for (const trade of orderedTrades(trades)) {
    if (!isQuantity(trade.quantity) || !isMoney(trade.total) || !isMoney(trade.fees)) continue;
    const key = itemKey(trade.item, trade.server);
    const pos = positions.get(key) ?? {
      key, item: trade.item, server: trade.server, quantity: 0, cost: 0,
      unknownQuantity: 0, realized: 0, unknownSoldQuantity: 0,
      sold: 0, purchased: 0, stockAdded: 0, stockRemoved: 0,
    };
    const stock = lots.get(key) ?? [];
    if (isInbound(trade)) {
      const known = trade.kind === "buy" || trade.costBasisKnown === true;
      const basis = known ? trade.total + (trade.kind === "buy" ? trade.fees : 0) : 0;
      stock.push({ quantity: trade.quantity, cost: basis, known });
      pos.quantity += trade.quantity;
      if (known) pos.cost += basis;
      else pos.unknownQuantity += trade.quantity;
      if (trade.kind === "buy") pos.purchased += trade.quantity;
      else pos.stockAdded += trade.quantity;
    } else if (isOutbound(trade)) {
      if (trade.quantity > pos.quantity) continue;
      let remaining = trade.quantity, consumedCost = 0, consumedUnknown = 0;
      while (remaining > 0 && stock.length) {
        const lot = stock[0];
        const take = Math.min(lot.quantity, remaining);
        const share = take === lot.quantity
          ? lot.cost : Math.round(lot.cost * take / lot.quantity);
        lot.quantity -= take;
        lot.cost -= share;
        consumedCost += share;
        if (!lot.known) consumedUnknown += take;
        remaining -= take;
        if (lot.quantity === 0) stock.shift();
      }
      pos.quantity -= trade.quantity;
      pos.cost -= consumedCost;
      pos.unknownQuantity -= consumedUnknown;
      if (trade.kind === "sell") {
        pos.sold += trade.quantity;
        pos.unknownSoldQuantity += consumedUnknown;
        // Unknown basis is never claimed as a fully realized profit.
        pos.realized += trade.total - trade.fees - consumedCost;
      } else {
        pos.stockRemoved += trade.quantity;
      }
    }
    positions.set(key, pos);
    lots.set(key, stock);
  }
  return [...positions.values()].sort((a, b) => a.item.name.localeCompare(b.item.name));
}
/** Prevent deleting an entry when subsequent movements would oversell the stock. */
export function validateLedger(trades: Trade[]): string | null {
  const balances = new Map<string, number>();
  const ids = new Set<string>();
  for (const trade of orderedTrades(trades)) {
    if (!trade.id || ids.has(trade.id)) return "Doppelte oder leere Buchungs-ID.";
    ids.add(trade.id);
    if (!trade.item?.name || !trade.server.trim() ||
      !Number.isFinite(Date.parse(trade.at)) ||
      !isQuantity(trade.quantity) || !isMoney(trade.total) || !isMoney(trade.fees) ||
      !["buy", "sell", "stock-in", "stock-out"].includes(trade.kind)) {
      return "Ungültige Buchungsdaten.";
    }
    if (trade.valuationUnitPrice !== undefined && !isMoney(trade.valuationUnitPrice)) return "Ungültiger Lager-Stückpreis.";
    if (trade.packSize !== undefined && !isQuantity(trade.packSize)) return "Ungültige Bündelgröße.";
    if (trade.referenceAverage !== undefined && !isMoney(trade.referenceAverage)) return "Ungültiger Referenzpreis.";
    if (trade.kind === "stock-out" && (trade.total !== 0 || trade.fees !== 0)) return "Bestandskorrekturen dürfen keinen Verkauf buchen.";
    if (trade.kind === "sell" && trade.fees > trade.total) return "Gebühren übersteigen den Erlös.";
    const key = itemKey(trade.item, trade.server);
    const next = (balances.get(key) ?? 0) + (isInbound(trade) ? trade.quantity : -trade.quantity);
    if (next < 0) return "Eine spätere Entnahme oder ein Verkauf würde den Bestand überziehen.";
    balances.set(key, next);
  }
  return null;
}
export function canSell(journal: Journal, item: ItemRef, server: string, quantity: number) {
  const position = portfolio(journal.trades).find((p) => p.key === itemKey(item, server));
  return isQuantity(quantity) && quantity <= (position?.quantity ?? 0);
}
export function currentEstimate(journal: Journal, position: Position) {
  const observation = latestFor(journal, position.item, position.server);
  const offer = observation ? unitOffers(observation)[0] : undefined;
  const saved = orderedTrades(journal.trades).filter((trade) =>
    trade.kind === "stock-in" && (trade.valuationUnitPrice !== undefined || trade.referenceAverage !== undefined) &&
    itemKey(trade.item, trade.server) === position.key).at(-1);
  // Most recent explicitly recorded price (offer or manual warehouse valuation).
  const latestPrice = offer && observation && (!saved || observation.at >= saved.at)
    ? { unit: offer.unit, observedAt: observation.at, source: "Marktbeobachtung" }
    : saved && (saved.valuationUnitPrice !== undefined || saved.referenceAverage !== undefined)
      ? { unit: saved.valuationUnitPrice ?? saved.referenceAverage!, observedAt: saved.at,
          source: saved.valuationUnitPrice !== undefined ? "Lagerbewertung" : "Ø-Marktpreis (manuell)" }
      : offer && observation
        ? { unit: offer.unit, observedAt: observation.at, source: "Marktbeobachtung" }
        : null;
  if (!latestPrice) return null;
  return { ...latestPrice, value: Math.round(latestPrice.unit * position.quantity) };
}
export const bundleValue = (unit: number, size: number) => unit * size;

export type Advice = { tone: "info" | "warning" | "positive"; title: string; text: string };
export function marketAdvice(journal: Journal, item: ItemRef, server: string, now = Date.now()): Advice[] {
  const matching = journal.observations
    .filter((o) => itemKey(o.item, o.server) === itemKey(item, server))
    .sort((a, b) => b.at.localeCompare(a.at));
  const position = portfolio(journal.trades).find((p) => p.key === itemKey(item, server));
  const target = journal.targets[itemKey(item, server)];
  const latest = matching[0];
  const tips: Advice[] = [];
  if (!latest) {
    tips.push({ tone: "info", title: "Marktdaten fehlen",
      text: "Erfasse mindestens ein Angebot. Ohne eigene Beobachtungen sind keine Preisvergleiche möglich." });
    return tips;
  }
  const offers = unitOffers(latest);
  if (offers.length) {
    const best = offers[0];
    tips.push({ tone: "info", title: "Günstigste beobachtete Losgröße",
      text: "Paket ×" + best.size + ": " + kama(best.total) + " gesamt, " +
        best.unit.toLocaleString("de-DE", { maximumFractionDigits: 2 }) +
        " K pro Stück. Ein Angebot ist noch kein tatsächlich erzielter Verkaufspreis." });
    if (target?.buyBelow !== undefined && best.unit <= target.buyBelow) {
      tips.push({ tone: "positive", title: "Eigenes Einkaufslimit erreicht",
        text: "Das beobachtete Angebot liegt unter deinem Limit von " +
          kama(target.buyBelow) + ". Prüfe Nachfrage, Bestand und Handelsspanne vor einem Kauf." });
    }
    if (target?.sellAbove !== undefined && best.unit >= target.sellAbove) {
      tips.push({ tone: "info", title: "Persönliche Preiszielmarke",
        text: "Der beobachtete Angebotspreis erreicht dein Verkaufsziel. Verkaufserfolg und Verkaufsdauer sind unbekannt." });
    }
    if (latest.average && Math.abs(best.unit / latest.average - 1) > 0.35) {
      tips.push({ tone: "warning", title: "Abweichender Referenzpreis",
        text: "Das günstigste Angebot weicht deutlich vom eingetragenen Durchschnitt ab. Preisstatistiken können verzerrt sein; prüfe andere Beobachtungen und Volumen." });
    }
  }
  if (matching.length < 3) {
    tips.push({ tone: "warning", title: "Geringe Datenbasis",
      text: "Erst " + matching.length + " eigene Preisbeobachtung(en). Noch keine zuverlässige Trendanalyse möglich." });
  } else {
    const old = unitOffers(matching[matching.length - 1])[0]?.unit;
    const current = offers[0]?.unit;
    if (old && current && Math.abs(current / old - 1) > 0.25) {
      tips.push({ tone: "warning", title: "Starke Preisveränderung",
        text: "Zwischen ältester und neuester erfasster Beobachtung liegt eine Abweichung von " +
          ((current / old - 1) * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 }) +
          " %. Zeitpunkt und Stichprobenumfang berücksichtigen." });
    }
  }
  if (now - Date.parse(latest.at) > 3 * 86400_000) {
    tips.push({ tone: "warning", title: "Veraltete Preisbeobachtung",
      text: "Der jüngste erfasste Preis ist älter als drei Tage. Er ist möglicherweise nicht mehr aktuell." });
  }
  if (position?.quantity && position.cost > 0) {
    tips.push({ tone: "info", title: "Deine Kapitalbindung",
      text: kama(position.cost) + " Einkaufskosten in " + position.quantity +
        " Stück gebunden. Verkäufe, Gebühren und potenzielle Preisrückgänge einkalkulieren." });
  }
  return tips;
}
export function parseOcrPrice(text: string): number | undefined {
  const hit = text.match(/(?:durchschnittspreis|durchschnitts.?preis|average\s+price)\s*[:：]?\s*([\d.\s]+)\s*(?:₭|kamas|k\b)/i);
  if (!hit) return undefined;
  const value = Number(hit[1].replace(/[.\s]/g, ""));
  return isMoney(value) ? value : undefined;
}
export function importJournal(text: string): Journal {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") throw Error("Ungültiges Backup.");
  const p = parsed as Partial<Journal>;
  if (p.version !== 1 || !Array.isArray(p.observations) ||
      !Array.isArray(p.trades) || !Array.isArray(p.notes) ||
      !p.targets || typeof p.targets !== "object") {
    throw Error("Unbekannte Backup-Version oder beschädigte Daten.");
  }
  for (const o of p.observations) {
    if (!o.id || !o.item?.name || typeof o.server !== "string" ||
        !o.at || !o.packs || Object.values(o.packs).some((v) => !isMoney(v))) {
      throw Error("Ungültige Marktbeobachtung im Backup.");
    }
  }
  for (const t of p.trades) {
    if (!t.id || !t.item?.name || !t.at || !isQuantity(t.quantity) ||
        !isMoney(t.total) || !isMoney(t.fees) || !["buy", "sell", "stock-in", "stock-out"].includes(t.kind)) {
      throw Error("Ungültige Buchung im Backup.");
    }
  }
  // Keep existing v0.9.0 journals readable even if old transactions have inconsistent ordering.
  // Validate new edits separately, so user data is never discarded on startup.
  for (const note of p.notes) {
    if (!note.id || !note.at || typeof note.text !== "string") throw Error("Ungültige Notiz.");
  }
  return p as Journal;
}
