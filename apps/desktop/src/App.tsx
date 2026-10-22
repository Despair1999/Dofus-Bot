import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Package,
  BookOpen,
  ScanLine,
  Hammer,
  Users,
  CalendarDays,
  Star,
  Settings,
  RefreshCw,
  Wifi,
  WifiOff,
  Layers,
  PanelLeftClose,
  ChevronRight,
  Plus,
  Trash2,
  ShieldCheck,
  ArrowUpRight,
  Compass,
  Check,
  Clipboard,
  Search,
} from "lucide-react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  Character,
  CharacterInput,
  GameClass,
  Progress,
} from "@dofus/core";
import type { Quest } from "@dofus/game-data";
import {
  api,
  cached,
  flush,
  enqueue,
  ApiError,
  type Config,
  type Mutation,
} from "./client";
import { read, write, erase } from "./storage";
import {
  windowMode,
  isOverlayWindow,
  toggleOverlay,
  publishOverlaySnapshot,
  listenCompanionActions,
  listenSnapshotRequest,
  type Mode,
} from "./native";
import { createSerialQueue } from "./serial";
import Scanner from "./Scanner";
import ItemsPage from "./v2/items/ItemsPage";
import ItemSearchBar from "./v2/items/ItemSearchBar";
import {
  defaultFilters,
  type ItemFilters,
  type CatalogDetail,
} from "./v2/items/types";
import CraftingPage from "./v2/craft/CraftingPage";
import QuestsPage from "./v2/quests/QuestsPage";
import CharactersPage from "./v2/characters/CharactersPage";
import AlmanaxTimeline, { type AlmanaxDay } from "./v2/almanax/AlmanaxTimeline";
import { todayISO } from "./v2/almanax/calendar";
import OverlayView from "./v2/overlay/OverlayView";
import OverlaySettings from "./v2/overlay/OverlaySettings";
import UpdatePanel from "./v2/updates/UpdatePanel";
import CatalogPanel from "./v2/settings/CatalogPanel";
import BuilderPage from "./v3/BuilderPage";
import WorldPage from "./v4/WorldPage";
import DungeonsPage from "./v4/DungeonsPage";
import ProfessionsPage from "./v4/ProfessionsPage";
import TranslatorPanel from "./v4/translator/TranslatorPanel";
import { useRoute, navigatePath, type View } from "./v2/routing";
import { AppearanceSettings } from "./appearance";
import appPackage from "../package.json";
import type { OverlaySnapshot } from "./v2/overlay/model";
import "./v2/v2.css";

