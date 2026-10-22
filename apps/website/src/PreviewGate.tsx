import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import logo from "../../desktop/public/branding/icon.png";
import hero from "../../desktop/public/classes/7.webp";
import { loadAccessConfig, savePreviewSession, verifyPreviewPassword, type AccessConfig } from "./lib/access";
import "./access.css";

export default function PreviewGate({onUnlock}:{onUnlock:()=>void}) {
  const [config,setConfig]=useState<AccessConfig|null>(null);
  const [status,setStatus]=useState<"loading"|"ready"|"unavailable">("loading");
  const [password,setPassword]=useState("");
  const [revealed,setRevealed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [failed,setFailed]=useState(0);
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const ctrl=new AbortController();
    loadAccessConfig(ctrl.signal).then(value=>{setConfig(value);setStatus("ready")})
      .catch(()=>{if(!ctrl.signal.aborted)setStatus("unavailable")});
    return()=>ctrl.abort();
  },[]);
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!config || busy || !password) return;
    setBusy(true);setError("");
    try {
      const matches=await verifyPreviewPassword(password,config);
      if (matches) {
        setPassword("");
        savePreviewSession();
        onUnlock();
        return;
      }
      setFailed(n=>n+1);
      setError("Dieses Zugangspasswort ist nicht korrekt.");
      setPassword("");
      input.current?.focus();
    } catch {
      setError("Die Passwortprüfung konnte nicht abgeschlossen werden.");
    } finally { setBusy(false); }
  }
  return <div className="gate-shell">
    <div className="gate-stars" aria-hidden="true"/>
    <div className="gate-topbar">
      <div className="gate-brand"><img src={logo} alt=""/><span>DOFUS <b>COMPANION</b><small>THE ADVENTURE TOOLKIT</small></span></div>
      <div className="gate-top-status"><span/> PRIVATE PREVIEW · ALPHA</div>
    </div>
    <div className="gate-frame">
      <div className="gate-visual" aria-hidden="true">
        <div className="gate-rune gate-rune-outer"/><div className="gate-rune gate-rune-inner"/><div className="gate-visual-glow"/>
        <div className="gate-crest">✦ <span>✧</span> ✦</div>
        <img className="gate-character" src={hero} alt=""/>
        <div className="gate-art-caption"><span>01 / PORTAL DER ABENTEUER</span><strong>Die Welt der Zwölf wartet.</strong></div>
      </div>
      <div className="gate-panel">
        <div className="gate-ornament">✧ <span/> ✧</div>
        <div className="gate-eyebrow"><Sparkles size={15}/> GESCHÜTZTER VORSCHAUZUGANG</div>
        <h1>Das Portal<br/><em>ist versiegelt.</em></h1>
        <p className="gate-copy">DOFUS Companion befindet sich in einer privaten Entwicklungsphase. Gib dein Zugangspasswort ein, um das Portal zu betreten.</p>
        <div className="gate-divider"><span/>◆<span/></div>
        <form onSubmit={submit} className="gate-form">
          <label htmlFor="gate-password"><KeyRound size={15}/> ZUGANGSPASSWORT</label>
          <div className={`gate-password-field ${error?"gate-invalid":""}`}>
            <LockKeyhole size={19} aria-hidden="true"/>
            <input id="gate-password" ref={input} type={revealed?"text":"password"} autoComplete="current-password"
              autoCapitalize="off" autoCorrect="off" spellCheck={false} value={password}
              onChange={e=>{setPassword(e.target.value);if(error)setError("")}}
              placeholder="Geheimes Passwort" disabled={busy||status!=="ready"} aria-invalid={!!error}
              aria-describedby={error?"gate-error":"gate-help"}/>
            <button type="button" className="gate-reveal" onClick={()=>setRevealed(s=>!s)} aria-label={revealed?"Passwort verbergen":"Passwort anzeigen"} aria-pressed={revealed} disabled={status!=="ready"}>{revealed?<EyeOff size={19}/>:<Eye size={19}/>}</button>
          </div>
          {error?<div className="gate-error" id="gate-error" role="alert"><XCircle size={15}/>{error}</div>:<p className="gate-help" id="gate-help">{failed>0?"Überprüfe die Schreibweise und versuche es erneut.":"Der Zugang ist aktuell nur für eingeladene Tester vorgesehen."}</p>}
          <button className="gate-submit" type="submit" disabled={!password||busy||status!=="ready"}>
            {status==="loading"?"Portal wird vorbereitet …":status==="unavailable"?"Zugang nicht konfiguriert":busy?"Zugang wird geprüft …":"Portal betreten"}
            {busy?<span className="gate-spinner"/>:<ArrowRight size={19}/>}
          </button>
        </form>
        <div className="gate-security"><ShieldCheck size={17}/><span>Vorschau-Modus · Keine Anmeldung an deinem Spielkonto erforderlich</span></div>
        {status==="unavailable"&&<p className="gate-config-error" role="alert">Der Vorschauzugang ist derzeit nicht eingerichtet. Bitte versuche es nach der nächsten Veröffentlichung erneut.</p>}
        <div className="gate-bottom-line"><Check size={15}/> ENTWICKLUNGSVERSION <span>✦</span> DIE REISE BEGINNT HIER</div>
      </div>
    </div>
    <div className="gate-footer"><span>© DOFUS Companion · Unabhängiges Fanprojekt</span><span>DOFUS und Ankama gehören ihren jeweiligen Rechteinhabern.</span></div>
  </div>;
}
