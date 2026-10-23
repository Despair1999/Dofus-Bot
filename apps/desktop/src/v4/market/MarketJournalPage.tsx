import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, Camera, ChartLine, Download, FileUp, Info, Package,
  Plus, Save, ScanLine, ShieldAlert, Trash2, Wallet,
} from "lucide-react";
import { createWorker } from "tesseract.js";
import type { Config } from "../../client";
import { read, write } from "../../storage";
import ItemSearchBar from "../../v2/items/ItemSearchBar";
import ItemImage from "../../v2/shared/ItemImage";
import type { CatalogItem } from "../../v2/items/types";
import { navigatePath } from "../../v2/routing";
import WarehousePanel from "./WarehousePanel";
import {
  canSell, currentEstimate, emptyJournal, importJournal, isMoney,
  isQuantity, itemKey, kama, latestFor, marketAdvice, parseOcrPrice,
  portfolio, unitOffers, validateLedger,
  type ItemRef, type Journal, type Observation, type Trade,
} from "./model";
import "./market.css";

type Tab = "overview" | "observations" | "trades" | "stock" | "assistant" | "notes";
const STORAGE_KEY = "market:journal-v1";
const fmt = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();
const numeric = (v: string): number | undefined =>
  v.trim() === "" ? undefined : Number(v);
