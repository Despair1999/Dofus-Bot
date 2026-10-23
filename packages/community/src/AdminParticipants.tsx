import { useEffect, useState } from "react";
import type { DocumentSnapshot } from "firebase/firestore";
import type { CommunityService } from "./firebase";
import type { Activity, CommunityCharacter, Participant } from "./model";
const roles = [
  "Schaden",
  "Tank",
  "Heilung",
  "Unterstützung",
  "Positionierung",
  "Flexibel",
];
export default function AdminParticipants({
  service,
}: {
  service: CommunityService;
}) {
  const [activities, setActivities] = useState<Activity[]>([]),
    [cursor, setCursor] = useState<DocumentSnapshot>(),
    [more, setMore] = useState(false),
    [id, setId] = useState(""),
    [activity, setActivity] = useState<Activity | null>(null),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [uid, setUid] = useState(""),
    [characters, setCharacters] = useState<CommunityCharacter[]>([]),
    [characterId, setCharacterId] = useState(""),
    [role, setRole] = useState("Flexibel");
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  };
  const load = async (append = false) => {
    const page = await service.page<Activity>(
      "activities",
      [],
      append ? cursor : undefined,
    );
    setActivities((old) => (append ? [...old, ...page.items] : page.items));
    setCursor(page.cursor);
    setMore(page.hasMore);
  };
  useEffect(() => {
    void run(() => load());
  }, [service]);
  useEffect(() => {
    setActivity(null);
    if (!id) return;
    return service.watch<Activity>(`activities/${id}`, setActivity, (error) =>
      setMessage(error.message),
    );
  }, [service, id]);
  const change = async (target: string, p: Participant | null) => {
    if (!activity) return;
    if (!confirm("Teilnehmeränderung mit Änderungsverlauf übernehmen?")) return;
    await service.moderateParticipant(id, target, p, activity.revision, reason);
  };
  return (
    <section className="cc-panel">
      <h3>Teilnehmer & Wartelisten</h3>
      <label className="cc-field">
        Aktivität
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Aktivität wählen</option>
          {activities.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title} · {event.kind === "group" ? "Gruppe" : "Event"} ·{" "}
              {event.server}
            </option>
          ))}
        </select>
      </label>
      {more && (
        <button disabled={busy} onClick={() => void run(() => load(true))}>
          Weitere Aktivitäten
        </button>
      )}
      {activity && (
        <>
          <p>
            {activity.joined}/{activity.capacity} Plätze · {activity.status}
          </p>
          <label className="cc-field">
            Änderungsgrund
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {Object.entries(activity.participants).map(([target, p]) => (
            <article className="cc-card" key={target}>
              <b>{p.name}</b>
              <p>
                Stufe {p.level} ·{" "}
                {p.status === "waiting" ? "Warteliste" : "Bestätigt"}
              </p>
              <select
                aria-label={`Rolle für ${p.name}`}
                value={p.role}
                disabled={busy || reason.trim().length < 5}
                onChange={(e) =>
                  void run(() => change(target, { ...p, role: e.target.value }))
                }
              >
                {roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <button
                disabled={busy || reason.trim().length < 5}
                onClick={() =>
                  void run(() =>
                    change(target, {
                      ...p,
                      status: p.status === "joined" ? "waiting" : "joined",
                    }),
                  )
                }
              >
                {p.status === "joined"
                  ? "Auf Warteliste setzen"
                  : "Platz bestätigen"}
              </button>
              <button
                disabled={busy || reason.trim().length < 5}
                onClick={() => void run(() => change(target, null))}
              >
                Teilnehmer entfernen
              </button>
            </article>
          ))}
          <details>
            <summary>Mitglied mit freigegebenem Charakter hinzufügen</summary>
            <label className="cc-field">
              Account-UID des bestätigten Mitglieds
              <input
                value={uid}
                onChange={(e) => {
                  setUid(e.target.value);
                  setCharacters([]);
                  setCharacterId("");
                }}
              />
            </label>
            <button
              disabled={busy || !uid}
              onClick={() =>
                void run(async () => {
                  const member = await service.get<{ status: string }>(
                    `memberships/${uid}`,
                  );
                  if (member?.status !== "approved")
                    throw Error("Keine bestätigte Mitgliedschaft.");
                  const shared = await service.get<{
                    characters: CommunityCharacter[];
                  }>(`guildCharacters/${uid}`);
                  setCharacters(shared?.characters ?? []);
                  if (!shared?.characters.length)
                    throw Error(
                      "Dieses Mitglied hat noch keine Charaktere für die Gilde freigegeben.",
                    );
                })
              }
            >
              Freigegebene Charaktere laden
            </button>
            <label className="cc-field">
              Charakter
              <select
                value={characterId}
                onChange={(e) => setCharacterId(e.target.value)}
              >
                <option value="">Charakter wählen</option>
                {characters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name} · {ch.level} · {ch.server}
                  </option>
                ))}
              </select>
            </label>
            <select
              aria-label="Neue Gruppenrolle"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <button
              disabled={busy || !characterId || reason.trim().length < 5}
              onClick={() =>
                void run(async () => {
                  const ch = characters.find((c) => c.id === characterId);
                  if (!ch || ch.server !== activity.server)
                    throw Error(
                      "Charakter und Aktivität müssen auf demselben Server sein.",
                    );
                  await change(uid, {
                    characterId: ch.id,
                    name: ch.name,
                    level: ch.level,
                    role,
                    status:
                      activity.joined < activity.capacity
                        ? "joined"
                        : "waiting",
                  });
                })
              }
            >
              Mitglied hinzufügen
            </button>
          </details>
        </>
      )}
      {message && (
        <p className="cc-notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
