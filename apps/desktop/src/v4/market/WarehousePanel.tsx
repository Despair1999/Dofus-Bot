import { useMemo, useState } from "react";
import { ArrowUpDown, ClipboardList, Layers3, PackagePlus, PackageMinus, Trash2, Info } from "lucide-react";
import ItemImage from "../../v2/shared/ItemImage";
import {
  calculateStockValue, currentEstimate, isMoney, isQuantity, itemKey, kama,
  type ItemRef, type Journal, type Position, type Trade,
} from "./model";
import "./warehouse.css";

type SortKey = "name" | "unit-asc" | "unit-desc" | "quantity-asc" | "quantity-desc" | "value-asc" | "value-desc";
const fmt = (value: number) => value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
const sortOptions: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name A–Z" },
  { value: "unit-asc", label: "Stückpreis aufsteigend" },
  { value: "unit-desc", label: "Stückpreis absteigend" },
  { value: "value-asc", label: "Gesamtwert aufsteigend" },
  { value: "value-desc", label: "Gesamtwert absteigend" },
  { value: "quantity-asc", label: "Menge aufsteigend" },
  { value: "quantity-desc", label: "Menge absteigend" },
  { value: "value-desc", label: "Lagerwert absteigend" },
];

export default function WarehousePanel({ journal, positions, item, server, onPick, onAdd, onDelete }: {
  journal: Journal; positions: Position[]; item: ItemRef | null; server: string;
  onPick: (item: ItemRef, server: string) => void;
  onAdd: (entry: Trade) => boolean; onDelete: (id: string) => void;
}) {
  const [mode, setMode] = useState<"stock-in" | "stock-out">("stock-in");
  const [quantityText, setQuantityText] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [comment, setComment] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [query, setQuery] = useState("");
  const [filterServer, setFilterServer] = useState("all");
  const [status, setStatus] = useState("");
  const entered = calculateStockValue(quantityText, unitPrice);
  const quantity = Number(quantityText);
  const cost = Number(costPerUnit);
  const active = positions.find((p) => item && p.key === itemKey(item, server));
  const validQuantity = quantityText.trim() !== "" && isQuantity(quantity);
  const validCost = costPerUnit.trim() === "" ||
    (isMoney(cost) && !!entered && Number.isSafeInteger(entered.quantity * cost));
  const canSubmit = !!item && !!server.trim() && (mode === "stock-in"
    ? entered !== null && validCost
    : validQuantity && quantity <= (active?.quantity ?? 0));
  const afterQuantity = active && entered ? active.quantity + entered.quantity : entered?.quantity ?? null;
  const afterValue = afterQuantity !== null && entered ? afterQuantity * entered.price : null;
  const validAfterValue = afterValue !== null && Number.isSafeInteger(afterValue);

  const warehouse = useMemo(() => positions.filter((p) => p.quantity > 0)
    .map((position) => {
      const estimate = currentEstimate(journal, position);
      return { position, estimate, perUnit: estimate?.unit ?? null,
        totalValue: estimate?.value ?? null };
    }).filter((r) => (filterServer === "all" || r.position.server === filterServer) &&
      r.position.item.name.toLocaleLowerCase("de").includes(query.trim().toLocaleLowerCase("de")))
    .sort((a, b) => {
      const compare = (field: "perUnit" | "totalValue", desc: boolean) => {
        const av = a[field], bv = b[field];
        if (av === null) return bv === null ? 0 : 1;
        if (bv === null) return -1;
        return desc ? bv - av : av - bv;
      };
      let difference = 0;
      switch (sortBy) {
        case "unit-asc": difference = compare("perUnit", false); break;
        case "unit-desc": difference = compare("perUnit", true); break;
        case "value-asc": difference = compare("totalValue", false); break;
        case "value-desc": difference = compare("totalValue", true); break;
        case "quantity-asc": difference = a.position.quantity - b.position.quantity; break;
        case "quantity-desc": difference = b.position.quantity - a.position.quantity; break;
      }
      return difference || a.position.item.name.localeCompare(b.position.item.name, "de");
    }), [positions, journal, sortBy, filterServer, query]);
  const servers = [...new Set(positions.map((p) => p.server))].sort();
  const movements = journal.trades.filter((t) => t.kind === "stock-in" || t.kind === "stock-out");
  const marketValue = warehouse.reduce((sum, r) => sum + (r.estimate?.value ?? 0), 0);
  const missing = warehouse.filter((r) => r.estimate === null).length;

  function submit() {
    if (!canSubmit || !item || (mode === "stock-in" && !validAfterValue)) {
      setStatus(mode === "stock-in"
        ? "Gegenstand, tatsächliche Stückzahl und Preis für 1 Item sind Pflichtfelder."
        : "Die Entnahmemenge muss positiv und durch deinen aktuellen Bestand gedeckt sein.");
      return;
    }
    const removing = mode === "stock-out";
    const accepted = onAdd({
      id: crypto.randomUUID(), at: new Date().toISOString(), item, server: server.trim(),
      kind: mode, quantity: removing ? quantity : entered!.quantity, fees: 0,
      total: !removing && costPerUnit.trim() !== "" ? entered!.quantity * cost : 0,
      costBasisKnown: !removing && costPerUnit.trim() !== "",
      valuationUnitPrice: removing ? undefined : entered!.price,
      note: comment.trim(),
    });
    if (!accepted) { setStatus("Buchung konnte nicht gespeichert werden. Bitte die Fehlermeldung prüfen."); return; }
    setStatus(removing ? "Stückzahl ohne Verkauf korrigiert." : "Bestand mit Stückpreis erfolgreich gespeichert.");
    setQuantityText(""); setUnitPrice(""); setCostPerUnit(""); setComment("");
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
        <p>Trage deine tatsächliche Item-Anzahl und den Preis für genau ein Stück ein. Der Gesamtwert wird sofort berechnet.</p></div>
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
      <div className="warehouse-simple-form">
        <label>Tatsächlich vorhandene Stückzahl *
          <input type="number" min="1" step="1" required value={quantityText} placeholder="z. B. 2500"
            onChange={(e) => setQuantityText(e.target.value)}/>
        </label>
        {mode === "stock-in" && <label>Stückpreis für 1 Item (Kamas) *
          <input type="number" min="0" step="1" required value={unitPrice} placeholder="z. B. 135"
            onChange={(e) => setUnitPrice(e.target.value)}/>
        </label>}
        <div className="warehouse-total" aria-live="polite">
          <small>{mode === "stock-in" ? "Gesamtwert der hinzugefügten Items" : "Verbleibende Stückzahl"}</small>
          <strong>{mode === "stock-in" ? entered ? kama(entered.value) : "—"
            : validQuantity && quantity <= (active?.quantity ?? 0) ? fmt((active?.quantity ?? 0) - quantity) + " Stück" : "—"}</strong>
          <span>{mode === "stock-in" ? entered ? fmt(entered.quantity) + " Stück × " + kama(entered.price) : "Stückzahl × Einzelpreis" : "Ohne Verkauf ausbuchen"}</span>
        </div>
      </div>
      {mode === "stock-in" && <>
        {active && active.quantity > 0 && <p className="warehouse-balance-preview">
          <Info size={15}/> Bereits erfasst: {fmt(active.quantity)} Stück. Nach dem Zugang:
          {" "}<strong>{afterQuantity !== null ? fmt(afterQuantity) : "—"} Stück</strong>,
          geschätzter Wert: <strong>{validAfterValue ? kama(afterValue!) : "—"}</strong>.
        </p>}
        <details className="warehouse-advanced">
          <summary>Ursprünglichen Einstandspreis ergänzen (optional)</summary>
          <label>Historischer Einstand pro Item (Kamas)
            <input type="number" min="0" step="1" value={costPerUnit} placeholder="Falls bekannt"
              onChange={(e) => setCostPerUnit(e.target.value)}/>
          </label>
          <small>Einstandskosten sind nicht der Marktwert. Sie dienen nur einer späteren Gewinnberechnung.</small>
        </details>
      </>}

      <label className="warehouse-note">Notiz zur Bewegung<textarea rows={2} maxLength={1500} value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder={mode === "stock-in" ? "z. B. vorhandene Ressourcen" : "z. B. Fehleintrag, Craftingverbrauch"}/></label>
      <div className="warehouse-footer"><button disabled={!canSubmit || (mode === "stock-in" && !validAfterValue)} onClick={submit}>
        {mode === "stock-in" ? <PackagePlus size={17}/> : <PackageMinus size={17}/>}
        {mode === "stock-in" ? "Bestand hinzufügen" : "Bestand ohne Verkauf entfernen"}</button>
        <small><Info size={14}/> Einzelpreise sind geschätzte Marktwerte; Bestandskorrekturen sind keine Käufe.</small>
      </div>
      {status && <p className="warehouse-status" role="status">{status}</p>}
    </section>
    <section className="panel warehouse-list">
      <div className="warehouse-heading"><div><h3><ClipboardList size={19}/> Dein Warenlager</h3><p>Einzelpreis × vorhandene Stückzahl = geschätzter Lagerwert.</p></div></div>
      <div className="warehouse-filters">
        <label>Item filtern<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Itemname"/></label>
        <label>Server<select value={filterServer} onChange={(e) => setFilterServer(e.target.value)}><option value="all">Alle Server</option>{servers.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label><ArrowUpDown size={15}/> Sortieren<select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>{sortOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
      </div>
      <div className="market-scroll"><table className="warehouse-table"><thead><tr><th>Gegenstand</th><th>Server</th><th>Stückzahl</th><th>Preis/Stück</th><th>Lagerwert</th><th>Einstand</th><th>Aktion</th></tr></thead>
        <tbody>{warehouse.map(({position,estimate,perUnit}) =>
          <tr key={position.key}><td><button className="market-item-button" onClick={() => onPick(position.item, position.server)}><ItemImage item={position.item} size={32}/><strong>{position.item.name}</strong></button></td>
            <td>{position.server}</td><td>{fmt(position.quantity)}</td><td>{perUnit === null ? "—" : fmt(perUnit)+" K"}</td>
            <td>{estimate ? <>{kama(estimate.value)}<small>{estimate.source}</small></> : "Unbekannt"}</td>
            <td>{position.unknownQuantity > 0 ? <>{position.cost ? kama(position.cost) : "Unbekannt"}<small>{fmt(position.unknownQuantity)} ohne Einstand</small></> : kama(position.cost)}</td>
            <td><button className="secondary" onClick={() => { onPick(position.item, position.server); setMode("stock-out"); setQuantityText(""); }}>Korrigieren</button></td></tr>
        )}</tbody></table></div>
      {!warehouse.length && <div className="warehouse-empty"><PackagePlus size={26}/><strong>Warenlager ist noch leer</strong><span>Oben Item auswählen, Stückzahl und Preis für 1 Item eintragen – ohne Kauf.</span></div>}
      {missing > 0 && <p className="warehouse-caution"><Info size={16}/> Der angezeigte Lagerwert enthält nur bewertete Positionen. {missing} Item(s) haben keinen Preis.</p>}
    </section>
    <section className="panel warehouse-history"><h3><ClipboardList size={19}/> Bestandsbewegungen</h3>
      <p>Fehlerhafte Einträge können gelöscht werden, sofern nachfolgende Verkäufe und Entnahmen weiterhin gedeckt sind.</p>
      <div className="market-scroll"><table><thead><tr><th>Datum</th><th>Item</th><th>Art</th><th>Stückzahl</th><th>Preis/Stück</th><th>Notiz</th><th/></tr></thead>
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
