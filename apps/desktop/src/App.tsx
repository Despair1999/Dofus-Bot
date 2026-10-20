import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Search,
  LayoutDashboard,
  ScanLine,
  Hammer,
  Users,
  Settings,
  Star,
  ArrowUpRight,
  Compass,
  CalendarDays,
  Check,
  RefreshCw,
  Wifi,
  WifiOff,
  PanelLeftClose,
  Layers,
  Clipboard,
  Plus,
  Trash2,
  Download,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Package,
  Pin,
} from "lucide-react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { materials, profit } from "@dofus/core";
import {
  api,
  cached,
  enqueue,
  flush,
  ApiError,
  type Config,
  type Character,
  type Quest,
  type Item,
  type Mutation,
} from "./client";
import { read, write, erase } from "./storage";
import { windowMode, openExternal, shortcut, type Mode } from "./native";
import Scanner from "./Scanner";
import CharacterEditor from "./CharacterEditor";
type Tab =
  | "dashboard"
  | "items"
  | "quests"
  | "scanner"
  | "craft"
  | "characters"
  | "almanax"
  | "favorites"
  | "settings";
const tabs: { id: Tab; label: string; icon: typeof Search }[] = [
  { id: "dashboard", label: "Übersicht", icon: LayoutDashboard },
  { id: "items", label: "Gegenstände", icon: Package },
  { id: "quests", label: "Quest-Assistent", icon: BookOpen },
  { id: "scanner", label: "Bildschirm erkennen", icon: ScanLine },
  { id: "craft", label: "Crafting & Kamas", icon: Hammer },
  { id: "characters", label: "Charaktere", icon: Users },
  { id: "almanax", label: "Almanax", icon: CalendarDays },
  { id: "favorites", label: "Favoriten", icon: Star },
  { id: "settings", label: "Einstellungen", icon: Settings },
];
type Progress = {
  questId: number;
  step: number;
  status: string;
  version: number;
};
type Todo = { id: string; text: string; done: boolean };
type Favorite = {
  id: number;
  name: string;
  kind: "item" | "quest";
  category?: string;
};
export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard"),
    [mode, setMode] = useState<Mode>("dashboard"),
    [config, setConfig] = useState<Config>({
      url: "http://127.0.0.1:4310",
      token: "",
    }),
    [ready, setReady] = useState(false),
    [online, setOnline] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("equipment"),
    [items, setItems] = useState<Item[]>([]),
    [quests, setQuests] = useState<Quest[]>([]),
    [item, setItem] = useState<Item | null>(null),
    [quest, setQuest] = useState<Quest | null>(null),
    [characters, setCharacters] = useState<Character[]>([]),
    [active, setActive] = useState(""),
    [progress, setProgress] = useState<Progress[]>([]),
    [favorites, setFavorites] = useState<Favorite[]>([]),
    [todos, setTodos] = useState<Todo[]>([]),
    [todo, setTodo] = useState(""),
    [pending, setPending] = useState(0),
    [lastSync, setLastSync] = useState(""),
    [stale, setStale] = useState(false),
    [almanax, setAlmanax] = useState<any>(null),
    [date, setDate] = useState(
      new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }),
    ),
    [update, setUpdate] = useState<any>(null),
    [hotkey, setHotkey] = useState("CommandOrControl+Shift+D"),
    [opacity, setOpacity] = useState(94),
    [onboarding, setOnboarding] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const character = characters.find((c) => c.id === active);
  const current = progress.find((p) => p.questId === quest?.id);
  const currentStep = quest?.steps[current?.step ?? 0];
  useEffect(() => {
    void (async () => {
      try {
        const saved = await read<Config>("config", {
          url: "http://127.0.0.1:4310",
          token: "",
        });
        setConfig({
          ...saved,
          token: sessionStorage.getItem("companion-token") ?? "",
        });
        setOnboarding(!(await read("onboarded", false)));
        setCharacters(await read("characters", []));
        setActive(await read("active", ""));
        setFavorites(await read("favorites", []));
        setTodos(await read("todos", []));
        setQuest(await read("activeQuest", null));
        setPending((await read<Mutation[]>("outbox", [])).length);
        setReady(true);
      } catch (e) {
        setNotice(String(e));
      }
    })();
  }, []);
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    async function health() {
      try {
        const res = await fetch(`${config.url}/health`, {
          signal: AbortSignal.timeout(4000),
        });
        if (!disposed) setOnline(res.ok);
      } catch {
        if (!disposed) setOnline(false);
      }
    }
    void health();
    const timer = setInterval(health, 30000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [ready, config.url]);
  useEffect(() => {
    if (!active || !ready) return;
    void read<Progress[]>(`progress:${active}`, []).then(setProgress);
  }, [active, ready]);
  useEffect(() => {
    if (!ready || !isTauri()) return;
    let cancelled = false;
    void (async () => {
      for (let attempt = 0; attempt < 30 && !cancelled; attempt++) {
        try {
          const local = await invoke<Config>("local_connection");
          if (!cancelled) {
            setConfig(local);
            const response = await api<Character[]>("/api/characters", local);
            setCharacters(response.data);
            setOnline(true);
            await write("characters", response.data);
          }
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      if (!cancelled)
        setNotice(
          "Der lokale Dienst ist noch nicht erreichbar. Verbindung in Einstellungen prüfen.",
        );
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);
  useEffect(() => {
    document.documentElement.style.background =
      mode === "overlay" ? "transparent" : "#101719";
  }, [mode]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape" && mode !== "dashboard")
        void changeMode("dashboard");
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [mode]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function changeMode(next: Mode) {
    await action(async () => {
      await windowMode(next);
      setMode(next);
    });
  }
  async function sync() {
    await action(async () => {
      await flush(config);
      const result = await api<Character[]>("/api/characters", config);
      setCharacters(result.data);
      await write("characters", result.data);
      if (active) {
        const p = await api<Progress[]>(
          `/api/characters/${active}/progress`,
          config,
        );
        setProgress(p.data);
        await write(`progress:${active}`, p.data);
      }
      setPending(0);
      setLastSync(new Date().toLocaleTimeString("de-DE"));
      setOnline(true);
      setNotice("Synchronisierung abgeschlossen.");
    });
  }
  async function search(kind: "items" | "quests", q = query) {
    await action(async () => {
      const path =
        kind === "items"
          ? `/api/items?q=${encodeURIComponent(q)}&category=${category}&lang=de`
          : `/api/quests?q=${encodeURIComponent(q)}&lang=de`;
      const res = await cached<any[]>(path, config);
      if (kind === "items") {
        setItems(res.data);
        setItem(null);
      } else {
        setQuests(res.data);
        setQuest(null);
      }
      setStale(!!res.stale);
      setTab(kind);
      if (!res.data.length) setNotice("Keine passenden Einträge gefunden.");
    });
  }
  async function selectItem(id: number, cat = category) {
    await action(async () => {
      const r = await cached<Item>(
        `/api/items/${id}?category=${cat}&lang=de`,
        config,
      );
      setItem(r.data);
      setStale(!!r.stale);
      setTab("items");
    });
  }
  async function selectQuest(id: number) {
    await action(async () => {
      const r = await cached<Quest>(`/api/quests/${id}?lang=de`, config);
      setQuest(r.data);
      await write("activeQuest", r.data);
      setTab("quests");
      setStale(!!r.stale);
    });
  }
  async function saveProgress(step: number, status = "active") {
    if (!quest || !active) {
      setNotice("Erstelle und wähle zuerst einen Charakter.");
      return;
    }
    await action(async () => {
      const m: Mutation = {
        id: crypto.randomUUID(),
        characterId: active,
        questId: quest.id,
        step,
        status,
        expectedVersion: current?.version ?? 0,
      };
      await enqueue(m);
      const local = {
        questId: quest.id,
        step,
        status,
        version: current?.version ?? 0,
      };
      const next = [...progress.filter((p) => p.questId !== quest.id), local];
      setProgress(next);
      await write(`progress:${active}`, next);
      setPending((await read<Mutation[]>("outbox", [])).length);
      try {
        await flush(config);
        const response = await api<Progress[]>(
          `/api/characters/${active}/progress`,
          config,
        );
        setProgress(response.data);
        await write(`progress:${active}`, response.data);
        setPending(0);
        setNotice("Fortschritt gespeichert und synchronisiert.");
      } catch (e) {
        if (e instanceof ApiError && e.status === 409)
          throw new Error(
            "Versionskonflikt: Die Änderung bleibt in der Warteschlange. In Einstellungen prüfen.",
            { cause: e },
          );
        setNotice("Lokal gespeichert. Synchronisierung steht aus.");
      }
    });
  }
  async function favorite(f: Favorite) {
    const next = favorites.some((v) => v.id === f.id && v.kind === f.kind)
      ? favorites.filter((v) => !(v.id === f.id && v.kind === f.kind))
      : [...favorites, f];
    setFavorites(next);
    await write("favorites", next);
  }
  async function loadAlmanax() {
    await action(async () => {
      const r = await cached<any>(`/api/almanax?date=${date}&lang=de`, config);
      setAlmanax(r.data);
      setStale(!!r.stale);
    });
  }
  function navigate(next: Tab) {
    setTab(next);
    setNotice("");
    if (next === "almanax") void loadAlmanax();
  }
  async function checkUpdates() {
    await action(async () => {
      if (!isTauri()) {
        const r = await fetch(
          "https://api.github.com/repos/Despair1999/Dofus-Bot/releases/latest",
          { signal: AbortSignal.timeout(10000) },
        );
        if (r.status === 404) {
          setNotice("Noch keine veröffentlichte Version verfügbar.");
          return;
        }
        if (!r.ok) throw new Error(`GitHub: HTTP ${r.status}`);
        const release = await r.json();
        setNotice(
          `GitHub-Version: ${release.tag_name}. Installation ist in der Windows-App verfügbar.`,
        );
        return;
      }
      const { check } = await import("@tauri-apps/plugin-updater");
      const next = await check();
      setUpdate(next);
      setNotice(
        next
          ? `Version ${next.version} ist verfügbar.`
          : "Du verwendest die aktuelle Version.",
      );
    });
  }
  const questCard = (
    <section className="panel quest-card">
      <div className="panel-title">
        <span>
          <BookOpen size={18} /> Quest-Assistent
        </span>
        <span className="pill">{quest ? "Manuell bestätigt" : "Bereit"}</span>
      </div>
      {quest ? (
        <>
          <h2>{quest.name}</h2>
          <p>
            {currentStep?.description ||
              currentStep?.name ||
              "Keine strukturierten Schritte vorhanden."}
          </p>
          <div className="progress">
            <i
              style={{
                width: `${quest.steps.length ? Math.min(100, ((current?.step ?? 0) / quest.steps.length) * 100) : 0}%`,
              }}
            />
          </div>
          <div className="split">
            <small>
              Schritt {Math.min((current?.step ?? 0) + 1, quest.steps.length)}{" "}
              von {quest.steps.length}
            </small>
            <button className="text-button" onClick={() => navigate("quests")}>
              Quest öffnen <ArrowUpRight size={15} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="quest-symbol">
            <Compass size={32} />
          </div>
          <h2>Dein nächstes Abenteuer</h2>
          <p>
            Suche eine Quest oder erkenne dein geöffnetes Questjournal. Dein
            Fortschritt bleibt bei dir.
          </p>
          <button onClick={() => navigate("quests")}>
            Quest auswählen <ChevronRight size={16} />
          </button>
        </>
      )}
    </section>
  );
  if (!ready)
    return (
      <div className="loading">
        <RefreshCw className="spin" /> Companion wird vorbereitet …
      </div>
    );
  if (mode === "overlay")
    return (
      <div className="overlay-only" style={{ opacity: opacity / 100 }}>
        <div className="overlay-drag" data-tauri-drag-region>
          <span data-tauri-drag-region>DOFUS Companion · Quest</span>
          <button
            title="Hauptfenster öffnen"
            className="icon-button"
            onClick={() => void changeMode("dashboard")}
          >
            <Layers size={17} />
          </button>
        </div>
        {questCard}
      </div>
    );
  if (mode === "hotbar")
    return (
      <div className="mini" data-tauri-drag-region>
        <strong>DC</strong>
        {[Search, BookOpen, ScanLine, Hammer].map((Icon, i) => (
          <button
            key={i}
            title={["Items", "Quests", "Scan", "Crafting"][i]}
            onClick={() => {
              setTab((["items", "quests", "scanner", "craft"] as Tab[])[i]);
              void changeMode("compact");
            }}
          >
            <Icon size={20} />
          </button>
        ))}
        <button
          title="Hauptfenster"
          onClick={() => void changeMode("dashboard")}
        >
          <Layers size={18} />
        </button>
      </div>
    );
  return (
    <div className={`app ${mode}`}>
      {mode === "dashboard" && (
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">
              D<span>◆</span>
            </div>
            <div>
              DOFUS<span>COMPANION</span>
            </div>
          </div>
          <div className="workspace">
            <span className="status-dot" /> DEIN ABENTEUER, ORGANISIERT
          </div>
          <nav>
            {tabs.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? "nav active" : "nav"}
                onClick={() => navigate(t.id)}
              >
                <t.icon size={19} />
                {t.label}
                {t.id === "scanner" && <span className="nav-tag">OCR</span>}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="safe">
              <ShieldCheck size={18} />
              <div>
                Dein Spiel. Deine Kontrolle.
                <small>Keine automatisierten Spielaktionen</small>
              </div>
            </div>
            <button className="profile" onClick={() => navigate("characters")}>
              <div className="avatar">
                {character?.name.slice(0, 2).toUpperCase() || "＋"}
              </div>
              <span>
                {character?.name || "Charakter hinzufügen"}
                <small>
                  {character
                    ? `${character.className} · Stufe ${character.level}`
                    : "Dein persönliches Profil"}
                </small>
              </span>
              <ChevronRight size={16} />
            </button>
          </div>
        </aside>
      )}
      <main>
        <header>
          <div className="breadcrumb">
            Mein Companion <ChevronRight size={13} />
            <strong>{tabs.find((t) => t.id === tab)?.label}</strong>
          </div>
          <div className="header-actions">
            <span className={`connection ${online ? "online" : ""}`}>
              {online ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
              {online ? "Backend erreichbar" : "Offline"}
            </span>
            <button
              title="Synchronisieren"
              className="icon-button"
              disabled={busy}
              onClick={() => void sync()}
            >
              <RefreshCw size={17} className={busy ? "spin" : ""} />
            </button>
            <button
              title="Ansichtsmodus wechseln"
              className="icon-button"
              onClick={() =>
                void changeMode(mode === "dashboard" ? "compact" : "dashboard")
              }
            >
              <PanelLeftClose size={18} />
            </button>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                DOFUS COMPANION / DEIN PERSÖNLICHER ASSISTENT
              </span>
              <h1>
                {tab === "dashboard" ? (
                  <>
                    Bereit für dein nächstes <em>Abenteuer?</em>
                  </>
                ) : (
                  tabs.find((t) => t.id === tab)?.label
                )}
              </h1>
              <p>
                {tab === "dashboard"
                  ? "Alles, was du für die Welt der Zwölf brauchst. An einem Ort."
                  : "Spielwissen, das dir weiterhilft. Mit nachvollziehbaren Quellen."}
              </p>
            </div>
            <div className="version">
              v0.1.0 <span>ENTWICKLUNG</span>
            </div>
          </div>
          {onboarding && (
            <section className="onboarding">
              <Sparkles size={23} />
              <div>
                <strong>Willkommen in deinem Companion</strong>
                <p>
                  Starte das Backend, hinterlege den lokalen Zugangsschlüssel in
                  den Einstellungen und lege deinen Charakter an. Itemdaten
                  werden bei der Suche geladen, Questdaten einmalig importiert.
                </p>
              </div>
              <button
                onClick={() => {
                  setOnboarding(false);
                  void write("onboarded", true);
                  navigate("settings");
                }}
              >
                Einrichten <ArrowUpRight size={16} />
              </button>
            </section>
          )}
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              void search(tab === "quests" ? "quests" : "items");
            }}
          >
            <Search size={21} />
            <input
              ref={searchRef}
              aria-label="Globale Suche"
              placeholder={
                tab === "quests"
                  ? "Questname suchen …"
                  : "Gegenstände durchsuchen …"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>Strg K</kbd>
            <button disabled={busy || query.trim().length < 2}>Suchen</button>
          </form>
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button className="text-button" onClick={() => setNotice("")}>
                Schließen
              </button>
            </div>
          )}
          {stale && (
            <div className="notice">
              Gespeicherte Daten · Quelle zurzeit nicht erreichbar. Dieser Stand
              kann veraltet sein.
            </div>
          )}
          {tab === "dashboard" && (
            <>
              <div className="stats">
                <Stat
                  icon={<Users />}
                  label="AKTIVER CHARAKTER"
                  value={character?.name || "Noch kein Charakter"}
                  sub={
                    character
                      ? `${character.server} · Stufe ${character.level}`
                      : "Profil manuell anlegen"
                  }
                />
                <Stat
                  icon={<BookOpen />}
                  label="QUESTFORTSCHRITT"
                  value={`${progress.filter((p) => p.status === "completed").length} abgeschlossen`}
                  sub={`${progress.filter((p) => p.status === "active").length} aktive Quests`}
                />
                <Stat
                  icon={<Star />}
                  label="DEINE SAMMLUNG"
                  value={`${favorites.length} Favoriten`}
                  sub="Lokal auf deinem Gerät"
                />
                <Stat
                  icon={<RefreshCw />}
                  label="SYNCHRONISIERUNG"
                  value={
                    pending
                      ? `${pending} ausstehend`
                      : lastSync || "Noch nicht verbunden"
                  }
                  sub={online ? "Backend ist erreichbar" : "Offline nutzbar"}
                />
              </div>
              <div className="dashboard-grid">
                {questCard}
                <section className="panel quick-panel">
                  <div className="panel-title">
                    <span>
                      <Sparkles size={18} /> Schnellzugriff
                    </span>
                  </div>
                  <div className="quick-grid">
                    {(
                      [
                        {
                          label: "Item finden",
                          sub: "Werte & Rezepte",
                          icon: Package,
                          target: "items",
                        },
                        {
                          label: "Quest erkennen",
                          sub: "Lokale OCR",
                          icon: ScanLine,
                          target: "scanner",
                        },
                        {
                          label: "Crafting planen",
                          sub: "Material & Kosten",
                          icon: Hammer,
                          target: "craft",
                        },
                        {
                          label: "Almanax prüfen",
                          sub: "Opfergabe & Bonus",
                          icon: CalendarDays,
                          target: "almanax",
                        },
                      ] as const
                    ).map((x) => (
                      <button key={x.target} onClick={() => navigate(x.target)}>
                        <x.icon size={25} />
                        <strong>{x.label}</strong>
                        <small>{x.sub}</small>
                        <ArrowUpRight size={15} />
                      </button>
                    ))}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-title">
                    <span>
                      <Check size={18} /> Deine Aufgaben
                    </span>
                    <span className="pill">
                      {todos.filter((t) => t.done).length}/{todos.length}
                    </span>
                  </div>
                  <form
                    className="toolbar"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!todo.trim()) return;
                      const next = [
                        ...todos,
                        {
                          id: crypto.randomUUID(),
                          text: todo.trim(),
                          done: false,
                        },
                      ];
                      setTodos(next);
                      void write("todos", next);
                      setTodo("");
                    }}
                  >
                    <input
                      aria-label="Neue Aufgabe"
                      value={todo}
                      onChange={(e) => setTodo(e.target.value)}
                      placeholder="Was steht heute an?"
                      maxLength={300}
                    />
                    <button title="Aufgabe hinzufügen">
                      <Plus size={17} />
                    </button>
                  </form>
                  <div className="stack">
                    {todos.map((t) => (
                      <div className="todo" key={t.id}>
                        <input
                          aria-label={`${t.text} erledigt`}
                          type="checkbox"
                          checked={t.done}
                          onChange={() => {
                            const next = todos.map((v) =>
                              v.id === t.id ? { ...v, done: !v.done } : v,
                            );
                            setTodos(next);
                            void write("todos", next);
                          }}
                        />
                        <span className={t.done ? "done" : ""}>{t.text}</span>
                        <button
                          className="icon-button"
                          title="Aufgabe löschen"
                          onClick={() => {
                            const next = todos.filter((v) => v.id !== t.id);
                            setTodos(next);
                            void write("todos", next);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {!todos.length && (
                    <p className="empty-text">
                      Platz für deine nächsten Ziele.
                    </p>
                  )}
                </section>
                <section className="panel source-card">
                  <div className="panel-title">
                    <span>
                      <ShieldCheck size={18} /> Transparent & unabhängig
                    </span>
                  </div>
                  <h3>Spieldaten mit Herkunft.</h3>
                  <p>
                    Items und Almanax von Dofusdude. Quests aus dofus-sqlite.
                    Fehlende Daten werden als solche angezeigt.
                  </p>
                  <div className="source-row">
                    <span>Dofusdude API</span>
                    <span className="pill">Live bei Abfrage</span>
                  </div>
                  <div className="source-row">
                    <span>Questdatenbank</span>
                    <button
                      className="text-button"
                      onClick={() => navigate("settings")}
                    >
                      Import verwalten <ArrowUpRight size={13} />
                    </button>
                  </div>
                  <small>
                    Inoffizielles Community-Projekt. Nicht mit Ankama verbunden.
                  </small>
                </section>
              </div>
            </>
          )}
          {tab === "items" && (
            <>
              <div className="toolbar">
                <select
                  aria-label="Itemkategorie"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {[
                    ["equipment", "Ausrüstung"],
                    ["resources", "Ressourcen"],
                    ["consumables", "Verbrauchsgegenstände"],
                    ["quest", "Questgegenstände"],
                    ["cosmetics", "Kosmetik"],
                  ].map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
                <button
                  className="secondary"
                  onClick={() =>
                    void action(async () => {
                      setQuery(await navigator.clipboard.readText());
                    })
                  }
                >
                  <Clipboard size={16} /> Namen aus Zwischenablage
                </button>
                <small>
                  Ausgewählte Kategorie wird bei der nächsten Suche verwendet.
                </small>
              </div>
              <div className="results-layout">
                <section className="panel result-list">
                  <div className="panel-title">
                    <span>{items.length} Suchergebnisse</span>
                  </div>
                  {items.map((i) => (
                    <button
                      className={`result ${item?.id === i.id ? "selected" : ""}`}
                      key={i.id}
                      onClick={() => void selectItem(i.id, i.category)}
                    >
                      {i.imageUrl ? (
                        <img src={i.imageUrl} alt="" />
                      ) : (
                        <Package size={24} />
                      )}
                      <span>
                        <strong>{i.name}</strong>
                        <small>
                          Stufe {i.level} · {i.type}
                        </small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                  {!items.length && (
                    <Empty
                      icon={<Search />}
                      title="Finde dein nächstes Item"
                      text="Gib mindestens zwei Zeichen ein. Es werden ausschließlich Daten der gewählten Quelle angezeigt."
                    />
                  )}
                </section>
                <section className="panel detail">
                  {item ? (
                    <>
                      <div className="item-heading">
                        {item.imageUrl && (
                          <img src={item.imageUrl} alt={item.name} />
                        )}
                        <div>
                          <span className="eyebrow">
                            {item.type} · STUFE {item.level}
                          </span>
                          <h2>{item.name}</h2>
                        </div>
                      </div>
                      <p>{item.description}</p>
                      <div className="toolbar">
                        <button
                          onClick={() =>
                            void navigator.clipboard.writeText(item.name)
                          }
                        >
                          <Clipboard size={16} /> Suchnamen kopieren
                        </button>
                        <button
                          className="secondary"
                          onClick={() =>
                            void favorite({
                              id: item.id,
                              name: item.name,
                              kind: "item",
                              category: item.category,
                            })
                          }
                        >
                          <Star size={16} /> Favorit umschalten
                        </button>
                        <button
                          className="secondary"
                          onClick={() => navigate("craft")}
                        >
                          <Hammer size={16} /> Rezept planen
                        </button>
                      </div>
                      <h3>Effekte</h3>
                      <ul className="effects">
                        {item.effects?.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                      {!item.effects?.length && (
                        <p>Keine Effekte von der Quelle geliefert.</p>
                      )}
                      <h3>Rezept</h3>
                      {item.recipe?.length ? (
                        item.recipe.map((r, i) => (
                          <button
                            className="result"
                            key={i}
                            onClick={() =>
                              void selectItem(r.itemId, r.category)
                            }
                          >
                            <span>Gegenstand #{r.itemId}</span>
                            <strong>× {r.quantity}</strong>
                          </button>
                        ))
                      ) : (
                        <p>Kein Rezept von der Quelle geliefert.</p>
                      )}
                      <Source>
                        {item.source || "Dofusdude API"} · ID {item.id}
                      </Source>
                    </>
                  ) : (
                    <Empty
                      icon={<Package />}
                      title="Ein Item, alle Details"
                      text="Wähle links einen Gegenstand, um Werte und verfügbare Rezepte zu laden."
                    />
                  )}
                </section>
              </div>
            </>
          )}
          {tab === "quests" && (
            <div className="results-layout">
              <section className="panel result-list">
                <div className="panel-title">
                  <span>
                    <BookOpen size={17} /> Quests
                  </span>
                  <button
                    className="text-button"
                    onClick={() => void search("quests")}
                  >
                    Suchen
                  </button>
                </div>
                {quests.map((q) => (
                  <button
                    key={q.id}
                    className="result"
                    onClick={() => void selectQuest(q.id)}
                  >
                    <span>
                      <strong>{q.name}</strong>
                      <small>
                        {q.nameFr} · Stufe {q.level ?? "unbekannt"}
                      </small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
                {!quests.length && (
                  <Empty
                    icon={<BookOpen />}
                    title="Deine Quest beginnt hier"
                    text="Suche nach einem Namen. Vor der ersten Suche müssen Questdaten in den Einstellungen importiert werden."
                  />
                )}
              </section>
              <section className="panel detail">
                {quest ? (
                  <>
                    <div className="panel-title">
                      <span className="eyebrow">QUEST #{quest.id}</span>
                      <button
                        className="icon-button"
                        title="Favorit umschalten"
                        onClick={() =>
                          void favorite({
                            id: quest.id,
                            name: quest.name,
                            kind: "quest",
                          })
                        }
                      >
                        <Star size={18} />
                      </button>
                    </div>
                    <h2>{quest.name}</h2>
                    <p>{quest.nameFr}</p>
                    <label>
                      Fortschritt für
                      <select
                        aria-label="Aktiver Charakter"
                        value={active}
                        onChange={(e) => {
                          setActive(e.target.value);
                          void write("active", e.target.value);
                        }}
                      >
                        <option value="">Charakter wählen</option>
                        {characters.map((c) => (
                          <option value={c.id} key={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="quest-steps">
                      {quest.steps.map((s, i) => (
                        <article
                          className={
                            i === (current?.step ?? 0) ? "step current" : "step"
                          }
                          key={s.id}
                        >
                          <span className="step-number">{i + 1}</span>
                          <div>
                            <h3>{s.name || `Schritt ${i + 1}`}</h3>
                            <p>{s.description}</p>
                            <ul>
                              {s.objectives.map((o) => (
                                <li key={o.id}>
                                  {o.description ||
                                    `Ziel #${o.id}: keine übersetzte Beschreibung verfügbar`}
                                  {o.mapId && (
                                    <small>
                                      {" "}
                                      · Map-ID {o.mapId} (keine Route berechnet)
                                    </small>
                                  )}
                                </li>
                              ))}
                            </ul>
                            <button
                              className="secondary"
                              disabled={busy || !active}
                              onClick={() => void saveProgress(i)}
                            >
                              Als aktuellen Schritt bestätigen
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="toolbar">
                      <button
                        disabled={!active || busy}
                        onClick={() =>
                          void saveProgress(
                            Math.min(
                              (current?.step ?? 0) + 1,
                              Math.max(0, quest.steps.length - 1),
                            ),
                          )
                        }
                      >
                        Nächster Schritt
                      </button>
                      <button
                        className="secondary"
                        disabled={!active || busy}
                        onClick={() =>
                          void saveProgress(current?.step ?? 0, "completed")
                        }
                      >
                        <Check size={16} /> Quest abgeschlossen
                      </button>
                      <button
                        className="secondary"
                        disabled={!active || busy}
                        onClick={() =>
                          void saveProgress(current?.step ?? 0, "paused")
                        }
                      >
                        Pausieren
                      </button>
                    </div>
                    <button
                      className="text-button"
                      onClick={() =>
                        void openExternal(
                          `https://www.google.com/search?q=${encodeURIComponent("site:dofuspourlesnoobs.com " + (quest.nameFr || quest.name))}`,
                        )
                      }
                    >
                      Originalguide auf Dofus Pour les Noobs suchen{" "}
                      <ArrowUpRight size={15} />
                    </button>
                    <Source>
                      {quest.source} · Version {quest.version}. Fortschritt wird
                      ausschließlich manuell bestätigt.
                    </Source>
                  </>
                ) : (
                  <Empty
                    icon={<Compass />}
                    title="Der nächste Schritt zählt"
                    text="Wähle eine Quest aus der Suche. Hier siehst du alle tatsächlich importierten Schritte."
                  />
                )}
              </section>
            </div>
          )}
          {tab === "scanner" && (
            <Scanner
              candidates={[
                ...quests.map((q) => ({ ...q, kind: "quests" as const })),
                ...items.map((i) => ({ ...i, kind: "items" as const })),
              ]}
              onSearch={(text, kind) => {
                setQuery(text);
                void search(kind, text);
              }}
              onPick={(id, kind) => {
                if (kind === "quests") void selectQuest(id);
                else void selectItem(id);
              }}
            />
          )}
          {tab === "craft" && <Craft item={item} notify={setNotice} />}
          {tab === "characters" && (
            <>
              <section className="panel">
                <div className="panel-title">
                  <span>
                    <Users size={18} /> Deine Charaktere
                  </span>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => void sync()}
                  >
                    <RefreshCw size={16} /> Laden
                  </button>
                </div>
                <div className="character-grid">
                  {characters.map((c) => (
                    <button
                      className={`character-card ${active === c.id ? "chosen" : ""}`}
                      key={c.id}
                      onClick={() => {
                        setActive(c.id);
                        void write("active", c.id);
                      }}
                    >
                      <div className="avatar">{c.name.slice(0, 2)}</div>
                      <h3>{c.name}</h3>
                      <p>
                        {c.className} · Stufe {c.level}
                      </p>
                      <small>{c.server}</small>
                      {active === c.id && <span className="pill">Aktiv</span>}
                    </button>
                  ))}
                </div>
                {!characters.length && (
                  <p>
                    Noch kein Charakter gespeichert. Profile werden manuell
                    registriert.
                  </p>
                )}
              </section>
              <section className="panel">
                <h2>Neuen Charakter anlegen</h2>
                {character && (
                  <CharacterEditor
                    key={character.id}
                    character={character}
                    busy={busy}
                    onSave={(input) =>
                      action(async () => {
                        const response = await api<Character>(
                          `/api/characters/${character.id}`,
                          config,
                          { ...input, expectedVersion: character.version },
                          "PUT",
                        );
                        const next = characters.map((c) =>
                          c.id === character.id ? response.data : c,
                        );
                        setCharacters(next);
                        await write("characters", next);
                        setNotice("Charakter aktualisiert.");
                      })
                    }
                    onDelete={() =>
                      action(async () => {
                        if (
                          !confirm(
                            `Charakter ${character.name} und seinen Questfortschritt unwiderruflich löschen?`,
                          )
                        )
                          return;
                        await api(
                          `/api/characters/${character.id}`,
                          config,
                          undefined,
                          "DELETE",
                        );
                        const next = characters.filter(
                          (c) => c.id !== character.id,
                        );
                        setCharacters(next);
                        setActive("");
                        setProgress([]);
                        await write("characters", next);
                        await write("active", "");
                        await write(`progress:${character.id}`, []);
                        const outbox = await read<Mutation[]>("outbox", []);
                        const retained = outbox.filter(
                          (m) => m.characterId !== character.id,
                        );
                        await write("outbox", retained);
                        setPending(retained.length);
                        setNotice("Charakter gelöscht.");
                      })
                    }
                  />
                )}
                <form
                  className="form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action(async () => {
                      const r = await api<Character>(
                        "/api/characters",
                        config,
                        {
                          name: f.get("name"),
                          server: f.get("server"),
                          className: f.get("className"),
                          level: Number(f.get("level")),
                        },
                      );
                      const next = [...characters, r.data];
                      setCharacters(next);
                      setActive(r.data.id);
                      await write("characters", next);
                      await write("active", r.data.id);
                      setNotice("Charakter angelegt.");
                    });
                  }}
                >
                  <label>
                    Name
                    <input required name="name" maxLength={60} />
                  </label>
                  <label>
                    Server
                    <input required name="server" maxLength={60} />
                  </label>
                  <label>
                    Klasse
                    <input required name="className" maxLength={60} />
                  </label>
                  <label>
                    Stufe
                    <input
                      name="level"
                      required
                      type="number"
                      min="1"
                      max="200"
                      defaultValue="1"
                    />
                  </label>
                  <button disabled={busy}>
                    <Plus size={16} /> Registrieren
                  </button>
                </form>
              </section>
            </>
          )}
          {tab === "almanax" && (
            <section className="panel">
              <div className="panel-title">
                <span>
                  <CalendarDays size={18} /> Dein Almanax
                </span>
                <div className="toolbar">
                  <input
                    aria-label="Almanax-Datum"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                  <button disabled={busy} onClick={() => void loadAlmanax()}>
                    Laden
                  </button>
                </div>
              </div>
              {almanax ? (
                <>
                  <span className="eyebrow">{almanax.date || date}</span>
                  <h2>{almanax.bonus?.type?.name || "Tagesbonus"}</h2>
                  <p>{almanax.bonus?.description}</p>
                  <div className="almanax-tribute">
                    <CalendarDays size={42} />
                    <div>
                      <small>OPFERGABE</small>
                      <h3>
                        {almanax.tribute?.quantity ?? "?"} ×{" "}
                        {almanax.tribute?.item?.name ||
                          "Nicht von der Quelle geliefert"}
                      </h3>
                      <p>
                        {almanax.reward_kamas ?? "—"} Kamas Belohnung laut
                        Quelle
                      </p>
                    </div>
                  </div>
                  <Source>
                    Dofusdude API · {date} · Keine automatische In-Game-Abgabe.
                  </Source>
                </>
              ) : (
                <Empty
                  icon={<CalendarDays />}
                  title="Ein Ritual für jeden Tag"
                  text="Wähle ein Datum und lade Bonus sowie Opfergabe aus der API."
                />
              )}
            </section>
          )}
          {tab === "favorites" && (
            <section className="panel">
              <div className="panel-title">
                <span>
                  <Star size={18} /> Angeheftet
                </span>
                <span className="pill">{favorites.length}</span>
              </div>
              {favorites.map((f) => (
                <div className="favorite-row" key={`${f.kind}:${f.id}`}>
                  <button
                    className="result"
                    onClick={() =>
                      f.kind === "item"
                        ? void selectItem(f.id, f.category)
                        : void selectQuest(f.id)
                    }
                  >
                    <Pin size={17} />
                    <span>
                      {f.name}
                      <small>
                        {f.kind === "item" ? "Gegenstand" : "Quest"} · #{f.id}
                      </small>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                  <button
                    className="icon-button"
                    title="Favorit entfernen"
                    onClick={() => void favorite(f)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
              {!favorites.length && (
                <Empty
                  icon={<Star />}
                  title="Gutes Wissen bleibt griffbereit"
                  text="Markiere Items und Quests als Favoriten, um sie hier wiederzufinden."
                />
              )}
            </section>
          )}
          {tab === "settings" && (
            <>
              <section className="panel">
                <div className="panel-title">
                  <span>
                    <Wifi size={18} /> Backend-Verbindung
                  </span>
                </div>
                <form
                  className="form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(async () => {
                      await write("config", { url: config.url, token: "" });
                      sessionStorage.setItem("companion-token", config.token);
                      setNotice(
                        "Verbindung gespeichert. Der Schlüssel bleibt nur für diese Sitzung gespeichert.",
                      );
                    });
                  }}
                >
                  <label>
                    Backend-URL
                    <input
                      type="url"
                      required
                      value={config.url}
                      onChange={(e) =>
                        setConfig({ ...config, url: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Lokaler Zugangsschlüssel
                    <input
                      type="password"
                      autoComplete="off"
                      value={config.token}
                      onChange={(e) =>
                        setConfig({ ...config, token: e.target.value })
                      }
                      placeholder="Aus .data/backend-token"
                    />
                  </label>
                  <button>Verbindung speichern</button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void sync()}
                  >
                    Verbindung testen & synchronisieren
                  </button>
                </form>
                <p>
                  Das Backend erzeugt beim ersten Start einen lokalen Schlüssel.
                  Kein Ankama-Login erforderlich. Der lokale Modus gehört einer
                  Person; Discord-Zugriff ist auf den konfigurierten Eigentümer
                  beschränkt.
                </p>
              </section>
              <section className="panel">
                <div className="panel-title">
                  <span>
                    <Download size={18} /> Anwendung & Spieldaten aktualisieren
                  </span>
                </div>
                <p>
                  App-Updates werden über GitHub Releases bereitgestellt und vor
                  der Installation kryptografisch geprüft. Es ist noch keine
                  stabile Veröffentlichung vorausgesetzt.
                </p>
                <div className="toolbar">
                  <button disabled={busy} onClick={() => void checkUpdates()}>
                    <RefreshCw size={16} /> Nach Updates suchen
                  </button>
                  {update && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          await update.downloadAndInstall();
                          setNotice(
                            "Update installiert. Anwendung bitte neu starten.",
                          );
                        })
                      }
                    >
                      Version {update.version} installieren
                    </button>
                  )}
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const r = await api<any>("/api/data/status", config);
                        setNotice(JSON.stringify(r.data));
                      })
                    }
                  >
                    Questdatenstatus
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const r = await api<any>(
                          "/api/data/update",
                          config,
                          {},
                        );
                        setNotice(
                          typeof r.data === "string"
                            ? r.data
                            : JSON.stringify(r.data),
                        );
                      })
                    }
                  >
                    Questdaten importieren
                  </button>
                </div>
                <small>
                  Der erstmalige Questimport lädt eine große SQLite-Datei. Der
                  bisherige Bestand bleibt bei Importfehlern erhalten.
                </small>
              </section>
              <section className="panel">
                <h2>Fenster & Hotkeys</h2>
                <div className="toolbar">
                  {(
                    ["dashboard", "compact", "overlay", "hotbar"] as Mode[]
                  ).map((m) => (
                    <button
                      className="secondary"
                      key={m}
                      onClick={() => void changeMode(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <label>
                  Overlay-Deckkraft {opacity} %
                  <input
                    type="range"
                    min="35"
                    max="100"
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                  />
                </label>
                <div className="toolbar">
                  <input
                    aria-label="Globale Tastenkombination"
                    value={hotkey}
                    onChange={(e) => setHotkey(e.target.value)}
                  />
                  <button
                    onClick={() =>
                      void action(async () => {
                        await shortcut(hotkey, () => {
                          setTab("scanner");
                        });
                        setNotice("Hotkey für den Scanner registriert.");
                      })
                    }
                  >
                    Scanner-Hotkey registrieren
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      void action(async () => {
                        if (!isTauri())
                          throw new Error("Nur in der Windows-App verfügbar.");
                        const { unregister } =
                          await import("@tauri-apps/plugin-global-shortcut");
                        await unregister(hotkey);
                        setNotice("Hotkey deaktiviert.");
                      })
                    }
                  >
                    Deaktivieren
                  </button>
                </div>
                <small>
                  Esc kehrt aus einer kompakten Ansicht zum Hauptfenster zurück.
                  Globale Hotkeys gelten für diese Sitzung.
                </small>
              </section>
              <section className="panel">
                <h2>Datenschutz & Konflikte</h2>
                <p>
                  {pending} lokale Änderung(en) warten auf Synchronisierung. Bei
                  einem Versionskonflikt bleibt die Warteschlange erhalten;
                  automatische Überschreibung ist deaktiviert.
                </p>
                <div className="toolbar">
                  <button
                    className="secondary"
                    onClick={() =>
                      void action(async () => {
                        const exported = {
                          characters,
                          progress,
                          favorites,
                          todos,
                          outbox: await read("outbox", []),
                        };
                        const blob = new Blob(
                          [JSON.stringify(exported, null, 2)],
                          { type: "application/json" },
                        );
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = "companion-export.json";
                        a.click();
                        URL.revokeObjectURL(a.href);
                      })
                    }
                  >
                    Eigene lokale Daten exportieren
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      if (
                        confirm(
                          "Alle lokalen Daten einschließlich nicht synchronisierter Änderungen löschen? Backend-Daten bleiben erhalten.",
                        )
                      )
                        void action(async () => {
                          await erase();
                          sessionStorage.clear();
                          location.reload();
                        });
                    }}
                  >
                    Lokale Daten löschen
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      if (
                        confirm(
                          "Ausstehende lokale Queständerungen verwerfen? Danach erneut synchronisieren.",
                        )
                      )
                        void action(async () => {
                          await write("outbox", []);
                          setPending(0);
                          setNotice(
                            "Warteschlange verworfen. Jetzt synchronisieren, um den Serverstand zu laden.",
                          );
                        });
                    }}
                  >
                    Warteschlange verwerfen
                  </button>
                </div>
              </section>
            </>
          )}
          <footer>
            <span>
              <ShieldCheck size={13} /> Lokal gedacht. Mit Quellen belegt.
            </span>
            <span>DOFUS Companion · Unabhängiges Community-Projekt</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <section className="stat">
      <div className="stat-top">
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{sub}</small>
    </section>
  );
}
function Empty({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="empty">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Source({ children }: { children: ReactNode }) {
  return (
    <div className="source">
      <ShieldCheck size={14} />
      <small>{children}</small>
    </div>
  );
}
function Craft({
  item,
  notify,
}: {
  item: Item | null;
  notify: (text: string) => void;
}) {
  const [quantity, setQuantity] = useState(1),
    [sale, setSale] = useState(0),
    [tax, setTax] = useState(2),
    [prices, setPrices] = useState<Record<number, number>>({}),
    [stock, setStock] = useState<Record<number, number>>({}),
    [server, setServer] = useState(""),
    [savedAt, setSavedAt] = useState("");
  useEffect(() => {
    void read<any>("craft", null).then((s) => {
      if (s) {
        setPrices(s.prices ?? {});
        setStock(s.stock ?? {});
        setServer(s.server ?? "");
        setSavedAt(s.savedAt ?? "");
      }
    });
  }, []);
  const recipe = item?.recipe ?? [];
  const needs = materials(recipe.length ? [{ recipe, quantity }] : [], stock);
  const total = needs.reduce(
    (sum, r) => sum + r.missing * (prices[r.itemId] ?? 0),
    0,
  );
  const complete =
    recipe.length > 0 && recipe.every((r) => prices[r.itemId] !== undefined);
  const revenue = profit(0, sale * quantity, tax).profit;
  return (
    <section className="panel">
      <div className="panel-title">
        <span>
          <Hammer size={18} /> Materialbedarf & Wirtschaft
        </span>
        <span className="pill">Eigene Preise</span>
      </div>
      <h2>{item?.name || "Wähle zuerst einen Gegenstand"}</h2>
      <p>
        Öffne ein Item mit Rezept in der Gegenstandssuche. Preise werden
        ausschließlich von dir eingetragen und gelten für deinen Server.
      </p>
      <div className="form-grid">
        <label>
          Menge
          <input
            type="number"
            min="1"
            max="100000"
            value={quantity}
            onChange={(e) =>
              setQuantity(
                Math.max(
                  1,
                  Math.min(100000, Math.trunc(Number(e.target.value))),
                ),
              )
            }
          />
        </label>
        <label>
          Server
          <input
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder="Server für deine Preise"
          />
        </label>
        <label>
          Verkaufspreis pro Stück
          <input
            type="number"
            min="0"
            value={sale}
            onChange={(e) => setSale(Math.max(0, Number(e.target.value)))}
          />
        </label>
        <label>
          Gebühr (%)
          <input
            type="number"
            min="0"
            max="100"
            value={tax}
            onChange={(e) =>
              setTax(Math.max(0, Math.min(100, Number(e.target.value))))
            }
          />
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Material-ID</th>
              <th>Bedarf</th>
              <th>Bestand</th>
              <th>Fehlend</th>
              <th>Preis/Stück (Kamas)</th>
            </tr>
          </thead>
          <tbody>
            {recipe.map((r) => (
              <tr key={r.itemId}>
                <td>#{r.itemId}</td>
                <td>{r.quantity * quantity}</td>
                <td>
                  <input
                    aria-label={`Bestand ${r.itemId}`}
                    type="number"
                    min="0"
                    value={stock[r.itemId] ?? 0}
                    onChange={(e) =>
                      setStock({
                        ...stock,
                        [r.itemId]: Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </td>
                <td>
                  {Math.max(0, r.quantity * quantity - (stock[r.itemId] ?? 0))}
                </td>
                <td>
                  <input
                    aria-label={`Preis ${r.itemId}`}
                    type="number"
                    min="0"
                    value={prices[r.itemId] ?? ""}
                    placeholder="Unbekannt"
                    onChange={(e) => {
                      const next = { ...prices };
                      if (e.target.value === "") delete next[r.itemId];
                      else next[r.itemId] = Math.max(0, Number(e.target.value));
                      setPrices(next);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!recipe.length && (
        <Empty
          icon={<Hammer />}
          title="Noch kein Rezept ausgewählt"
          text="Ohne Rezept werden keine Materialmengen oder Gewinne behauptet."
        />
      )}
      <div className="stats">
        <Stat
          icon={<Hammer />}
          label="ZUKAUFKOSTEN"
          value={
            complete
              ? `${total.toLocaleString("de-DE")} K`
              : "Preise unvollständig"
          }
          sub="Vorhandene Materialien ausgenommen"
        />
        <Stat
          icon={<Star />}
          label="ERLÖS ABZÜGLICH ZUKAUF"
          value={
            complete
              ? `${Math.round(revenue - total).toLocaleString("de-DE")} K`
              : "Nicht berechenbar"
          }
          sub="Keine Vollkostenrechnung des Bestands"
        />
      </div>
      <button
        onClick={() => {
          const savedAt = new Date().toISOString();
          void write("craft", { prices, stock, server, savedAt }).then(() => {
            setSavedAt(savedAt);
            notify("Preise und Materialbestand lokal gespeichert.");
          });
        }}
      >
        Preise & Bestand speichern
      </button>
      <Source>
        Quelle: manuelle Eingabe · Server: {server || "noch nicht angegeben"} ·
        Stand: {savedAt || "noch nicht gespeichert"} · Keine Live-Marktpreise
      </Source>
    </section>
  );
}
