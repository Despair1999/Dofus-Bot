import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  collection,
  documentId,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import type { CommunityService } from "./firebase";
import type { Profile, CommunityCharacter } from "./model";
import { useGuildRanks, rankIcons } from "./GuildRanks";
type Membership = {
  uid: string;
  displayName: string;
  rank: string;
  status: string;
  personalStatus?: string;
  biography?: string;
  revision: number;
};
type Row = {
  profile?: Profile & { updatedAt?: { seconds: number } };
  characters: CommunityCharacter[];
  membership?: Membership;
};
export default function MemberDirectory({
  service,
  members,
  contact,
  emblem,
  onSummary,
}: {
  service: CommunityService;
  members: Membership[];
  contact: (uid: string) => ReactNode;
  emblem?: ReactNode;
  onSummary?: (value: { members: number; characters: number }) => void;
}) {
  const { ranks } = useGuildRanks(service);
  const [selected, setSelected] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, Row>>({}),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [classId, setClassId] = useState(""),
    [rank, setRank] = useState(""),
    [server, setServer] = useState(""),
    [min, setMin] = useState("1"),
    [max, setMax] = useState("200"),
    [count, setCount] = useState("0"),
    [sort, setSort] = useState("name"),
    [desc, setDesc] = useState(false);
  const ids = members
    .filter((m) => m.status === "approved")
    .map((m) => m.uid)
    .sort()
    .join(",");
  useEffect(() => {
    onSummary?.({
      members: members.filter(
        (m) => (rows[m.uid]?.membership ?? m).status === "approved",
      ).length,
      characters: Object.values(rows).reduce(
        (sum, r) => sum + r.characters.length,
        0,
      ),
    });
  }, [members, rows, onSummary]);
  useEffect(() => {
    setRows({});
    if (!ids) return;
    setError("");
    const uids = ids.split(","),
      stops: (() => void)[] = [];
    for (let i = 0; i < uids.length; i += 25) {
      const chunk = uids.slice(i, i + 25);
      for (const path of ["profiles", "guildCharacters", "memberships"]) {
        stops.push(
          onSnapshot(
            query(
              collection(service.db, path),
              where(documentId(), "in", chunk),
              limit(25),
            ),
            (snapshot) =>
              setRows((old) => {
                const next = { ...old };
                for (const uid of chunk) {
                  const doc = snapshot.docs.find((d) => d.id === uid),
                    current = next[uid] ?? { characters: [] };
                  next[uid] =
                    path === "memberships"
                      ? { ...current, membership: doc?.data() as Membership }
                      : path === "profiles"
                        ? { ...current, profile: doc?.data() as Row["profile"] }
                        : {
                            ...current,
                            characters: doc?.data().characters ?? [],
                          };
                }
                return next;
              }),
            (e) => setError(e.message),
          ),
        );
      }
    }
    return () => stops.forEach((stop) => stop());
  }, [service, ids]);
  const liveMembers = members.map((m) => rows[m.uid]?.membership ?? m);
  const main = (uid: string) => {
    const r = rows[uid];
    return (
      r?.characters.find((ch) => ch.id === r.profile?.mainCharacterId) ??
      r?.characters[0]
    );
  };
  const value = (m: Membership, key: string): string | number => {
    const r = rows[m.uid],
      ch = main(m.uid);
    return key === "name"
      ? m.displayName || r?.profile?.dofusName || ""
      : key === "level"
        ? (ch?.level ?? 0)
        : key === "omega"
          ? (ch?.omegaLevel ?? 0)
          : key === "class"
            ? (ch?.className ?? "")
            : key === "count"
              ? (r?.characters.length ?? 0)
              : key === "server"
                ? ch?.server || r?.profile?.server || ""
                : key === "activity"
                  ? (r?.profile?.updatedAt?.seconds ?? 0)
                  : m.rank;
  };
  const filtered = liveMembers
    .filter((m) => {
      if (m.status !== "approved") return false;
      const r = rows[m.uid],
        ch = main(m.uid);
      return (
        (!search ||
          JSON.stringify([
            m.displayName,
            r?.profile?.dofusName,
            r?.characters.map((c) => c.name),
          ])
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (!classId ||
          r?.characters.some((c) => String(c.classId) === classId)) &&
        (!rank || m.rank === rank) &&
        (!server || value(m, "server") === server) &&
        (!ch || (ch.level >= Number(min) && ch.level <= Number(max))) &&
        (r?.characters.length ?? 0) >= Number(count)
      );
    })
    .sort((a, b) => {
      const x = value(a, sort),
        y = value(b, sort);
      return (
        (typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), "de", { numeric: true })) *
        (desc ? -1 : 1)
      );
    });
  const sortBy = (key: string) => {
    if (sort === key) setDesc(!desc);
    else {
      setSort(key);
      setDesc(false);
    }
  };
  return (
    <>
      <div className="cc-form-grid">
        <label className="cc-field">
          Mitglied oder Charakter
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="cc-field">
          Klasse
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Alle Klassen</option>
            {Array.from(
              new Map(
                Object.values(rows)
                  .flatMap((r) => r.characters)
                  .map((c) => [c.classId, c.className]),
              ),
            )
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
          </select>
        </label>
        <label className="cc-field">
          Rang
          <select value={rank} onChange={(e) => setRank(e.target.value)}>
            <option value="">Alle Ränge</option>
            {[...new Set(liveMembers.map((m) => m.rank).filter(Boolean))].map(
              (r) => (
                <option key={r}>{r}</option>
              ),
            )}
          </select>
        </label>
        <label className="cc-field">
          Server
          <select value={server} onChange={(e) => setServer(e.target.value)}>
            <option value="">Alle Server</option>
            {[
              ...new Set(
                liveMembers
                  .map((m) => String(value(m, "server")))
                  .filter(Boolean),
              ),
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="cc-field">
          Ab Stufe
          <input
            type="number"
            min="1"
            max="200"
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
        </label>
        <label className="cc-field">
          Bis Stufe
          <input
            type="number"
            min="1"
            max="200"
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </label>
        <label className="cc-field">
          Mindestens Charaktere
          <input
            type="number"
            min="0"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </label>
      </div>
      <p>
        {filtered.length} von {members.length} geladenen Accounts · Filter und
        Sortierung beziehen sich auf geladene Seiten.
      </p>
      <div className="cc-toolbar">
        {[
          ["name", "Name"],
          ["class", "Klasse"],
          ["level", "Level"],
          ["omega", "Omega"],
          ["rank", "Rang"],
          ["server", "Server"],
          ["count", "Charaktere"],
          ["activity", "Profilaktivität"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={sort === key}
            onClick={() => sortBy(key)}
          >
            {label}
            {sort === key ? (desc ? " ↓" : " ↑") : ""}
          </button>
        ))}
      </div>
      <div className="cc-member-list">
        {filtered.map((m) => {
          const r = rows[m.uid],
            ch = main(m.uid);
          return (
            <button
              type="button"
              className="cc-member cc-member-row"
              key={m.uid}
              onClick={() => setSelected(m.uid)}
              aria-label={`Profil von ${value(m, "name") || "Mitglied"} öffnen`}
            >
              {ch && (
                <img
                  className="cc-class"
                  src={`/classes/${ch.classId}-thumb.webp`}
                  alt={ch.className}
                />
              )}
              <b>{value(m, "name") || "Profil wird geladen …"}</b>
              <span>{ch?.className || "Keine Charakterfreigabe"}</span>
              <span>
                {ch?.name}
                {ch &&
                  ch.id === r?.profile?.mainCharacterId &&
                  " · Hauptcharakter"}
              </span>
              <span>{ch ? `${ch.level} · Ω ${ch.omegaLevel}` : ""}</span>
              <span
                style={{
                  color: ranks.find((r) => r.name === m.rank && !r.archived)
                    ?.color,
                }}
              >
                {ranks.find((r) => r.name === m.rank && !r.archived)
                  ? rankIcons[
                      ranks.find((r) => r.name === m.rank && !r.archived)!.icon
                    ]
                  : ""}{" "}
                {m.rank || "Mitglied"}
              </span>
              <span>
                {r?.characters.length ?? 0} Charaktere · {value(m, "server")}
              </span>
              {m.personalStatus && (
                <span className="cc-member-status">{m.personalStatus}</span>
              )}
            </button>
          );
        })}
      </div>
      {selected &&
        liveMembers.some(
          (m) => m.uid === selected && m.status === "approved",
        ) && (
          <MemberProfile
            service={service}
            member={liveMembers.find((m) => m.uid === selected)!}
            row={rows[selected]}
            main={main(selected)}
            contact={contact(selected)}
            emblem={emblem}
            onClose={() => setSelected(null)}
          />
        )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
function MemberProfile({
  service,
  member,
  row,
  main,
  contact,
  emblem,
  onClose,
}: {
  service: CommunityService;
  member: Membership;
  row?: Row;
  main?: CommunityCharacter;
  contact: ReactNode;
  emblem?: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(false),
    [status, setStatus] = useState(member.personalStatus ?? ""),
    [bio, setBio] = useState(member.biography ?? ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);
  const name =
    row?.profile?.dofusName || member.displayName || "Gildenmitglied";
  return (
    <dialog
      ref={dialog}
      className="cc cc-member-dialog"
      aria-labelledby="cc-member-title"
      onCancel={onClose}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cc-member-profile">
        <button
          type="button"
          className="cc-close"
          aria-label="Mitgliederprofil schließen"
          onClick={onClose}
        >
          ×
        </button>
        <header className="cc-profile-hero">
          {main && (
            <img src={`/classes/${main.classId}.webp`} alt={main.className} />
          )}
          <div>
            <small>
              {member.rank || "Mitglied"} ·{" "}
              {main?.server || row?.profile?.server}
            </small>
            <h2 id="cc-member-title">{name}</h2>
            <p>
              {main?.name} · {main?.className} · Stufe {main?.level}
              {!!main?.omegaLevel && ` · Ω ${main.omegaLevel}`}
            </p>
          </div>
          {emblem && <div className="cc-profile-emblem">{emblem}</div>}
        </header>
        <p className="cc-member-status">
          {member.personalStatus || "Noch kein persönlicher Status."}
        </p>
        <section>
          <h3>Über mich</h3>
          <p className="cc-prewrap">
            {member.biography || "Noch keine Biografie hinterlegt."}
          </p>
        </section>
        {member.uid === service.uid && !editing && (
          <button
            type="button"
            onClick={() => {
              setStatus(member.personalStatus ?? "");
              setBio(member.biography ?? "");
              setEditing(true);
            }}
          >
            Profil bearbeiten
          </button>
        )}
        {editing && (
          <form
            className="cc-panel"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              void service
                .saveGuildProfile(
                  { personalStatus: status, biography: bio },
                  member.revision,
                )
                .then(
                  () => setEditing(false),
                  (e) => setError(String(e)),
                )
                .finally(() => setBusy(false));
            }}
          >
            <label className="cc-field">
              Persönlicher Status
              <input
                aria-label="Persönlicher Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                maxLength={100}
              />
              <small>{status.length}/100 · selbst festgelegt</small>
            </label>
            <label className="cc-field">
              Biografie
              <textarea
                aria-label="Biografie"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                rows={5}
              />
              <small>{bio.length}/500</small>
            </label>
            <button className="cc-primary" disabled={busy}>
              Profil speichern
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Abbrechen
            </button>
            {error && <p role="alert">{error}</p>}
          </form>
        )}
        <h3>Charaktere · {row?.characters.length ?? 0}</h3>
        <div className="cc-profile-characters">
          {row?.characters.map((ch) => (
            <article className="cc-card" key={ch.id}>
              <img src={`/classes/${ch.classId}.webp`} alt={ch.className} />
              <div>
                <h4>{ch.name}</h4>
                {ch.id === row.profile?.mainCharacterId && (
                  <span className="cc-badge">Hauptcharakter</span>
                )}
                <p>
                  {ch.className} · Stufe {ch.level}
                  {!!ch.omegaLevel && ` · Ω ${ch.omegaLevel}`}
                </p>
                <small>{ch.server}</small>
              </div>
            </article>
          ))}
        </div>
        {contact}
        <MemberHistory service={service} uid={member.uid} />
        <small>
          Profil und Status sind selbst gepflegt; kein Ingame-Onlinestatus.
        </small>
      </div>
    </dialog>
  );
}
function MemberHistory({
  service,
  uid,
}: {
  service: CommunityService;
  uid: string;
}) {
  const [open, setOpen] = useState(false),
    [values, setValues] = useState<{ title: string; kind: string }[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let active = true;
    void Promise.all([
      service.page<{ itemName: string }>("listings", [
        where("ownerUid", "==", uid),
      ]),
      service.page<{ title: string; kind: string }>("activities", [
        where("ownerUid", "==", uid),
      ]),
    ])
      .then(([offers, activities]) => {
        if (active)
          setValues([
            ...offers.items.map((o) => ({
              title: o.itemName,
              kind: "Angebot",
            })),
            ...activities.items.map((a) => ({
              title: a.title,
              kind: a.kind === "group" ? "Gruppe" : "Event",
            })),
          ]);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [service, uid, open]);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Angebote, organisierte Events & Gruppen laden</summary>
      {values.map((v, i) => (
        <p key={i}>
          {v.kind} · {v.title}
        </p>
      ))}
      {error && <p role="alert">{error}</p>}
      <small>
        Je Bereich bis zu 25 Einträge; weitere Einträge im jeweiligen
        Gildenbereich.
      </small>
    </details>
  );
}
