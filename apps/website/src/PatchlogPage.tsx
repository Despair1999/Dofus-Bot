import { useEffect, useState } from "react";
import { ArrowDown, CalendarDays, CheckCircle2, ChevronDown, History, Sparkles, Wrench } from "lucide-react";
import { patchNotes } from "./lib/changelog";
import "./patchlog.css";

export default function PatchlogPage() {
  const [expanded,setExpanded]=useState<string[]>(patchNotes.map((entry)=>entry.version));
  useEffect(() => {
    const id=window.location.hash.replace("#","");
    if (id && /^v\d+\.\d+\.\d+$/.test(id)) {
      requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({block:"start",behavior:"auto"}));
    }
  },[]);
  return <div className="patchlog-page">
    <section className="page-hero container patchlog-hero">
      <div className="eyebrow"><span className="tiny-gem"/> ENTWICKLUNG & UPDATES</div>
      <h1>Jedes Update.<br/><span>Ein besseres Abenteuer.</span></h1>
      <p>Die wichtigsten Verbesserungen und Fehlerbehebungen von DOFUS Companion – übersichtlich nach Version und Funktionsbereich zusammengestellt.</p>
      <div className="patchlog-hero-meta"><span><History size={16}/> {patchNotes.length} veröffentlichte Versionen</span><span><CheckCircle2 size={16}/> Redaktionell gepflegte Patchnotes</span></div>
      <a href="#patches" className="button outline">Patchnotes entdecken <ArrowDown size={17}/></a>
    </section>
    <section className="section section-tight" id="patches"><div className="container patchlog-layout">
      <aside className="patchlog-navigation" aria-label="Versionen">
        <div className="patchlog-nav-heading"><History size={17}/> VERSIONEN</div>
        {patchNotes.map((entry,index)=><a href={`#${entry.version}`} key={entry.version}><span className={index===0?"patchlog-nav-dot latest":"patchlog-nav-dot"}/><span><b>{entry.version}</b><small>{entry.date}</small></span>{index===0&&<span className="patchlog-new">NEU</span>}</a>)}
      </aside>
      <div className="patchlog-timeline">
      {patchNotes.map((entry,index)=>{const open=expanded.includes(entry.version);return <article className="patchlog-release" key={entry.version} id={entry.version}>
        <div className="patchlog-date-line"><span className="patchlog-bullet"/><CalendarDays size={14}/> {entry.date}</div>
        <div className="patchlog-card">
          <header className="patchlog-card-header"><div className="patchlog-version-line"><span className="patchlog-version">{entry.version}</span>{index===0&&<span className="patchlog-latest"><Sparkles size={12}/> AKTUELL</span>}</div><h2>{entry.title}</h2><p>{entry.subtitle}</p></header>
          <button className="patchlog-expand" type="button" aria-expanded={open} aria-controls={`changes-${entry.version}`} onClick={()=>setExpanded(prev=>open?prev.filter(v=>v!==entry.version):[...prev,entry.version])}><span>{open?"Details ausblenden":"Änderungen anzeigen"}</span><ChevronDown className={open?"is-expanded":""} size={18}/></button>
          {open&&<div className="patchlog-body" id={`changes-${entry.version}`}>{entry.groups.map(group=><section className="patchlog-group" key={group.label}><h3><Wrench size={16}/>{group.label}</h3><ul>{group.entries.map(item=><li key={item}><span className="patchlog-check"><CheckCircle2 size={15}/></span>{item}</li>)}</ul></section>)}
          {entry.caveat&&<div className="patchlog-note"><strong>Hinweis zum Datenstand</strong><p>{entry.caveat}</p></div>}</div>}
        </div>
      </article>})}
      <div className="patchlog-end"><Sparkles size={18}/><span>Fortsetzung folgt. Updates werden nach Veröffentlichung in diese Übersicht übernommen.</span></div>
      </div>
    </div></section>
  </div>;
}
