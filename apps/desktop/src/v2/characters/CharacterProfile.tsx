import { useEffect, useState } from "react";
import type {
  Build,
  BuilderItem,
  Character,
  GameClass,
  Progress,
  calculateBuild,
} from "@dofus/core";
import type { Config } from "../../client";
import { request, message } from "../shared/request";
import { navigatePath } from "../routing";
import ClassArtwork from "../../ui/ClassArtwork";
import { AttributeGroups, EffectRows } from "../../ui/attributes";
import ItemImage from "../shared/ItemImage";
import GameGlyph, { slotGlyph } from "../../ui/GameGlyph";
import { slotDefinitions } from "@dofus/core";
type Summary = {
  build: Build;
  calculation: ReturnType<typeof calculateBuild>;
  equipment: (BuilderItem & { slot: string })[];
};
export default function CharacterProfile({
  config,
  character,
  characters,
  classes,
  builds,
  activeId,
  onSelect,
  onEdit,
}: {
  config: Config;
  character: Character;
  characters: Character[];
  classes: GameClass[];
  builds: Build[];
  activeId: string;
  onSelect: (id: string) => void;
  onEdit: (c: Character) => void;
}) {
  const [tab, setTab] = useState("Allgemein"),
    [summary, setSummary] = useState<Summary | null>(null),
    [progress, setProgress] = useState<Progress[] | null>(null),
    [professions, setProfessions] = useState<{
      levels: { jobId: number; level: number }[];
      quests: {
        questId: number;
        quantity: number;
        completedAt: string | null;
      }[];
    } | null>(null),
    [jobs, setJobs] = useState<{ id: number; name: string }[]>([]),
    [error, setError] = useState("");
  const owned = builds.filter((b) => b.characterId === character.id),
    activeBuild = owned.find((b) => b.active),
    [buildId, setBuildId] = useState("");
  const selectedBuild =
    owned.find((b) => b.id === buildId) ?? activeBuild ?? owned[0];
  const cls = classes.find((c) => c.id === character.classId);
  useEffect(() => {
    setProgress(null);
    setProfessions(null);
    setBuildId("");
    setError("");
    const c = new AbortController();
    void Promise.allSettled([
      request<Progress[]>(
        `/api/characters/${character.id}/progress`,
        config,
        c.signal,
      ),
      request<NonNullable<typeof professions>>(
        `/api/profession-personal/${character.id}`,
        config,
        c.signal,
      ),
      request<typeof jobs>("/api/professions", config, c.signal),
    ]).then(([p, j, n]) => {
      if (c.signal.aborted) return;
      if (p.status === "fulfilled") setProgress(p.value.data);
      if (j.status === "fulfilled") setProfessions(j.value.data);
      if (n.status === "fulfilled") setJobs(n.value.data);
      if (p.status === "rejected" || j.status === "rejected")
        setError("Einige Fortschrittsdaten sind derzeit nicht verfügbar.");
    });
    return () => c.abort();
  }, [character.id, config]);
  useEffect(() => {
    setSummary(null);
    if (!selectedBuild) return;
    const c = new AbortController();
    void request<Summary>(
      `/api/builder/builds/${selectedBuild.id}/summary`,
      config,
      c.signal,
    )
      .then((r) => setSummary(r.data))
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [selectedBuild?.id, config]);
  function personal(path: string) {
    onSelect(character.id);
    navigatePath(path);
  }
  return (
    <section
      className="character-profile"
      aria-label={`Profil von ${character.name}`}
    >
      <div className="profile-heading">
        <div>
          <span className="eyebrow">DEIN PROFIL · WELT DER ZWÖLF</span>
          <h2>{character.name}</h2>
          <p>
            {cls?.nameDe ?? character.className} · Stufe {character.level} ·{" "}
            {character.server}
          </p>
        </div>
        <div className="toolbar">
          <label>
            Charakter wechseln
            <select
              aria-label="Charakterprofil wechseln"
              value={character.id}
              onChange={(e) => navigatePath(`/characters/${e.target.value}`)}
            >
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary" onClick={() => onEdit(character)}>
            Bearbeiten
          </button>
          <button
            aria-pressed={activeId === character.id}
            disabled={activeId === character.id}
            onClick={() => onSelect(character.id)}
          >
            {activeId === character.id
              ? "Aktives Profil"
              : "Als aktives Profil wählen"}
          </button>
        </div>
      </div>
      <div
        className="ui-module-tabs"
        role="tablist"
        aria-label="Charakterinformationen"
      >
        {["Allgemein", "Ausrüstung", "Fortschritt"].map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {error && (
        <p role="status" className="notice">
          {error}
        </p>
      )}
      {tab === "Allgemein" && (
        <div className="profile-general">
          <aside>
            <section className="panel">
              <h3>Dein Companion</h3>
              <dl className="profile-facts">
                <dt>Stufe</dt>
                <dd>{character.level}</dd>
                <dt>Server</dt>
                <dd>{character.server}</dd>
                <dt>Gespeicherte Builds</dt>
                <dd>{owned.length}</dd>
                <dt>Aktiver Build</dt>
                <dd>{activeBuild?.name ?? "Nicht ausgewählt"}</dd>
              </dl>
            </section>
            <section className="panel">
              <h3>Schnellaktionen</h3>
              <div className="profile-actions">
                <button
                  onClick={() =>
                    navigatePath(`/builder?characterId=${character.id}`)
                  }
                >
                  Neuen Build erstellen
                </button>
                <button
                  className="secondary"
                  onClick={() => personal("/quests")}
                >
                  Quest-Assistent öffnen
                </button>
                <button
                  className="secondary"
                  onClick={() => personal("/professions")}
                >
                  Berufe anzeigen
                </button>
                <button
                  className="secondary"
                  onClick={() => personal("/farming")}
                >
                  Farmrouten öffnen
                </button>
              </div>
            </section>
          </aside>
          <div className="profile-stage">
            <div className="profile-halo" />
            <ClassArtwork
              classId={character.classId}
              name={cls?.nameDe ?? character.className}
              hero
            />
            <strong>{cls?.nameDe ?? character.className}</strong>
            <small>
              Vorhandenes Klassenportrait · keine Darstellung getragener
              Ausrüstung
            </small>
          </div>
          <aside>
            <section className="panel">
              <h3>Deine Builds</h3>
              {owned.length ? (
                owned.map((b) => (
                  <button
                    className="profile-build"
                    key={b.id}
                    onClick={() => navigatePath(`/builder/${b.id}`)}
                  >
                    <span>
                      {b.name}
                      <small>
                        Stufe {b.level} · {b.gameVersion}
                        {b.active ? " · Aktiv im Companion" : ""}
                      </small>
                    </span>
                    <span>↗</span>
                  </button>
                ))
              ) : (
                <p className="v2-muted">Noch kein Build zugeordnet.</p>
              )}
            </section>
            <section className="panel">
              <h3>Fortschritt</h3>
              <p>
                {progress
                  ? `${progress.filter((p) => p.status === "completed").length} abgeschlossene Quests · ${progress.filter((p) => p.status === "active").length} aktive Quests`
                  : "Questfortschritt wird geladen …"}
              </p>
              {professions?.levels.length ? (
                professions.levels.map((j) => (
                  <div className="profile-job" key={j.jobId}>
                    <span>
                      {jobs.find((n) => n.id === j.jobId)?.name ??
                        `Beruf #${j.jobId}`}
                    </span>
                    <strong>{j.level}</strong>
                    <progress value={j.level} max={200} />
                  </div>
                ))
              ) : (
                <p className="v2-muted">Keine Berufslevel erfasst.</p>
              )}
            </section>
          </aside>
        </div>
      )}
      {tab === "Ausrüstung" && (
        <>
          <div className="ui-catalog-toolbar">
            <label>
              Build ansehen
              <select
                aria-label="Profilbuild"
                value={selectedBuild?.id ?? ""}
                onChange={(e) => setBuildId(e.target.value)}
              >
                {!owned.length && (
                  <option value="">Kein Build vorhanden</option>
                )}
                {owned.map((b) => (
                  <option value={b.id} key={b.id}>
                    {b.name}
                    {b.active ? " · Aktiv" : ""} · {b.gameVersion}
                  </option>
                ))}
              </select>
            </label>
            {selectedBuild && (
              <button
                onClick={() => navigatePath(`/builder/${selectedBuild.id}`)}
              >
                Im Builder öffnen
              </button>
            )}
          </div>
          {summary ? (
            <>
              <p className="v2-muted">
                Geplante Ausrüstung im Companion · DOFUS{" "}
                {summary.build.gameVersion}. Tatsächlich im Spiel getragene
                Ausrüstung ist nicht automatisch bekannt.
              </p>
              <div className="profile-equipment">
                {slotDefinitions.map(([slot, label]) => {
                  const item = summary.equipment.find((i) => i.slot === slot);
                  return (
                    <button
                      className="profile-slot secondary"
                      disabled={!item}
                      key={slot}
                      title={
                        item ? `${item.name} · Stufe ${item.level}` : label
                      }
                      onClick={() =>
                        item &&
                        navigatePath(
                          `/items/${item.id}?version=${summary.build.gameVersion}`,
                        )
                      }
                    >
                      {item ? (
                        <ItemImage item={item} itemId={item.id} size={48} />
                      ) : (
                        <GameGlyph name={slotGlyph(slot)} size={30} />
                      )}
                      <span>
                        <small>{label}</small>
                        <strong>{item?.name ?? "Leer"}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
              <section className="panel">
                <h3>Gesamtattribute</h3>
                <p className="profile-life">
                  {summary.calculation.hp.toLocaleString("de-DE")} Lebenspunkte
                </p>
                <AttributeGroups stats={summary.calculation.total} />
              </section>
              <section className="panel">
                <h3>Aktive Setboni</h3>
                {summary.calculation.activeSets.map((s) => (
                  <div key={s.id}>
                    <h4>
                      {s.name} · {s.count} Teile
                    </h4>
                    <EffectRows effects={s.effects} />
                  </div>
                ))}
                {!summary.calculation.activeSets.length && (
                  <p className="v2-muted">Keine Setboni aktiv.</p>
                )}
              </section>
            </>
          ) : (
            <div className="ui-empty">
              {selectedBuild
                ? "Builddaten werden geladen …"
                : "Ordne diesem Charakter zuerst einen Build zu."}
            </div>
          )}
        </>
      )}
      {tab === "Fortschritt" && (
        <div className="profile-progress">
          <section className="panel">
            <h3>Erfasste Quests</h3>
            {progress?.length ? (
              progress.map((p) => (
                <button
                  className="profile-build"
                  key={p.questId}
                  onClick={() => personal(`/quests/${p.questId}`)}
                >
                  <span>
                    Quest #{p.questId}
                    <small>Schritt {p.step + 1}</small>
                  </span>
                  <span>
                    {p.status === "completed"
                      ? "Abgeschlossen"
                      : p.status === "active"
                        ? "Aktiv"
                        : "Pausiert"}
                  </span>
                </button>
              ))
            ) : (
              <p className="v2-muted">Keine Questfortschritte erfasst.</p>
            )}
          </section>
          <section className="panel">
            <h3>Berufe & Sammelquests</h3>
            {professions?.levels.map((j) => (
              <div className="profile-job" key={j.jobId}>
                <span>
                  {jobs.find((n) => n.id === j.jobId)?.name ??
                    `Beruf #${j.jobId}`}
                </span>
                <strong>{j.level}</strong>
                <progress value={j.level} max={200} />
              </div>
            ))}
            {professions?.quests.map((q) => (
              <p key={q.questId}>
                Sammelquest #{q.questId} · {q.quantity} gesammelt
                {q.completedAt ? " · Abgeschlossen" : ""}
              </p>
            ))}
            {!professions?.levels.length && !professions?.quests.length && (
              <p className="v2-muted">Noch keine Berufsaktivitäten erfasst.</p>
            )}
            <p className="v2-muted">
              Ranglisten, PvP-Ränge und Achievement-Punkte werden ohne
              Datenquelle nicht angezeigt.
            </p>
          </section>
        </div>
      )}
    </section>
  );
}
