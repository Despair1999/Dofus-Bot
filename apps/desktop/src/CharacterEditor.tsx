import { useState, type FormEvent } from "react";
import type { Character, CharacterInput } from "@dofus/core";
export default function CharacterEditor({
  character,
  busy,
  onSave,
  onDelete,
}: {
  character: Character;
  busy: boolean;
  onSave: (input: CharacterInput) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void onSave({
      name: String(f.get("name")),
      server: String(f.get("server")),
      className: String(f.get("className")),
      level: Number(f.get("level")),
    });
  }
  return (
    <div className="character-editor">
      <div className="toolbar">
        <strong>{character.name}</strong>
        <button
          type="button"
          className="secondary"
          onClick={() => setEditing(!editing)}
        >
          Profil bearbeiten
        </button>
        <button
          type="button"
          className="danger"
          disabled={busy}
          onClick={() => void onDelete()}
        >
          Aktiven Charakter löschen
        </button>
      </div>
      {editing && (
        <form className="form-grid" onSubmit={submit}>
          <label>
            Profilname
            <input
              required
              name="name"
              defaultValue={character.name}
              maxLength={64}
            />
          </label>
          <label>
            Profilserver
            <input
              required
              name="server"
              defaultValue={character.server}
              maxLength={64}
            />
          </label>
          <label>
            Profilklasse
            <input
              required
              name="className"
              defaultValue={character.className}
              maxLength={64}
            />
          </label>
          <label>
            Profilstufe
            <input
              required
              name="level"
              type="number"
              min={1}
              max={200}
              defaultValue={character.level}
            />
          </label>
          <button disabled={busy}>Profil speichern</button>
        </form>
      )}
    </div>
  );
}