const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Übersicht" }, { id: "observations", label: "Marktpreise" },
  { id: "trades", label: "Handelsbuch" }, { id: "stock", label: "Warenlager" },
  { id: "assistant", label: "Strategie-Assistent" }, { id: "notes", label: "Notizbuch" },
];
function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const quote = (value: string | number | undefined) =>
  '"' + String(value ?? "").replace(/"/g, '""') + '"';

export default function MarketJournalPage({ config }: { config: Config }) {
  const [journal, setJournal] = useState<Journal>(emptyJournal);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [item, setItem] = useState<ItemRef | null>(null);
  const [search, setSearch] = useState("");
  const [server, setServer] = useState("Draconiros");
  const [message, setMessage] = useState("");
  const [pack1, setPack1] = useState("");
  const [pack10, setPack10] = useState("");
  const [pack100, setPack100] = useState("");
  const [pack1000, setPack1000] = useState("");
  const [average, setAverage] = useState("");
  const [volume, setVolume] = useState("");
  const [observationNote, setObservationNote] = useState("");
  const [fromOcr, setFromOcr] = useState(false);
  const [observationAt, setObservationAt] = useState("");
  const [editingObservationId, setEditingObservationId] = useState<string | null>(null);
  const [kind, setKind] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("1");
  const [total, setTotal] = useState("");
  const [fees, setFees] = useState("0");
  const [tradeNote, setTradeNote] = useState("");
  const [note, setNote] = useState("");
  const [buyLimit, setBuyLimit] = useState("");
  const [sellLimit, setSellLimit] = useState("");
  const [planQuantity, setPlanQuantity] = useState("10");
  const [planUnitPrice, setPlanUnitPrice] = useState("");
  const [planFeePercent, setPlanFeePercent] = useState("2");
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    void read<Journal>(STORAGE_KEY, emptyJournal())
      .then((saved) => {
        if (!active) return;
        setJournal(importJournal(JSON.stringify(saved)));
        setReady(true);
      })
      .catch((error) => {
        if (!active) return;
        setMessage("Marktdaten konnten nicht geladen werden: " + String(error));
      });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => write(STORAGE_KEY, journal));
    void saveQueue.current.catch((error) => setMessage("Speichern fehlgeschlagen: " + String(error)));
  }, [journal, ready]);

  const positions = useMemo(() => portfolio(journal.trades), [journal.trades]);
  const items = useMemo(() => {
    const unique = new Map<string, ItemRef>();
    for (const ob of journal.observations) unique.set(itemKey(ob.item, ""), ob.item);
    for (const trade of journal.trades) unique.set(itemKey(trade.item, ""), trade.item);
    for (const n of journal.notes) if (n.item) unique.set(itemKey(n.item, ""), n.item);
    if (item) unique.set(itemKey(item, ""), item);
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [journal, item]);
  const selectedKey = item ? itemKey(item, server) : "";
  const relevant = useMemo(
    () => journal.observations.filter((o) => item && itemKey(o.item, o.server) === selectedKey)
      .sort((a, b) => b.at.localeCompare(a.at)),
    [journal.observations, item, selectedKey],
  );
  const position = positions.find((p) => p.key === selectedKey);
  const latest = item ? latestFor(journal, item, server) : undefined;
  const tips = item ? marketAdvice(journal, item, server) : [];
  const target = journal.targets[selectedKey];
  useEffect(() => {
    setBuyLimit(target?.buyBelow === undefined ? "" : String(target.buyBelow));
    setSellLimit(target?.sellAbove === undefined ? "" : String(target.sellAbove));
  }, [selectedKey, target?.buyBelow, target?.sellAbove]);
  function pick(next: ItemRef) {
    setItem(next);
    setEditingObservationId(null);
    setSearch("");
    setMessage("");
  }
  function manualItem() {
    const name = search.trim();
    if (name.length < 2) { setMessage("Bitte einen Gegenstandsnamen eingeben."); return; }
    pick({ name });
  }
  function editObservation(entry: Observation) {
    setItem(entry.item);
    setServer(entry.server);
    setPack1(entry.packs["1"] === undefined ? "" : String(entry.packs["1"]));
    setPack10(entry.packs["10"] === undefined ? "" : String(entry.packs["10"]));
    setPack100(entry.packs["100"] === undefined ? "" : String(entry.packs["100"]));
    setPack1000(entry.packs["1000"] === undefined ? "" : String(entry.packs["1000"]));
    setAverage(entry.average === undefined ? "" : String(entry.average));
    setVolume(entry.volume === undefined ? "" : String(entry.volume));
    setObservationNote(entry.note);
    setFromOcr(entry.source === "ocr");
    const time = new Date(entry.at);
    setObservationAt(new Date(time.getTime() - time.getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
    setEditingObservationId(entry.id);
    setTab("observations");
    setMessage("Marktbeobachtung bearbeiten: " + entry.item.name);
  }
  function saveObservation() {
    if (!item || !server.trim()) { setMessage("Gegenstand und Server wählen."); return; }
    const packs: Record<string, number> = {};
    for (const [size, input] of [["1", pack1], ["10", pack10], ["100", pack100], ["1000", pack1000]]) {
      const value = numeric(input);
      if (value === undefined) continue;
      if (!isMoney(value)) { setMessage("Paketpreise müssen ganze, nichtnegative Kamas sein."); return; }
      packs[size] = value;
    }
    const avg = numeric(average), vol = numeric(volume);
    if ((avg !== undefined && !isMoney(avg)) || (vol !== undefined && !isMoney(vol))) {
      setMessage("Durchschnitt und Volumen müssen nichtnegative ganze Zahlen sein."); return;
    }
    if (!Object.keys(packs).length && avg === undefined) {
      setMessage("Mindestens einen Angebotspreis oder Durchschnitt eintragen."); return;
    }
    const date = observationAt ? new Date(observationAt) : new Date();
    if (!Number.isFinite(date.getTime())) { setMessage("Ungültiges Beobachtungsdatum."); return; }
    const entry: Observation = {
      id: editingObservationId ?? newId(), at: date.toISOString(), item, server: server.trim(), packs, average: avg,
      volume: vol, note: observationNote.trim(), source: fromOcr ? "ocr" : "manual",
    };
    setJournal((prev) => ({ ...prev, observations: editingObservationId
      ? prev.observations.map((old) => old.id === editingObservationId ? entry : old)
      : [entry, ...prev.observations],
    }));
    setPack1(""); setPack10(""); setPack100(""); setPack1000(""); setAverage("");
    setVolume(""); setObservationNote(""); setFromOcr(false); setObservationAt("");
    setMessage(editingObservationId ? "Marktbeobachtung aktualisiert." : "Marktbeobachtung gespeichert.");
    setEditingObservationId(null);
  }
  function saveTrade() {
    if (!item || !server.trim()) { setMessage("Gegenstand und Server wählen."); return; }
    const qty = numeric(quantity), gross = numeric(total), fee = numeric(fees) ?? 0;
    if (qty === undefined || !isQuantity(qty) || gross === undefined ||
        !isMoney(gross) || !isMoney(fee) || (kind === "sell" && fee > gross)) {
      setMessage("Menge, Gesamtbetrag oder Gebühren sind ungültig."); return;
    }
    if (kind === "sell" && !canSell(journal, item, server, qty)) {
      setMessage("Nicht genügend dokumentierter Bestand. Zuerst einen Einkauf erfassen."); return;
    }
    const entry: Trade = {
      id: newId(), item, server: server.trim(), at: now(), kind,
      quantity: qty, total: gross, fees: fee, note: tradeNote.trim(),
    };
    const ledgerError = validateLedger([entry, ...journal.trades]);
    if (ledgerError) { setMessage(ledgerError); return; }
    setJournal((prev) => ({ ...prev, trades: [entry, ...prev.trades] }));
    setTotal(""); setFees("0"); setQuantity("1"); setTradeNote("");
    setMessage(kind === "buy" ? "Einkauf gebucht." : "Verkauf und FIFO-Gewinn gebucht.");
  }
  function saveTargets() {
    if (!item) return;
    const buy = numeric(buyLimit), sell = numeric(sellLimit);
    if ((buy !== undefined && !isMoney(buy)) || (sell !== undefined && !isMoney(sell))) {
      setMessage("Zielpreise müssen ganze, nichtnegative Kamas sein."); return;
    }
    setJournal((prev) => ({
      ...prev, targets: { ...prev.targets, [selectedKey]: { buyBelow: buy, sellAbove: sell } },
    }));
    setMessage("Persönliche Preisgrenzen gespeichert.");
  }
  function saveNote() {
    if (!note.trim()) return;
    setJournal((prev) => ({
      ...prev, notes: [{ id: newId(), at: now(), item, text: note.trim() }, ...prev.notes],
    }));
    setNote(""); setMessage("Notiz gespeichert.");
  }
  function remove(type: "observations" | "trades" | "notes", id: string) {
    if (type === "trades") {
      const next = journal.trades.filter((entry) => entry.id !== id);
      const error = validateLedger(next);
      if (error) {
        setMessage("Löschen nicht möglich: " + error + " Nutze bei verbrauchtem Bestand eine Bestandskorrektur.");
        return;
      }
    }
    if (!window.confirm("Diesen Eintrag endgültig löschen? Zur Sicherheit vorher ein JSON-Backup erstellen.")) return;
    setJournal((prev) => ({
      ...prev, [type]: prev[type].filter((entry) => entry.id !== id),
    }));
    setMessage("Eintrag entfernt.");
  }
  async function recognizeFile(file: File) {
    if (!file.type.startsWith("image/") || file.size > 20_000_000) {
      setOcrStatus("Bitte ein Bild mit höchstens 20 MB auswählen."); return;
    }
    setOcrBusy(true);
    setOcrStatus("Lokale Erkennung wird vorbereitet (Sprachdaten können einmalig heruntergeladen werden).");
    let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
    try {
      worker = await createWorker("deu");
      const result = await worker.recognize(file);
      setOcrText(result.data.text);
      setFromOcr(true);
      const detected = parseOcrPrice(result.data.text);
      if (detected !== undefined) setAverage(String(detected));
      setOcrStatus("Text erkannt. Zahlen und Gegenstand bitte vor dem Speichern manuell prüfen.");
    } catch (error) {
      setOcrStatus("OCR fehlgeschlagen: " + String(error));
    } finally {
      await worker?.terminate();
      setOcrBusy(false);
    }
  }
  async function capture() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      try {
        const video = document.createElement("video");
        video.srcObject = stream;
        await video.play();
        await new Promise<void>((resolve) => video.requestVideoFrameCallback(() => resolve()));
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (blob) await recognizeFile(new File([blob], "marktaufnahme.png", { type: "image/png" }));
      } finally {
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (error) { setOcrStatus("Aufnahme nicht möglich: " + String(error)); }
  }
  async function restore(file: File) {
    try {
      if (file.size > 10_000_000) throw Error("Backup ist größer als 10 MB.");
      const parsed = importJournal(await file.text());
      if (!window.confirm("Das Backup ersetzt das aktuelle Marktjournal. Fortfahren?")) return;
      setJournal(parsed);
      setMessage("Backup erfolgreich wiederhergestellt.");
    } catch (error) { setMessage("Import fehlgeschlagen: " + String(error)); }
  }
  function exportCsv() {
    const lines = [
      ["Datum", "Server", "Gegenstand", "Item-ID", "1er", "10er", "100er", "1000er", "Durchschnitt", "Volumen", "Quelle", "Notiz"].join(";"),
      ...journal.observations.map((o) => [
        o.at, o.server, o.item.name, o.item.id, o.packs["1"], o.packs["10"],
        o.packs["100"], o.packs["1000"], o.average, o.volume, o.source, o.note,
      ].map(quote).join(";")),
    ];
    download("dofus-marktbeobachtungen.csv", "\uFEFF" + lines.join("\r\n"), "text/csv;charset=utf-8");
  }
  const totalCost = positions.reduce((sum, p) => sum + p.cost, 0);
  const totalProfit = positions.reduce((sum, p) => sum + p.realized, 0);
  const estimates = positions.map((p) => currentEstimate(journal, p));
  const totalEstimate = estimates.reduce((sum, e) => sum + (e?.value ?? 0), 0);
  const withoutValue = positions.filter((p, index) => p.quantity > 0 && !estimates[index]).length;
  const unknownCosts = positions.reduce((sum, p) => sum + p.unknownQuantity, 0);
  const unknownProfit = positions.some((p) => p.unknownSoldQuantity > 0);
  const latestPoints = [...relevant].reverse()
    .map((o) => ({ date: o.at, unit: unitOffers(o)[0]?.unit }))
    .filter((p): p is { date: string; unit: number } => p.unit !== undefined);
  const graphValues = latestPoints.slice(-25);
  const graphMin = Math.min(...graphValues.map((p) => p.unit));
  const graphMax = Math.max(...graphValues.map((p) => p.unit));
  const graphSpan = Math.max(1, graphMax - graphMin);
  const graphPath = graphValues.map((p, index) =>
    (30 + index * 440 / Math.max(1, graphValues.length - 1)).toFixed(1) + "," +
    (140 - (p.unit - graphMin) / graphSpan * 110).toFixed(1)).join(" ");

  if (!ready) return <section className="panel">Marktjournal wird geladen … {message}</section>;
  return (
    <div className="market-page">
      <div className="market-hero">
        <div>
          <span className="eyebrow">DEIN PERSÖNLICHES HANDELSBUCH</span>
          <h2>Marktjournal & Kamas Intelligence</h2>
          <p>Marktpreise, Bestände und Strategien selbst dokumentieren. Offline und ohne OCR-Zwang.</p>
        </div>
        <div className="market-actions">
          <button className="secondary" onClick={() =>
            download("dofus-marktjournal-backup.json", JSON.stringify(journal, null, 2), "application/json")
          }><Download size={16}/> Backup</button>
          <button className="secondary" onClick={exportCsv}><Download size={16}/> CSV</button>
          <button className="secondary" onClick={() => importRef.current?.click()}><FileUp size={16}/> Import</button>
          <input hidden ref={importRef} type="file" accept=".json,application/json"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) void restore(file); e.currentTarget.value = ""; }}/>
        </div>
      </div>

      <div className="market-context panel">
        <div className="market-item-search">
          <ItemSearchBar config={config} value={search} onChange={setSearch}
            onSubmit={manualItem} onSelect={(found: CatalogItem) => pick({
              id: found.id, name: found.name, category: found.category, imageUrl: found.imageUrl,
            })} placeholder="Item aus dem Katalog wählen oder Namen eingeben …"
            label="Item für die Marktanalyse suchen"/>
          <small>Auch ohne Backend: Namen eingeben und auf „Suchen“ klicken.</small>
        </div>
        <label>Server
          <input value={server} onChange={(e) => setServer(e.target.value)}
            placeholder="z. B. Draconiros" maxLength={80}/>
        </label>
        {item && <div className="market-selected">
          <ItemImage item={item} size={40}/>
          <span><strong>{item.name}</strong><small>Aktueller Gegenstand</small></span>
          <button className="icon-button" onClick={() => setItem(null)} title="Gegenstand abwählen">×</button>
        </div>}
      </div>
      {items.length > 0 && <div className="market-saved-items" aria-label="Gespeicherte Gegenstände">
        {items.slice(0, 40).map((entry) => (
          <button className={item?.name === entry.name ? "is-current" : ""} key={entry.name + ":" + (entry.id ?? "")}
            onClick={() => pick(entry)}>{entry.name}</button>
        ))}
      </div>}
      {message && <p className="market-message" role="status">{message}</p>}
      <div className="market-tabs" role="tablist" aria-label="Marktjournal-Bereiche">
        {tabs.map((entry) => <button role="tab" aria-selected={tab === entry.id}
          className={tab === entry.id ? "selected" : ""} key={entry.id}
          onClick={() => setTab(entry.id)}>{entry.label}</button>)}
      </div>

      {tab === "overview" && <>
        <div className="market-metrics">
          <Metric label="Bekannte Einstandskosten" value={kama(totalCost)} detail={unknownCosts ? fmt(unknownCosts) + " Stück ohne belegte Kosten" : "Nur bekannte Anschaffungskosten"} icon={<Wallet size={18}/>}/>
          <Metric label="Realisierter Gewinn (FIFO)" value={unknownProfit ? "Teilweise unbekannt" : kama(totalProfit)} detail={unknownProfit ? "Einstand einiger verkaufter Stücke unbekannt" : undefined} icon={<ChartLine size={18}/>}/>
          <Metric label="Beobachteter Lagerwert" value={kama(totalEstimate)}
            detail={withoutValue ? fmt(withoutValue) + " Position(en) ohne Bewertung" : "Basierend auf deinen eigenen Preisen"} icon={<Package size={18}/>}/>
          <Metric label="Preisbeobachtungen" value={fmt(journal.observations.length)} icon={<BookOpen size={18}/>}/>
        </div>
        <div className="market-grid">
          <section className="panel"><h3>Deine nächsten Schritte</h3>
            <p>Wähle ein Item und erfasse manuell ein aktuelles Angebot. Dokumentiere danach Käufe oder Verkäufe im Handelsbuch.</p>
            <div className="market-action-row">
              <button onClick={() => setTab("observations")}><Plus size={16}/> Preis erfassen</button>
              <button className="secondary" onClick={() => setTab("trades")}>Handel eintragen</button>
            </div>
          </section>
          <section className="panel"><h3>Hinweise für {item?.name ?? "deinen Markt"}</h3>
            {item ? <AdviceList tips={tips.slice(0, 3)}/> :
              <p>Wähle oben einen Gegenstand für konkrete, regelbasierte Hinweise.</p>}
          </section>
        </div>
        <section className="panel"><h3>Letzte Marktbeobachtungen</h3>
          <ObservationTable entries={journal.observations.slice(0, 8)}
            onSelect={(entry) => { setServer(entry.server); pick(entry.item); }} onEdit={editObservation} onRemove={(id) => remove("observations", id)}/>
        </section>
      </>}

      {tab === "observations" && <>
        <section className="panel"><h3>Neue Marktbeobachtung</h3>
          <p>Manuelle Eingabe ist der Standard. Paketpreise sind Gesamtpreise, keine Stückpreise.</p>
          <div className="market-form-grid">
            <Field label="Preis für ×1 (Kamas)" value={pack1} onChange={setPack1}/>
            <Field label="Preis für ×10 (Kamas)" value={pack10} onChange={setPack10}/>
            <Field label="Preis für ×100 (Kamas)" value={pack100} onChange={setPack100}/>
            <Field label="Preis für ×1000 (Kamas)" value={pack1000} onChange={setPack1000}/>
            <Field label="Angezeigter Ø-Preis (Kamas)" value={average} onChange={setAverage}/>
            <Field label="Angezeigtes Handelsvolumen" value={volume} onChange={setVolume}/>
          </div>
          <label>Beobachtungsdatum (optional, sonst jetzt)
            <input type="datetime-local" value={observationAt} onChange={(e) => setObservationAt(e.target.value)}/>
          </label>
          <label>Persönliche Notiz
            <textarea rows={2} value={observationNote} maxLength={2000}
              onChange={(e) => setObservationNote(e.target.value)}
              placeholder="Was ist dir bei diesem Marktpreis aufgefallen?"/>
          </label>
          <div className="market-action-row">
            <button disabled={!item} onClick={saveObservation}><Save size={16}/> {editingObservationId ? "Änderungen speichern" : "Beobachtung speichern"}</button>
            {editingObservationId && <button className="secondary" onClick={() => { setEditingObservationId(null); setObservationAt(""); setMessage("Bearbeitung abgebrochen."); }}>Abbrechen</button>}
            <button className="secondary" onClick={() => setOcrOpen(!ocrOpen)}>
              <ScanLine size={16}/> OCR optional {ocrOpen ? "ausblenden" : "öffnen"}
            </button>
          </div>
          {ocrOpen && <div className="market-ocr">
            <h4>Freiwilliger OCR-Import</h4>
            <p>OCR liest eine bewusst ausgewählte Aufnahme. Alle Ergebnisse sind vor dem Speichern zu kontrollieren.</p>
            <div className="market-action-row">
              <button className="secondary" onClick={() => inputRef.current?.click()} disabled={ocrBusy}>
                <FileUp size={16}/> Screenshot wählen
              </button>
              <button className="secondary" onClick={() => void capture()} disabled={ocrBusy}>
                <Camera size={16}/> Bildschirmbereich freigeben
              </button>
              <input hidden ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) void recognizeFile(file); e.currentTarget.value = ""; }}/>
            </div>
            <p role="status">{ocrStatus || "Es wird nichts automatisch aus dem Spiel ausgelesen."}</p>
            <label>Erkannter Text (editierbar)
              <textarea rows={5} value={ocrText} onChange={(e) => setOcrText(e.target.value)}/>
            </label>
            <button className="secondary" disabled={!ocrText.trim()} onClick={() => {
              const found = parseOcrPrice(ocrText);
              if (found !== undefined) { setAverage(String(found)); setFromOcr(true); }
              else setOcrStatus("Kein eindeutiger Durchschnittspreis erkannt; Preise bitte manuell eintragen.");
            }}>Erkannten Durchschnitt vorschlagen</button>
          </div>}
        </section>
        {item && <section className="panel"><h3>Preisverlauf · {item.name}</h3>
          {graphValues.length >= 2 ? <div className="market-chart">
            <svg role="img" aria-label="Verlauf der manuell dokumentierten günstigsten Stückpreise" viewBox="0 0 500 165" preserveAspectRatio="none">
              <line x1="30" y1="145" x2="480" y2="145" stroke="#516074"/>
              <line x1="30" y1="30" x2="480" y2="30" stroke="#3a4354" strokeDasharray="4 5"/>
              <polyline points={graphPath} fill="none" stroke="#dbb675" strokeWidth="3" strokeLinejoin="round"/>
              <text x="34" y="20" fill="#a9b8ce" fontSize="12">{fmt(graphMax)} K</text>
              <text x="34" y="160" fill="#a9b8ce" fontSize="12">{fmt(graphMin)} K</text>
            </svg>
          </div> : <p>Mindestens zwei Beobachtungen mit Paketpreisen erfassen, um den Verlauf zu sehen.</p>}
          <small>Die Punkte zeigen eigene Messungen; fehlende Zeiträume werden nicht mit erfundenen Preisen aufgefüllt.</small>
        </section>}
        <section className="panel"><h3>Marktpreis-Historie</h3>
          <ObservationTable entries={item ? relevant : journal.observations}
            onSelect={(entry) => { setServer(entry.server); pick(entry.item); }} onEdit={editObservation} onRemove={(id) => remove("observations", id)}/>
        </section>
      </>}

      {tab === "trades" && <>
        <section className="panel"><h3>Neuen Handel dokumentieren</h3>
          <p>Erfasse echte Käufe und Verkäufe; Einkaufskosten werden nach FIFO berücksichtigt.</p>
          <div className="market-form-grid">
            <label>Vorgang<select value={kind} onChange={(e) => setKind(e.target.value as "buy" | "sell")}>
              <option value="buy">Einkauf</option><option value="sell">Verkauf</option>
            </select></label>
            <Field label="Menge" value={quantity} onChange={setQuantity}/>
            <Field label="Gesamtbetrag (Kamas)" value={total} onChange={setTotal}/>
            <Field label="Gebühren (Kamas)" value={fees} onChange={setFees}/>
          </div>
          <label>Handelsnotiz
            <textarea rows={2} value={tradeNote} maxLength={2000} onChange={(e) => setTradeNote(e.target.value)}/>
          </label>
          {Number(quantity) > 0 && total !== "" &&
            <p>Rechnerischer Stückpreis: {fmt(Number(total) / Number(quantity))} K ·
              {kind === "sell" ? " dokumentierter Bestand: " + (position?.quantity ?? 0) : " wird dem Bestand hinzugefügt"}</p>}
          <button disabled={!item} onClick={saveTrade}><Save size={16}/> {kind === "buy" ? "Einkauf" : "Verkauf"} buchen</button>
        </section>
        <section className="panel"><h3>Handelsbuch</h3>
          <div className="market-scroll"><table><thead><tr>
            <th>Datum</th><th>Gegenstand</th><th>Typ</th><th>Menge</th><th>Gesamt</th><th>Gebühren</th><th/>
          </tr></thead><tbody>
            {journal.trades.filter((t) => (t.kind === "buy" || t.kind === "sell") && (!item || itemKey(t.item, t.server) === selectedKey)).map((t) =>
              <tr key={t.id}><td>{new Date(t.at).toLocaleString("de-DE")}</td>
                <td>{t.item.name}<small>{t.server}</small></td>
                <td>{t.kind === "buy" ? "Kauf" : "Verkauf"}</td>
                <td>{fmt(t.quantity)}</td><td>{kama(t.total)}</td><td>{kama(t.fees)}</td>
                <td><button className="icon-button" aria-label="Buchung löschen" onClick={() => remove("trades", t.id)}><Trash2 size={15}/></button></td>
              </tr>)}
          </tbody></table></div>
          {!journal.trades.some((t) => t.kind === "buy" || t.kind === "sell") && <p>Noch keine Transaktionen dokumentiert.</p>}
        </section>
      </>}

      {tab === "stock" && <WarehousePanel journal={journal} positions={positions} item={item} server={server}
        onPick={(picked, selectedServer) => { pick(picked); setServer(selectedServer); }}
        onAdd={(entry) => {
          const error = validateLedger([entry, ...journal.trades]);
          if (error) { setMessage(error); return false; }
          setJournal((prev) => ({ ...prev, trades: [entry, ...prev.trades] }));
          setMessage(entry.kind === "stock-in" ? "Bestand ohne Einkauf übernommen." : "Bestand ohne Verkauf korrigiert.");
          return true;
        }}
        onDelete={(id) => remove("trades", id)}
      />}

      {tab === "assistant" && <>
        <section className="panel"><h3><ShieldAlert size={19}/> Persönlicher Strategie-Assistent</h3>
          <p>Die Hinweise beruhen auf deinen Eingaben und transparenten Regeln – nicht auf Live-Marktdaten oder automatischen Spielhandlungen.</p>
          {item ? <>
            <div className="market-form-grid">
              <Field label="Einkaufslimit (Kamas/Stück)" value={buyLimit} onChange={setBuyLimit}/>
              <Field label="Verkaufsziel (Kamas/Stück)" value={sellLimit} onChange={setSellLimit}/>
            </div>
            <button onClick={saveTargets}><Save size={16}/> Preisgrenzen speichern</button>
            {latest && <p>Letzte Preisbeobachtung: {new Date(latest.at).toLocaleString("de-DE")} ·
              {unitOffers(latest)[0] ? " günstigster Stückpreis " + fmt(unitOffers(latest)[0].unit) + " K" : " kein Paketpreis"}</p>}
            <AdviceList tips={tips}/>
          </> : <p>Wähle oben ein Item für persönliche Empfehlungen und Preisgrenzen.</p>}
        </section>
        <section className="panel"><h3><Wallet size={18}/> Verkaufsplanung & Risiko</h3>
          <p>Simuliere einen möglichen Verkauf deines dokumentierten Bestands. Die Berechnung ist eine Schätzung; es werden keine Spielaktionen ausgeführt.</p>
          <div className="market-form-grid">
            <Field label="Geplante Menge" value={planQuantity} onChange={setPlanQuantity}/>
            <Field label="Verkaufspreis je Stück (Kamas)" value={planUnitPrice} onChange={setPlanUnitPrice}/>
            <label>Geschätzte Gebühren in %
              <input type="number" min="0" max="99" step="0.1" value={planFeePercent} onChange={(e) => setPlanFeePercent(e.target.value)}/>
            </label>
          </div>
          {(() => {
            const q = Number(planQuantity), price = Number(planUnitPrice), fee = Number(planFeePercent);
            const valid = !!position && isQuantity(q) && q <= position.quantity &&
              planUnitPrice !== "" && isMoney(price) && planFeePercent !== "" &&
              Number.isFinite(fee) && fee >= 0 && fee < 100;
            if (!valid) return <p>Wähle einen Gegenstand mit ausreichendem Lagerbestand und gib gültige Mengen, Preise und Gebühren (0 bis unter 100 %) ein.</p>;
            const gross = q * price;
            const estimatedFees = Math.round(gross * fee / 100);
            const estimatedCost = position!.unknownQuantity === 0 ? Math.round(position!.cost / position!.quantity * q) : null;
            const net = gross - estimatedFees;
            const profit = estimatedCost === null ? null : net - estimatedCost;
            const breakEven = estimatedCost === null ? null : Math.ceil(estimatedCost / q / (1 - fee / 100));
            return <div className="market-plan-results" aria-live="polite">
              <div><small>Bruttoerlös</small><strong>{kama(gross)}</strong></div>
              <div><small>Geschätzte Gebühren</small><strong>{kama(estimatedFees)}</strong></div>
              <div><small>Geplantes Nettoergebnis</small><strong>{profit === null ? "Unbekannt" : kama(profit)}</strong></div>
              <div><small>Break-even je Stück</small><strong>{breakEven === null ? "Unbekannt" : kama(breakEven)}</strong></div>
              <p>Basierend auf dem durchschnittlichen Einstandswert des aktuellen Bestands. Der tatsächlich gebuchte Gewinn wird beim Verkauf nach FIFO ermittelt. Absatz und Verkaufspreis sind nicht garantiert.</p>
            </div>;
          })()}
        </section>
        <section className="panel"><h3><BookOpen size={18}/> Marktmechanismen verstehen</h3>
          <div className="market-guide">
            <article><strong>1. Günstig einkaufen</strong><p>Beobachte mehrere Angebote und Losgrößen. Vergleiche immer den Stückpreis, nicht nur den Paketpreis.</p></article>
            <article><strong>2. Lager und Kapital planen</strong><p>Ein großer Warenbestand bindet Kamas. Dokumentiere Einkaufskosten und prüfe, ob Verkäufe tatsächlich zustande kommen.</p></article>
            <article><strong>3. Durchschnittspreise hinterfragen</strong><p>Der angezeigte Marktdurchschnitt kann von aktuellen Angeboten abweichen. Eigengeschäfte oder künstliche Preisbewegungen aus Gildengesprächen sind keine bestätigte DOFUS-Mechanik.</p></article>
            <article><strong>4. Automatische Unterbietung erkennen</strong><p>Häufige Preisänderungen können verschiedene Ursachen haben. Beobachte Zeitabstände und Angebote, ohne einen Bot oder Manipulation zu unterstellen.</p></article>
            <article><strong>5. Ausstieg dokumentieren</strong><p>Lege einen Zielpreis fest, rechne Gebühren ein und bewerte Lager- und Absatzrisiko. Gewinne entstehen erst bei tatsächlichen Verkäufen.</p></article>
            <article><strong>6. Alternative Verwendung prüfen</strong><p>Berücksichtige Crafting oder Pet-Fütterung als mögliche Nutzung gebundener Ressourcen. Vergleiche den erwarteten Wert mit dem Marktverkauf.</p></article>
          </div>
          <div className="market-disclaimer"><Info size={18}/> Dieses Modul unterstützt Analyse und Dokumentation. Es kauft, verkauft, unterbietet oder verändert keine Preise im DOFUS-Client.</div>
        </section>
        <button className="secondary" onClick={() => navigatePath("/craft")}>Crafting & Kamas öffnen</button>
      </>}

      {tab === "notes" && <>
        <section className="panel"><h3>Persönliches Handelsnotizbuch</h3>
          <p>Hypothesen, Beobachtungen und Strategien chronologisch festhalten. Optional dem gewählten Item zugeordnet.</p>
          <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={5000}
            placeholder="Was hast du am Markt beobachtet?"/>
          <button disabled={!note.trim()} onClick={saveNote}><Plus size={16}/> Notiz hinzufügen</button>
        </section>
        <div className="market-notes">
          {journal.notes.map((n) => <article className="panel" key={n.id}>
            <div className="market-note-head"><strong>{n.item?.name ?? "Allgemeine Notiz"}</strong>
              <small>{new Date(n.at).toLocaleString("de-DE")}</small>
              <button className="icon-button" aria-label="Notiz löschen" onClick={() => remove("notes", n.id)}><Trash2 size={15}/></button>
            </div>
            <p>{n.text}</p>
          </article>)}
          {!journal.notes.length && <p>Noch keine Notizen vorhanden.</p>}
        </div>
      </>}
    </div>
  );
}
function Metric({ label, value, detail, icon }: {
  label: string; value: string; detail?: string; icon: React.ReactNode;
}) {
  return <div className="market-metric"><div>{icon}<small>{label}</small></div>
    <strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}
