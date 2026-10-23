import { useMemo, useState } from "react";
import { ArrowUpDown, ClipboardList, Layers3, PackagePlus, PackageMinus, Trash2, Info } from "lucide-react";
import ItemImage from "../../v2/shared/ItemImage";
import {
  bundleValue, currentEstimate, isMoney, isQuantity, itemKey, kama,
  type ItemRef, type Journal, type Position, type Trade,
} from "./model";
import "./warehouse.css";

type SortKey = "name" | "unit-asc" | "unit-desc" | "bundle-asc" | "bundle-desc" | "quantity-asc" | "quantity-desc" | "value-desc";
const fmt = (value: number) => value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
const sortOptions: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name A–Z" },
  { value: "unit-asc", label: "Stückpreis aufsteigend" },
  { value: "unit-desc", label: "Stückpreis absteigend" },
  { value: "bundle-asc", label: "Bündelpreis aufsteigend" },
  { value: "bundle-desc", label: "Bündelpreis absteigend" },
  { value: "quantity-asc", label: "Menge aufsteigend" },
  { value: "quantity-desc", label: "Menge absteigend" },
  { value: "value-desc", label: "Lagerwert absteigend" },
];

export default function WarehousePanel({ journal, positions, item, server, onPick, onAdd, onDelete }: {
  journal: Journal; positions: Position[]; item: ItemRef | null; server: string;
  onPick: (item: ItemRef, server: string) => void;
  onAdd: (entry: Trade) => void; onDelete: (id: string) => void;
}) {
  const [mode, setMode] = useState<"stock-in" | "stock-out">("stock-in");
  const [bundleCount, setBundleCount] = useState("1");
  const [packSize, setPackSize] = useState("100");
  const [unitPrice, setUnitPrice] = useState("");
  const [marketAverage, setMarketAverage] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [comment, setComment] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [query, setQuery] = useState("");
  const [filterServer, setFilterServer] = useState("all");
  const [status, setStatus] = useState("");
  const count = Number(bundleCount), size = Number(packSize);
  const totalQuantity = count * size;
  const price = Number(unitPrice), cost = Number(costPerUnit);
  const totalValue = totalQuantity * price, costTotal = totalQuantity * cost;
  const active = positions.find((p) => item && p.key === itemKey(item, server));
  const validCount = bundleCount !== "" && isQuantity(count) && isQuantity(size) && Number.isSafeInteger(totalQuantity);
  const validPrice = unitPrice === "" || (isMoney(price) && Number.isSafeInteger(totalValue));
  const validCost = costPerUnit === "" || (isMoney(cost) && Number.isSafeInteger(costTotal));
  const validAvg = marketAverage === "" || isMoney(Number(marketAverage));
  const canSubmit = !!item && !!server.trim() && validCount && validPrice && validCost && validAvg &&
    (mode === "stock-in" || totalQuantity <= (active?.quantity ?? 0));

  const warehouse = useMemo(() => positions.filter((p) => p.quantity > 0)
    .map((position) => {
      const estimate = currentEstimate(journal, position);
      const recent = journal.trades.filter((t) => t.kind === "stock-in" &&
        itemKey(t.item, t.server) === position.key).sort((a, b) => b.at.localeCompare(a.at))[0];
      const preferredPack = recent?.packSize ?? 1;
      return { position, estimate, preferredPack, perUnit: estimate?.unit ?? null,
        perBundle: estimate ? bundleValue(estimate.unit, preferredPack) : null };
    }).filter((r) => (filterServer === "all" || r.position.server === filterServer) &&
      r.position.item.name.toLocaleLowerCase("de").includes(query.trim().toLocaleLowerCase("de")))
    .sort((a, b) => {
      const compare = (field: "perUnit" | "perBundle", desc: boolean) => {
        const av = a[field], bv = b[field];
        if (av === null) return bv === null ? 0 : 1;
        if (bv === null) return -1;
        return desc ? bv - av : av - bv;
      };
      let difference = 0;
      switch (sortBy) {
        case "unit-asc": difference = compare("perUnit", false); break;
        case "unit-desc": difference = compare("perUnit", true); break;
        case "bundle-asc": difference = compare("perBundle", false); break;
        case "bundle-desc": difference = compare("perBundle", true); break;
        case "quantity-asc": difference = a.position.quantity - b.position.quantity; break;
        case "quantity-desc": difference = b.position.quantity - a.position.quantity; break;
        case "value-desc": difference = (b.estimate?.value ?? -1) - (a.estimate?.value ?? -1); break;
      }
      return difference || a.position.item.name.localeCompare(b.position.item.name, "de");
    }), [positions, journal, sortBy, filterServer, query]);
  const servers = [...new Set(positions.map((p) => p.server))].sort();
  const movements = journal.trades.filter((t) => t.kind === "stock-in" || t.kind === "stock-out");
  const marketValue = warehouse.reduce((sum, r) => sum + (r.estimate?.value ?? 0), 0);
  const missing = warehouse.filter((r) => r.estimate === null).length;

  function submit() {
    if (!canSubmit || !item) { setStatus("Bitte ein Item auswählen und alle Mengen/Preise prüfen."); return; }
    const removing = mode === "stock-out";
    onAdd({
      id: crypto.randomUUID(), at: new Date().toISOString(), item, server: server.trim(),
      kind: mode, quantity: totalQuantity, fees: 0, packSize: size,
      total: !removing && costPerUnit !== "" ? costTotal : 0,
      costBasisKnown: !removing && costPerUnit !== "",
      valuationUnitPrice: !removing && unitPrice !== "" ? price : undefined,
      referenceAverage: !removing && marketAverage !== "" ? Number(marketAverage) : undefined,
      note: comment.trim(),
    });
    setStatus(removing ? "Bestand ohne Verkauf ausgebucht." : "Vorhandener Besitz ohne Kaufbuchung erfasst.");
    setBundleCount("1"); setCostPerUnit(""); setComment("");
  }
  return <div className="warehouse-workspace">
    <div className="warehouse-summary">
      <div><small>Gegenstände im Lager</small><strong>{fmt(warehouse.length)}</strong></div>
      <div><small>Gesamte Stückzahl</small><strong>{fmt(warehouse.reduce((sum,r) => sum+r.position.quantity,0))}</strong></div>
      <div><small>Geschätzter Lagerwert</small><strong>{kama(marketValue)}</strong></div>
      <div><small>Ohne Preisbewertung</small><strong>{fmt(missing)}</strong></div>
    </div>
    <section className="panel warehouse-entry">
      <div className="warehouse-heading"><div><h3><Layers3 size={19}/> Warenbestand verwalten</h3>
        <p>Dein vorhandenes Inventar erfassen, Mengen korrigieren und Buchungen nachvollziehen.</p></div>
        <div className="warehouse-mode" role="group" aria-label="Lageraktion">
          <button className={mode === "stock-in" ? "is-active" : ""} onClick={() => setMode("stock-in")}><PackagePlus size={16}/> Bestand hinzufügen</button>
          <button className={mode === "stock-out" ? "is-active" : ""} onClick={() => setMode("stock-out")}><PackageMinus size={16}/> Bestand entfernen</button>
        </div>
      </div>
      <div className="warehouse-item-label">
        {item ? <><ItemImage item={item} size={36}/><span><strong>{item.name}</strong><small>{server} · ausgewählt</small></span></> :
          <span><strong>Kein Gegenstand gewählt</strong><small>Oben einen Gegenstand suchen oder Lagerzeile auswählen.</small></span>}
        {active && <span className="warehouse-available">Aktuell: {fmt(active.quantity)} Stück</span>}
      </div>
      <div className="warehouse-form-grid">
        <label>Anzahl Bündel<input type="number" min="1" step="1" value={bundleCount} onChange={(e) => setBundleCount(e.target.value)}/></label>
        <label>Stück pro Bündel<select value={packSize} onChange={(e) => setPackSize(e.target.value)}>
          <option value="1">×1</option><option value="10">×10</option><option value="100">×100</option><option value="1000">×1000</option>
        </select></label>
        <div className="warehouse-derived"><small>Gesamtmenge</small><strong>{validCount ? fmt(totalQuantity) : "—"} Stück</strong></div>
        {mode === "stock-in" && <>
          <label>Geschätzter Preis je Einheit (Kamas)<input type="number" min="0" step="1" value={unitPrice} placeholder="Optional" onChange={(e) => setUnitPrice(e.target.value)}/></label>
          <label>Angezeigter Ø-Marktpreis (Kamas)<input type="number" min="0" step="1" value={marketAverage} placeholder="Optional" onChange={(e) => setMarketAverage(e.target.value)}/></label>
          <label>Ursprünglicher Einstand je Einheit (Kamas)<input type="number" min="0" step="1" value={costPerUnit} placeholder="Falls bekannt" onChange={(e) => setCostPerUnit(e.target.value)}/></label>
          <div className="warehouse-derived"><small>Wert pro Bündel</small><strong>{unitPrice !== "" && validPrice ? kama(size * price) : "—"}</strong></div>
          <div className="warehouse-derived"><small>Geschätzter Gesamtwert</small><strong>{unitPrice !== "" && validPrice && validCount ? kama(totalValue) : "—"}</strong></div>
          <div className="warehouse-derived"><small>Historische Kosten</small><strong>{costPerUnit !== "" && validCost && validCount ? kama(costTotal) : "Unbekannt"}</strong></div>
        </>}
      </div>
      <label className="warehouse-note">Notiz zur Bewegung<textarea rows={2} maxLength={1500} value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder={mode === "stock-in" ? "z. B. vorhandene Ressourcen" : "z. B. Fehleintrag, Craftingverbrauch"}/></label>
      <div className="warehouse-footer"><button disabled={!canSubmit} onClick={submit}>
        {mode === "stock-in" ? <PackagePlus size={17}/> : <PackageMinus size={17}/>}
        {mode === "stock-in" ? "Bestand hinzufügen" : "Bestand ohne Verkauf entfernen"}</button>
        <small><Info size={14}/> Bestandskorrekturen sind keine Käufe oder Verkäufe. Preise bleiben Schätzungen.</small>
      </div>
      {status && <p className="warehouse-status" role="status">{status}</p>}
    </section>
    <section className="panel warehouse-list">
      <div className="warehouse-heading"><div><h3><ClipboardList size={19}/> Dein Warenlager</h3><p>Wert, Menge und Bündelpreis auf einen Blick.</p></div></div>
      <div className="warehouse-filters">
        <label>Item filtern<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Itemname"/></label>
        <label>Server<select value={filterServer} onChange={(e) => setFilterServer(e.target.value)}><option value="all">Alle Server</option>{servers.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label><ArrowUpDown size={15}/> Sortieren<select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>{sortOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
      </div>
      <div className="market-scroll"><table className="warehouse-table"><thead><tr><th>Gegenstand</th><th>Server</th><th>Menge</th><th>Preis/Stück</th><th>Preis/Bündel</th><th>Lagerwert</th><th>Einstand</th><th>Aktion</th></tr></thead>
        <tbody>{warehouse.map(({position,estimate,preferredPack,perUnit,perBundle}) =>
          <tr key={position.key}><td><button className="market-item-button" onClick={() => onPick(position.item, position.server)}><ItemImage item={position.item} size={32}/><strong>{position.item.name}</strong></button></td>
            <td>{position.server}</td><td>{fmt(position.quantity)}</td><td>{perUnit === null ? "—" : fmt(perUnit)+" K"}</td>
            <td>{perBundle === null ? "—" : <>{kama(perBundle)}<small>×{preferredPack}</small></>}</td>
            <td>{estimate ? <>{kama(estimate.value)}<small>{estimate.source}</small></> : "Unbekannt"}</td>
            <td>{position.unknownQuantity > 0 ? <>{position.cost ? kama(position.cost) : "Unbekannt"}<small>{fmt(position.unknownQuantity)} ohne Einstand</small></> : kama(position.cost)}</td>
            <td><button className="secondary" onClick={() => { onPick(position.item, position.server); setMode("stock-out"); setBundleCount("1"); setPackSize("1"); }}>Korrigieren</button></td></tr>
        )}</tbody></table></div>
      {!warehouse.length && <div className="warehouse-empty"><PackagePlus size={26}/><strong>Warenlager ist noch leer</strong><span>Oben Item auswählen und vorhandenen Bestand eintragen – ohne Kauf.</span></div>}
      {missing > 0 && <p className="warehouse-caution"><Info size={16}/> Der angezeigte Lagerwert enthält nur bewertete Positionen. {missing} Item(s) haben keinen Preis.</p>}
    </section>
    <section className="panel warehouse-history"><h3><ClipboardList size={19}/> Bestandsbewegungen</h3>
      <p>Fehlerhafte Einträge können gelöscht werden, sofern nachfolgende Verkäufe und Entnahmen weiterhin gedeckt sind.</p>
      <div className="market-scroll"><table><thead><tr><th>Datum</th><th>Item</th><th>Art</th><th>Menge</th><th>Preis/Stück</th><th>Notiz</th><th/></tr></thead>
      <tbody>{movements.map((t) => <tr key={t.id}><td>{new Date(t.at).toLocaleString("de-DE")}</td><td>{t.item.name}<small>{t.server}</small></td>
        <td>{t.kind === "stock-in" ? "Zugang ohne Kauf" : "Abgang ohne Verkauf"}</td>
        <td>{(t.kind === "stock-in" ? "+" : "−")+fmt(t.quantity)}</td>
        <td>{t.valuationUnitPrice === undefined ? "—" : kama(t.valuationUnitPrice)}</td>
        <td className="warehouse-remark">{t.note || "—"}</td>
        <td><button className="icon-button" title="Fehlbuchung rückgängig machen" aria-label="Lagerbuchung löschen" onClick={() => onDelete(t.id)}><Trash2 size={16}/></button></td>
      </tr>)}</tbody></table></div>{movements.length === 0 && <p>Noch keine Bestandskorrekturen.</p>}
    </section>
  </div>;
}
