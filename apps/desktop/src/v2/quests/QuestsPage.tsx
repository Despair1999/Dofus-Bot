import { useEffect, useMemo, useState } from "react";
import { navigatePath } from "../routing";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  ExternalLink,
  Filter,
  Flag,
  MapPin,
  Pause,
  Search,
  Star,
} from "lucide-react";
import type { Progress } from "@dofus/core";
import type { Quest } from "@dofus/game-data";
import type { Config } from "../../client";
import { openExternal } from "../../native";
import { read, write } from "../../storage";
import { request, message, type PageEnvelope } from "../shared/request";
import ItemImage from "../shared/ItemImage";
import "./quests.css";
interface QuestCategory {
  id: string;
  parentId: string | null;
  name: string;
  kind: "achievement" | "quest";
  questCount: number;
  questIds: number[];
}
type QuestMaterial = {
  itemId: number;
  quantity: number;
  name?: string;
  imageUrl?: string;
  category?: string;
};
type RichQuest = Quest & {
  description?: string;
  categoryIds?: string[];
  achievements?: { id: number; name: string; categoryId: string }[];
  materials?: QuestMaterial[];
  guideUrl?: string;
  guides?: { name?: string; url: string }[];
  rewards?: unknown[];
  npcs?: {
    id: number;
    name?: string;
    coordinates?: { x: number; y: number };
  }[];
};
export interface QuestsPageProps {
  config: Config;
  selectedId?: number;
  initialQuery?: string;
  activeCharacterId?: string;
  progress: Pick<Progress, "questId" | "step" | "status" | "version">[];
  onQuestSelect: (id: number) => void;
  onProgress: (
    quest: Quest,
    step: number,
    status: Progress["status"],
  ) => void | Promise<void>;
  onFavorite?: (quest: Quest) => void;
  navigateItem?: (id: number, category?: string) => void;
}
export default function QuestsPage({
  config,
  selectedId,
  initialQuery,
  activeCharacterId,
  progress,
  onQuestSelect,
  onProgress,
  onFavorite,
  navigateItem,
}: QuestsPageProps) {
  const [categories, setCategories] = useState<QuestCategory[]>([]),
    [expanded, setExpanded] = useState<Set<string>>(new Set()),
    [categoryId, setCategoryId] = useState(""),
    [query, setQuery] = useState(initialQuery ?? ""),
    [committed, setCommitted] = useState(initialQuery ?? ""),
    [status, setStatus] = useState(""),
    [minLevel, setMinLevel] = useState(""),
    [maxLevel, setMaxLevel] = useState(""),
    [page, setPage] = useState(1),
    [quests, setQuests] = useState<PageEnvelope<RichQuest[]>>({
      data: [],
      total: 0,
    }),
    [quest, setQuest] = useState<RichQuest | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [history, setHistory] = useState<{ id: number; name: string }[]>([]),
    [showHistory, setShowHistory] = useState(false);
  useEffect(() => {
    if (initialQuery !== undefined) {
      setQuery(initialQuery);
      setCommitted(initialQuery);
    }
  }, [initialQuery]);
  useEffect(() => {
    const c = new AbortController();
    void request<QuestCategory[]>("/api/quest-categories", config, c.signal)
      .then((result) => {
        setCategories(result.data);
        setExpanded(
          new Set(result.data.filter((v) => !v.parentId).map((v) => v.id)),
        );
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    void read<{ id: number; name: string }[]>("quests:history", []).then(
      setHistory,
    );
    return () => c.abort();
  }, [config.url, config.token]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setCommitted(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    const p = new URLSearchParams({
      q: committed,
      lang: "de",
      page: String(page),
      pageSize: "25",
    });
    if (categoryId) p.set("categoryId", categoryId);
    if (minLevel) p.set("minLevel", minLevel);
    if (maxLevel) p.set("maxLevel", maxLevel);
    if (status && activeCharacterId) {
      p.set("characterId", activeCharacterId);
      p.set("status", status);
    }
    void request<RichQuest[]>(`/api/quests?${p}`, config, c.signal)
      .then((result) => {
        if (!c.signal.aborted) {
          setQuests(result);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setError(message(e));
          setLoading(false);
        }
      });
    return () => c.abort();
  }, [
    committed,
    page,
    categoryId,
    minLevel,
    maxLevel,
    status,
    activeCharacterId,
    progress,
    config.url,
    config.token,
  ]);
  useEffect(() => {
    if (!selectedId) {
      setQuest(null);
      return;
    }
    const c = new AbortController();
    void request<RichQuest>(
      `/api/quests/${selectedId}?lang=de`,
      config,
      c.signal,
    )
      .then((result) => {
        if (c.signal.aborted) return;
        setQuest(result.data);
        setHistory((previous) => {
          const next = [
            { id: result.data.id, name: result.data.name },
            ...previous.filter((v) => v.id !== result.data.id),
          ].slice(0, 15);
          void write("quests:history", next);
          return next;
        });
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [selectedId, config.url, config.token]);
  const byProgress = useMemo(
    () => new Map(progress.map((p) => [p.questId, p])),
    [progress],
  );
  const roots = categories.filter(
    (c) => !c.parentId || !categories.some((p) => p.id === c.parentId),
  );
  const current = quest ? byProgress.get(quest.id) : undefined;
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const total = quests.total ?? quests.data.length;
  const pages = Math.max(1, Math.ceil(total / (quests.pageSize ?? 25)));
  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function categoryRow(
    category: QuestCategory,
    depth: number,
    path: Set<string>,
  ) {
    if (path.has(category.id)) return null;
    const children = categories.filter((c) => c.parentId === category.id);
    const done = category.questIds.filter(
      (id) => byProgress.get(id)?.status === "completed",
    ).length;
    const nextPath = new Set(path).add(category.id);
    return (
      <div key={category.id}>
        <div
          className={`v2-category-row ${categoryId === category.id ? "selected" : ""}`}
          style={{ paddingLeft: 10 + depth * 13 }}
        >
          {children.length ? (
            <button
              className="v2-category-toggle"
              aria-label={`${category.name} ${expanded.has(category.id) ? "zuklappen" : "aufklappen"}`}
              aria-expanded={expanded.has(category.id)}
              onClick={() => toggle(category.id)}
            >
              {expanded.has(category.id) ? (
                <ChevronDown size={13} />
              ) : (
                <ChevronRight size={13} />
              )}
            </button>
          ) : (
            <span className="v2-category-dot" />
          )}
          <button
            className="v2-category-select"
            onClick={() => {
              setCategoryId(category.id);
              setPage(1);
            }}
          >
            <span>{category.name}</span>
            <small>
              {activeCharacterId
                ? `${done}/${category.questCount}`
                : category.questCount}
            </small>
          </button>
        </div>
        {expanded.has(category.id) &&
          children.map((child) => categoryRow(child, depth + 1, nextPath))}
      </div>
    );
  }
  return (
    <div className="v2-quests-page">
      <div className="v2-page-intro">
        <span className="eyebrow">DEIN QUESTJOURNAL</span>
        <h2>Jede Geschichte beginnt mit einem Schritt.</h2>
        <p>
          Kategorien und Zusammenhänge stammen aus den importierten
          Spieltabellen. Fortschritt wird nur durch deine Bestätigung geändert.
        </p>
      </div>
      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}
      <div className="v2-quest-tools">
        <div className="v2-quest-search">
          <Search size={18} />
          <input
            aria-label="Quests durchsuchen"
            placeholder="Deutscher oder französischer Questname …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label>
          <Filter size={14} />
          <select
            aria-label="Queststatus filtern"
            value={status}
            disabled={!activeCharacterId}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Alle Quests</option>
            <option value="open">Noch offen</option>
            <option value="active">Aktiv</option>
            <option value="paused">Pausiert</option>
            <option value="completed">Abgeschlossen</option>
          </select>
        </label>
        <input
          aria-label="Questlevel von"
          type="number"
          min={1}
          max={200}
          value={minLevel}
          onChange={(e) => {
            setMinLevel(e.target.value);
            setPage(1);
          }}
          placeholder="Level von"
        />
        <input
          aria-label="Questlevel bis"
          type="number"
          min={1}
          max={200}
          value={maxLevel}
          onChange={(e) => {
            setMaxLevel(e.target.value);
            setPage(1);
          }}
          placeholder="bis"
        />
        <button
          className="secondary"
          onClick={() => setShowHistory(!showHistory)}
        >
          Verlauf
        </button>
      </div>
      {showHistory && (
        <div className="v2-quest-history">
          {history.length ? (
            history.map((h) => (
              <button key={h.id} onClick={() => onQuestSelect(h.id)}>
                {h.name}
              </button>
            ))
          ) : (
            <span>Noch keine Quest geöffnet.</span>
          )}
        </div>
      )}
      <div className="v2-quest-columns">
        <aside className="v2-quest-categories">
          <div className="v2-quest-column-heading">
            <BookOpen size={17} />
            <strong>Questkategorien</strong>
          </div>
          <button
            className={`v2-category-all ${!categoryId ? "selected" : ""}`}
            onClick={() => {
              setCategoryId("");
              setPage(1);
            }}
          >
            <span>Alle Quests</span>
            <ChevronRight size={14} />
          </button>
          <div className="v2-category-tree">
            {roots.map((c) => categoryRow(c, 0, new Set()))}
          </div>
          {!categories.length && (
            <p className="v2-column-empty">
              Nach dem Spieldatenimport erscheinen hier die tatsächlichen Quest-
              und Erfolgskategorien.
            </p>
          )}
        </aside>
        <section className="v2-quest-list">
          <div className="v2-quest-column-heading">
            <strong>{selectedCategory?.name || "Alle Quests"}</strong>
            <span>{total.toLocaleString("de-DE")}</span>
          </div>
          <div className="v2-quest-list-scroll">
            {loading ? (
              <p role="status" className="v2-column-empty">
                Quests werden geladen …
              </p>
            ) : quests.data.length ? (
              quests.data.map((q) => {
                const p = byProgress.get(q.id);
                return (
                  <button
                    className={`v2-quest-list-card ${selectedId === q.id ? "selected" : ""}`}
                    key={q.id}
                    onClick={() => onQuestSelect(q.id)}
                  >
                    <div className="v2-quest-list-title">
                      <BookOpen size={18} />
                      <strong>{q.name}</strong>
                    </div>
                    <span className="v2-quest-level">
                      Stufe {q.level ?? "unbekannt"}
                    </span>
                    <small>
                      {p?.status === "completed"
                        ? "Abgeschlossen"
                        : p?.status === "active"
                          ? "In Arbeit"
                          : p?.status === "paused"
                            ? "Pausiert"
                            : "Nicht begonnen"}
                    </small>
                    <p>
                      {q.description || q.steps[0]?.description || q.nameFr}
                    </p>
                    {p && q.steps.length > 0 && (
                      <div className="v2-progress">
                        <span
                          style={{
                            width: `${p.status === "completed" ? 100 : Math.min(100, (p.step / q.steps.length) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="v2-column-empty">
                Keine Quest entspricht deinen Filtern.
              </p>
            )}
          </div>
          <div className="v2-quest-list-pagination">
            <button
              className="icon-button"
              aria-label="Vorherige Questseite"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              <ArrowLeft size={15} />
            </button>
            <small>
              {page} / {pages}
            </small>
            <button
              className="icon-button"
              aria-label="Nächste Questseite"
              disabled={page >= pages || loading}
              onClick={() => setPage(page + 1)}
            >
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
        <section className="v2-quest-detail">
          {quest ? (
            <>
              <div className="v2-quest-detail-heading">
                <span className="eyebrow">QUEST · STUFE {quest.level}</span>
                {onFavorite && (
                  <button
                    className="icon-button"
                    title="Quest favorisieren"
                    onClick={() => onFavorite(quest)}
                  >
                    <Star size={18} />
                  </button>
                )}
              </div>
              <h2>{quest.name}</h2>
              {quest.nameFr && quest.nameFr !== quest.name && (
                <p className="v2-french-name">{quest.nameFr}</p>
              )}
              {quest.description && <p>{quest.description}</p>}
              {quest.achievements?.length ? (
                <div className="v2-quest-achievements">
                  {quest.achievements.map((a) => (
                    <span key={a.id}>
                      <Flag size={12} />
                      {a.name}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="v2-quest-progress-summary">
                <span>
                  {activeCharacterId
                    ? current?.status === "completed"
                      ? "Von dir abgeschlossen"
                      : current
                        ? `Schritt ${Math.min(current.step + 1, quest.steps.length)} von ${quest.steps.length}`
                        : "Noch nicht begonnen"
                    : "Wähle einen Charakter für deinen Fortschritt"}
                </span>
                <div className="v2-progress">
                  <span
                    style={{
                      width:
                        current?.status === "completed"
                          ? "100%"
                          : `${quest.steps.length ? ((current?.step ?? 0) / quest.steps.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              {quest.requirements && (
                <details className="v2-quest-requirements">
                  <summary>Voraussetzungen aus den Spieldaten</summary>
                  <p>{quest.requirements}</p>
                  <small>
                    Technische Kriterien werden unverändert angezeigt, wenn
                    keine zuverlässige Auflösung verfügbar ist.
                  </small>
                </details>
              )}
              <div className="v2-quest-steps">
                {quest.steps.map((step, index) => (
                  <article
                    className={`v2-quest-step ${index === (current?.step ?? 0) ? "current" : ""}`}
                    key={step.id}
                  >
                    <div className="v2-step-index">
                      {current?.status === "completed" ||
                      (current && index < current.step) ? (
                        <Check size={13} />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div>
                      <h3>{step.name || `Schritt ${index + 1}`}</h3>
                      {step.description && <p>{step.description}</p>}
                      <ul>
                        {step.objectives.map((objective) => (
                          <li key={objective.id}>
                            {objective.description ||
                              "Für dieses Ziel ist kein übersetzter Text hinterlegt."}
                            {objective.coordinates && (
                              <button
                                className="v2-quest-coordinate"
                                title="Auf der Weltkarte anzeigen"
                                onClick={() =>
                                  navigatePath(
                                    objective.mapId
                                      ? `/world?mapId=${objective.mapId}`
                                      : `/world?x=${objective.coordinates!.x}&y=${objective.coordinates!.y}`,
                                  )
                                }
                              >
                                <MapPin size={12} />[{objective.coordinates.x},{" "}
                                {objective.coordinates.y}]
                              </button>
                            )}
                            {(objective.mapId || objective.coordinates) && (
                              <button
                                className="text-button"
                                onClick={() =>
                                  navigatePath(
                                    objective.mapId
                                      ? `/world?mapId=${objective.mapId}`
                                      : `/world?x=${objective.coordinates!.x}&y=${objective.coordinates!.y}`,
                                  )
                                }
                              >
                                Auf Weltkarte anzeigen
                              </button>
                            )}
                            {objective.mapId && !objective.coordinates && (
                              <small>
                                {" "}
                                · Kartenposition noch nicht aufgelöst
                              </small>
                            )}
                          </li>
                        ))}
                      </ul>
                      <button
                        className="v2-step-confirm"
                        disabled={!activeCharacterId}
                        onClick={() => void onProgress(quest, index, "active")}
                      >
                        Als aktuellen Schritt bestätigen
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {quest.materials?.length ? (
                <div className="v2-quest-materials">
                  <h3>Bekannte Materialien</h3>
                  {quest.materials.map((m) => (
                    <button
                      key={m.itemId}
                      className="v2-quest-material"
                      disabled={!navigateItem}
                      onClick={() => navigateItem?.(m.itemId, m.category)}
                    >
                      <ItemImage url={m.imageUrl} size={32} />
                      <span>{m.name || "Materialdaten fehlen"}</span>
                      <strong>× {m.quantity}</strong>
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="toolbar">
                <button
                  disabled={!activeCharacterId}
                  onClick={() =>
                    void onProgress(
                      quest,
                      Math.min(
                        (current?.step ?? 0) + 1,
                        Math.max(0, quest.steps.length - 1),
                      ),
                      "active",
                    )
                  }
                >
                  <ChevronRight size={15} /> Nächster Schritt
                </button>
                <button
                  className="secondary"
                  disabled={!activeCharacterId}
                  onClick={() =>
                    void onProgress(quest, current?.step ?? 0, "paused")
                  }
                >
                  <Pause size={15} /> Pausieren
                </button>
                <button
                  className="secondary"
                  disabled={!activeCharacterId}
                  onClick={() =>
                    void onProgress(quest, current?.step ?? 0, "completed")
                  }
                >
                  <Check size={15} /> Abschließen
                </button>
              </div>
              <div className="v2-guide-section">
                <ExternalLink size={17} />
                <div>
                  <strong>Guide auf DOFUS Pour les Noobs</strong>
                  <p>
                    Originalartikel öffnen. Externe Texte und Bilder werden
                    nicht übernommen.
                  </p>
                  <button
                    className="text-button"
                    onClick={() =>
                      void openExternal(
                        quest.guideUrl ??
                          `https://www.google.com/search?q=${encodeURIComponent("site:dofuspourlesnoobs.com " + (quest.nameFr || quest.name))}`,
                      )
                    }
                  >
                    {quest.guideUrl
                      ? "Guide auf DOFUS Pour les Noobs öffnen"
                      : "Originalguide auf DOFUS Pour les Noobs suchen"}{" "}
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </div>
              <small className="v2-quest-provenance">
                {quest.source} · Version {quest.version} · Quest-ID {quest.id}.
                Keine Live-Abfrage deines Spielaccounts.
              </small>
            </>
          ) : (
            <div className="v2-quest-detail-empty">
              <Compass size={43} />
              <h3>Deine Geschichte wartet.</h3>
              <p>
                Wähle eine Kategorie und eine Quest. Hier findest du die
                bekannten Schritte und deinen bestätigten Fortschritt.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
