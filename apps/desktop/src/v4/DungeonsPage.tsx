import { useEffect, useState } from "react";
import {
  Castle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Search,
  Shield,
  Star,
  Swords,
} from "lucide-react";
import type {
  Character,
  DungeonSummary,
  DungeonMonster,
  DungeonEditorial,
  Build,
} from "@dofus/core";
import { api, type Config } from "../client";
import { request, message } from "../v2/shared/request";
import { navigatePath, useRoute } from "../v2/routing";
import "./dungeons.css";

type Detail = DungeonSummary & {
  version: string;
  monsters: DungeonMonster[];
  editorial: DungeonEditorial;
  importedAt: string;
  sourceSha256: string;
};
type Preparation = {
  favorite: boolean;
  players: number;
  checklist: Record<string, boolean>;
};
const checks = {
  access: "Zugang freigeschaltet",
  key: "Schlüssel vorhanden",
  build: "Build ausgewählt",
  equipment: "Ausrüstung geprüft",
  mechanics: "Mechaniken gelesen",
  achievements: "Erfolge ausgewählt",
  group: "Gruppe bereit",
  travel: "Anreise geplant",
};
const emptyPreparation = (): Preparation => ({
  favorite: false,
  players: 4,
  checklist: Object.fromEntries(Object.keys(checks).map((k) => [k, false])),
});
const elements: Record<string, string> = {
  neutral: "Neutral",
  earth: "Erde",
  fire: "Feuer",
  water: "Wasser",
  air: "Luft",
};
const tabs = [
  "Übersicht",
  "Räume",
  "Monster",
  "Bossmechaniken",
  "Strategie",
  "Vorbereitung",
  "Erfolge",
  "Drops",
  "Quellen",
];
function MonsterCard({ monster }: { monster: DungeonMonster }) {
  const [grade, setGrade] = useState(0),
    g = monster.grades[grade];
  return (
    <article className="dungeon-monster">
      <header>
        <span className="dungeon-emblem">
          <Swords size={23} />
        </span>
        <div>
          <h3>{monster.name}</h3>
          <small>
            {monster.nameFr} · #{monster.id}
          </small>
        </div>
      </header>
      <label>
        Originalgrad{" "}
        <select value={grade} onChange={(e) => setGrade(+e.target.value)}>
          {monster.grades.map((v, i) => (
            <option key={v.grade} value={i}>
              Grad {v.grade} · Stufe {v.level}
            </option>
          ))}
        </select>
      </label>
      {g && (
        <>
          <p>
            <strong>{g.lifePoints.toLocaleString("de-DE")} LP</strong> ·{" "}
            {g.actionPoints} AP · {g.movementPoints} MP
          </p>
          <div className="dungeon-resistances">
            {Object.entries(g.resistances).map(([element, value]) => (
              <div key={element}>
                <span>{elements[element]}</span>
                <meter min={-100} max={100} value={value} />
                <b>{value}%</b>
              </div>
            ))}
          </div>
        </>
      )}
      <details>
        <summary>{monster.spells.length} zugeordnete Zauber</summary>
        {monster.spells.map((s) => (
          <div className="dungeon-spell" key={s.id}>
            <b>{s.name}</b>
            <p>
              {s.description || "Kein übersetzter Beschreibungstext vorhanden."}
            </p>
            {s.ranks.map((r) => (
              <small key={r.grade}>
                Grad {r.grade}: {r.apCost} AP · RW {r.minRange}–{r.range} ·
                Intervall {r.minCastInterval} · {r.effects.length} Roh-Effekte
                <br />
              </small>
            ))}
          </div>
        ))}
      </details>
      <small>
        Originalgrade sind keine verifizierten Skalierungen nach Gruppengröße.
        Bild noch nicht lokal freigegeben.
      </small>
    </article>
  );
}
export default function DungeonsPage({
  config,
  characters = [],
}: {
  config: Config;
  characters?: Character[];
  onNavigate?: (path: string) => void;
}) {
  const route = useRoute();
  const [version, setVersion] = useState("3.7.12.12"),
    [q, setQ] = useState(""),
    [min, setMin] = useState(0),
    [max, setMax] = useState(200),
    [page, setPage] = useState(1),
    [rows, setRows] = useState<DungeonSummary[]>([]),
    [total, setTotal] = useState(0),
    [selected, setSelected] = useState<number | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [tab, setTab] = useState("Übersicht"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [report, setReport] = useState<Record<string, number | string>>({}),
    [characterId, setCharacterId] = useState(characters[0]?.id || ""),
    [prep, setPrep] = useState<Preparation>(emptyPreparation),
    [editor, setEditor] = useState(""),
    [builds, setBuilds] = useState<Build[]>([]),
    [buildStats, setBuildStats] = useState<
      { name: string; total: Record<string, number>; warnings: string[] }[]
    >([]),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    if (route.id) setSelected(route.id);
  }, [route.id]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      request<DungeonSummary[]>(
        `/api/dungeons?version=${version}&q=${encodeURIComponent(q)}&minLevel=${min}&maxLevel=${max}&page=${page}&pageSize=30`,
        config,
        controller.signal,
      )
        .then((r) => {
          setRows(r.data);
          setTotal(r.total || 0);
          setError("");
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(message(e));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [config, version, q, min, max, page]);
  useEffect(() => {
    const c = new AbortController();
    request<Record<string, number | string>>(
      `/api/dungeons/report?version=${version}`,
      config,
      c.signal,
    )
      .then((r) => setReport(r.data))
      .catch(() => {});
    return () => c.abort();
  }, [config, version]);
  useEffect(() => {
    if (selected === null) return;
    const c = new AbortController();
    setDetail(null);
    request<Detail>(
      `/api/dungeons/${selected}?version=${version}`,
      config,
      c.signal,
    )
      .then((r) => {
        setDetail(r.data);
        setEditor(
          JSON.stringify(
            {
              status: r.data.editorial.status,
              versionNote: r.data.editorial.versionNote,
              mechanicsVerified: r.data.editorial.mechanicsVerified ?? false,
              mechanics: r.data.editorial.mechanics,
              strategy: r.data.editorial.strategy,
              sources: r.data.editorial.sources,
              rooms: r.data.editorial.rooms,
            },
            null,
            2,
          ),
        );
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [selected, version, config]);
  useEffect(() => {
    setPrep(emptyPreparation());
    if (!characterId || selected === null) return;
    const c = new AbortController();
    request<Preparation>(
      `/api/dungeon-personal/${characterId}/${selected}?version=${version}`,
      config,
      c.signal,
    )
      .then((r) =>
        setPrep({
          ...r.data,
          checklist: { ...emptyPreparation().checklist, ...r.data.checklist },
        }),
      )
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [characterId, selected, version, config]);
  useEffect(() => {
    setBuildStats([]);
    if (!characterId) return;
    const c = new AbortController();
    request<Build[]>(
      `/api/builder/builds?characterId=${characterId}`,
      config,
      c.signal,
    )
      .then((r) => setBuilds(r.data))
      .catch(() => setBuilds([]));
    return () => c.abort();
  }, [characterId, config]);
  async function savePreparation(next: Preparation) {
    if (!characterId || selected === null) return;
    setSaving(true);
    try {
      await api(
        `/api/dungeon-personal/${characterId}/${selected}?version=${version}`,
        config,
        next,
        "PUT",
      );
      setPrep(next);
      setError("");
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  }
  async function compareBuilds() {
    try {
      const same = builds.filter((b) => b.gameVersion === version);
      const summaries = await Promise.all(
        same.map((b) =>
          api<{
            build: Build;
            calculation: { total: Record<string, number>; warnings: string[] };
          }>(`/api/builder/builds/${b.id}/summary`, config),
        ),
      );
      setBuildStats(
        summaries.map((r) => ({
          name: r.data.build.name,
          total: r.data.calculation.total,
          warnings: r.data.calculation.warnings,
        })),
      );
      if (!same.length)
        setError(
          "Keine gespeicherten Builds für diese Spielversion vorhanden.",
        );
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <section className="dungeon-page">
      <header className="dungeon-heading">
        <div>
          <span className="eyebrow">
            ENZYKLOPÄDIE · VERSIONIERTE ORIGINALDATEN
          </span>
          <h1>
            <Castle /> Dungeons & Bosse
          </h1>
          <p>Bosswerte, Zauber, Drops und deine Vorbereitung an einem Ort.</p>
        </div>
        <label>
          Datenstand
          <select
            value={version}
            onChange={(e) => {
              setVersion(e.target.value);
              setPage(1);
            }}
          >
            <option>3.7.12.12</option>
            <option>3.6.12.16</option>
          </select>
        </label>
      </header>
      {error && (
        <p role="alert" className="dungeon-alert">
          {error}
        </p>
      )}
      <div className="dungeon-metrics">
        {[
          ["Katalogeinträge", report.catalogDungeons],
          ["Bossmonster", report.uniqueBosses],
          ["Monster", report.monsters],
          ["Geprüfte Strategien", report.verifiedStrategies],
        ].map(([label, value]) => (
          <div key={label}>
            <b>{value ?? "–"}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="dungeon-layout">
        <aside className="dungeon-list">
          <label className="dungeon-search">
            <Search size={17} />
            <input
              aria-label="Dungeons durchsuchen"
              placeholder="Dungeon, Boss oder Gebiet …"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <div className="dungeon-levels">
            <label>
              Ab Stufe
              <input
                type="number"
                min={0}
                max={200}
                value={min}
                onChange={(e) => {
                  setMin(+e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              Bis Stufe
              <input
                type="number"
                min={0}
                max={200}
                value={max}
                onChange={(e) => {
                  setMax(+e.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>
          <p>
            <small>
              {loading
                ? "Katalog wird geladen …"
                : `${total} Einträge · Aktivität nicht pauschal verifiziert`}
            </small>
          </p>
          {rows.map((d) => (
            <button
              className={`dungeon-row ${selected === d.id ? "selected" : ""}`}
              key={d.id}
              onClick={() => {
                setSelected(d.id);
                setTab("Übersicht");
              }}
            >
              <span className="dungeon-emblem">
                <Castle size={22} />
              </span>
              <span>
                <b>{d.name}</b>
                <small>
                  {d.bossNames.join(", ") || "Bosszuordnung unbekannt"}
                </small>
                <small>
                  {d.region} · Stufe {d.level}
                </small>
              </span>
              <ChevronRight size={15} />
            </button>
          ))}
          {!loading && !rows.length && <p>Keine Dungeons für diese Suche.</p>}
          <div className="dungeon-pagination">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Vorige Seite"
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {page} / {Math.max(1, Math.ceil(total / 30))}
            </span>
            <button
              disabled={page * 30 >= total}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Nächste Seite"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </aside>
        <main className="dungeon-detail">
          {!detail ? (
            <div className="dungeon-empty">
              <Castle size={60} />
              <h2>
                {selected === null
                  ? "Wähle deinen nächsten Dungeon"
                  : "Dungeon wird geladen …"}
              </h2>
              <p>
                Originaldaten und redaktionelle Strategien werden getrennt
                ausgewiesen.
              </p>
            </div>
          ) : (
            <>
              <header className="dungeon-detail-heading">
                <span className="dungeon-emblem large">
                  <Castle size={42} />
                </span>
                <div>
                  <span className="eyebrow">
                    STUFE {detail.level} · {version}
                  </span>
                  <h2>{detail.name}</h2>
                  <p>
                    {detail.bossNames.join(" · ") ||
                      "Keine explizite Bossreferenz"}
                  </p>
                  <small>
                    <MapPin size={13} />{" "}
                    {detail.entrance
                      ? `[${detail.entrance.x},${detail.entrance.y}] · Welt ${detail.entrance.worldId} · Map ${detail.entrance.mapId}`
                      : "Eingangsposition unbekannt"}
                  </small>
                </div>
              </header>
              <div className="dungeon-actions">
                <button
                  disabled={!detail.entrance}
                  onClick={() =>
                    navigatePath(`/world?mapId=${detail.entrance?.mapId}`)
                  }
                >
                  <MapPin size={16} /> Zum Dungeon
                </button>
                <button
                  disabled={!characterId || saving}
                  onClick={() =>
                    void savePreparation({ ...prep, favorite: !prep.favorite })
                  }
                >
                  <Star
                    size={16}
                    fill={prep.favorite ? "currentColor" : "none"}
                  />{" "}
                  Favorisieren
                </button>
                <a
                  href={
                    detail.guideUrls?.[0] ||
                    "https://www.dofuspourlesnoobs.com/donjons.html"
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Dungeon-Guide ↗
                </a>
              </div>
              <nav className="dungeon-tabs" aria-label="Dungeoninformationen">
                {tabs.map((t) => (
                  <button
                    key={t}
                    className={t === tab ? "selected" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </nav>
              {tab === "Übersicht" && (
                <div>
                  <div className="dungeon-info-grid">
                    <article>
                      <h3>Zugang</h3>
                      <p>Mindeststufe laut Katalog: {detail.minLevel}</p>
                      <p>{detail.entrance?.subAreaName || detail.region}</p>
                      <p>
                        {detail.keys.length
                          ? detail.keys
                              .map((k) => `${k.quantity} × ${k.name}`)
                              .join(", ")
                          : "Keine Schlüsselreferenz im Katalog. Weitere Voraussetzungen unbekannt."}
                      </p>
                    </article>
                    <article>
                      <h3>Datenabdeckung</h3>
                      <p>
                        {detail.mapIds.length} zugeordnete Karten ·{" "}
                        {detail.monsters.length} Gebietsmonster
                      </p>
                      <p>
                        Strategie:{" "}
                        {detail.editorial.status === "verified"
                          ? "Versionsbezogen geprüft"
                          : "Redaktionelle Prüfung ausstehend"}
                      </p>
                      <p>
                        Ein Katalogeintrag beweist keine aktuelle
                        Zugänglichkeit.
                      </p>
                    </article>
                  </div>
                  <h3>Bossmonster</h3>
                  <div className="dungeon-monster-grid">
                    {detail.monsters
                      .filter((m) => detail.bossIds.includes(m.id))
                      .map((m) => (
                        <MonsterCard key={m.id} monster={m} />
                      ))}
                  </div>
                </div>
              )}
              {tab === "Räume" && (
                <div>
                  <label>
                    Gruppengröße
                    <select
                      value={prep.players}
                      onChange={(e) =>
                        setPrep((p) => ({ ...p, players: +e.target.value }))
                      }
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n}>
                          {n} Spieler
                        </option>
                      ))}
                    </select>
                  </label>
                  {detail.editorial.rooms.filter(
                    (r) => r.players === prep.players,
                  ).length ? (
                    detail.editorial.rooms
                      .filter((r) => r.players === prep.players)
                      .sort((a, b) => a.order - b.order)
                      .map((r, i) => (
                        <article key={i}>
                          <h3>
                            {r.type === "boss"
                              ? "Bossraum"
                              : r.type === "wave"
                                ? "Welle"
                                : "Raum"}{" "}
                            {r.order}
                          </h3>
                          <p>Map-ID {r.mapId}</p>
                          {r.monsters.map((m) => (
                            <p key={m.id}>
                              {m.count} ×{" "}
                              {detail.monsters.find((v) => v.id === m.id)
                                ?.name || `Monster #${m.id}`}
                            </p>
                          ))}
                        </article>
                      ))
                  ) : (
                    <p className="dungeon-notice">
                      Keine belegte Raumzusammenstellung für {prep.players}{" "}
                      Spieler. Die Quelle liefert Kartenzugehörigkeiten, jedoch
                      keine verlässliche Raumreihenfolge, Monsteranzahl oder
                      Gruppenskalierung.
                    </p>
                  )}
                  <details>
                    <summary>
                      {detail.mapIds.length} zugeordnete Map-IDs (ohne
                      Reihenfolge)
                    </summary>
                    <p>{detail.mapIds.join(", ")}</p>
                  </details>
                </div>
              )}
              {tab === "Monster" && (
                <>
                  <p className="dungeon-notice">
                    Gebietsmonster sind keine bestätigte Raumzusammenstellung.
                  </p>
                  <div className="dungeon-monster-grid">
                    {detail.monsters.map((m) => (
                      <MonsterCard key={m.id} monster={m} />
                    ))}
                  </div>
                </>
              )}
              {(tab === "Bossmechaniken" || tab === "Strategie") && (
                <div>
                  {detail.editorial.versionNote && (
                    <p className="dungeon-notice">
                      {detail.editorial.versionNote}
                    </p>
                  )}
                  {detail.editorial.status !== "verified" && (
                    <p className="dungeon-notice">
                      Dieser Leitfaden ist noch unvollständig. Einzelne belegte
                      Mechaniken sind im Quellenreiter dokumentiert. Automatisch
                      importierte Zauberwerte ersetzen keine geprüfte
                      Bossmechanik.
                    </p>
                  )}
                  {(tab === "Bossmechaniken"
                    ? detail.editorial.mechanics
                    : detail.editorial.strategy
                  ).length ? (
                    <ol>
                      {(tab === "Bossmechaniken"
                        ? detail.editorial.mechanics
                        : detail.editorial.strategy
                      ).map((text, i) => (
                        <li key={i}>{text}</li>
                      ))}
                    </ol>
                  ) : (
                    <p>
                      Für diesen Boss liegt noch kein belegter deutschsprachiger
                      Eintrag vor. Nutze das verlinkte Guideverzeichnis und
                      prüfe dessen Spielversion.
                    </p>
                  )}
                </div>
              )}
              {tab === "Vorbereitung" && (
                <div>
                  <h3>
                    <Shield size={19} /> Deine Vorbereitung
                  </h3>
                  <label>
                    Charakter
                    <select
                      value={characterId}
                      onChange={(e) => setCharacterId(e.target.value)}
                    >
                      <option value="">Charakter wählen</option>
                      {characters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · Stufe {c.level}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="dungeon-checklist">
                    {Object.entries(checks).map(([key, label]) => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          disabled={!characterId || saving}
                          checked={prep.checklist[key] || false}
                          onChange={(e) =>
                            void savePreparation({
                              ...prep,
                              checklist: {
                                ...prep.checklist,
                                [key]: e.target.checked,
                              },
                            })
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <p>
                    <small>
                      Bestände und Freischaltungen werden manuell bestätigt.
                    </small>
                  </p>
                  <button
                    disabled={!characterId}
                    onClick={() => void compareBuilds()}
                  >
                    Gespeicherte Builds vergleichen
                  </button>
                  <button onClick={() => navigatePath("/builder")}>
                    Builder öffnen
                  </button>
                  {buildStats.map((b, i) => (
                    <article key={i}>
                      <h4>{b.name}</h4>
                      <p>
                        {b.total[9] ?? 0} Vitalität · {b.total[12] ?? 0} AP ·{" "}
                        {b.total[8] ?? 0} MP · {b.total[31] ?? 0} RW
                      </p>
                      <p>
                        Eigenschaften: Stärke {b.total[45] ?? 0}, Intelligenz{" "}
                        {b.total[13] ?? 0}, Glück {b.total[22] ?? 0},
                        Beweglichkeit {b.total[36] ?? 0}.
                      </p>
                      <p>{b.warnings?.join(" · ")}</p>
                      {detail.monsters
                        .filter((m) => detail.bossIds.includes(m.id))
                        .map((monster) => {
                          const grade = monster.grades[0];
                          if (!grade) return null;
                          const mapping = [
                            { element: "earth", stat: 45 },
                            { element: "fire", stat: 13 },
                            { element: "water", stat: 22 },
                            { element: "air", stat: 36 },
                          ];
                          const strongest = [...mapping].sort(
                            (left, right) =>
                              (b.total[right.stat] ?? 0) -
                              (b.total[left.stat] ?? 0),
                          )[0];
                          const weakest = [...mapping]
                            .filter((value) =>
                              Number.isFinite(grade.resistances[value.element]),
                            )
                            .sort(
                              (left, right) =>
                                grade.resistances[left.element] -
                                grade.resistances[right.element],
                            )[0];
                          return (
                            <p key={monster.id}>
                              <strong>
                                {monster.name} · Originalgrad {grade.grade}:
                              </strong>{" "}
                              {weakest
                                ? `Niedrigste Elementarresistenz: ${elements[weakest.element]} ${grade.resistances[weakest.element]} %. `
                                : "Resistenzen unvollständig. "}
                              Höchstes Elementarattribut dieses Builds:{" "}
                              {elements[strongest.element]} (
                              {b.total[strongest.stat] ?? 0}); Bossresistenz
                              dafür:{" "}
                              {Number.isFinite(
                                grade.resistances[strongest.element],
                              )
                                ? `${grade.resistances[strongest.element]} %`
                                : "unbekannt"}
                              . Zauber, Schadensboni und Zustandsmechaniken
                              müssen zusätzlich geprüft werden.
                            </p>
                          );
                        })}
                    </article>
                  ))}
                  <p>
                    Elementarschwächen ergeben sich aus dem gewählten
                    Originalgrad im Monster-Reiter. Ohne belegte Mechaniken wird
                    keine Gewinnprognose erzeugt.
                  </p>
                </div>
              )}
              {tab === "Erfolge" && (
                <div>
                  {detail.achievements.map((a) => (
                    <article className="dungeon-spell" key={a.id}>
                      <h3>{a.name}</h3>
                      <p>{a.description}</p>
                      <small>
                        {a.points} Erfolgspunkte · #{a.id}
                      </small>
                    </article>
                  ))}
                  {!detail.achievements.length && (
                    <p>Keine Erfolgsreferenzen vorhanden.</p>
                  )}
                </div>
              )}
              {tab === "Drops" && (
                <div>
                  <p className="dungeon-notice">
                    Basisraten pro Originalgrad. Bedingungen, Beutechance und
                    Modifikatoren im Spiel können die tatsächliche Ausbeute
                    ändern.
                  </p>
                  {detail.monsters
                    .filter((m) => detail.bossIds.includes(m.id))
                    .map((m) => (
                      <details key={m.id} open>
                        <summary>
                          {m.name}: {m.drops.length} Dropdatensätze
                        </summary>
                        <div className="dungeon-drop-list">
                          {m.drops.map((d, i) => (
                            <article key={`${d.itemId}-${i}`}>
                              <a
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigatePath(`/items/${d.itemId}`);
                                }}
                                href={`#/items/${d.itemId}`}
                              >
                                {d.name}
                              </a>
                              <small>Grad 1–5: {d.rates.join(" / ")}%</small>
                              {d.conditions && (
                                <small>
                                  Bedingung (Original): {d.conditions}
                                </small>
                              )}
                              {!!d.recipes.length && (
                                <small>
                                  In {d.recipes.length} Rezepten verwendet
                                </small>
                              )}
                            </article>
                          ))}
                        </div>
                      </details>
                    ))}
                </div>
              )}
              {tab === "Quellen" && (
                <div>
                  <p>
                    Datenimport:{" "}
                    {new Date(detail.importedAt).toLocaleString("de-DE")}
                  </p>
                  <p>
                    <a href={detail.source} target="_blank" rel="noreferrer">
                      Originaldaten {version} ↗
                    </a>
                  </p>
                  <p className="dungeon-hash">SHA-256: {detail.sourceSha256}</p>
                  {detail.editorial.sources.map((s) => (
                    <p key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.url}
                      </a>{" "}
                      · {s.version} · {s.checkedAt}
                    </p>
                  ))}
                  <details>
                    <summary>Redaktioneller Ergänzungsworkflow</summary>
                    <p>
                      Eigene Fakten, Raumbelege und Strategie ergänzen. Status
                      „verified“ erfordert Quellen, Prüfdatum und exakt passende
                      Version. Keine fremden Volltexte übernehmen.
                    </p>
                    <textarea
                      aria-label="Redaktioneller Dungeon-Datensatz"
                      rows={16}
                      value={editor}
                      onChange={(e) => setEditor(e.target.value)}
                    />
                    <button
                      disabled={saving}
                      onClick={async () => {
                        setSaving(true);
                        try {
                          const r = await api<DungeonEditorial>(
                            `/api/dungeons/${detail.id}/editorial?version=${version}`,
                            config,
                            JSON.parse(editor),
                            "PUT",
                          );
                          setDetail({ ...detail, editorial: r.data });
                          setError("");
                        } catch (e) {
                          setError(message(e));
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      Redaktionellen Stand speichern
                    </button>
                  </details>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </section>
  );
}
