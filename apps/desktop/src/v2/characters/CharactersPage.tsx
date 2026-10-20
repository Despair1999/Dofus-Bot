import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Plus,
  RefreshCw,
  Users,
  Check,
  Shield,
  Edit3,
  Trash2,
} from "lucide-react";
import type { Character, CharacterInput, GameClass, Build } from "@dofus/core";
import { cached, type Config } from "../../client";
import ClassSelector from "./ClassSelector";
import "./characters.css";
import { navigatePath } from "../routing";
interface Props {
  config: Config;
  characters: Character[];
  activeId: string;
  busy: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onSave: (input: CharacterInput, existing?: Character) => Promise<boolean>;
  onDelete: (character: Character) => Promise<boolean>;
}
export default function CharactersPage({
  config,
  characters,
  activeId,
  busy,
  onSelect,
  onRefresh,
  onSave,
  onDelete,
}: Props) {
  const [classes, setClasses] = useState<GameClass[]>([]),
    [builds, setBuilds] = useState<Build[]>([]),
    [error, setError] = useState(""),
    [sort, setSort] = useState("name"),
    [editing, setEditing] = useState<Character | null>(null),
    [classId, setClassId] = useState<number | null>(null),
    [formKey, setFormKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void cached<GameClass[]>("/api/classes", config)
      .then((result) => {
        if (!cancelled) setClasses(result.data);
      })
      .catch((error) => {
        if (!cancelled)
          setError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [config.url, config.token]);
  useEffect(() => {
    let cancelled = false;
    void cached<Build[]>("/api/builder/builds", config)
      .then((r) => {
        if (!cancelled) setBuilds(r.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [config]);
  const sorted = useMemo(
    () =>
      [...characters].sort((a, b) =>
        sort === "level"
          ? b.level - a.level
          : a.name.localeCompare(b.name, "de"),
      ),
    [characters, sort],
  );
  const active = characters.find((c) => c.id === activeId);
  const selectedClass = classes.find((c) => c.id === classId);
  function startEdit(character: Character) {
    setEditing(character);
    setClassId(character.classId ?? null);
    setFormKey((key) => key + 1);
    setTimeout(
      () =>
        document
          .getElementById("character-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClass) return;
    const data = new FormData(event.currentTarget);
    const input: CharacterInput = {
      name: String(data.get("name")),
      server: String(data.get("server")),
      className: selectedClass.nameDe,
      classId: selectedClass.id,
      level: Number(data.get("level")),
    };
    if (await onSave(input, editing ?? undefined)) {
      setEditing(null);
      setClassId(null);
      setFormKey((key) => key + 1);
    }
  }
  return (
    <div className="v2-characters">
      <section className="panel">
        <div className="panel-title">
          <span>
            <Users size={19} /> Dein Team in der Welt der Zwölf{" "}
            <span className="pill">{characters.length}</span>
          </span>
          <div className="toolbar">
            <select
              aria-label="Charaktere sortieren"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="name">Nach Namen</option>
              <option value="level">Nach Stufe</option>
            </select>
            <button className="secondary" disabled={busy} onClick={onRefresh}>
              <RefreshCw size={16} /> Synchronisieren
            </button>
          </div>
        </div>
        {sorted.length ? (
          <div className="v2-character-grid">
            {sorted.map((character) => {
              const gameClass = classes.find((c) => c.id === character.classId);
              return (
                <article
                  className={`v2-character-card ${activeId === character.id ? "selected" : ""}`}
                  key={character.id}
                >
                  <button
                    className="v2-character-main"
                    onClick={() => onSelect(character.id)}
                    aria-label={`${character.name} als aktiven Charakter auswählen`}
                    aria-pressed={activeId === character.id}
                  >
                    <div className="v2-character-art">
                      {gameClass?.portrait ? (
                        <img
                          src={gameClass.portrait}
                          alt={`${gameClass.nameDe} Klassen-Symbol`}
                        />
                      ) : (
                        <Shield size={60} />
                      )}
                      <span className="v2-level">{character.level}</span>
                    </div>
                    <h3>{character.name}</h3>
                    <p>{gameClass?.nameDe || character.className}</p>
                    <small>{character.server}</small>
                    <small>
                      {
                        builds.filter((b) => b.characterId === character.id)
                          .length
                      }{" "}
                      gespeicherte Sets
                    </small>
                    {builds.find(
                      (b) => b.characterId === character.id && b.active,
                    ) && (
                      <small>
                        Aktiv im Companion:{" "}
                        {
                          builds.find(
                            (b) => b.characterId === character.id && b.active,
                          )?.name
                        }
                      </small>
                    )}
                    {activeId === character.id && (
                      <span className="pill">
                        <Check size={11} /> Aktives Profil
                      </span>
                    )}
                    {!character.classId && (
                      <small className="v2-legacy-class">
                        Klasse einmalig zuordnen
                      </small>
                    )}
                  </button>
                  <div className="v2-character-actions">
                    <button
                      className="secondary"
                      onClick={() =>
                        navigatePath("/builder?characterId=" + character.id)
                      }
                    >
                      Sets
                    </button>
                    <button
                      className="secondary"
                      onClick={() => startEdit(character)}
                    >
                      <Edit3 size={14} /> Bearbeiten
                    </button>
                    <button
                      className="icon-button"
                      title={`${character.name} löschen`}
                      disabled={busy}
                      onClick={() => void onDelete(character)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty">
            <Users size={35} />
            <h3>Dein Abenteuer beginnt mit einem Profil</h3>
            <p>
              Charaktere werden von dir registriert. Wir benötigen weder ein
              Ankama-Passwort noch Zugriff auf deinen Spielaccount.
            </p>
          </div>
        )}
        {active && (
          <div className="v2-active-summary">
            <Check size={15} />
            <span>
              <strong>{active.name}</strong> ist dein aktives Profil für Quests,
              Crafting und persönliche Ziele.
            </span>
            <button className="text-button" onClick={() => startEdit(active)}>
              Profil bearbeiten
            </button>
          </div>
        )}
      </section>
      <section className="panel" id="character-form">
        <div className="panel-title">
          <span>
            <Plus size={18} />
            {editing
              ? `${editing.name} bearbeiten`
              : "Neuen Charakter registrieren"}
          </span>
          {editing && (
            <button
              className="text-button"
              onClick={() => {
                setEditing(null);
                setClassId(null);
                setFormKey((key) => key + 1);
              }}
            >
              Bearbeitung abbrechen
            </button>
          )}
        </div>
        {error && (
          <div className="notice" role="status">
            Klassenkatalog: {error}
          </div>
        )}
        {editing && !editing.classId && (
          <p>
            Die bisherige Klasse „{editing.className}“ bleibt erhalten. Wähle
            jetzt die passende Klasse aus dem aktuellen Katalog.
          </p>
        )}
        <form
          key={formKey}
          className="form-grid"
          onSubmit={(e) => void submit(e)}
        >
          <label>
            {editing ? "Profilname" : "Name"}
            <input
              name="name"
              required
              maxLength={64}
              defaultValue={editing?.name || ""}
              placeholder="Charaktername"
            />
          </label>
          <label>
            {editing ? "Profilserver" : "Server"}
            <input
              name="server"
              required
              maxLength={64}
              defaultValue={editing?.server || active?.server || ""}
              placeholder="Zum Beispiel Draconiros"
            />
          </label>
          <ClassSelector
            classes={classes}
            value={classId}
            onChange={setClassId}
            label={editing ? "Profilklasse" : "Klasse"}
          />
          <label>
            {editing ? "Profilstufe" : "Stufe"}
            <input
              name="level"
              type="number"
              min={1}
              max={200}
              step={1}
              required
              defaultValue={editing?.level || 1}
            />
          </label>
          <button disabled={busy || !selectedClass}>
            <Plus size={16} />
            {editing ? "Profil speichern" : "Registrieren"}
          </button>
        </form>
        <small>
          {classes.length
            ? `${classes.length} Klassen aus dem importierten DOFUS-Datenbestand.`
            : "Der Klassenkatalog wird nach dem Spieldatenimport verfügbar."}{" "}
          Klassenbilder werden als eigenständige neutrale Symbole dargestellt,
          solange keine weitergehende Bildfreigabe hinterlegt ist.
        </small>
      </section>
    </div>
  );
}
