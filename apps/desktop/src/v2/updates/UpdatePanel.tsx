import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import {
  Download,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { openExternal } from "../../native";
import appPackage from "../../../package.json";
import "./updates.css";
type Stage =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "verified"
  | "installing"
  | "current"
  | "error";
export function updateError(error: unknown) {
  const message = String(error instanceof Error ? error.message : error);
  if (/signature|verification|public.?key|minisign|verify/i.test(message))
    return "Die kryptografische Updateprüfung ist fehlgeschlagen. Installation wurde abgebrochen; die vorhandene Version bleibt unverändert.";
  if (/404|release JSON|No releases/i.test(message))
    return "Noch kein kompatibles freigegebenes Update verfügbar. Bitte später erneut prüfen.";
  if (/timeout|connect|network|fetch|resolve/i.test(message))
    return "Der Update-Server ist nicht erreichbar. Prüfe die Internetverbindung und versuche es erneut.";
  return `Update konnte nicht abgeschlossen werden: ${message}`;
}
export default function UpdatePanel() {
  const [version, setVersion] = useState(appPackage.version),
    [stage, setStage] = useState<Stage>("idle"),
    [update, setUpdate] = useState<Update | null>(null),
    [message, setMessage] = useState(""),
    [downloaded, setDownloaded] = useState(0),
    [total, setTotal] = useState(0),
    [checkedAt, setCheckedAt] = useState(""),
    [releaseUrl, setReleaseUrl] = useState("");
  const resource = useRef<Update | null>(null);
  useEffect(() => {
    if (isTauri()) void getVersion().then(setVersion);
    return () => {
      void resource.current?.close().catch(() => {});
    };
  }, []);
  async function checkUpdate() {
    setStage("checking");
    setMessage("");
    setDownloaded(0);
    setTotal(0);
    try {
      await resource.current?.close();
      resource.current = null;
      setUpdate(null);
      if (!isTauri()) {
        const response = await fetch(
          "https://api.github.com/repos/Despair1999/Dofus-Bot/releases/latest",
          { signal: AbortSignal.timeout(15000) },
        );
        if (response.status === 404) throw new Error("404");
        if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
        const release = (await response.json()) as {
          tag_name: string;
          html_url: string;
        };
        setReleaseUrl(release.html_url);
        setMessage(
          `Veröffentlichte Version: ${release.tag_name}. Updates werden in der Windows-Anwendung sicher installiert.`,
        );
        setStage("idle");
      } else {
        const result = await check({ timeout: 15000 });
        resource.current = result;
        setUpdate(result);
        setStage(result ? "available" : "current");
        setMessage(
          result
            ? `Version ${result.version} ist verfügbar.`
            : "Du verwendest die aktuelle freigegebene Version.",
        );
      }
      setCheckedAt(new Date().toLocaleString("de-DE"));
    } catch (error) {
      setStage("error");
      setMessage(updateError(error));
    }
  }
  async function download() {
    if (!update) return;
    setStage("downloading");
    setMessage(
      "Update wird heruntergeladen und anschließend kryptografisch geprüft.",
    );
    setDownloaded(0);
    setTotal(0);
    try {
      await update.download(
        (event) => {
          if (event.event === "Started")
            setTotal(event.data.contentLength ?? 0);
          if (event.event === "Progress")
            setDownloaded((value) => value + event.data.chunkLength);
        },
        { timeout: 180000 },
      );
      setStage("verified");
      setMessage(
        "Download abgeschlossen. Die Signatur wurde erfolgreich geprüft. Das Update kann installiert werden.",
      );
    } catch (error) {
      setStage("error");
      setMessage(updateError(error));
    }
  }
  async function install() {
    if (stage !== "verified" || !update) return;
    setStage("installing");
    setMessage(
      "Das signierte Update wird dem Windows-Installer übergeben. Die Anwendung wird beendet und nach dem Update neu gestartet.",
    );
    try {
      await update.install({ restartAfterInstall: true });
    } catch (error) {
      setStage("error");
      setMessage(updateError(error));
    }
  }
  const busy = ["checking", "downloading", "installing"].includes(stage);
  const percent = total
    ? Math.min(100, Math.round((downloaded / total) * 100))
    : 0;
  return (
    <section className="panel update-panel">
      <div className="panel-title">
        <span>
          <Download size={18} /> Anwendung aktualisieren
        </span>
        <span className="pill">Installiert: v{version}</span>
      </div>
      <div className="update-summary">
        <div
          className={`update-status-icon ${stage === "verified" || stage === "current" ? "verified" : ""}`}
        >
          {stage === "verified" || stage === "current" ? (
            <CheckCircle2 size={27} />
          ) : (
            <ShieldCheck size={27} />
          )}
        </div>
        <div>
          <h3>
            {update
              ? `DOFUS Companion ${update.version}`
              : "Immer auf dem aktuellen Stand"}
          </h3>
          <p>
            Updates kommen aus den freigegebenen GitHub Releases und werden mit
            dem fest hinterlegten öffentlichen Schlüssel geprüft. Charaktere,
            Fortschritt und Einstellungen bleiben im bisherigen
            Datenverzeichnis.
          </p>
        </div>
      </div>
      {update?.body && (
        <details className="update-changelog" open>
          <summary>Was ist neu in {update.version}?</summary>
          <pre>{update.body}</pre>
        </details>
      )}
      {(stage === "downloading" || stage === "verified") && (
        <div className="update-download">
          <progress max="100" value={total ? percent : undefined} />
          <span>
            {stage === "verified"
              ? "Signatur geprüft"
              : `${(downloaded / 1048576).toFixed(1)} MB${total ? ` / ${(total / 1048576).toFixed(1)} MB · ${percent} %` : ""}`}
          </span>
        </div>
      )}
      <div className="toolbar">
        <button disabled={busy} onClick={() => void checkUpdate()}>
          <RefreshCw size={16} className={stage === "checking" ? "spin" : ""} />{" "}
          Nach Updates suchen
        </button>
        {update && ["available", "error"].includes(stage) && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void download()}
          >
            <Download size={16} /> Update herunterladen
          </button>
        )}
        {stage === "verified" && (
          <button disabled={busy} onClick={() => void install()}>
            Geprüftes Update installieren
          </button>
        )}
        {releaseUrl && (
          <button
            className="secondary"
            onClick={() => void openExternal(releaseUrl)}
          >
            Release öffnen <ExternalLink size={14} />
          </button>
        )}
      </div>
      {message && (
        <div
          role="status"
          className={`notice ${stage === "error" ? "update-error" : ""}`}
        >
          {message}
        </div>
      )}
      <small>
        {checkedAt ? `Letzte Prüfung: ${checkedAt}` : "Noch nicht geprüft."} Die
        Datenkataloge können unabhängig von der Anwendung aktualisiert werden.
        Für Browseransichten ist die native Installation nicht verfügbar.
      </small>
    </section>
  );
}
