import { useEffect, useState } from "react";
import { collection, onSnapshot, query, limit } from "firebase/firestore";
import type { CommunityService } from "./firebase";
import type { GuildRank } from "./model";
export const rankIcons = {
  crown: "♛",
  shield: "⛨",
  star: "★",
  diamond: "◆",
  sword: "⚔",
} as const;
export function useGuildRanks(service: CommunityService) {
  const [ranks, setRanks] = useState<GuildRank[]>([]),
    [error, setError] = useState("");
  useEffect(
    () =>
      onSnapshot(
        query(collection(service.db, "guildRanks"), limit(100)),
        (s) => {
          setRanks(
            s.docs
              .map((d) => d.data() as GuildRank)
              .sort(
                (a, b) =>
                  a.order - b.order || a.name.localeCompare(b.name, "de"),
              ),
          );
          setError("");
        },
        (e) => setError(e.message),
      ),
    [service],
  );
  return { ranks, error };
}
export default function GuildRanks({ service }: { service: CommunityService }) {
  const { ranks, error } = useGuildRanks(service),
    [selected, setSelected] = useState<GuildRank | null>(null),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="cc-panel">
      <h3>Ingame-Ränge gestalten</h3>
      <p>
        Rangname, Reihenfolge, Farbe und Symbol ändern keine technischen Rechte.
        Bestehende Rangzuordnungen bleiben bei Umbenennung erhalten und können
        in der Mitgliederverwaltung angepasst werden. Archivierte Ränge bleiben
        in der Historie.
      </p>
      {ranks.map((r) => (
        <button
          key={r.id}
          onClick={() => {
            setSelected({ ...r });
            setMessage("");
          }}
          style={{ color: r.color }}
        >
          {rankIcons[r.icon]} {r.name}
          {r.archived ? " (archiviert)" : ""}
        </button>
      ))}
      <button
        onClick={() =>
          setSelected({
            id: crypto.randomUUID(),
            name: "",
            order: ranks.length,
            color: "#c6a765",
            icon: "shield",
            archived: false,
            revision: 0,
            lastAudit: "",
          })
        }
      >
        Rang hinzufügen
      </button>
      {selected && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!confirm("Rang mit Änderungsgrund protokolliert speichern?"))
              return;
            setBusy(true);
            const { id, revision, name, order, color, icon, archived } =
              selected;
            void service
              .saveGuildRank(
                id,
                { name, order, color, icon, archived },
                revision,
                reason,
              )
              .then(() => {
                setSelected(null);
                setReason("");
                setMessage("Rang gespeichert.");
              })
              .catch((e) => setMessage(e.message))
              .finally(() => setBusy(false));
          }}
        >
          <label className="cc-field">
            Rangname
            <input
              required
              maxLength={60}
              value={selected.name}
              onChange={(e) =>
                setSelected({ ...selected, name: e.target.value })
              }
            />
          </label>
          <label className="cc-field">
            Reihenfolge
            <input
              type="number"
              required
              min={0}
              max={1000}
              value={selected.order}
              onChange={(e) =>
                setSelected({ ...selected, order: Number(e.target.value) })
              }
            />
          </label>
          <label className="cc-field">
            Farbe
            <input
              type="color"
              value={selected.color}
              onChange={(e) =>
                setSelected({ ...selected, color: e.target.value })
              }
            />
          </label>
          <label className="cc-field">
            Symbol
            <select
              value={selected.icon}
              onChange={(e) =>
                setSelected({
                  ...selected,
                  icon: e.target.value as GuildRank["icon"],
                })
              }
            >
              {Object.entries(rankIcons).map(([key, icon]) => (
                <option value={key} key={key}>
                  {icon} {key}
                </option>
              ))}
            </select>
          </label>
          <label className="cc-check">
            <input
              type="checkbox"
              checked={selected.archived}
              onChange={(e) =>
                setSelected({ ...selected, archived: e.target.checked })
              }
            />
            Archivieren
          </label>
          <label className="cc-field">
            Änderungsgrund
            <input
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button disabled={busy}>Rang speichern</button>
          <button type="button" onClick={() => setSelected(null)}>
            Verwerfen
          </button>
        </form>
      )}
      {(error || message) && <p role="status">{error || message}</p>}
    </section>
  );
}
