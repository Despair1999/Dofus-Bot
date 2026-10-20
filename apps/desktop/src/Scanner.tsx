import { useEffect, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import { Camera, Upload, ScanLine } from "lucide-react";
import { matchText } from "./matching";
import { api, type Config } from "./client";
type Candidate = {
  id: number;
  name: string;
  nameFr?: string;
  kind: "items" | "quests";
};
export default function Scanner({
  candidates,
  onSearch,
  onPick,
  config,
  initialKind = "quests",
}: {
  candidates: Candidate[];
  onSearch: (text: string, kind: "items" | "quests") => void;
  onPick: (id: number, kind: "items" | "quests") => void;
  config?: Config;
  initialKind?: "items" | "quests";
}) {
  const [kind, setKind] = useState<"items" | "quests">(initialKind);
  const [remote, setRemote] = useState<
      {
        id: number;
        name: string;
        score: number;
        stepSuggestion?: number;
        stepLabel?: string;
      }[]
    >([]),
    [matchingError, setMatchingError] = useState("");
  const [image, setImage] = useState(""),
    [text, setText] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [confidence, setConfidence] = useState(0),
    [language, setLanguage] = useState("deu");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let stopped = false;
    setRemote([]);
    setMatchingError("");
    if (!config || !text.trim()) return;
    const timer = setTimeout(() => {
      void api<
        {
          id: number;
          name: string;
          score: number;
          stepSuggestion?: number;
          stepLabel?: string;
        }[]
      >("/api/recognize", config, { text, kind })
        .then((result) => {
          if (!stopped) setRemote(result.data);
        })
        .catch((error) => {
          if (!stopped)
            setMatchingError(
              error instanceof Error ? error.message : String(error),
            );
        });
    }, 250);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [text, kind, config?.url, config?.token]);
  async function capture() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      try {
        const video = document.createElement("video");
        video.srcObject = stream;
        await video.play();
        await new Promise<void>((r) =>
          video.requestVideoFrameCallback(() => r()),
        );
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")!.drawImage(video, 0, 0);
        setImage(canvas.toDataURL("image/png"));
        setText("");
        setStatus("Aufnahme beendet. Vorschau prüfen und OCR manuell starten.");
      } finally {
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch (e) {
      setStatus(`Bildschirmfreigabe: ${String(e)}`);
    }
  }
  async function recognize() {
    if (!image) return;
    setBusy(true);
    setStatus(
      "Lokale OCR startet. Sprachmodell wird beim ersten Mal heruntergeladen.",
    );
    let worker;
    try {
      worker = await createWorker(language, 1, {
        logger: (m) =>
          setStatus(`${m.status} · ${Math.round((m.progress ?? 0) * 100)} %`),
      });
      const result = await worker.recognize(image);
      setText(result.data.text);
      setConfidence(result.data.confidence);
      setStatus("Analyse beendet. Zuordnung bitte bestätigen.");
    } catch (e) {
      setStatus(String(e));
    } finally {
      await worker?.terminate();
      setBusy(false);
    }
  }
  const localMatches = matchText(
    text,
    candidates.filter((c) => c.kind === kind),
  );
  const matches = remote.length ? remote : localMatches;
  return (
    <>
      <div className="section-head">
        <div>
          <span className="eyebrow">LOKALE BILDSCHIRMANALYSE</span>
          <h2>Erkennen. Prüfen. Bestätigen.</h2>
          <p>
            Nur eine ausdrücklich ausgewählte Aufnahme wird verarbeitet. Bilder
            verlassen dein Gerät nicht.
          </p>
        </div>
        <ScanLine size={42} />
      </div>
      <section className="panel">
        <div className="toolbar">
          <select
            aria-label="Erkennungstyp"
            value={kind}
            onChange={(e) => setKind(e.target.value as "items" | "quests")}
          >
            <option value="quests">Questjournal</option>
            <option value="items">Item-Tooltip</option>
          </select>
          <button onClick={() => void capture()} disabled={busy}>
            <Camera size={17} /> Fenster freigeben
          </button>
          <button
            className="secondary"
            onClick={() => ref.current?.click()}
            disabled={busy}
          >
            <Upload size={17} /> Screenshot öffnen
          </button>
          <input
            ref={ref}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 20_000_000) {
                setStatus("Bild ist größer als 20 MB.");
                return;
              }
              const r = new FileReader();
              r.onload = () => {
                setImage(String(r.result));
                setText("");
              };
              r.readAsDataURL(file);
            }}
          />
          <select
            aria-label="OCR-Sprache"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="deu">Deutsch</option>
            <option value="fra">Französisch</option>
          </select>
          <button onClick={() => void recognize()} disabled={!image || busy}>
            OCR starten
          </button>
        </div>
        {image && (
          <img
            className="scan-preview"
            src={image}
            alt="Freigegebener Screenshot zur lokalen Analyse"
          />
        )}
        <p role="status">
          {status ||
            "Öffne dein Questjournal oder einen Item-Tooltip und wähle eine Aufnahme."}
        </p>
        <label>
          Erkannter Text · OCR-Konfidenz {confidence.toFixed(0)} %
          <textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Alternativ erkannten Text hier einfügen"
          />
        </label>
        <button
          disabled={!text.trim()}
          onClick={() =>
            onSearch(
              text
                .split("\n")
                .map((s) => s.trim())
                .find((s) => s.length > 3) ?? text,
              kind,
            )
          }
        >
          Erste Textzeile in Datenbank suchen
        </button>
        {matchingError && (
          <p role="alert">
            Abgleich mit dem vollständigen Katalog: {matchingError}
          </p>
        )}
        <div className="stack">
          {matches.map((c) => (
            <button
              className="result"
              key={c.id}
              onClick={() => onPick(c.id, kind)}
            >
              <span>{c.name}</span>
              {"stepSuggestion" in c && c.stepSuggestion !== undefined && (
                <span>
                  Schrittvorschlag {c.stepSuggestion + 1}:{" "}
                  {"stepLabel" in c
                    ? String(c.stepLabel)
                    : "Bitte in der Quest prüfen"}
                </span>
              )}
              <small>
                {Math.round(c.score * 100)} % Textübereinstimmung · auswählen
              </small>
            </button>
          ))}
        </div>
        <small>
          Textübereinstimmung ist keine Bestätigung des Questfortschritts.
          Unklare Ergebnisse werden niemals automatisch übernommen.
        </small>
      </section>
    </>
  );
}