type Todo = { id: string; text: string; done: boolean };
type Favorite = {
  id: number;
  name: string;
  kind: "item" | "quest";
  category?: string;
};
type SavedProgress = Pick<Progress, "questId" | "step" | "status" | "version">;
const tabs: { id: View; label: string; icon: typeof Search }[] = [
  { id: "dashboard", label: "Übersicht", icon: LayoutDashboard },
  { id: "items", label: "Gegenstände", icon: Package },
  { id: "builder", label: "Builder", icon: ShieldCheck },
  { id: "world", label: "Weltkarte", icon: Compass },
  { id: "farming", label: "Farmrouten", icon: Hammer },
  { id: "dungeons", label: "Dungeons & Bosse", icon: ShieldCheck },
  { id: "professions", label: "Berufe & Sammelquests", icon: BookOpen },
  { id: "translator", label: "Übersetzer", icon: BookOpen },
  { id: "quests", label: "Quest-Assistent", icon: BookOpen },
  { id: "scanner", label: "Bildschirm erkennen", icon: ScanLine },
  { id: "craft", label: "Crafting & Kamas", icon: Hammer },
  { id: "characters", label: "Charaktere", icon: Users },
  { id: "almanax", label: "Almanax", icon: CalendarDays },
  { id: "favorites", label: "Favoriten", icon: Star },
  { id: "settings", label: "Einstellungen", icon: Settings },
];
export default function App() {
  return isOverlayWindow() ? <OverlayView /> : <MainApp />;
}
function MainApp() {
  const [toolsOpen, setToolsOpen] = useState(false);
  useEffect(() => {
    void read("navigation:tools-open", false).then(setToolsOpen);
  }, []);
  const [navigation, setNavigation] = useState<OverlaySnapshot["navigation"]>();
  useEffect(() => {
    let mounted = true;
    const load = () => {
      void read<OverlaySnapshot["navigation"]>(
        "world:active-route",
        undefined,
      ).then((value) => {
        if (mounted) setNavigation(value);
      });
    };
    load();
    window.addEventListener("companion:route", load);
    return () => {
      mounted = false;
      window.removeEventListener("companion:route", load);
    };
  }, []);
  const route = useRoute();
  const tab = tabs.some((t) => t.id === route.view) ? route.view : "dashboard";
  const [ready, setReady] = useState(false),
    [config, setConfig] = useState<Config>({
      url: "http://127.0.0.1:4310",
      token: "",
    }),
    [online, setOnline] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [characters, setCharacters] = useState<Character[]>([]),
    [classes, setClasses] = useState<GameClass[]>([]),
    [active, setActive] = useState(""),
    [progress, setProgress] = useState<SavedProgress[]>([]),
    [favorites, setFavorites] = useState<Favorite[]>([]),
    [todos, setTodos] = useState<Todo[]>([]),
    [todo, setTodo] = useState(""),
    [quest, setQuest] = useState<Quest | null>(null),
    [craftItem, setCraftItem] = useState<CatalogDetail | null>(null),
    [pending, setPending] = useState(0),
    [lastSync, setLastSync] = useState(""),
    [mode, setMode] = useState<Mode>("dashboard"),
    [scannerKind, setScannerKind] = useState<"items" | "quests">("quests"),
    [almanax, setAlmanax] = useState<AlmanaxDay | null>(null),
    [onboarding, setOnboarding] = useState(false),
    [catalogRevision, setCatalogRevision] = useState(0),
    [dashboardQuery, setDashboardQuery] = useState("");
  const lastSearch = useRef("/items/search");
  useEffect(() => {
    if (route.view === "items" && !route.id) lastSearch.current = route.path;
  }, [route.view, route.id, route.path]);
  const modeQueue = useRef(createSerialQueue());
  const questRequest = useRef(0);
  const character = characters.find((c) => c.id === active);
  const gameClass = classes.find((c) => c.id === character?.classId);
  const current = progress.find((p) => p.questId === quest?.id);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const saved = await read<Config>("config", {
          url: "http://127.0.0.1:4310",
          token: "",
        });
        if (cancelled) return;
        setConfig({
          ...saved,
          token: sessionStorage.getItem("companion-token") ?? "",
        });
        setCharacters(await read("characters", []));
        setActive(await read("active", ""));
        setFavorites(await read("favorites", []));
        setTodos(await read("todos", []));
        setQuest(await read("activeQuest", null));
        setCraftItem(await read("craft:active-item", null));
        setPending((await read<Mutation[]>("outbox", [])).length);
        setOnboarding(!(await read("onboarded", false)));
        if (!cancelled) setReady(true);
      } catch (error) {
        setNotice(String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!ready || !isTauri()) return;
    let stopped = false;
    void (async () => {
      for (let attempt = 0; attempt < 40 && !stopped; attempt++) {
        try {
          const local = await invoke<Config>("local_connection");
          const response = await api<Character[]>("/api/characters", local);
          if (!stopped) {
            setConfig(local);
            setCharacters(response.data);
            await write("characters", response.data);
            setOnline(true);
          }
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      if (!stopped)
        setNotice(
          "Der lokale Dienst ist noch nicht erreichbar. Bitte Verbindung und Diagnose in den Einstellungen prüfen.",
        );
    })();
    return () => {
      stopped = true;
    };
  }, [ready]);
  useEffect(() => {
    if (!ready || isTauri() || config.token.length < 32) return;
    let cancelled = false;
    void api<Character[]>("/api/characters", config)
      .then((r) => {
        if (!cancelled) {
          setCharacters(r.data);
          void write("characters", r.data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready, config.url, config.token]);
  useEffect(() => {
    if (!ready) return;
    let stopped = false;
    async function health() {
      try {
        const response = await fetch(`${config.url}/health`, {
          signal: AbortSignal.timeout(4000),
        });
        if (!stopped) setOnline(response.ok);
      } catch {
        if (!stopped) setOnline(false);
      }
    }
    void health();
    const timer = setInterval(health, 15000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [ready, config.url]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void cached<GameClass[]>("/api/classes", config)
      .then((result) => {
        if (!cancelled) setClasses(result.data);
      })
      .catch(() => {});
    void cached<AlmanaxDay>(`/api/almanax?date=${todayISO()}&lang=de`, config)
      .then((result) => {
        if (!cancelled) setAlmanax(result.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready, config.url, config.token, catalogRevision]);
  useEffect(() => {
    if (!ready || !active) {
      setProgress([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const local = await read<SavedProgress[]>(`progress:${active}`, []);
      if (!cancelled) setProgress(local);
      const queue = await read<Mutation[]>("outbox", []);
      if (queue.some((m) => m.characterId === active)) return;
      try {
        const result = await api<Progress[]>(
          `/api/characters/${active}/progress`,
          config,
        );
        if (!cancelled) {
          setProgress(result.data);
          await write(`progress:${active}`, result.data);
        }
      } catch {
        /* Local confirmed state remains usable. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, active, config.url, config.token]);
  useEffect(() => {
    if (!ready) return;
    const reconnect = () => void synchronize();
    addEventListener("online", reconnect);
    return () => removeEventListener("online", reconnect);
  }, [ready, config.url, config.token, active]);
  async function run(task: () => Promise<void>): Promise<boolean> {
    setBusy(true);
    setNotice("");
    try {
      await task();
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function changeMode(next: Mode) {
    await modeQueue.current(() =>
      run(async () => {
        if (next === "overlay") {
          await toggleOverlay();
          return;
        }
        await windowMode(next);
        setMode(next);
      }).then(() => {}),
    );
  }
  function navigate(view: View) {
    setNotice("");
    navigatePath(view === "dashboard" ? "/" : `/${view}`);
  }
  function navigateItem(id: number, category?: string) {
    navigatePath(
      `/items/${id}${category ? `?category=${encodeURIComponent(category)}` : ""}`,
    );
  }
  function navigateSearch(
    query: string,
    filters: ItemFilters = defaultFilters,
    page = 1,
  ) {
    const params = new URLSearchParams({
      q: query,
      mainGroup: filters.mainGroup,
      sort: filters.sort,
      page: String(page),
    });
    for (const [key, value] of Object.entries(filters))
      if (value !== undefined) params.set(key, String(value));
    const path = `/items/search?${params}`;
    lastSearch.current = path;
    navigatePath(path);
  }
  async function selectQuest(id: number) {
    const sequence = ++questRequest.current;
    navigatePath(`/quests/${id}`);
    try {
      const result = await cached<Quest>(`/api/quests/${id}?lang=de`, config);
      if (sequence === questRequest.current) {
        setQuest(result.data);
        await write("activeQuest", result.data);
      }
    } catch (error) {
      setNotice(String(error));
    }
  }
  async function selectCraft(item: CatalogDetail) {
    setCraftItem(item);
    await write("craft:active-item", item);
    navigate("craft");
  }
  async function synchronize() {
    return run(async () => {
      await flush(config);
      const result = await api<Character[]>("/api/characters", config);
      setCharacters(result.data);
      await write("characters", result.data);
      if (active) {
        const result = await api<Progress[]>(
          `/api/characters/${active}/progress`,
          config,
        );
        setProgress(result.data);
        await write(`progress:${active}`, result.data);
      }
      setPending((await read<Mutation[]>("outbox", [])).length);
      setOnline(true);
      setLastSync(new Date().toLocaleTimeString("de-DE"));
      setNotice("Synchronisierung abgeschlossen.");
    });
  }
  async function saveProgress(
    target: Quest,
    step: number,
    status: Progress["status"],
  ) {
    if (!active) {
      setNotice(
        "Wähle zuerst einen Charakter, um deinen Fortschritt zu speichern.",
      );
      return;
    }
    await run(async () => {
      const existing = progress.find((p) => p.questId === target.id);
      const mutation: Mutation = {
        id: crypto.randomUUID(),
        characterId: active,
        questId: target.id,
        step,
        status,
        expectedVersion: existing?.version ?? 0,
      };
      await enqueue(mutation);
      const next = [
        ...progress.filter((p) => p.questId !== target.id),
        { questId: target.id, step, status, version: existing?.version ?? 0 },
      ];
      setProgress(next);
      setQuest(target);
      await write("activeQuest", target);
      await write(`progress:${active}`, next);
      setPending((await read<Mutation[]>("outbox", [])).length);
      try {
        await flush(config);
        const result = await api<Progress[]>(
          `/api/characters/${active}/progress`,
          config,
        );
        setProgress(result.data);
        await write(`progress:${active}`, result.data);
        setPending(0);
        setNotice("Fortschritt gespeichert und synchronisiert.");
      } catch (error) {
        if (error instanceof ApiError && error.status === 409)
          throw new Error(
            "Versionskonflikt: Deine Änderung bleibt lokal erhalten. Prüfe die Warteschlange in den Einstellungen.",
            { cause: error },
          );
        setNotice("Lokal gespeichert. Synchronisierung steht aus.");
      }
    });
  }
  async function favorite(value: Favorite) {
    const next = favorites.some(
      (f) => f.id === value.id && f.kind === value.kind,
    )
      ? favorites.filter((f) => !(f.id === value.id && f.kind === value.kind))
      : [...favorites, value];
    setFavorites(next);
    await write("favorites", next);
  }
  async function saveCharacter(input: CharacterInput, existing?: Character) {
    return run(async () => {
      const result = await api<Character>(
        existing ? `/api/characters/${existing.id}` : "/api/characters",
        config,
        existing ? { ...input, expectedVersion: existing.version } : input,
        existing ? "PUT" : "POST",
      );
      const next = existing
        ? characters.map((c) => (c.id === existing.id ? result.data : c))
        : [...characters, result.data];
      setCharacters(next);
      setActive(result.data.id);
      await write("characters", next);
      await write("active", result.data.id);
      setNotice(
        existing ? "Charakter aktualisiert." : "Charakter registriert.",
      );
    });
  }
  async function deleteCharacter(target: Character) {
    if (
      !confirm(
        `Charakter ${target.name} einschließlich seines bestätigten Questfortschritts löschen?`,
      )
    )
      return false;
    return run(async () => {
      const builds = await api<{ id: string }[]>(
        `/api/builder/builds?characterId=${target.id}`,
        config,
      );
      const choice = builds.data.length
        ? prompt(
            `${builds.data.length} gespeicherte Builds: „behalten“ löst die Zuordnung, „löschen“ entfernt sie ebenfalls. Abbrechen beendet den Vorgang.`,
            "behalten",
          )
        : "behalten";
      if (choice !== "behalten" && choice !== "löschen") return;
      const handling = choice === "behalten" ? "keep" : "delete";
      await api(
        `/api/characters/${target.id}?builds=${handling}`,
        config,
        undefined,
        "DELETE",
      );
      const next = characters.filter((c) => c.id !== target.id);
      setCharacters(next);
      await write("characters", next);
      await write(`progress:${target.id}`, []);
      if (active === target.id) {
        setActive("");
        setProgress([]);
        await write("active", "");
      }
      const queue = (await read<Mutation[]>("outbox", [])).filter(
        (m) => m.characterId !== target.id,
      );
      await write("outbox", queue);
      setPending(queue.length);
      setNotice("Charakter gelöscht.");
    });
  }
  const snapshot = useMemo(
    () => ({
      character: character ?? null,
      quest,
      step: current?.step ?? 0,
      materials: quest?.materials?.map((m) => ({
        name: m.name,
        quantity: m.quantity,
      })),
      almanax,
      favorites,
      tasks: todos,
      navigation,
    }),
    [character, quest, current?.step, almanax, favorites, todos, navigation],
  );
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  useEffect(() => {
    if (ready) void publishOverlaySnapshot(snapshot);
  }, [ready, snapshot]);
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    const releases: (() => void)[] = [];
    void (async () => {
      for (const off of [
        await listenSnapshotRequest(
          () => void publishOverlaySnapshot(snapshotRef.current),
        ),
        await listenCompanionActions((action) => {
          if (action === "settings") navigate("settings");
          else if (action === "questScanner" || action === "itemScanner") {
            setScannerKind(action === "itemScanner" ? "items" : "quests");
            navigate("scanner");
          } else if (action === "search") {
            navigate("items");
            setTimeout(
              () =>
                document
                  .querySelector<HTMLInputElement>("input[role=combobox]")
                  ?.focus(),
              100,
            );
          } else if (action === "compact") void changeMode("compact");
          else if (action.startsWith("items:"))
            navigateItem(Number(action.slice(6)));
          else if (action.startsWith("quests:"))
            void selectQuest(Number(action.slice(7)));
          else if (action === "quests") navigate("quests");
          else if (action === "treasure") {
            navigate("settings");
            setNotice(
              "Schatzsuche ist derzeit wegen fehlender verifizierter DBI-Daten nicht verfügbar.",
            );
          } else navigate("dashboard");
        }),
      ]) {
        if (disposed) off();
        else releases.push(off);
      }
    })();
    return () => {
      disposed = true;
      releases.forEach((off) => off());
    };
  }, [ready, config.url, config.token]);
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const input = document.querySelector<HTMLInputElement>(
          'input[role=combobox],input[aria-label="Quests durchsuchen"]',
        );
        if (input) input.focus();
        else {
          navigate("items");
          setTimeout(
            () =>
              document
                .querySelector<HTMLInputElement>("input[role=combobox]")
                ?.focus(),
            100,
          );
        }
      }
      if (event.key === "Escape" && mode !== "dashboard")
        void changeMode("dashboard");
    }
    addEventListener("keydown", keyboard);
    return () => removeEventListener("keydown", keyboard);
  }, [mode]);
  async function addTodo() {
    if (!todo.trim()) return;
    const next = [
      ...todos,
      { id: crypto.randomUUID(), text: todo.trim(), done: false },
    ];
    setTodos(next);
    setTodo("");
    await write("todos", next);
  }
  async function exportData() {
    const progressByCharacter: Record<string, SavedProgress[]> = {};
    for (const c of characters)
      progressByCharacter[c.id] = await read(`progress:${c.id}`, []);
    const contents = {
      version: 3,
      characters,
      progressByCharacter,
      favorites,
      todos,
      outbox: await read("outbox", []),
      overlayLayouts: await read("overlay-layouts-v2", null),
      craftingProjects: await read("craft:projects", []),
      shoppingLists: await read("shopping-lists", []),
      builderProjects: (
        await cached<import("@dofus/core").Build[]>(
          "/api/builder/builds",
          config,
        ).catch(async () => ({ data: await read("builder:saved", []) }))
      ).data,
      builderOutbox: await read("builder:outbox", []),
      builderBuffProfiles: await read("builder:buffProfiles", []),
      builderTargetProfiles: await read("builder:targets", []),
      builderLastDraft: await read(
        "builder:draft:" + (await read("builder:lastDraft", "")),
        null,
      ),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(contents, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "dofus-companion-export.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!ready)
    return (
      <div className="loading">
        <RefreshCw className="spin" /> Dein Companion wird vorbereitet …
      </div>
    );
  if (mode === "hotbar")
    return (
      <div className="mini" data-tauri-drag-region>
        <img
          src="/branding/icon.png"
          width={38}
          height={38}
          alt="DOFUS Companion"
        />
        {[Search, BookOpen, ScanLine, Hammer].map((Icon, index) => (
          <button
            key={index}
            title={["Items", "Quests", "Scan", "Crafting"][index]}
            onClick={() => {
              navigate(
                (["items", "quests", "scanner", "craft"] as View[])[index],
              );
              void changeMode("compact");
            }}
          >
            <Icon size={19} />
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
  const filterParams =
    route.id && route.view === "items"
      ? new URL(lastSearch.current, location.origin).searchParams
      : route.params;
  const parsedFilters: ItemFilters = {
    effects: filterParams.get("effects") || undefined,
    effectMode: filterParams.get("effectMode") === "or" ? "or" : "and",
    mainGroup:
      filterParams.get("mainGroup") === "resources" ? "resources" : "equipment",
    sort: (filterParams.get("sort") as ItemFilters["sort"]) || "name",
    category: filterParams.get("category") || undefined,
    typeId: filterParams.has("typeId")
      ? Number(filterParams.get("typeId"))
      : undefined,
    minLevel: filterParams.has("minLevel")
      ? Number(filterParams.get("minLevel"))
      : undefined,
    maxLevel: filterParams.has("maxLevel")
      ? Number(filterParams.get("maxLevel"))
      : undefined,
  };
  return (
    <div className={`app v2-shell ${mode}`}>
      {mode === "dashboard" && (
        <aside className="sidebar">
          <div className="brand">
            <img
              className="v2-brand-image"
              src="/branding/wordmark.png"
              alt="DOFUS Companion"
            />
          </div>
          <div className="workspace">
            <span className="status-dot" /> DEIN ABENTEUER. DEIN COMPANION.
          </div>
          <nav aria-label="Hauptnavigation">
            {tabs
              .filter((e) => e.id === "dashboard")
              .map((entry) => (
                <button
                  key={entry.id}
                  className={`nav ${tab === entry.id ? "active" : ""}`}
                  onClick={() => navigate(entry.id)}
                >
                  <entry.icon size={19} />
                  {entry.label}
                </button>
              ))}
            <button
              className={`nav tools-toggle ${!["dashboard", "characters", "almanax", "favorites", "settings"].includes(tab) ? "active" : ""}`}
              aria-expanded={toolsOpen}
              aria-controls="tools-navigation"
              onClick={() => {
                const next = !toolsOpen;
                setToolsOpen(next);
                void write("navigation:tools-open", next);
              }}
            >
              <Layers size={19} />
              Tools
              <ChevronRight size={16} />
            </button>
            {toolsOpen && (
              <div id="tools-navigation" className="tools-links">
                {tabs
                  .filter(
                    (e) =>
                      ![
                        "dashboard",
                        "characters",
                        "almanax",
                        "favorites",
                        "settings",
                      ].includes(e.id),
                  )
                  .map((entry) => (
                    <button
                      key={entry.id}
                      className={`nav ${tab === entry.id ? "active" : ""}`}
                      onClick={() => navigate(entry.id)}
                    >
                      <entry.icon size={17} />
                      {entry.label}
                      {entry.id === "scanner" && (
                        <span className="nav-tag">OCR</span>
                      )}
                    </button>
                  ))}
              </div>
            )}
            {tabs
              .filter((e) =>
                ["characters", "almanax", "favorites", "settings"].includes(
                  e.id,
                ),
              )
              .map((entry) => (
                <button
                  key={entry.id}
                  className={`nav ${tab === entry.id ? "active" : ""}`}
                  onClick={() => navigate(entry.id)}
                >
                  <entry.icon size={19} />
                  {entry.label}
                </button>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="safe">
              <ShieldCheck size={18} />
              <div>
                Dein Spiel. Deine Kontrolle.
                <small>Unabhängiges Community-Projekt</small>
              </div>
            </div>
            <button className="profile" onClick={() => navigate("characters")}>
              <div className="avatar">
                {gameClass ? (
                  <img src={gameClass.icon} alt="" />
                ) : (
                  character?.name.slice(0, 2).toUpperCase() || "＋"
                )}
              </div>
              <span>
                {character?.name || "Charakter hinzufügen"}
                <small>
                  {character
                    ? `${gameClass?.nameDe || character.className} · Stufe ${character.level}`
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
            <strong>{tabs.find((entry) => entry.id === tab)?.label}</strong>
            {route.id && (
              <>
                <ChevronRight size={13} />
                <span>{tab === "quests" ? "Quest" : "Details"}</span>
              </>
            )}
          </div>
          <div className="v2-header-buttons">
            <span className={`connection ${online ? "online" : ""}`}>
              {online ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
              {online ? "Backend erreichbar" : "Offline"}
            </span>
            <button
              className="icon-button"
              title="Synchronisieren"
              disabled={busy}
              onClick={() => void synchronize()}
            >
              <RefreshCw size={17} className={busy ? "spin" : ""} />
            </button>
            <button
              className="icon-button"
              title="Overlay ein-/ausblenden"
              onClick={() =>
                void run(async () => {
                  await toggleOverlay();
                })
              }
            >
              <Layers size={18} />
            </button>
            <button
              className="icon-button"
              title="Ansichtsmodus wechseln"
              onClick={() =>
                void changeMode(mode === "dashboard" ? "compact" : "dashboard")
              }
            >
              <PanelLeftClose size={18} />
            </button>
          </div>
        </header>
        <div className="content">
          {mode === "compact" && (
            <div className="v2-compact-nav">
              {tabs.map((entry) => (
                <button
                  className="secondary"
                  key={entry.id}
                  title={entry.label}
                  onClick={() => navigate(entry.id)}
                >
                  <entry.icon size={15} />
                </button>
              ))}
            </div>
          )}
          {!["builder", "dungeons", "professions"].includes(tab) && (
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  DOFUS COMPANION / DIE WELT DER ZWÖLF AN DEINER SEITE
                </span>
                <h1>
                  {tab === "dashboard" ? (
                    <>
                      Dein nächstes <em>Abenteuer wartet.</em>
                    </>
                  ) : (
                    tabs.find((entry) => entry.id === tab)?.label
                  )}
                </h1>
                <p>
                  {
                    (
                      {
                        dashboard:
                          "Mehr Überblick. Weniger Umwege. Dein persönlicher Begleiter für DOFUS.",
                        items:
                          "Die Enzyklopädie für Ausrüstung, Ressourcen und deine nächsten Ideen.",
                        quests:
                          "Geschichten entdecken und jeden bestätigten Schritt im Blick behalten.",
                        craft:
                          "Von der Idee zum fertigen Gegenstand. Mit deinem persönlichen Materialplan.",
                        characters:
                          "Deine Charaktere, Klassen und Fortschritte – übersichtlich verbunden.",
                        almanax:
                          "Plane deine Opfergaben und entdecke die nächsten Tagesboni.",
                        scanner:
                          "Deine Aufnahme. Lokale Erkennung. Du bestätigst das Ergebnis.",
                        favorites:
                          "Deine wichtigsten Gegenstände und Quests direkt griffbereit.",
                        settings: "Dein Companion, so wie du ihn brauchst.",
                        builder: "Deine Ausrüstung. Dein Plan.",
                        world:
                          "Ein gemeinsamer Atlas für deine Ziele, Ressourcen und nächsten Wege.",
                        farming:
                          "Plane deine Sammelrunde mit echten Spieldaten und persönlichen Fundorten.",
                        dungeons:
                          "Bosse, Monsterwerte und Quellen – getrennt nach Spielversion.",
                        professions:
                          "Deine Sammelberufe, täglichen Quests und bestätigten Fortschritte.",
                        translator:
                          "Nachrichten verstehen und Antworten schreiben. Vollständig lokal.",
                      } as Record<View, string>
                    )[tab]
                  }
                </p>
              </div>
              <div className="version">
                v{appPackage.version}
                <span>COMMUNITY</span>
              </div>
            </div>
          )}
          {onboarding && tab === "dashboard" && (
            <section className="onboarding">
              <Compass size={24} />
              <div>
                <strong>Willkommen in deinem Companion</strong>
                <p>
                  Importiere den vollständigen Spieldatenkatalog, lege deinen
                  Charakter an und richte dein persönliches Overlay ein.
                  Bestehende Profile und Fortschritte bleiben erhalten.
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
          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button className="text-button" onClick={() => setNotice("")}>
                Schließen
              </button>
            </div>
          )}
          {tab === "dashboard" && (
            <div className="v2-dashboard">
              <section className="panel v2-dashboard-search">
                <span className="eyebrow">SCHNELL GEFUNDEN</span>
                <h2>Wonach suchst du heute?</h2>
                <ItemSearchBar
                  config={config}
                  value={dashboardQuery}
                  onChange={setDashboardQuery}
                  onSubmit={(q) => navigateSearch(q)}
                  onSelect={(item) => navigateItem(item.id, item.category)}
                  filters={defaultFilters}
                />
              </section>
              <div className="stats">
                <Stat
                  icon={<Users />}
                  label="AKTIVER CHARAKTER"
                  value={character?.name || "Dein Profil anlegen"}
                  sub={
                    character
                      ? `${character.server} · Stufe ${character.level}`
                      : "Mit deiner Klasse beginnen"
                  }
                />
                <Stat
                  icon={<BookOpen />}
                  label="DEIN QUESTFORTSCHRITT"
                  value={`${progress.filter((p) => p.status === "completed").length} abgeschlossen`}
                  sub={`${progress.filter((p) => p.status === "active").length} aktiv`}
                />
                <Stat
                  icon={<Star />}
                  label="DEINE SAMMLUNG"
                  value={`${favorites.length} Favoriten`}
                  sub="Gegenstände und Geschichten"
                />
                <Stat
                  icon={<RefreshCw />}
                  label="SYNCHRONISIERUNG"
                  value={
                    pending ? `${pending} ausstehend` : lastSync || "Bereit"
                  }
                  sub={
                    online
                      ? "Lokaler Dienst erreichbar"
                      : "Gespeicherte Daten bleiben verfügbar"
                  }
                />
              </div>
              <div className="dashboard-grid">
                <section className="panel quest-card">
                  <div className="panel-title">
                    <span>
                      <BookOpen size={18} /> Dein Quest-Assistent
                    </span>
                    <span className="pill">
                      {quest ? "Von dir ausgewählt" : "Bereit"}
                    </span>
                  </div>
                  <div className="quest-symbol">
                    <Compass size={30} />
                  </div>
                  <h2>{quest?.name || "Dein nächstes Abenteuer"}</h2>
                  <p>
                    {quest?.steps[current?.step ?? 0]?.description ||
                      "Entdecke deinen nächsten Questschritt, plane Materialien und behalte deinen Fortschritt im Blick."}
                  </p>
                  {quest && (
                    <div className="progress">
                      <i
                        style={{
                          width:
                            current?.status === "completed"
                              ? "100%"
                              : `${quest.steps.length ? ((current?.step ?? 0) / quest.steps.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  )}
                  <button
                    onClick={() =>
                      quest ? void selectQuest(quest.id) : navigate("quests")
                    }
                  >
                    {quest ? "Quest fortsetzen" : "Quest auswählen"}{" "}
                    <ChevronRight size={16} />
                  </button>
                </section>
                <section className="panel">
                  <div className="panel-title">
                    <span>
                      <Layers size={18} /> Schnellzugriff
                    </span>
                  </div>
                  <div className="quick-grid">
                    {(
                      [
                        {
                          target: "items",
                          title: "Gegenstände",
                          subtitle: "Werte, Bilder & Rezepte",
                          icon: Package,
                        },
                        {
                          target: "scanner",
                          title: "Quest erkennen",
                          subtitle: "Lokale Bildschirm-OCR",
                          icon: ScanLine,
                        },
                        {
                          target: "craft",
                          title: "Crafting planen",
                          subtitle: "Materialien & Einkauf",
                          icon: Hammer,
                        },
                        {
                          target: "almanax",
                          title: "Almanax",
                          subtitle: "Deine Woche im Blick",
                          icon: CalendarDays,
                        },
                      ] as const
                    ).map((shortcut) => (
                      <button
                        key={shortcut.target}
                        onClick={() => navigate(shortcut.target)}
                      >
                        <shortcut.icon size={24} />
                        <strong>{shortcut.title}</strong>
                        <small>{shortcut.subtitle}</small>
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
                      {todos.filter((task) => task.done).length}/{todos.length}
                    </span>
                  </div>
                  <form
                    className="toolbar"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void addTodo();
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
                  {todos.map((task) => (
                    <div className="todo" key={task.id}>
                      <input
                        type="checkbox"
                        aria-label={`${task.text} erledigt`}
                        checked={task.done}
                        onChange={() => {
                          const next = todos.map((t) =>
                            t.id === task.id ? { ...t, done: !t.done } : t,
                          );
                          setTodos(next);
                          void write("todos", next);
                        }}
                      />
                      <span className={task.done ? "done" : ""}>
                        {task.text}
                      </span>
                      <button
                        className="icon-button"
                        title="Aufgabe löschen"
                        onClick={() => {
                          const next = todos.filter((t) => t.id !== task.id);
                          setTodos(next);
                          void write("todos", next);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {!todos.length && (
                    <div className="v2-task-empty">
                      Platz für deine nächsten Ziele.
                    </div>
                  )}
                </section>
                <section className="panel source-card">
                  <div className="panel-title">
                    <span>
                      <CalendarDays size={18} /> Heute im Almanax
                    </span>
                  </div>
                  <h3>{almanax?.bonus.type.name || "Dein tägliches Ritual"}</h3>
                  <p>
                    {almanax?.bonus.description ||
                      "Öffne den Kalender, um Opfergaben und Tagesboni aus der Quelle zu laden."}
                  </p>
                  {almanax && (
                    <div className="source-row">
                      <span>
                        {almanax.tribute.quantity} × {almanax.tribute.item.name}
                      </span>
                      <button
                        className="text-button"
                        onClick={() =>
                          navigateItem(
                            almanax.tribute.item.ankama_id,
                            almanax.tribute.item.subtype,
                          )
                        }
                      >
                        Ressource <ArrowUpRight size={13} />
                      </button>
                    </div>
                  )}
                  <button
                    className="text-button"
                    onClick={() => navigate("almanax")}
                  >
                    Wochenübersicht öffnen <ArrowUpRight size={14} />
                  </button>
                  <small>
                    Quelle: Dofusdude · Keine automatische Spielaktion.
                  </small>
                </section>
              </div>
            </div>
          )}
          {tab === "items" && (
            <ItemsPage
              config={config}
              query={route.params.get("q") || ""}
              itemId={route.id}
              itemCategory={
                route.id ? route.params.get("category") || undefined : undefined
              }
              filters={parsedFilters}
              page={Number(route.params.get("page") || 1)}
              navigateItem={navigateItem}
              onSearch={navigateSearch}
              onCraft={(item) => void selectCraft(item)}
              onFavorite={(item) =>
                void favorite({
                  id: item.id,
                  name: item.name,
                  category: item.category,
                  kind: "item",
                })
              }
              onBack={() => navigatePath(lastSearch.current)}
            />
          )}
          {tab === "quests" && (
            <>
              <div className="toolbar">
                <label>
                  Fortschritt für
                  <select
                    aria-label="Aktiver Charakter"
                    value={active}
                    onChange={(event) => {
                      setActive(event.target.value);
                      void write("active", event.target.value);
                    }}
                  >
                    <option value="">Charakter wählen</option>
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <QuestsPage
                config={config}
                selectedId={route.id}
                initialQuery={
                  route.params.has("q")
                    ? route.params.get("q") || ""
                    : undefined
                }
                activeCharacterId={active || undefined}
                progress={progress}
                onQuestSelect={(id) => void selectQuest(id)}
                onProgress={saveProgress}
                onFavorite={(target) =>
                  void favorite({
                    id: target.id,
                    name: target.name,
                    kind: "quest",
                  })
                }
                navigateItem={navigateItem}
              />
            </>
          )}
          {(tab === "world" || tab === "farming") && (
            <WorldPage
              key={route.path}
              config={config}
              farming={tab === "farming"}
              characterId={active || undefined}
            />
          )}
          {tab === "dungeons" && (
            <DungeonsPage config={config} characters={characters} />
          )}
          {tab === "professions" && (
            <ProfessionsPage config={config} characters={characters} />
          )}
          {tab === "translator" && <TranslatorPanel config={config} />}
          {tab === "craft" && (
            <CraftingPage
              config={config}
              item={craftItem}
              navigateItem={navigateItem}
              onNotice={setNotice}
            />
          )}
          {tab === "characters" && (
            <CharactersPage
              key={catalogRevision}
              config={config}
              characters={characters}
              activeId={active}
              busy={busy}
              onSelect={(id) => {
                setActive(id);
                void write("active", id);
              }}
              onRefresh={() => void synchronize()}
              onSave={saveCharacter}
              onDelete={deleteCharacter}
            />
          )}
          {tab === "builder" && (
            <BuilderPage
              config={config}
              classes={classes}
              characters={characters}
              buildId={route.entityId}
              characterId={route.params.get("characterId") ?? undefined}
            />
          )}
          {tab === "almanax" && (
            <AlmanaxTimeline
              config={config}
              onOpenItem={navigateItem}
              onNotice={setNotice}
            />
          )}
          {tab === "scanner" && (
            <Scanner
              key={scannerKind}
              initialKind={scannerKind}
              config={config}
              candidates={[]}
              onSearch={(text, kind) =>
                kind === "items"
                  ? navigateSearch(text)
                  : navigatePath(`/quests?q=${encodeURIComponent(text)}`)
              }
              onPick={(id, kind) =>
                kind === "items" ? navigateItem(id) : void selectQuest(id)
              }
            />
          )}
          {tab === "favorites" && (
            <section className="panel">
              <div className="panel-title">
                <span>
                  <Star size={18} /> Deine Favoriten
                </span>
                <span className="pill">{favorites.length}</span>
              </div>
              <div className="v2-favorites-grid">
                {favorites.map((f) => (
                  <article className="v2-favorite" key={`${f.kind}:${f.id}`}>
                    <button
                      onClick={() =>
                        f.kind === "item"
                          ? navigateItem(f.id, f.category)
                          : void selectQuest(f.id)
                      }
                    >
                      <Star size={17} />
                      <span>
                        {f.name}
                        <small>
                          {f.kind === "item" ? "Gegenstand" : "Quest"}
                        </small>
                      </span>
                    </button>
                    <button
                      className="icon-button"
                      title="Favorit entfernen"
                      onClick={() => void favorite(f)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))}
              </div>
              {!favorites.length && (
                <div className="empty">
                  <Star size={35} />
                  <h3>Gutes Wissen bleibt griffbereit.</h3>
                  <p>Markiere einen Gegenstand oder eine Quest als Favorit.</p>
                </div>
              )}
            </section>
          )}
          {tab === "settings" && (
            <>
              <AppearanceSettings />
              <UpdatePanel />
              <CatalogPanel
                config={config}
                onComplete={() => setCatalogRevision((value) => value + 1)}
              />
              <OverlaySettings onNotice={setNotice} />
              <section className="panel">
                <div className="panel-title">
                  <span>
                    <Layers size={18} /> Hauptfenster
                  </span>
                </div>
                <div className="toolbar">
                  <button
                    className="secondary"
                    onClick={() => void changeMode("dashboard")}
                  >
                    Dashboard
                  </button>
                  <button
                    className="secondary"
                    onClick={() => void changeMode("compact")}
                  >
                    Compact Mode
                  </button>
                  <button
                    className="secondary"
                    onClick={() => void changeMode("hotbar")}
                  >
                    Mini-Hotbar
                  </button>
                </div>
                <small>
                  Escape bringt das Hauptfenster aus einer kompakten Ansicht
                  zurück.
                </small>
              </section>
              <section className="panel">
                <div className="panel-title">
                  <span>
                    <Wifi size={18} /> Backend-Verbindung
                  </span>
                  <span className="pill">Einzelbenutzer-Modus</span>
                </div>
                <form
                  className="form-grid v2-connection-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      await write("config", { url: config.url, token: "" });
                      sessionStorage.setItem("companion-token", config.token);
                      setNotice(
                        "Verbindung gespeichert. Der Schlüssel wird nur für diese Sitzung gespeichert.",
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
                      onChange={(event) =>
                        setConfig({ ...config, url: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Lokaler Zugangsschlüssel
                    <input
                      type="password"
                      autoComplete="off"
                      value={config.token}
                      onChange={(event) =>
                        setConfig({ ...config, token: event.target.value })
                      }
                    />
                  </label>
                  <button>Verbindung speichern</button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void synchronize()}
                  >
                    Verbindung testen & synchronisieren
                  </button>
                  <small>
                    Die Windows-App startet ihr lokales Backend automatisch. Für
                    die Browseransicht liegt der Schlüssel in
                    .data/backend-token bzw. deiner eigenen .env. Keine
                    Ankama-Zugangsdaten eingeben.
                  </small>
                </form>
              </section>
              <section className="panel">
                <h2>Datenschutz & Synchronisierung</h2>
                <p>
                  {pending} Änderung(en) warten auf Synchronisierung.
                  Versionskonflikte werden nicht automatisch überschrieben.
                </p>
                <div className="toolbar">
                  <button
                    className="secondary"
                    onClick={() => void run(exportData)}
                  >
                    <Clipboard size={16} /> Eigene Daten exportieren
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      if (
                        confirm(
                          "Ausstehende lokale Änderungen verwerfen? Anschließend erneut synchronisieren.",
                        )
                      )
                        void run(async () => {
                          await write("outbox", []);
                          setPending(0);
                          setNotice(
                            "Warteschlange verworfen. Jetzt den Serverstand synchronisieren.",
                          );
                        });
                    }}
                  >
                    Warteschlange verwerfen
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      if (
                        confirm(
                          "Alle lokalen Daten einschließlich nicht synchronisierter Änderungen löschen? Backend-Profile bleiben erhalten.",
                        )
                      )
                        void run(async () => {
                          await erase();
                          sessionStorage.clear();
                          location.reload();
                        });
                    }}
                  >
                    Lokale Daten löschen
                  </button>
                </div>
              </section>
            </>
          )}
          <footer>
            <span>
              <ShieldCheck size={13} /> Dein Spiel. Deine Kontrolle.
            </span>
            <span>DOFUS Companion · Unabhängig von Ankama</span>
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