function Field({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return <label>{label}<input type="number" min="0" step="1" value={value}
    onChange={(e) => onChange(e.target.value)} placeholder="Optional"/></label>;
}
function AdviceList({ tips }: { tips: ReturnType<typeof marketAdvice> }) {
  return <div className="market-advice-list">
    {tips.map((tip, i) => <article key={i} className={"market-tip " + tip.tone}>
      <Info size={17}/><div><strong>{tip.title}</strong><p>{tip.text}</p></div>
    </article>)}
  </div>;
}
function ObservationTable({ entries, onSelect, onEdit, onRemove }: {
  entries: Observation[]; onSelect: (entry: Observation) => void; onEdit: (entry: Observation) => void; onRemove: (id: string) => void;
}) {
  return entries.length ? <div className="market-scroll"><table><thead><tr>
    <th>Datum</th><th>Item</th><th>Server</th><th>Günstigstes Angebot</th><th>Ø gemeldet</th><th>Quelle</th><th/>
  </tr></thead><tbody>{entries.map((o) => {
    const offer = unitOffers(o)[0];
    return <tr key={o.id}><td>{new Date(o.at).toLocaleString("de-DE")}</td>
      <td><button className="market-item-button" onClick={() => onSelect(o)}>
        <ItemImage item={o.item} size={28}/>{o.item.name}</button></td>
      <td>{o.server}</td><td>{offer ? fmt(offer.unit) + " K/Stk (×" + offer.size + ")" : "–"}</td>
      <td>{o.average === undefined ? "–" : kama(o.average)}</td><td>{o.source === "ocr" ? "OCR, geprüft" : "Manuell"}</td>
      <td><button className="secondary" onClick={() => onEdit(o)}>Bearbeiten</button>
        <button className="icon-button" aria-label="Beobachtung löschen" onClick={() => onRemove(o.id)}><Trash2 size={15}/></button></td>
    </tr>;
  })}</tbody></table></div> : <p>Noch keine Marktbeobachtungen vorhanden.</p>;
}
