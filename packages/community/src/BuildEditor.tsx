import { useEffect, useState } from "react";
import {
  buildInput,
  calculateBuild,
  compatible,
  slotDefinitions,
  statDefinitions,
  type Build,
  type BuildInput,
  type BuilderItem,
  type BuilderSet,
} from "@dofus/core";
import type { LocalStore } from "./sync";
import type { CommunityCharacter } from "./model";
import classes from "./classes.json";
type Catalog = { items: BuilderItem[]; sets: BuilderSet[] };
export default function BuildEditor({
  store,
  initial,
  onClose,
}: {
  store: LocalStore;
  initial?: Build;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<BuildInput>(() =>
      buildInput.parse(
        initial ?? {
          name: "Neuer Build",
          classId: 1,
          level: 200,
          gameVersion: "3.7.12.12",
        },
      ),
    ),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [characters, setCharacters] = useState<CommunityCharacter[]>([]),
    [slot, setSlot] = useState("hat"),
    [search, setSearch] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void import("./builder-catalog.json").then((data) => {
      if (active)
        setCatalog(data.default.versions[draft.gameVersion] as Catalog);
    });
    void store.read<CommunityCharacter[]>("characters", []).then((c) => {
      if (active) setCharacters(c);
    });
    return () => {
      active = false;
    };
  }, [store, draft.gameVersion]);
  const items = new Map(catalog?.items.map((i) => [i.id, i])),
    sets = new Map(catalog?.sets.map((s) => [s.id, s])),
    result = calculateBuild(draft, items, sets),
    equipped = draft.equipment[slot],
    item = items.get(equipped?.itemId),
    set = (patch: Partial<BuildInput>) =>
      setDraft((old) => ({ ...old, ...patch }));
  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      const clean = buildInput.parse(draft),
        current = await store.read<Build[]>("builder:saved", []),
        original = current.find((b) => b.id === initial?.id);
      if (initial && original?.revision !== initial.revision)
        throw Error(
          "Build wurde inzwischen geändert. Entwurf exportieren und die neuere Fassung laden.",
        );
      const now = new Date().toISOString(),
        build: Build = {
          ...clean,
          id: initial?.id ?? crypto.randomUUID(),
          revision: (original?.revision ?? 0) + 1,
          createdAt: original?.createdAt ?? now,
          updatedAt: now,
        };
      await store.write("builder:saved", [
        ...current
          .filter((b) => b.id !== build.id)
          .map((b) =>
            build.active &&
            build.characterId &&
            b.characterId === build.characterId
              ? {
                  ...b,
                  active: false,
                  revision: b.revision + 1,
                  updatedAt: now,
                }
              : b,
          ),
        build,
      ]);
      window.dispatchEvent(new Event("companion:cloud-applied"));
      onClose();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cc-panel cc-build-editor">
      <div className="cc-toolbar">
        <h3>Build bearbeiten</h3>
        <button
          onClick={() => {
            if (confirm("Ungespeicherten Entwurf schließen?")) onClose();
          }}
        >
          Schließen
        </button>
      </div>
      <p>
        Versionierte Originaldaten und dieselbe Berechnung wie im
        Desktop-Builder. Unbekannte Spezialeffekte bleiben gekennzeichnet.
      </p>
      <div className="cc-form-grid">
        <label className="cc-field">
          Buildname
          <input
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </label>
        <label className="cc-field">
          Klasse
          <select
            value={draft.classId}
            onChange={(e) => set({ classId: Number(e.target.value) })}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="cc-field">
          Level
          <input
            type="number"
            min="1"
            max="200"
            value={draft.level}
            onChange={(e) => set({ level: Number(e.target.value) })}
          />
        </label>
        <label className="cc-field">
          Charakter
          <select
            value={draft.characterId ?? ""}
            onChange={(e) => set({ characterId: e.target.value || null })}
          >
            <option value="">Ohne Zuordnung</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="cc-field">
          Datenversion
          <select
            value={draft.gameVersion}
            onChange={(e) =>
              set({ gameVersion: e.target.value as BuildInput["gameVersion"] })
            }
          >
            <option>3.7.12.12</option>
            <option>3.6.12.16</option>
          </select>
        </label>
        <label className="cc-check">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => set({ active: e.target.checked })}
          />
          Aktiver Build für diesen Charakter
        </label>
      </div>
      <div className="cc-build-stats">
        <b className="cc-stat-ap">{result.total[12] ?? 0} AP</b>
        <b className="cc-stat-mp">{result.total[8] ?? 0} BP</b>
        <b className="cc-stat-hp">{result.hp} LP</b>
      </div>
      <div className="cc-build-slots">
        {slotDefinitions.map(([key, name]) => (
          <button
            key={key}
            aria-pressed={slot === key}
            onClick={() => {
              setSlot(key);
              setSearch("");
            }}
          >
            {name}
            <small>
              {items.get(draft.equipment[key]?.itemId)?.name ?? "Leer"}
            </small>
          </button>
        ))}
      </div>
      <h4>{slotDefinitions.find((s) => s[0] === slot)?.[1]}</h4>
      {item && (
        <div className="cc-card">
          <strong>{item.name}</strong>
          <button
            onClick={() => {
              const equipment = { ...draft.equipment };
              delete equipment[slot];
              set({ equipment });
            }}
          >
            Slot leeren
          </button>
          <div className="cc-form-grid">
            {item.effects
              .filter((e) => statDefinitions.some((s) => s[0] === e.id))
              .map((effect, i) => (
                <label className="cc-field" key={`${effect.id}-${i}`}>
                  {effect.label} ({effect.min} bis {effect.max})
                  <input
                    type="number"
                    value={equipped.rolls[effect.id] ?? effect.max}
                    onChange={(e) =>
                      set({
                        equipment: {
                          ...draft.equipment,
                          [slot]: {
                            ...equipped,
                            rolls: {
                              ...equipped.rolls,
                              [effect.id]: Number(e.target.value),
                            },
                          },
                        },
                      })
                    }
                  />
                </label>
              ))}
          </div>
          <details>
            <summary>Exomagie</summary>
            <div className="cc-form-grid">
              {statDefinitions.map(([id, name]) => (
                <label className="cc-field" key={id}>
                  {name}
                  <input
                    type="number"
                    value={equipped.exos[id] ?? 0}
                    onChange={(e) =>
                      set({
                        equipment: {
                          ...draft.equipment,
                          [slot]: {
                            ...equipped,
                            exos: {
                              ...equipped.exos,
                              [id]: Number(e.target.value),
                            },
                          },
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </details>
        </div>
      )}
      <label className="cc-field">
        Passenden Gegenstand suchen
        <input value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      {!catalog ? (
        <p role="status">Originalkatalog wird bei Bedarf geladen …</p>
      ) : (
        <div className="cc-cards">
          {catalog.items
            .filter(
              (i) =>
                compatible(i, slot) &&
                i.level <= draft.level &&
                i.name.toLowerCase().includes(search.toLowerCase()),
            )
            .slice(0, 15)
            .map((i) => (
              <button
                key={i.id}
                onClick={() =>
                  set({
                    equipment: {
                      ...draft.equipment,
                      [slot]: { itemId: i.id, rolls: {}, exos: {} },
                    },
                  })
                }
              >
                {i.name} · Stufe {i.level}
              </button>
            ))}
        </div>
      )}
      <details>
        <summary>Eigenschaften & Schriftrollen</summary>
        <div className="cc-form-grid">
          {statDefinitions
            .filter(([id]) => [9, 10, 45, 13, 22, 36].includes(id))
            .map(([id, name]) => (
              <label key={id} className="cc-field">
                {name} · Punkte
                <input
                  type="number"
                  min="0"
                  value={draft.characteristics[id] ?? 0}
                  onChange={(e) =>
                    set({
                      characteristics: {
                        ...draft.characteristics,
                        [id]: Number(e.target.value),
                      },
                    })
                  }
                />
                Schriftrollen
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.scroll[id] ?? 0}
                  onChange={(e) =>
                    set({
                      scroll: { ...draft.scroll, [id]: Number(e.target.value) },
                    })
                  }
                />
              </label>
            ))}
        </div>
      </details>
      <details>
        <summary>Gesamtwerte & Setboni</summary>
        {statDefinitions.map(([id, name]) => (
          <p key={id}>
            {name}: {result.total[id] ?? 0}
          </p>
        ))}
        <pre>{JSON.stringify(result.activeSets, null, 2)}</pre>
      </details>
      <p>{[...result.warnings, ...result.unknown].join(" · ")}</p>
      <button
        className="cc-primary"
        disabled={busy || !catalog}
        onClick={() => void save()}
      >
        Build speichern & synchronisieren
      </button>
      {message && <p role="alert">{message}</p>}
    </div>
  );
}
