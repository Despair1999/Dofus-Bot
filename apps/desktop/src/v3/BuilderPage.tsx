import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Shield,
  Plus,
  Save,
  Copy,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  WandSparkles,
  Swords,
  SlidersHorizontal,
  Check,
  X,
  Pencil,
} from "lucide-react";
import {
  buildInput,
  calculateBuild,
  classAssets,
  compatible,
  slotDefinitions,
  statDefinitions,
  type Build,
  type BuildInput,
  type BuilderItem,
  type BuilderSet,
  type BuilderSpell,
  type SpellLevel,
  type GameClass,
  type Character,
  type Stats,
} from "@dofus/core";
import { api, cached, ApiError, type Config } from "../client";
import { read, write } from "../storage";
import { navigatePath } from "../v2/routing";
import ClassSelector from "../v2/characters/ClassSelector";
import ItemImage from "../v2/shared/ItemImage";
import ItemPicker from "./ItemPicker";
import SpellSimulator from "./SpellSimulator";
import Optimizer from "./Optimizer";
import DamageComparison from "./DamageComparison";
import "./builder.css";
interface Props {
  config: Config;
  classes: GameClass[];
  characters: Character[];
  buildId?: string;
  characterId?: string;
}
type Catalog = { items: BuilderItem[]; sets: BuilderSet[] };
function fresh(character?: Character): Build {
  return {
    ...buildInput.parse({
      name: character ? character.name + " – Neues Set" : "Mein neues Set",
      classId: character?.classId ?? 9,
      level: character?.level ?? 200,
      characterId: character?.id ?? null,
      gameVersion: "3.7.12.12",
    }),
    id: crypto.randomUUID(),
    revision: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
function fileDownload(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
const positions: Record<string, [number, number]> = {
  hat: [1, 1],
  amulet: [2, 1],
  weapon: [3, 1],
  ring1: [1, 2],
  shield: [3, 2],
  ring2: [1, 3],
  cape: [3, 3],
  belt: [1, 4],
  boots: [2, 4],
  companion: [3, 4],
};
export default function BuilderPage({
  config,
  classes,
  characters,
  buildId,
  characterId,
}: Props) {
  const [draft, setDraft] = useState<Build>(() =>
      fresh(characters.find((c) => c.id === characterId)),
    ),
    [saved, setSaved] = useState<Build[]>([]),
    [catalog, setCatalog] = useState<Catalog>({ items: [], sets: [] }),
    [tab, setTab] = useState(characterId ? "saved" : "equipment"),
    [picker, setPicker] = useState<string | null>(null),
    [editor, setEditor] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState(0),
    [compare, setCompare] = useState<string[]>([]),
    [targetProfiles, setTargetProfiles] = useState<BuildInput["target"][]>([]),
    [buffProfiles, setBuffProfiles] = useState<
      { name: string; buffs: BuildInput["buffs"] }[]
    >([]),
    [loaded, setLoaded] = useState(false);
  const importer = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  const navigationEpoch = useRef(0);
  draftRef.current = draft;
  useEffect(() => {
    if (!loaded || !characterId) return;
    const c = characters.find((c) => c.id === characterId);
    if (c && draftRef.current.characterId !== c.id) setDraft(fresh(c));
  }, [loaded, characters, characterId]);
  useEffect(() => {
    if (characterId) setTab("saved");
  }, [characterId]);
  const itemMap = useMemo(
      () => new Map(catalog.items.map((i) => [i.id, i])),
      [catalog.items],
    ),
    setMap = useMemo(
      () => new Map(catalog.sets.map((s) => [s.id, s])),
      [catalog.sets],
    );
  const calculated = useMemo(
    () => calculateBuild(draft, itemMap, setMap),
    [draft, itemMap, setMap],
  );
  const change = useCallback(
    (next: Partial<Build>) => setDraft((d) => ({ ...d, ...next })),
    [],
  );
  const closePicker = useCallback(() => setPicker(null), []);
  useEffect(() => {
    let cancelled = false;
    const epoch = navigationEpoch.current;
    setLoaded(false);
    async function load() {
      try {
        const response = await cached<Build[]>("/api/builder/builds", config);
        const queue = await read<Build[]>("builder:outbox", []);
        const merged = [
          ...response.data.filter((b) => !queue.some((q) => q.id === b.id)),
          ...queue,
        ];
        const all = merged;
        if (cancelled || epoch !== navigationEpoch.current) return;
        setSaved(all);
        setPending(queue.length);
        const id =
          buildId ??
          (!characterId ? await read<string>("builder:lastDraft", "") : "");
        const localDraft = id
          ? await read<Build | null>("builder:draft:" + id, null)
          : null;
        const chosen =
          (buildId ? localDraft : null) ??
          all.find((b) => b.id === id) ??
          (!characterId ? localDraft : null);
        if (cancelled || epoch !== navigationEpoch.current) return;
        setDraft(chosen ?? fresh(characters.find((c) => c.id === characterId)));
        if (buildId && !chosen)
          setError("Dieser Build ist nicht lokal verfügbar.");
      } catch (e) {
        const all = await read<Build[]>("builder:saved", []);
        const localDraft = buildId
          ? await read<Build | null>("builder:draft:" + buildId, null)
          : null;
        if (!cancelled && epoch === navigationEpoch.current) {
          if (e instanceof ApiError && [401, 403].includes(e.status))
            setError(
              "Verbindungsschlüssel fehlt oder ist ungültig. Bitte Einstellungen prüfen.",
            );
          setSaved(all);
          setDraft(
            localDraft ??
              all.find((b) => b.id === buildId) ??
              fresh(characters.find((c) => c.id === characterId)),
          );
          setNotice(
            "Lokale Builder-Daten geladen. Dienst derzeit nicht erreichbar.",
          );
        }
      }
      if (!cancelled && epoch === navigationEpoch.current) setLoaded(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [buildId, characterId, config]);
  useEffect(() => {
    let cancelled = false;
    void cached<Catalog>(
      "/api/builder/catalog?version=" + draft.gameVersion,
      config,
    )
      .then((r) => {
        if (!cancelled) setCatalog(r.data);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [draft.gameVersion, config]);
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      void write("builder:draft:" + draft.id, draft);
      void write("builder:lastDraft", draft.id);
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, loaded]);
  useEffect(() => {
    void read<BuildInput["target"][]>("builder:targets", []).then(
      setTargetProfiles,
    );
    void read<{ name: string; buffs: BuildInput["buffs"] }[]>(
      "builder:buffProfiles",
      [],
    ).then(setBuffProfiles);
    void cached<(BuildInput["target"] & { id: string })[]>(
      "/api/builder/targets",
      config,
    )
      .then((r) => {
        const profiles = r.data.map(({ id: _id, ...target }) => target);
        setTargetProfiles((local) => [
          ...new Map(
            [...local, ...profiles].map((t) => [JSON.stringify(t), t]),
          ).values(),
        ]);
      })
      .catch(() => {});
  }, [config]);
  useEffect(() => {
    function keys(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        document.getElementById("builder-save")?.click();
      }
    }
    addEventListener("keydown", keys);
    return () => removeEventListener("keydown", keys);
  }, []);
  async function storeLocal(build: Build) {
    const all = await read<Build[]>("builder:saved", []);
    const next = [
      build,
      ...all
        .filter((b) => b.id !== build.id)
        .map((b) =>
          build.active && build.characterId === b.characterId
            ? { ...b, active: false }
            : b,
        ),
    ];
    await write("builder:saved", next);
    setSaved(next);
    await write("builder:draft:" + build.id, build);
  }
  async function save(build = draftRef.current) {
    setBusy(true);
    setError("");
    try {
      const input = buildInput.parse(build);
      const result = await api<Build>(
        build.revision
          ? "/api/builder/builds/" + build.id
          : "/api/builder/builds",
        config,
        {
          ...input,
          ...(build.revision
            ? { expectedRevision: build.revision }
            : { id: build.id }),
        },
        build.revision ? "PUT" : "POST",
      );
      await storeLocal(result.data);
      setDraft(result.data);
      const queue = (await read<Build[]>("builder:outbox", [])).filter(
        (b) => b.id !== build.id,
      );
      await write("builder:outbox", queue);
      setPending(queue.length);
      setNotice(
        "Build gespeichert. Geplante Companion-Ausrüstung wurde aktualisiert.",
      );
      navigatePath("/builder/" + result.data.id);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(
          e.status === 409
            ? "Versionskonflikt: Deine lokale Fassung bleibt erhalten. Exportiere sie oder dupliziere sie vor dem erneuten Laden."
            : e.message,
        );
      } else {
        const queue = await read<Build[]>("builder:outbox", []);
        const next = [...queue.filter((b) => b.id !== build.id), build];
        await write("builder:outbox", next);
        await storeLocal(build);
        setPending(next.length);
        setNotice(
          "Offline gespeichert. Die Änderung wartet auf Synchronisierung.",
        );
      }
    } finally {
      setBusy(false);
    }
  }
  async function synchronize() {
    setBusy(true);
    setError("");
    try {
      let queue = await read<Build[]>("builder:outbox", []);
      for (const build of queue) {
        const input = buildInput.parse(build);
        const result = await api<Build>(
          build.revision
            ? "/api/builder/builds/" + build.id
            : "/api/builder/builds",
          config,
          {
            ...input,
            ...(build.revision
              ? { expectedRevision: build.revision }
              : { id: build.id }),
          },
          build.revision ? "PUT" : "POST",
        );
        await storeLocal(result.data);
        if (draft.id === build.id) setDraft(result.data);
        queue = queue.filter((q) => q.id !== build.id);
        await write("builder:outbox", queue);
        setPending(queue.length);
      }
      const all = await api<Build[]>("/api/builder/builds", config);
      setSaved(all.data);
      await write("builder:saved", all.data);
      setNotice("Builds synchronisiert.");
    } catch (e) {
      setError("Synchronisierung angehalten: " + String(e));
    } finally {
      setBusy(false);
    }
  }
  function newBuild(
    character = characters.find((c) => c.id === draft.characterId),
  ) {
    activateDraft(fresh(character));
  }
  function activateDraft(build: Build) {
    navigationEpoch.current++;
    setDraft(build);
    setLoaded(true);
    setEditor(null);
    setTab("equipment");
    void (async () => {
      await write("builder:draft:" + build.id, build);
      await write("builder:lastDraft", build.id);
      navigatePath("/builder/" + build.id);
    })().catch((e) => setError(String(e)));
  }
  function open(build: Build) {
    setDraft(build);
    setTab("equipment");
    setEditor(null);
    navigatePath("/builder/" + build.id);
  }
  function duplicate(build = draft) {
    activateDraft({
      ...structuredClone(build),
      id: crypto.randomUUID(),
      revision: 0,
      name: build.name + " – Kopie",
      active: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setNotice("Kopie geöffnet. Mit Speichern dauerhaft übernehmen.");
  }
  async function remove(build: Build) {
    if (!confirm(`Build „${build.name}“ dauerhaft löschen?`)) return;
    try {
      await api("/api/builder/builds/" + build.id, config, undefined, "DELETE");
      const next = saved.filter((b) => b.id !== build.id);
      setSaved(next);
      await write("builder:saved", next);
      if (build.id === draft.id) newBuild();
    } catch (e) {
      setError(String(e));
    }
  }
  function equip(item: BuilderItem) {
    if (!picker) return;
    change({
      equipment: {
        ...draft.equipment,
        [picker]: { itemId: item.id, rolls: {}, exos: {} },
      },
    });
    setPicker(null);
    setNotice(item.name + " ausgerüstet.");
  }
  function unequip(slot: string) {
    const equipment = { ...draft.equipment };
    delete equipment[slot];
    change({ equipment });
    if (editor === slot) setEditor(null);
  }
  function updateInstance(
    slot: string,
    kind: "rolls" | "exos",
    id: number,
    value: number | undefined,
  ) {
    const instance = draft.equipment[slot];
    if (!instance) return;
    const stats = { ...instance[kind] };
    if (value === undefined) delete stats[id];
    else stats[id] = value;
    change({
      equipment: { ...draft.equipment, [slot]: { ...instance, [kind]: stats } },
    });
  }
  function addBuff(spell: BuilderSpell, level: SpellLevel) {
    const stats: Stats = {};
    for (const e of level.effects)
      if (e.kind === "buff" && e.statId)
        stats[e.statId] = (stats[e.statId] ?? 0) + e.max;
    if (!Object.keys(stats).length) return;
    change({
      buffs: [
        ...draft.buffs,
        {
          id: crypto.randomUUID(),
          name: spell.name + " – manuelle Annahme",
          active: true,
          stats,
          spellId: spell.id,
          version: spell.version,
        },
      ],
    });
    setTab("buffs");
    setNotice(
      "Quellzauber übernommen. Zielmaske, Dauer und Bedingungen vor Verwendung prüfen.",
    );
  }
  const equipped = Object.values(draft.equipment);
  const knownCost = equipped.reduce(
      (sum, x) => sum + (draft.prices[x.itemId] ?? 0),
      0,
    ),
    unknownPrices = equipped.filter(
      (x) => draft.prices[x.itemId] === undefined,
    ).length;
  const filteredSaved = saved.filter(
    (b) => !characterId || b.characterId === characterId,
  );
  const gameClass = classes.find((c) => c.id === draft.classId),
    character = characters.find((c) => c.id === draft.characterId);
  const editing = editor ? itemMap.get(draft.equipment[editor]?.itemId) : null;
  if (!loaded) return <div className="panel">Builder wird geladen …</div>;
  return (
    <div className="builder-page">
      <header className="builder-heading">
        <div>
          <span className="eyebrow">DEINE AUSRÜSTUNG. DEIN PLAN.</span>
          <h2>Ein Set, das zu dir passt.</h2>
          <p>Plane, vergleiche und verfeinere deinen nächsten Build.</p>
        </div>
        <div className="toolbar">
          <button className="secondary" onClick={() => newBuild()}>
            <Plus size={16} />
            Neuer Build
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void synchronize()}
          >
            <RefreshCw size={16} />
            Synchronisieren{pending ? " (" + pending + ")" : ""}
          </button>
          <button id="builder-save" disabled={busy} onClick={() => void save()}>
            <Save size={16} />
            Speichern
          </button>
        </div>
      </header>
      {notice && (
        <div role="status" className="notice builder-notice">
          {notice}
          <button
            className="icon-button"
            aria-label="Hinweis schließen"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="notice">
          {error}
          <button
            className="icon-button"
            aria-label="Fehler schließen"
            onClick={() => setError("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <div className="builder-tabs" role="tablist">
        {[
          ["equipment", "Ausrüstung"],
          ["spells", "Zauber & Schaden"],
          ["buffs", "Buffs & Gegner"],
          ["compare", "Vergleichen"],
          ["optimizer", "Optimierer"],
          ["saved", "Gespeicherte Sets"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="builder-layout">
        <aside className="panel builder-character">
          <div className="builder-class-heading">
            <img
              src={classAssets[draft.classId]?.icon}
              alt={gameClass?.nameDe ?? "Klasse"}
            />
            <div>
              <strong>{gameClass?.nameDe ?? "Klasse " + draft.classId}</strong>
              <small>
                {character?.name ?? "Unabhängiger Build"} · Stufe {draft.level}
              </small>
            </div>
          </div>
          <label>
            Buildname
            <input
              value={draft.name}
              onChange={(e) => change({ name: e.target.value })}
            />
          </label>
          <ClassSelector
            classes={classes}
            value={draft.classId}
            onChange={(classId) =>
              change({
                classId,
                characterId:
                  character?.classId === classId ? draft.characterId : null,
                active: false,
              })
            }
            label="Builder-Klasse"
          />
          <div className="builder-form-grid">
            <label>
              Level
              <input
                type="number"
                min="1"
                max="200"
                value={draft.level}
                onChange={(e) =>
                  change({ level: Math.max(1, Math.min(200, +e.target.value)) })
                }
              />
            </label>
            <label>
              Datenversion
              <select
                value={draft.gameVersion}
                onChange={(e) => {
                  if (
                    Object.keys(draft.equipment).length &&
                    !confirm(
                      "Datenversion wechseln? Ausrüstung und versionsgebundene Buffs dieses Entwurfs werden zurückgesetzt.",
                    )
                  )
                    return;
                  change({
                    gameVersion: e.target.value as Build["gameVersion"],
                    equipment: {},
                    buffs: [],
                  });
                }}
              >
                <option>3.7.12.12</option>
                <option>3.6.12.16</option>
              </select>
            </label>
            <label>
              Element
              <select
                value={draft.element ?? "earth"}
                onChange={(e) =>
                  change({ element: e.target.value as Build["element"] })
                }
              >
                {[
                  ["earth", "Erde"],
                  ["fire", "Feuer"],
                  ["water", "Wasser"],
                  ["air", "Luft"],
                  ["neutral", "Neutral"],
                  ["hybrid", "Hybrid"],
                ].map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Zugeordneter Charakter
            <select
              value={draft.characterId ?? ""}
              onChange={(e) => {
                const c = characters.find((c) => c.id === e.target.value);
                change({
                  characterId: c?.id ?? null,
                  ...(c
                    ? { classId: c.classId ?? draft.classId, level: c.level }
                    : {}),
                  active: false,
                });
              }}
            >
              <option value="">Unabhängiger Build</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.server}
                </option>
              ))}
            </select>
          </label>
          <details className="builder-points">
            <summary>
              Eigenschaftspunkte & Scrolls{" "}
              <span>
                {calculated.spent} / {5 * (draft.level - 1)}
              </span>
            </summary>
            {[9, 10, 45, 13, 22, 36].map((id) => (
              <div key={id}>
                <strong>{statDefinitions.find((s) => s[0] === id)?.[1]}</strong>
                <label>
                  Verteilter Wert
                  <input
                    type="number"
                    min="0"
                    max="995"
                    value={draft.characteristics[id] ?? 0}
                    onChange={(e) =>
                      change({
                        characteristics: {
                          ...draft.characteristics,
                          [id]: Math.max(0, +e.target.value),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Scroll
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={draft.scroll[id] ?? 0}
                    onChange={(e) =>
                      change({
                        scroll: {
                          ...draft.scroll,
                          [id]: Math.max(0, Math.min(100, +e.target.value)),
                        },
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </details>
          <div className="builder-stat-groups">
            {[...new Set(statDefinitions.map((s) => s[2]))].map((group) => (
              <details key={group} open={group === "Grundwerte"}>
                <summary>{group}</summary>
                {statDefinitions
                  .filter((s) => s[2] === group)
                  .map(([id, label]) => (
                    <div
                      className="builder-stat-row"
                      key={id}
                      title={`Basis ${calculated.base[id] ?? 0} · Items ${calculated.equipment[id] ?? 0} · Sets ${calculated.bonuses[id] ?? 0} · Buffs ${calculated.buffs[id] ?? 0}`}
                    >
                      <span>{label}</span>
                      <strong>{calculated.total[id] ?? 0}</strong>
                    </div>
                  ))}
              </details>
            ))}
          </div>
        </aside>
        <main className="builder-workspace">
          {tab === "equipment" && (
            <>
              <section className="panel equipment-panel">
                <div className="panel-title">
                  <span>
                    <Shield size={18} /> {draft.name}
                  </span>
                  <span className="pill">
                    {draft.active ? "Aktiv im Companion" : "Geplanter Build"}
                  </span>
                </div>
                <div className="equipment-stage">
                  <div className="builder-portrait">
                    <img
                      src={classAssets[draft.classId]?.portrait}
                      alt={gameClass?.nameDe ?? "Klassenbild"}
                    />
                    <span>{gameClass?.nameDe}</span>
                    <small>{draft.level}</small>
                  </div>
                  {slotDefinitions
                    .filter(([s]) => !s.startsWith("dofus"))
                    .map(([slot, label]) => {
                      const instance = draft.equipment[slot],
                        item = instance ? itemMap.get(instance.itemId) : null;
                      const position = positions[slot];
                      return (
                        <article
                          key={slot}
                          className={
                            "equipment-slot " + (item ? "occupied" : "")
                          }
                          style={{
                            gridColumn: position?.[0],
                            gridRow: position?.[1],
                          }}
                        >
                          <button
                            className="slot-select"
                            title={
                              item
                                ? item.name +
                                  " · " +
                                  item.effects.map((e) => e.label).join(" · ")
                                : label + " auswählen"
                            }
                            onClick={() => setPicker(slot)}
                            aria-label={label + " auswählen"}
                          >
                            {item ? (
                              <ItemImage item={item} />
                            ) : (
                              <Shield size={32} />
                            )}
                            <span>{item?.name ?? label}</span>
                            <small>
                              {item ? "Stufe " + item.level : label}
                            </small>
                            {instance &&
                              (Object.keys(instance.rolls).length > 0 ||
                                Object.keys(instance.exos).length > 0) && (
                                <em>Verändert</em>
                              )}
                          </button>
                          {item && (
                            <div className="slot-tools">
                              <button
                                aria-label={label + " bearbeiten"}
                                onClick={() =>
                                  setEditor(editor === slot ? null : slot)
                                }
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                aria-label={label + " entfernen"}
                                onClick={() => unequip(slot)}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                </div>
                <div className="dofus-slots">
                  {slotDefinitions
                    .filter(([s]) => s.startsWith("dofus"))
                    .map(([slot, label]) => {
                      const item = itemMap.get(draft.equipment[slot]?.itemId);
                      return (
                        <article
                          className={
                            "equipment-slot " + (item ? "occupied" : "")
                          }
                          key={slot}
                        >
                          <button
                            className="slot-select"
                            aria-label={label + " auswählen"}
                            onClick={() => setPicker(slot)}
                          >
                            {item ? (
                              <ItemImage item={item} />
                            ) : (
                              <WandSparkles size={25} />
                            )}
                            <span>{item?.name ?? label}</span>
                          </button>
                          {item && (
                            <div className="slot-tools">
                              <button
                                aria-label={label + " bearbeiten"}
                                onClick={() => setEditor(slot)}
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                aria-label={label + " entfernen"}
                                onClick={() => unequip(slot)}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                </div>
              </section>
              {editor && editing && (
                <section className="panel item-editor">
                  <div className="panel-title">
                    <span>
                      <Pencil size={17} />
                      {editing.name} · Individuelle Instanz
                    </span>
                    <button
                      className="icon-button"
                      onClick={() => setEditor(null)}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <p className="muted">
                    Nur dieser Build wird verändert. Die Originaldaten bleiben
                    erhalten.
                  </p>
                  <div className="builder-form-grid">
                    {editing.effects
                      .filter((e) => !e.active)
                      .map((e) => (
                        <label key={e.id}>
                          {e.label}
                          <input
                            type="number"
                            aria-label={"Item-Roll " + e.id}
                            disabled={
                              editor.startsWith("dofus") ||
                              editor === "companion"
                            }
                            value={draft.equipment[editor].rolls[e.id] ?? e.max}
                            onChange={(event) =>
                              updateInstance(
                                editor,
                                "rolls",
                                e.id,
                                +event.target.value,
                              )
                            }
                          />
                        </label>
                      ))}
                  </div>
                  <details>
                    <summary>Exomagie & Overmaging</summary>
                    <div className="builder-form-grid">
                      {statDefinitions.map(([id, label]) => (
                        <label key={id}>
                          {label}
                          <input
                            aria-label={"Exomagie " + id}
                            disabled={
                              editor.startsWith("dofus") ||
                              editor === "companion"
                            }
                            type="number"
                            value={draft.equipment[editor].exos[id] ?? ""}
                            onChange={(e) =>
                              updateInstance(
                                editor,
                                "exos",
                                id,
                                e.target.value === ""
                                  ? undefined
                                  : +e.target.value,
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </details>
                  <label>
                    Eigener bestätigter Preis (Kamas)
                    <input
                      type="number"
                      min="0"
                      value={draft.prices[editing.id] ?? ""}
                      onChange={(e) => {
                        const prices = { ...draft.prices };
                        if (e.target.value === "") delete prices[editing.id];
                        else prices[editing.id] = Math.max(0, +e.target.value);
                        change({ prices });
                      }}
                    />
                  </label>
                  <button
                    className="secondary"
                    onClick={() =>
                      change({
                        equipment: {
                          ...draft.equipment,
                          [editor]: { itemId: editing.id, rolls: {}, exos: {} },
                        },
                      })
                    }
                  >
                    Ursprüngliche Werte wiederherstellen
                  </button>
                </section>
              )}
              <section className="panel">
                <h3>Setboni</h3>
                {calculated.activeSets.length ? (
                  calculated.activeSets.map((s) => (
                    <article key={s.id} className="set-bonus">
                      <strong>
                        {s.name} · {s.count} Teile
                      </strong>
                      <div>
                        {s.effects.map((e, i) => (
                          <span
                            className={e.max < 0 ? "negative" : "positive"}
                            key={i}
                          >
                            {e.label}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="muted">
                    Rüste Setteile aus, um ihre Boni hier zu prüfen.
                  </p>
                )}
              </section>
            </>
          )}
          {tab === "spells" && (
            <SpellSimulator
              config={config}
              build={draft}
              stats={calculated.total}
              weapon={itemMap.get(draft.equipment.weapon?.itemId)}
              onBuff={addBuff}
            />
          )}
          {tab === "buffs" && (
            <>
              <section className="panel">
                <h2>Buffs & Simulationsannahmen</h2>
                <p className="muted">
                  Klassenbuffs aus „Zauber & Schaden“ übernehmen oder manuelle
                  Vergleichsbedingungen festlegen. Zustands-, Ziel- und
                  Dauerbedingungen werden nicht automatisch als erfüllt
                  angenommen.
                </p>
                <div className="toolbar">
                  <button
                    onClick={() =>
                      change({
                        buffs: [
                          ...draft.buffs,
                          {
                            id: crypto.randomUUID(),
                            name: "Manuelle Annahme",
                            active: true,
                            stats: { 32: 100 },
                          },
                        ],
                      })
                    }
                  >
                    Manuellen Buff hinzufügen
                  </button>
                  <button
                    className="secondary"
                    onClick={() => change({ buffs: [] })}
                  >
                    Buffs zurücksetzen
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      const next = [
                        ...buffProfiles,
                        {
                          name: draft.name + " – Buffprofil",
                          buffs: structuredClone(draft.buffs),
                        },
                      ];
                      setBuffProfiles(next);
                      void write("builder:buffProfiles", next);
                    }}
                  >
                    Buffprofil speichern
                  </button>
                  <select
                    aria-label="Buffprofil laden"
                    value=""
                    onChange={(e) => {
                      const profile = buffProfiles[+e.target.value];
                      if (profile)
                        change({ buffs: structuredClone(profile.buffs) });
                    }}
                  >
                    <option value="">Buffprofil laden …</option>
                    {buffProfiles.map((p, i) => (
                      <option key={i} value={i}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                {draft.buffs.map((buff) => (
                  <article className="builder-buff" key={buff.id}>
                    <div className="toolbar">
                      <label>
                        <input
                          type="checkbox"
                          checked={buff.active}
                          onChange={(e) =>
                            change({
                              buffs: draft.buffs.map((b) =>
                                b.id === buff.id
                                  ? { ...b, active: e.target.checked }
                                  : b,
                              ),
                            })
                          }
                        />
                        <input
                          aria-label="Buffname"
                          value={buff.name}
                          onChange={(e) =>
                            change({
                              buffs: draft.buffs.map((b) =>
                                b.id === buff.id
                                  ? { ...b, name: e.target.value }
                                  : b,
                              ),
                            })
                          }
                        />
                      </label>
                      <button
                        className="icon-button"
                        aria-label="Buff entfernen"
                        onClick={() =>
                          change({
                            buffs: draft.buffs.filter((b) => b.id !== buff.id),
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <small>
                      {buff.spellId
                        ? "Quelle: Spell #" +
                          buff.spellId +
                          " · " +
                          buff.version
                        : "Manuelle Simulationsannahme"}
                    </small>
                    <div className="builder-form-grid">
                      {statDefinitions
                        .filter((s) => buff.stats[s[0]] !== undefined)
                        .map(([id, label]) => (
                          <label key={id}>
                            {label}
                            <input
                              type="number"
                              value={buff.stats[id]}
                              onChange={(e) =>
                                change({
                                  buffs: draft.buffs.map((b) =>
                                    b.id === buff.id
                                      ? {
                                          ...b,
                                          stats: {
                                            ...b.stats,
                                            [id]: +e.target.value,
                                          },
                                        }
                                      : b,
                                  ),
                                })
                              }
                            />
                          </label>
                        ))}
                    </div>
                    <select
                      aria-label="Buffeffekt hinzufügen"
                      value=""
                      onChange={(e) =>
                        change({
                          buffs: draft.buffs.map((b) =>
                            b.id === buff.id
                              ? {
                                  ...b,
                                  stats: { ...b.stats, [e.target.value]: 0 },
                                }
                              : b,
                          ),
                        })
                      }
                    >
                      <option value="">Effekt hinzufügen …</option>
                      {statDefinitions.map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
              </section>
              <section className="panel">
                <h2>Gegner konfigurieren</h2>
                <div className="builder-form-grid">
                  <label>
                    Zielname
                    <input
                      value={draft.target.name}
                      onChange={(e) =>
                        change({
                          target: { ...draft.target, name: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    Lebenspunkte
                    <input
                      type="number"
                      min="1"
                      value={draft.target.hp}
                      onChange={(e) =>
                        change({
                          target: {
                            ...draft.target,
                            hp: Math.max(1, +e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Entfernung (Felder)
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={draft.target.distance}
                      onChange={(e) =>
                        change({
                          target: {
                            ...draft.target,
                            distance: Math.max(1, +e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Zieltyp
                    <select
                      value={draft.target.mode}
                      onChange={(e) =>
                        change({
                          target: {
                            ...draft.target,
                            mode: e.target.value as "pvm" | "pvp",
                          },
                        })
                      }
                    >
                      <option value="pvm">PvM</option>
                      <option value="pvp">PvP (50 % Resistenzgrenze)</option>
                    </select>
                  </label>
                  {[0, 45, 13, 22, 36].map((id) => (
                    <div key={id}>
                      <label>
                        {id === 0
                          ? "Neutral"
                          : statDefinitions.find((s) => s[0] === id)?.[1]}{" "}
                        Resistenz %
                        <input
                          type="number"
                          min="-100"
                          max="100"
                          value={draft.target.percent[id] ?? 0}
                          onChange={(e) =>
                            change({
                              target: {
                                ...draft.target,
                                percent: {
                                  ...draft.target.percent,
                                  [id]: +e.target.value,
                                },
                              },
                            })
                          }
                        />
                      </label>
                      <label>
                        Feste Resistenz
                        <input
                          type="number"
                          value={draft.target.fixed[id] ?? 0}
                          onChange={(e) =>
                            change({
                              target: {
                                ...draft.target,
                                fixed: {
                                  ...draft.target.fixed,
                                  [id]: +e.target.value,
                                },
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                  ))}
                  <label>
                    Kritische Resistenz
                    <input
                      type="number"
                      value={draft.target.critical}
                      onChange={(e) =>
                        change({
                          target: {
                            ...draft.target,
                            critical: +e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Pushback-Resistenz (gespeicherte Zielannahme)
                    <input
                      type="number"
                      value={draft.target.pushback ?? 0}
                      onChange={(e) =>
                        change({
                          target: {
                            ...draft.target,
                            pushback: +e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                </div>
                <div className="toolbar">
                  <button
                    className="secondary"
                    onClick={() =>
                      change({ target: buildInput.shape.target.parse({}) })
                    }
                  >
                    Keine Resistenzen
                  </button>
                  <button
                    onClick={() => {
                      const profiles = [
                        ...targetProfiles,
                        structuredClone(draft.target),
                      ];
                      setTargetProfiles(profiles);
                      void write("builder:targets", profiles);
                      void api(
                        "/api/builder/targets",
                        config,
                        draft.target,
                      ).catch(() => {});
                    }}
                  >
                    Testgegner speichern
                  </button>
                  <select
                    aria-label="Testgegner laden"
                    value=""
                    onChange={(e) =>
                      change({
                        target: structuredClone(
                          targetProfiles[+e.target.value],
                        ),
                      })
                    }
                  >
                    <option value="">Testgegner laden …</option>
                    {targetProfiles.map((t, i) => (
                      <option key={i} value={i}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </section>
            </>
          )}
          {tab === "optimizer" && (
            <Optimizer
              config={config}
              build={draft}
              items={catalog.items}
              sets={catalog.sets}
              onUse={(b) => {
                activateDraft({ ...fresh(), ...b });
              }}
            />
          )}
          {tab === "saved" && (
            <section className="panel">
              <h2>
                {characterId
                  ? characters.find((c) => c.id === characterId)?.name +
                    " – Sets"
                  : "Deine gespeicherten Sets"}
              </h2>
              <div className="builder-saved-grid">
                {filteredSaved.map((b) => {
                  const current =
                    b.gameVersion === draft.gameVersion
                      ? calculateBuild(b, itemMap, setMap)
                      : null;
                  return (
                    <article className="builder-result" key={b.id}>
                      <header>
                        <img
                          className="build-class-thumb"
                          src={classAssets[b.classId]?.icon}
                          alt=""
                        />
                        <h3>{b.name}</h3>
                      </header>
                      <small>
                        {characters.find((c) => c.id === b.characterId)?.name ??
                          "Unabhängig"}{" "}
                        · {b.gameVersion} ·{" "}
                        {b.active ? "Aktiv im Companion" : "Gespeichert"}
                      </small>
                      <p>
                        {current
                          ? `${current.total[12]} AP · ${current.total[8]} MP · ${current.hp} LP`
                          : "Zum Berechnen Datenversion öffnen"}
                      </p>
                      <div className="saved-equipment-strip">
                        {Object.values(b.equipment).map((x, i) => {
                          const item = itemMap.get(x.itemId);
                          return item ? (
                            <ItemImage key={i} item={item} />
                          ) : (
                            <span key={i}>#{x.itemId}</span>
                          );
                        })}
                      </div>
                      <small>
                        Erstellt{" "}
                        {new Date(b.createdAt).toLocaleDateString("de-DE")} ·
                        Geändert {new Date(b.updatedAt).toLocaleString("de-DE")}
                      </small>
                      <div className="toolbar">
                        <button onClick={() => open(b)}>Öffnen</button>
                        <button
                          className="secondary"
                          onClick={() => duplicate(b)}
                        >
                          Duplizieren
                        </button>
                        <button
                          className="secondary"
                          onClick={() => {
                            setCompare((c) =>
                              c.includes(b.id) ? c : c.concat(b.id),
                            );
                            setTab("compare");
                          }}
                        >
                          Vergleichen
                        </button>
                        <button
                          className="icon-button"
                          aria-label={b.name + " löschen"}
                          onClick={() => void remove(b)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {!filteredSaved.length && (
                <div className="empty">
                  Noch keine Sets gespeichert. Erstelle deinen ersten Build.
                </div>
              )}
            </section>
          )}
          {tab === "compare" && (
            <section className="panel">
              <h2>Builds unter gleichen Bedingungen vergleichen</h2>
              <p className="muted">
                Vergleiche verwenden die Gegnerbedingungen und Buffs des
                aktuellen Entwurfs. Datenversion und Klasse müssen
                übereinstimmen, damit Schadenswerte vergleichbar sind.
              </p>
              <div className="toolbar">
                {saved.map((b) => (
                  <label key={b.id}>
                    <input
                      type="checkbox"
                      checked={compare.includes(b.id)}
                      onChange={(e) =>
                        setCompare((c) =>
                          e.target.checked
                            ? [...c, b.id]
                            : c.filter((id) => id !== b.id),
                        )
                      }
                    />
                    {b.name}
                  </label>
                ))}
              </div>
              <div className="build-comparison">
                <table>
                  <thead>
                    <tr>
                      <th>Wert</th>
                      <th>{draft.name} (aktuell)</th>
                      {saved
                        .filter((b) => compare.includes(b.id))
                        .map((b) => (
                          <th key={b.id}>{b.name}</th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {statDefinitions.map(([id, label]) => (
                      <tr key={id}>
                        <td>{label}</td>
                        <td>{calculated.total[id] ?? 0}</td>
                        {saved
                          .filter((b) => compare.includes(b.id))
                          .map((b) => {
                            if (b.gameVersion !== draft.gameVersion)
                              return <td key={b.id}>Andere Datenversion</td>;
                            const value =
                              calculateBuild(
                                {
                                  ...b,
                                  buffs: draft.buffs,
                                  target: draft.target,
                                },
                                itemMap,
                                setMap,
                              ).total[id] ?? 0;
                            const delta = value - (calculated.total[id] ?? 0);
                            return (
                              <td
                                key={b.id}
                                className={
                                  delta > 0
                                    ? "positive"
                                    : delta < 0
                                      ? "negative"
                                      : ""
                                }
                              >
                                {value}{" "}
                                <small>
                                  ({delta > 0 ? "+" : ""}
                                  {delta})
                                </small>
                              </td>
                            );
                          })}
                      </tr>
                    ))}
                    <tr>
                      <td>Ausrüstung</td>
                      <td>
                        {Object.values(draft.equipment)
                          .map((x) => itemMap.get(x.itemId)?.name)
                          .join(" · ")}
                      </td>
                      {saved
                        .filter((b) => compare.includes(b.id))
                        .map((b) => (
                          <td key={b.id}>
                            {Object.values(b.equipment)
                              .map(
                                (x) =>
                                  itemMap.get(x.itemId)?.name ?? "#" + x.itemId,
                              )
                              .join(" · ")}
                          </td>
                        ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <DamageComparison
                config={config}
                current={draft}
                builds={saved.filter((b) => compare.includes(b.id))}
                items={itemMap}
                sets={setMap}
              />
            </section>
          )}
        </main>
        <aside className="panel builder-summary">
          <span className="eyebrow">DEIN BUILD AUF EINEN BLICK</span>
          <div className="builder-summary-metrics">
            <div>
              <strong>{calculated.total[12] ?? 0}</strong>
              <span>AP</span>
            </div>
            <div>
              <strong>{calculated.total[8] ?? 0}</strong>
              <span>MP</span>
            </div>
            <div>
              <strong>{calculated.hp}</strong>
              <span>LP</span>
            </div>
          </div>
          <div className="builder-summary-elements">
            {[45, 13, 22, 36].map((id) => (
              <div key={id}>
                <span>{statDefinitions.find((s) => s[0] === id)?.[1]}</span>
                <strong>{calculated.total[id] ?? 0}</strong>
              </div>
            ))}
          </div>
          <div className="builder-validity">
            <strong>
              {calculated.valid
                ? "✓ Ausgewertete Regeln erfüllt"
                : "Ausrüstung prüfen"}
            </strong>
            {[...calculated.warnings, ...calculated.unknown].map((w, i) => (
              <p key={i} className="warning-text">
                {w}
              </p>
            ))}
          </div>
          <div className="builder-cost">
            <span>Eigene bekannte Preise</span>
            <strong>{knownCost.toLocaleString("de-DE")} Kamas</strong>
            <small>
              {unknownPrices
                ? `${unknownPrices} Preise fehlen – Gesamtkosten unbekannt`
                : "Alle ausgerüsteten Items bepreist"}
            </small>
          </div>
          <div className="builder-actions">
            <button disabled={busy} onClick={() => void save()}>
              <Save size={16} />
              Build speichern
            </button>
            <button className="secondary" onClick={() => duplicate()}>
              <Copy size={16} />
              Duplizieren
            </button>
            <button
              className="secondary"
              disabled={!draft.characterId}
              onClick={() => void save({ ...draft, active: true })}
            >
              <Check size={16} />
              Als aktiv markieren
            </button>
            <button className="secondary" onClick={() => setTab("spells")}>
              <Swords size={16} />
              Schaden berechnen
            </button>
            <button className="secondary" onClick={() => setTab("buffs")}>
              <SlidersHorizontal size={16} />
              Buffs bearbeiten
            </button>
            <button
              className="secondary"
              onClick={() =>
                fileDownload(draft.name + ".dofus-build.json", {
                  format: "dofus-companion-build",
                  schema: 1,
                  build: buildInput.parse(draft),
                })
              }
            >
              <Download size={16} />
              Build exportieren
            </button>
            <button
              className="secondary"
              onClick={() => importer.current?.click()}
            >
              <Upload size={16} />
              Build importieren
            </button>
            <input
              ref={importer}
              type="file"
              hidden
              accept="application/json,.json"
              onChange={async (e) => {
                try {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1024 * 1024)
                    throw Error("Importdatei zu groß (max. 1 MB).");
                  const json = JSON.parse(await file.text());
                  if (
                    json.format !== "dofus-companion-build" ||
                    json.schema !== 1
                  )
                    throw Error("Unbekanntes Austauschformat");
                  const input = buildInput.parse(json.build);
                  activateDraft({ ...fresh(), ...input, active: false });
                  setNotice(
                    "Build importiert. Speichern übernimmt ihn dauerhaft.",
                  );
                } catch (e) {
                  setError(String(e));
                } finally {
                  e.target.value = "";
                }
              }}
            />
            <button
              className="secondary"
              disabled={!draft.revision}
              onClick={async () => {
                try {
                  await api(
                    "/api/builder/builds/" + draft.id + "/share",
                    config,
                    {},
                  );
                  setNotice(
                    "Freigabe vorgemerkt. Der konfigurierte Discord-Bot liefert den Build an dein Companion-Konto.",
                  );
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              An Discord senden
            </button>
            <button
              className="text-button"
              onClick={() => {
                if (
                  confirm(
                    "Ausrüstung, Punkte und Buffs dieses Entwurfs zurücksetzen?",
                  )
                )
                  change({
                    equipment: {},
                    characteristics: {},
                    scroll: {},
                    buffs: [],
                  });
              }}
            >
              Build zurücksetzen
            </button>
          </div>
          <label>
            Beschreibung
            <textarea
              rows={3}
              value={draft.description}
              onChange={(e) => change({ description: e.target.value })}
            />
          </label>
          <small>
            Aktiv bedeutet im Companion ausgewählt. Tatsächlich im Spiel
            getragene Ausrüstung ist ohne autorisierte Live-Schnittstelle
            unbekannt.
          </small>
        </aside>
      </div>
      {picker && (
        <ItemPicker
          config={config}
          version={draft.gameVersion}
          level={draft.level}
          slot={picker}
          types={[
            ...new Map(
              catalog.items
                .filter((i) => compatible(i, picker))
                .map((i) => [i.typeId, { id: i.typeId, name: i.type }]),
            ).values(),
          ]}
          currentItem={itemMap.get(draft.equipment[picker]?.itemId)}
          onClose={closePicker}
          onEquip={equip}
        />
      )}
    </div>
  );
}
