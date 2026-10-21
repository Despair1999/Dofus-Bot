import { useEffect, useState } from "react";
import { Hammer, MapPin, Sprout } from "lucide-react";
import type {
  Character,
  ProfessionQuest,
  GatherableResource,
} from "@dofus/core";
import { api, type Config } from "../client";
import { request, message } from "../v2/shared/request";
import { navigatePath } from "../v2/routing";
import "./dungeons.css";
import ItemImage from "../v2/shared/ItemImage";
type Personal = {
  levels: { jobId: number; level: number }[];
  quests: {
    questId: number;
    quantity: number;
    completedAt: string | null;
    updatedAt: string;
  }[];
};
export default function ProfessionsPage({
  config,
  characters = [],
  activeCharacterId,
  onNavigate = navigatePath,
}: {
  config: Config;
  characters?: Character[];
  activeCharacterId?: string;
  onNavigate?: (path: string) => void;
}) {
  const [quests, setQuests] = useState<ProfessionQuest[]>([]),
    [jobs, setJobs] = useState<{ id: number; name: string }[]>([]),
    [characterId, setCharacterId] = useState(
      activeCharacterId || characters[0]?.id || "",
    ),
    [personal, setPersonal] = useState<Personal>({ levels: [], quests: [] }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [resourceJob, setResourceJob] = useState(24),
    [available, setAvailable] = useState<GatherableResource[]>([]),
    [quantities, setQuantities] = useState<Record<number, number>>({});
  useEffect(() => {
    const c = new AbortController();
    const savedLevel = personal.levels.find(
      (l) => l.jobId === resourceJob,
    )?.level;
    request<GatherableResource[]>(
      `/api/world/resources?jobId=${resourceJob}${savedLevel === undefined ? "" : `&maxLevel=${savedLevel}`}`,
      config,
      c.signal,
    )
      .then((r) =>
        setAvailable([...new Map(r.data.map((v) => [v.itemId, v])).values()]),
      )
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [config, resourceJob, personal.levels]);
  useEffect(() => {
    const c = new AbortController();
    Promise.all([
      request<ProfessionQuest[]>("/api/profession-quests", config, c.signal),
      request<{ id: number; name: string }[]>(
        "/api/professions",
        config,
        c.signal,
      ),
    ])
      .then(([q, j]) => {
        setQuests(q.data);
        setJobs(j.data);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [config]);
  useEffect(() => {
    setPersonal({ levels: [], quests: [] });
    setQuantities({});
    if (!characterId) return;
    const c = new AbortController();
    request<Personal>(
      `/api/profession-personal/${characterId}`,
      config,
      c.signal,
    )
      .then((r) => {
        setPersonal(r.data);
        setQuantities(
          Object.fromEntries(r.data.quests.map((q) => [q.questId, q.quantity])),
        );
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [characterId, config]);
  async function level(jobId: number, value: number) {
    setBusy(true);
    try {
      const r = await api<{ jobId: number; level: number }>(
        `/api/profession-personal/${characterId}/levels`,
        config,
        { jobId, level: value },
        "PUT",
      );
      setPersonal((p) => ({
        ...p,
        levels: [...p.levels.filter((l) => l.jobId !== jobId), r.data],
      }));
      setError("");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function progress(
    quest: ProfessionQuest,
    completed: boolean,
    reset = false,
  ) {
    setBusy(true);
    try {
      const r = await api<Personal["quests"][number]>(
        `/api/profession-personal/${characterId}/quests/${quest.id}`,
        config,
        { quantity: reset ? 0 : quantities[quest.id] || 0, completed },
        "PUT",
      );
      setPersonal((p) => ({
        ...p,
        quests: [...p.quests.filter((q) => q.questId !== quest.id), r.data],
      }));
      setQuantities((q) => ({ ...q, [quest.id]: r.data.quantity }));
      setError("");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const character = characters.find((c) => c.id === characterId);
  return (
    <section className="dungeon-page">
      <header className="dungeon-heading">
        <div>
          <span className="eyebrow">
            BERUFE · TÄGLICHE ZIELE · ECHTE QUESTDATEN
          </span>
          <h1>
            <Sprout /> Berufe & Sammelquests
          </h1>
          <p>
            Berufslevel pflegen, Voraussetzungen prüfen und Sammelziele
            verfolgen.
          </p>
        </div>
        <label>
          Charakter
          <select
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
          >
            <option value="">Charakter auswählen</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      {error && (
        <p role="alert" className="dungeon-alert">
          {error}
        </p>
      )}
      <div className="profession-levels">
        {jobs.map((j) => (
          <label key={j.id}>
            {j.name}
            <input
              key={`${characterId}-${j.id}-${personal.levels.find((l) => l.jobId === j.id)?.level}`}
              aria-label={`${j.name} Berufslevel`}
              type="number"
              min={1}
              max={200}
              placeholder="?"
              disabled={!characterId || busy}
              defaultValue={
                personal.levels.find((l) => l.jobId === j.id)?.level ?? ""
              }
              onBlur={(e) => {
                if (
                  e.target.value &&
                  +e.target.value !==
                    personal.levels.find((l) => l.jobId === j.id)?.level
                )
                  void level(j.id, +e.target.value);
              }}
            />
          </label>
        ))}
      </div>
      {!characterId && (
        <p className="dungeon-notice">
          Wähle einen Charakter, um Berufslevel und persönliche Fortschritte zu
          speichern.
        </p>
      )}
      <details className="profession-resource-picker">
        <summary>Verfügbare Sammelressourcen anzeigen</summary>
        <label>
          Beruf
          <select
            value={resourceJob}
            onChange={(e) => setResourceJob(+e.target.value)}
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </label>
        <p>
          {personal.levels.some((l) => l.jobId === resourceJob)
            ? "Nach gespeichertem Berufslevel gefiltert."
            : "Berufslevel unbekannt: alle Freischaltlevel werden angezeigt."}
        </p>
        <div className="dungeon-drop-list">
          {available.map((r) => (
            <article key={r.id}>
              <div className="resource-title">
                <ItemImage iconId={r.iconId} name={r.name} size={52} />
                <h3>{r.name}</h3>
              </div>
              <small>
                Ab Stufe {r.level} · {r.regions.length} bekannte Untergebiete
              </small>
              <button onClick={() => onNavigate(`/farming?resourceId=${r.id}`)}>
                Fundgebiete & Route
              </button>
            </article>
          ))}
        </div>
      </details>
      <h2>Berufsquests</h2>
      <div className="profession-quests">
        {quests.map((q) => {
          const jobLevel = personal.levels.find(
              (l) => l.jobId === q.jobId,
            )?.level,
            quantity = quantities[q.id] || 0,
            saved = personal.quests.find((p) => p.questId === q.id),
            eligible =
              character &&
              jobLevel !== undefined &&
              character.level >= q.minCharacterLevel &&
              jobLevel >= q.minJobLevel;
          return (
            <article key={q.id} className="profession-card">
              <span className="eyebrow">
                {q.jobName.toUpperCase()} · QUEST #{q.id}
              </span>
              <div className="resource-title">
                <ItemImage itemId={q.itemId} name={q.itemName} size={56} />
                <h3>{q.name}</h3>
              </div>
              <small>{q.nameFr}</small>
              <p>
                <strong>
                  {q.quantity} × {q.itemName}
                </strong>
              </p>
              <p>
                <Hammer size={14} /> {q.jobName} Stufe {q.minJobLevel} ·
                Charakterstufe {q.minCharacterLevel}
              </p>
              <p>
                {eligible
                  ? "Hinterlegte Level erfüllen die Voraussetzungen."
                  : jobLevel === undefined
                    ? "Berufslevel noch unbekannt."
                    : "Hinterlegte Level erfüllen die Voraussetzungen noch nicht."}
              </p>
              <p>
                <MapPin size={14} /> {q.npc} ·{" "}
                {q.start
                  ? `[${q.start.x},${q.start.y}] · Welt ${q.start.worldId}`
                  : "Startposition unbekannt"}
              </p>
              <progress max={q.quantity} value={quantity} />
              <label>
                Gesammelt: {quantity} / {q.quantity}
                <input
                  aria-label={`Fortschritt ${q.name}`}
                  type="number"
                  min={0}
                  max={q.quantity}
                  value={quantity}
                  disabled={!characterId || busy}
                  onChange={(e) =>
                    setQuantities((v) => ({
                      ...v,
                      [q.id]: Math.max(
                        0,
                        Math.min(q.quantity, +e.target.value),
                      ),
                    }))
                  }
                />
              </label>
              {saved?.completedAt && (
                <p>
                  Manuell abgeschlossen am{" "}
                  {new Date(saved.completedAt).toLocaleString("de-DE")}. Eine
                  neue Wiederholung setzt du selbst zurück.
                </p>
              )}
              {q.id === 945 && (
                <p className="dungeon-notice">
                  Questressource statt Marktware: Laut Guide nur Bronze in
                  Amakna abbauen. Fundstellen anderer Gebiete zählen für dieses
                  Ziel nicht. Gebietsangaben im Guide wurden 2020
                  veröffentlicht.
                </p>
              )}
              <div className="dungeon-actions">
                <button
                  disabled={!characterId || busy}
                  onClick={() => void progress(q, false)}
                >
                  Fortschritt speichern
                </button>
                <button
                  disabled={!characterId || busy || quantity !== q.quantity}
                  onClick={() => void progress(q, true)}
                >
                  Abschließen
                </button>
                {saved?.completedAt && (
                  <button
                    disabled={busy}
                    onClick={() => void progress(q, false, true)}
                  >
                    Neue Wiederholung
                  </button>
                )}
                <button onClick={() => onNavigate(`/quests/${q.id}`)}>
                  Quest öffnen
                </button>
                <button
                  onClick={() =>
                    onNavigate(
                      `/farming?questId=${q.id}${q.gatheringItemId ? `&itemId=${q.gatheringItemId}` : ""}${q.regionAreaIds.length ? `&areaIds=${q.regionAreaIds.join(",")}` : ""}`,
                    )
                  }
                >
                  Sammelroute planen
                </button>
                {q.start && (
                  <button
                    onClick={() => onNavigate(`/world?mapId=${q.start?.mapId}`)}
                  >
                    Start auf Karte
                  </button>
                )}
              </div>
              <details>
                <summary>Quellen und Datenstatus</summary>
                <p>{q.evidence}</p>
                <a href={q.source} target="_blank" rel="noreferrer">
                  Originaldaten 3.7.12.12 ↗
                </a>{" "}
                ·{" "}
                <a href={q.guide} target="_blank" rel="noreferrer">
                  Guide ↗
                </a>
                {q.warnings.map((w) => (
                  <p key={w}>
                    <small>{w}</small>
                  </p>
                ))}
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
