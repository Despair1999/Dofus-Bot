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
  kind: "buy" | "sell";
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
  cost: number;
  realized: number;
  sold: number;
  purchased: number;
};
type Lot = { quantity: number; cost: number };
/** FIFO; purchase fees are cost, sale fees reduce revenue. */
export function portfolio(trades: Trade[]): Position[] {
  const positions = new Map<string, Position>();
  const lots = new Map<string, Lot[]>();
  const ordered = [...trades].sort((a, b) =>
    a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  for (const trade of ordered) {
    if (!isQuantity(trade.quantity) || !isMoney(trade.total) || !isMoney(trade.fees)) continue;
    const key = itemKey(trade.item, trade.server);
    const pos = positions.get(key) ?? {
      key, item: trade.item, server: trade.server, quantity: 0,
      cost: 0, realized: 0, sold: 0, purchased: 0,
    };
    const stock = lots.get(key) ?? [];
    if (trade.kind === "buy") {
      stock.push({ quantity: trade.quantity, cost: trade.total + trade.fees });
      pos.quantity += trade.quantity;
      pos.purchased += trade.quantity;
      pos.cost += trade.total + trade.fees;
    } else {
      // Invalid historical oversells are not booked as profits.
      if (trade.quantity > pos.quantity) continue;
      let remaining = trade.quantity, cost = 0;
      while (remaining > 0 && stock.length) {
        const lot = stock[0];
        const take = Math.min(lot.quantity, remaining);
        const takenCost = take === lot.quantity
          ? lot.cost : Math.round(lot.cost * take / lot.quantity);
        lot.quantity -= take;
        lot.cost -= takenCost;
        cost += takenCost;
        remaining -= take;
        if (!lot.quantity) stock.shift();
      }
      pos.quantity -= trade.quantity;
      pos.cost -= cost;
      pos.sold += trade.quantity;
      pos.realized += trade.total - trade.fees - cost;
    }
    positions.set(key, pos);
    lots.set(key, stock);
  }
  return [...positions.values()].sort((a, b) => a.item.name.localeCompare(b.item.name));
}
export function canSell(journal: Journal, item: ItemRef, server: string, quantity: number) {
  const position = portfolio(journal.trades).find((p) => p.key === itemKey(item, server));
  return isQuantity(quantity) && quantity <= (position?.quantity ?? 0);
}
export function currentEstimate(journal: Journal, position: Position) {
  const observation = latestFor(journal, position.item, position.server);
  const best = observation ? unitOffers(observation)[0] : undefined;
  return best ? {
    unit: best.unit,
    value: Math.round(best.unit * position.quantity),
    observedAt: observation!.at,
  } : null;
}
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
        !isMoney(t.total) || !isMoney(t.fees) || !["buy", "sell"].includes(t.kind)) {
      throw Error("Ungültige Buchung im Backup.");
    }
  }
  for (const note of p.notes) {
    if (!note.id || !note.at || typeof note.text !== "string") throw Error("Ungültige Notiz.");
  }
  return p as Journal;
}
