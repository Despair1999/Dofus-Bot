import {
  createContext,
  lazy,
  Suspense,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Cloud,
  Shield,
  Siren,
  Users,
  CalendarDays,
  ShoppingBag,
  Search,
  LogOut,
  RefreshCw,
  X,
  Copy,
  Upload,
  Download,
} from "lucide-react";
import {
  where,
  serverTimestamp,
  setDoc,
  onSnapshot,
  query,
  collection,
  orderBy,
  documentId,
  limit,
  type DocumentSnapshot,
  type WhereFilterOp,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import {
  communityService,
  type CommunityService,
  type PlatformConfig,
  type Role,
  type RecordClock,
} from "./firebase";
import classes from "./classes.json";
import type { Build } from "@dofus/core";
const BuildEditor = lazy(() => import("./BuildEditor"));
import { firebaseConfig } from "./config";
import {
  characterSchema,
  type Activity,
  type CommunityCharacter,
  type Listing,
  type Profile,
  type Reservation,
  type ReservationState,
  syncable,
} from "./model";
import { SyncEngine, type LocalStore } from "./sync";
import { applyFragment, changedFragments, fragments } from "./fragments";
import "./community.css";
import AdminParticipants from "./AdminParticipants";
import ActivityCalendar from "./ActivityCalendar";
import MemberDirectory from "./MemberDirectory";
import { calendarDays, zonedInstant, type CalendarView } from "./calendar";
import {
  portfolio,
  currentEstimate,
  importJournal,
  emptyJournal,
  type Journal,
} from "@dofus/core/market";

export type CatalogItem = {
  id: number;
  name: string;
  iconUrl: string;
  level?: number;
  category?: string;
};
export type DungeonOption = { id: number; name: string };
export type Section =
  "account" | "guild" | "members" | "marketplace" | "events" | "groups";
type Membership = {
  uid: string;
  status: string;
  rank: string;
  displayName: string;
  revision: number;
  lastAudit: string;
};
type ContextValue = {
  service: CommunityService;
  store: LocalStore;
  user: User | null;
  profile: Profile | null;
  role: Role;
  membership: Membership | null;
  settings: PlatformConfig | null;
  engine: SyncEngine | null;
  migration: boolean;
  loading: boolean;
  error: string;
  startSync: (includeLocal: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  searchItems?: (q: string) => Promise<CatalogItem[]>;
  dungeons?: DungeonOption[];
};
const Context = createContext<ContextValue | null>(null);
export function useCommunity() {
  const value = useContext(Context);
  if (!value) throw Error("CommunityProvider fehlt.");
  return value;
}
export function CommunityProvider({
  store,
  children,
  searchItems,
  dungeons,
  emulators = false,
}: {
  store: LocalStore;
  children: ReactNode;
  searchItems?: (q: string) => Promise<CatalogItem[]>;
  dungeons?: DungeonOption[];
  emulators?: boolean;
}) {
  const [service] = useState(() =>
    communityService(
      emulators
        ? {
            ...firebaseConfig,
            apiKey: "emulator-only",
            projectId: "demo-dofus-community",
            authDomain: "localhost",
            storageBucket: "demo-dofus-community.appspot.com",
          }
        : firebaseConfig,
      { emulator: emulators },
    ),
  );
  const [user, setUser] = useState<User | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [role, setRole] = useState<Role>("member"),
    [membership, setMembership] = useState<Membership | null>(null),
    [settings, setSettings] = useState<PlatformConfig | null>(null);
  const [engine, setEngine] = useState<SyncEngine | null>(null),
    [migration, setMigration] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [, render] = useState(0);
  const epoch = useRef(0);
  const engineRef = useRef<SyncEngine | null>(null);
  const scopeRef = useRef<string | null>(null);
  const sourceRef = useRef<Record<string, unknown>>({});
  const clockRef = useRef<RecordClock | null>(null);
  const refresh = useCallback(async () => {
    const current = service.auth.currentUser;
    if (!current) return;
    const ticket = epoch.current;
    const [p, r, m] = await Promise.all([
      service.get<Profile>(`profiles/${current.uid}`),
      service.role(),
      service.get<Membership>(`memberships/${current.uid}`),
    ]);
    if (ticket !== epoch.current) return;
    setProfile(p);
    if (p) await store.write(`community:profile:${current.uid}`, p);
    setRole(r);
    setMembership(m);
    if (current.emailVerified && !engineRef.current) setMigration(true);
  }, [service, store]);
  useEffect(
    () =>
      service.watch<PlatformConfig>(
        "platform/legal",
        (value) => {
          if (value)
            setSettings(
              (old) =>
                ({
                  ...old,
                  registrationEnabled: value.registrationEnabled,
                  privacyUrl: value.privacyUrl,
                  termsUrl: value.termsUrl,
                  legalVersion: value.legalVersion,
                  archived:
                    (value as PlatformConfig & { guildActive?: boolean })
                      .guildActive === false,
                }) as PlatformConfig,
            );
        },
        (e) =>
          setError("Firebase-Einrichtung noch nicht verfügbar: " + e.message),
      ),
    [service],
  );
  useEffect(() => {
    if (
      !user?.emailVerified ||
      (membership?.status !== "approved" && !["owner", "admin"].includes(role))
    )
      return;
    return service.watch<PlatformConfig>(
      "platform/config",
      (value) => setSettings((old) => ({ ...old, ...value }) as PlatformConfig),
      (e) => setError(e.message),
    );
  }, [service, user?.uid, user?.emailVerified, membership?.status, role]);
  useEffect(
    () =>
      service.observeSession((current) => {
        if (current?.uid && current.uid === scopeRef.current) {
          setUser(current);
          void refresh().catch((e) => setError(String(e)));
          return;
        }
        const ticket = ++epoch.current;
        engineRef.current?.stop();
        engineRef.current = null;
        setEngine(null);
        setMigration(false);
        setProfile(null);
        setRole("member");
        setMembership(null);
        setSettings((old) =>
          old
            ? ({
                registrationEnabled: old.registrationEnabled,
                privacyUrl: old.privacyUrl,
                termsUrl: old.termsUrl,
                legalVersion: old.legalVersion,
              } as PlatformConfig)
            : null,
        );
        setLoading(true);
        setUser(null);
        void (async () => {
          // Snapshot the guest workspace before switching namespaces; import requires the user's later confirmation.
          if (scopeRef.current) sourceRef.current = {};
          if (current && !scopeRef.current) {
            const original: Record<string, unknown> = {};
            for (const key of await store.keys())
              if (syncable(key)) original[key] = await store.read(key, null);
            await store.write(
              `community:guest-backup:${current.uid}:${Date.now()}`,
              original,
            );
            await store.prepare?.();
            const guest: Record<string, unknown> = {};
            for (const key of await store.keys())
              if (syncable(key)) guest[key] = await store.read(key, null);
            sourceRef.current = guest;
          }
          await store.setAccount?.(current?.uid ?? null);
          scopeRef.current = current?.uid ?? null;
          if (ticket !== epoch.current) return;
          setUser(current);
          setLoading(false);
          if (current) {
            try {
              await refresh();
            } catch (error) {
              const cachedProfile = await store.read<Profile | null>(
                `community:profile:${current.uid}`,
                null,
              );
              if (ticket !== epoch.current) return;
              setProfile(cachedProfile);
              setRole("member");
              setMembership(null);
              setError("Accountdaten derzeit offline: " + String(error));
            }
            if (ticket !== epoch.current) return;
            setMigration(current.emailVerified);
          }
        })().catch((e) => {
          if (ticket === epoch.current) {
            setError(String(e));
            setLoading(false);
          }
        });
      }),
    [service, store, refresh],
  );
  const startSync = async (includeLocal: boolean) => {
    const current = service.auth.currentUser;
    if (!current?.emailVerified) throw Error("Bitte zuerst E-Mail bestätigen.");
    const ticket = epoch.current,
      uid = current.uid;
    const deviceId = await store.read("community:device", crypto.randomUUID());
    await store.write("community:device", deviceId);
    const migrated = await store.read(`community:migration:${uid}`, false);
    const since = migrated
      ? await store.read<RecordClock | null>(`community:clock:${uid}`, null)
      : null;
    clockRef.current = since;
    const engineStore: LocalStore = {
      ...store,
      write: async (key, value) => {
        if (ticket !== epoch.current) throw Error("Account gewechselt.");
        if (key.includes("::") && syncable(key)) {
          const root = key.split("::")[0],
            valueAfter = applyFragment(
              await store.read(root, null),
              key,
              value,
            );
          await store.write("community:applying", true);
          try {
            await store.write(root, valueAfter);
          } finally {
            await store.write("community:applying", false);
          }
        } else await store.write(key, value);
      },
    };
    const next = new SyncEngine(
      uid,
      deviceId,
      engineStore,
      service.transport(uid),
    );
    await next.init();
    const local: Record<string, unknown> = {};
    for (const key of await store.keys())
      if (syncable(key)) local[key] = await store.read(key, null);
    if (!migrated)
      await store.write(`community:migration-backup:${uid}:${Date.now()}`, {
        local,
        guest: sourceRef.current,
      });
    if (includeLocal || migrated) {
      const chosen: Record<string, unknown> = includeLocal
        ? { ...sourceRef.current }
        : {};
      for (const [key, value] of Object.entries(local)) {
        const empty = value == null || (Array.isArray(value) && !value.length);
        if (!empty || !(key in chosen)) chosen[key] = value;
      }
      for (const [key, value] of Object.entries(chosen)) {
        if (value == null) continue;
        const parts = fragments(key, value),
          before = await store.read<Record<string, unknown>>(
            `community:parts:${key}`,
            {},
          );
        for (const change of changedFragments(before, parts))
          await next.capture(change.key, change.value, change.deleted);
        // Missing outbox operations after a crash are recovered from the canonical local rows and acknowledged hashes.
        for (const [part, payload] of Object.entries(parts))
          await next.capture(part, payload);
        await store.write(`community:parts:${key}`, parts);
      }
    }
    if (!migrated) {
      const cloud = await service.records(uid);
      if (ticket !== epoch.current) {
        next.stop();
        return;
      }
      await next.receive(cloud);
      clockRef.current = service.cloudClock(cloud);
      await store.write(`community:clock:${uid}`, clockRef.current);
    }
    if (ticket !== epoch.current) {
      next.stop();
      return;
    }
    engineRef.current = next;
    setEngine(next);
    setMigration(false);
    await store.write(`community:migration:${uid}`, true);
    await next.flush();
    window.dispatchEvent(new Event("companion:cloud-applied"));
  };
  const startRef = useRef(startSync);
  startRef.current = startSync;
  useEffect(() => {
    if (!migration || !user?.emailVerified) return;
    let active = true;
    void store
      .read(`community:migration:${user.uid}`, false)
      .then((done) => {
        if (active && done) return startRef.current(false);
      })
      .catch((e) => setError(String(e)));
    return () => {
      active = false;
    };
  }, [migration, user?.uid, user?.emailVerified, store]);
  useEffect(() => {
    if (!engine || !user) return;
    const ticket = epoch.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let serial = Promise.resolve();
    const cleanupState = engine.subscribe(() => render((n) => n + 1));
    const stop = store.subscribe?.((key, value) => {
      if (!syncable(key) || ticket !== epoch.current) return;
      serial = serial
        .then(async () => {
          const before = await store.read<Record<string, unknown>>(
              `community:parts:${key}`,
              {},
            ),
            after = fragments(key, value);
          for (const change of changedFragments(before, after))
            await engine.capture(change.key, change.value, change.deleted);
          await store.write(`community:parts:${key}`, after);
          clearTimeout(timer);
          timer = setTimeout(() => {
            void engine.flush().catch((e) => setError(String(e)));
          }, 750);
        })
        .catch((e) => setError(String(e)));
    });
    const unsubscribe = service.watchRecords(
      user.uid,
      async (records) => {
        if (ticket !== epoch.current) return;
        try {
          await store.prepareRemote?.();
          await serial;
          if (ticket !== epoch.current) return;
          await engine.receive(records);
          if (ticket !== epoch.current) return;
          clockRef.current = service.cloudClock(records, clockRef.current);
          await store.write(`community:clock:${user.uid}`, clockRef.current);
          window.dispatchEvent(new Event("companion:cloud-applied"));
        } catch (error) {
          setError(String(error));
          throw error;
        }
      },
      (error) => setError(error.message),
      clockRef.current,
    );
    const online = () => {
      void engine.flush().catch((e) => setError(String(e)));
    };
    window.addEventListener("online", online);
    return () => {
      cleanupState();
      stop?.();
      unsubscribe();
      clearTimeout(timer);
      window.removeEventListener("online", online);
    };
  }, [engine, user, service, store]);
  useEffect(() => {
    if (!user) return;
    return service.watch<{ role: Role }>(
      `roles/${user.uid}`,
      (value) => setRole(value?.role ?? "member"),
      (e) => setError(e.message),
    );
  }, [service, user?.uid]);
  useEffect(() => {
    if (!user) return;
    const ticket = epoch.current;
    return service.watch<Profile>(
      `profiles/${user.uid}`,
      (profile) => {
        if (ticket !== epoch.current) return;
        setProfile(profile);
        if (profile)
          void store
            .write(`community:profile:${user.uid}`, profile)
            .catch((error) => setError(String(error)));
      },
      (error) => setError(error.message),
    );
  }, [service, store, user?.uid]);
  useEffect(() => {
    if (!user?.emailVerified) return;
    return service.watch<Membership>(
      `memberships/${user.uid}`,
      setMembership,
      (e) => setError(e.message),
    );
  }, [service, user?.uid, user?.emailVerified]);
  return (
    <Context.Provider
      value={{
        service,
        store,
        user,
        profile,
        role,
        membership,
        settings,
        engine,
        migration,
        loading,
        error,
        startSync,
        refresh,
        searchItems,
        dungeons,
      }}
    >
      <Fragment key={user?.uid ?? "guest"}>
        {loading ? (
          <div className="cc cc-skeleton" role="status">
            Accountbereich wird vorbereitet …
          </div>
        ) : (
          children
        )}
      </Fragment>
      <AdminAccess />
    </Context.Provider>
  );
}
function useAction() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, message, run, setMessage };
}
function Status({ message }: { message: string }) {
  return message ? (
    <p className="cc-notice" role="status">
      {message}
    </p>
  ) : null;
}
function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  required = true,
  min,
  max,
}: {
  label: string;
  name?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <label className="cc-field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        min={min}
        max={max}
      />
    </label>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="cc-empty">{children}</div>;
}
function Contact({ uid }: { uid: string }) {
  const { service } = useCommunity();
  const [name, setName] = useState("");
  useEffect(() => {
    let active = true;
    void service
      .get<Profile>(`profiles/${uid}`)
      .then((p) => {
        if (active) setName(p?.discordName ?? "");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [service, uid]);
  return name ? (
    <button
      type="button"
      title="Auf Discord kontaktieren – unbestätigten Benutzernamen kopieren"
      onClick={() => void navigator.clipboard.writeText(name)}
    >
      <Copy size={14} />
      {name}
    </button>
  ) : null;
}
export function CommunityPage({ section = "account" }: { section?: Section }) {
  const c = useCommunity();
  return (
    <section className="cc">
      <header className="cc-heading">
        <div>
          <small>DOFUS COMPANION · GEMEINSAM WEITER</small>
          <h1>
            {
              {
                account: "Dein Companion-Account",
                guild: "Deine Gilde",
                members: "Mitglieder",
                marketplace: "Community-Marktplatz",
                events: "Events & Aktivitäten",
                groups: "Dungeon-Gruppenfinder",
              }[section]
            }
          </h1>
          <p>
            Dein Abenteuer bleibt lokal. Gemeinsam geplante Aktivitäten
            verbinden euch.
          </p>
        </div>
        <Shield size={32} />
      </header>
      <Status message={c.error} />
      {c.loading ? (
        <div className="cc-skeleton" role="status">
          Sitzung wird wiederhergestellt …
        </div>
      ) : !c.user ? (
        <AccountForm />
      ) : !c.profile ? (
        <AccountForm onboarding />
      ) : !c.user.emailVerified ? (
        <Verification />
      ) : section === "account" ? (
        <AccountPanel />
      ) : section === "marketplace" ? (
        <Marketplace visibility="global" />
      ) : c.settings?.archived && !["owner", "admin"].includes(c.role) ? (
        <Empty>
          Diese Gilde wurde archiviert. Deine persönlichen Accountdaten bleiben
          verfügbar.
        </Empty>
      ) : c.membership?.status !== "approved" &&
        !["owner", "admin"].includes(c.role) ? (
        <GuildJoin />
      ) : section === "guild" ? (
        <GuildHome />
      ) : section === "members" ? (
        <Members />
      ) : section === "events" ? (
        <Activities kind="event" />
      ) : (
        <Activities kind="group" />
      )}
    </section>
  );
}
function Verification() {
  const { service } = useCommunity(),
    a = useAction();
  return (
    <div className="cc-panel">
      <h2>E-Mail bestätigen</h2>
      <p>
        Private Cloud- und Gildendaten werden erst mit bestätigter E-Mail
        freigegeben.
      </p>
      <button
        disabled={a.busy}
        onClick={() => void a.run(() => service.verify())}
      >
        Bestätigungslink senden
      </button>
      <button
        disabled={a.busy}
        onClick={() => void a.run(() => service.refreshVerification())}
      >
        Bestätigung prüfen
      </button>
      <button onClick={() => void service.logout()}>Abmelden</button>
      <Status message={a.message} />
    </div>
  );
}
function AccountForm({ onboarding = false }: { onboarding?: boolean }) {
  const { service, settings, refresh } = useCommunity();
  const [mode, setMode] = useState<"login" | "register" | "reset">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [p, setP] = useState<Profile>({
      dofusName: "",
      discordName: "",
      server: "",
      mainCharacterId: "",
    }),
    [legal, setLegal] = useState(false);
  const a = useAction();
  const register = mode === "register" || onboarding;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void a.run(async () => {
      if (onboarding) {
        await service.completeOnboarding(p, legal);
        await refresh();
      } else if (mode === "register")
        await service.register(email, password, confirmation, p, legal);
      else if (mode === "reset") {
        await service.reset(email);
        a.setMessage(
          "Wenn ein passendes Konto existiert, erhältst du einen Rücksetzlink.",
        );
      } else await service.login(email, password);
    });
  };
  return (
    <div className="cc-account-grid">
      <div className="cc-panel">
        <h2>
          {onboarding
            ? "Profil vervollständigen"
            : mode === "register"
              ? "Account erstellen"
              : mode === "reset"
                ? "Passwort zurücksetzen"
                : "Willkommen zurück"}
        </h2>
        {!onboarding && (
          <div className="cc-tabs">
            {(["login", "register", "reset"] as const).map((m) => (
              <button
                key={m}
                className={mode === m ? "active" : ""}
                onClick={() => setMode(m)}
              >
                {
                  {
                    login: "Anmelden",
                    register: "Registrieren",
                    reset: "Passwort vergessen",
                  }[m]
                }
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submit}>
          {!onboarding && (
            <Field
              label="E-Mail"
              name="email"
              type="email"
              value={email}
              onChange={setEmail}
            />
          )}
          {mode !== "reset" && !onboarding && (
            <Field
              label="Passwort"
              name="password"
              type="password"
              value={password}
              onChange={setPassword}
            />
          )}{" "}
          {mode === "register" && !onboarding && (
            <Field
              label="Passwort bestätigen"
              type="password"
              value={confirmation}
              onChange={setConfirmation}
            />
          )}{" "}
          {register && (
            <>
              <Field
                label="DOFUS-Ingame-Name · dein Anzeigename"
                value={p.dofusName}
                onChange={(dofusName) => setP({ ...p, dofusName })}
              />
              <Field
                label="Discord-Benutzername (unbestätigt)"
                value={p.discordName}
                onChange={(discordName) => setP({ ...p, discordName })}
              />
              <Field
                label="DOFUS-Server"
                value={p.server}
                onChange={(server) => setP({ ...p, server })}
              />
              {settings?.privacyUrl && settings?.termsUrl ? (
                <label className="cc-check">
                  <input
                    type="checkbox"
                    required
                    checked={legal}
                    onChange={(e) => setLegal(e.target.checked)}
                  />
                  <span>
                    Ich stimme den{" "}
                    <a
                      href={settings.termsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Nutzungsbedingungen
                    </a>{" "}
                    zu und habe die{" "}
                    <a
                      href={settings.privacyUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Datenschutzerklärung
                    </a>{" "}
                    gelesen.
                  </span>
                </label>
              ) : (
                <p className="cc-notice">
                  Die Registrierung wird freigegeben, sobald der Betreiber die
                  Rechtstexte vervollständigt und geprüft hat.
                </p>
              )}
            </>
          )}
          <button
            className="cc-primary"
            disabled={a.busy || (register && !settings?.registrationEnabled)}
          >
            {a.busy
              ? "Bitte warten …"
              : register
                ? "Profil speichern"
                : mode === "reset"
                  ? "Rücksetzlink senden"
                  : "Anmelden"}
          </button>
          <Status message={a.message} />
        </form>
      </div>
      <aside className="cc-panel cc-story">
        <Cloud size={42} />
        <h2>
          Ein Account.
          <br />
          Deine Welt der Zwölf.
        </h2>
        <p>
          Charaktere, Builds und Marktjournal geräteübergreifend verbinden.
          Gildenmitgliedschaft und technische Rechte werden getrennt geprüft.
        </p>
        <ul>
          <li>Lokale Daten bleiben erhalten.</li>
          <li>Import erst nach deiner Entscheidung.</li>
          <li>Private Handelsbücher bleiben privat.</li>
        </ul>
      </aside>
    </div>
  );
}
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function AccountPanel() {
  const c = useCommunity(),
    a = useAction();
  const [p, setP] = useState(c.profile!),
    [password, setPassword] = useState("");
  const engine = c.engine;
  return (
    <>
      <div className="cc-account-grid">
        <form
          className="cc-panel"
          onSubmit={(e) => {
            e.preventDefault();
            void a.run(async () => {
              await c.service.saveProfile(p);
              await c.refresh();
              a.setMessage("Profil gespeichert.");
            });
          }}
        >
          <h2>{c.profile!.dofusName}</h2>
          <p>Dein DOFUS-Name ist zugleich dein Companion-Anzeigename.</p>
          <Field
            label="DOFUS-Ingame-Name"
            value={p.dofusName}
            onChange={(dofusName) => setP({ ...p, dofusName })}
          />
          <Field
            label="Discord-Name · unbestätigt"
            value={p.discordName}
            onChange={(discordName) => setP({ ...p, discordName })}
          />
          <Field
            label="Server"
            value={p.server}
            onChange={(server) => setP({ ...p, server })}
          />
          <button className="cc-primary" disabled={a.busy}>
            Profil speichern
          </button>
          <button
            type="button"
            onClick={() => void a.run(() => c.service.logout())}
          >
            <LogOut size={16} />
            Abmelden
          </button>
        </form>
        <div className="cc-panel">
          <h2>
            <Cloud size={21} /> Cloud-Synchronisierung
          </h2>
          <p role="status">
            {!navigator.onLine
              ? "Offline"
              : engine?.state.error
                ? "Fehler"
                : engine?.state.conflicts.length
                  ? "Konflikte"
                  : engine?.isSyncing
                    ? "Synchronisierung läuft"
                    : engine?.state.queue.length
                      ? "Änderungen ausstehend"
                      : engine
                        ? "Synchronisiert"
                        : "Noch nicht verbunden"}
          </p>
          {c.migration && (
            <>
              <p>
                Vorhandene Daten werden zuerst gesichert. Wähle, ob lokale Daten
                übernommen werden sollen. Abweichende Fassungen werden als
                Konflikte angezeigt.
              </p>
              <button
                disabled={a.busy}
                onClick={() => void a.run(() => c.startSync(true))}
              >
                Lokale Daten vergleichen & übernehmen
              </button>
              <button
                disabled={a.busy}
                onClick={() => void a.run(() => c.startSync(false))}
              >
                Cloud-Daten verwenden · lokale Sicherung behalten
              </button>
            </>
          )}
          {engine && (
            <>
              <p>
                {engine.state.queue.length} ausstehend ·{" "}
                {engine.state.conflicts.length} Konflikte
              </p>
              <small>
                Zuletzt:{" "}
                {engine.state.lastSync
                  ? new Date(engine.state.lastSync).toLocaleString("de-DE")
                  : "Noch kein erfolgreicher Upload"}
              </small>
              <button
                disabled={a.busy}
                onClick={() => void a.run(() => engine.flush())}
              >
                <RefreshCw size={16} />
                Jetzt synchronisieren
              </button>
              <Status message={engine.state.error} />
              {engine.state.conflicts.map((conflict) => (
                <div key={conflict.remote.key} className="cc-conflict">
                  <b>{conflict.remote.key}</b>
                  <div className="cc-versions">
                    <pre>{conflict.local.payload}</pre>
                    <pre>
                      {conflict.remote.deleted
                        ? "Gelöscht"
                        : conflict.remote.payload}
                    </pre>
                  </div>
                  <button
                    onClick={() =>
                      void a.run(() =>
                        engine.resolve(conflict.remote.key, "local"),
                      )
                    }
                  >
                    Meine Fassung behalten
                  </button>
                  <button
                    onClick={() =>
                      void a.run(() =>
                        engine.resolve(conflict.remote.key, "remote"),
                      )
                    }
                  >
                    Cloud-Fassung übernehmen
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
      <CharacterManager />
      <PersonalLibrary />
      <NotificationCenter />
      {((c.membership?.status === "approved" && !c.settings?.archived) ||
        ["owner", "admin"].includes(c.role)) && <GuildNoticeFeed />}
      <div className="cc-panel">
        <h2>Daten & Account</h2>
        <button
          disabled={a.busy}
          onClick={() =>
            void a.run(async () =>
              download(
                "companion-account.json",
                await c.service.exportAccount(),
              ),
            )
          }
        >
          <Download size={16} />
          Daten exportieren
        </button>
        <details>
          <summary>Konto löschen</summary>
          <p>
            Exportiere deine Daten vor dem Löschen. Offene Angebote und
            Reservierungen müssen zuerst abgeschlossen werden. Privilegierte
            Konten benötigen eine Betreiberprüfung.
          </p>
          <Field
            label="Zur Bestätigung dein Accountpasswort"
            type="password"
            value={password}
            onChange={setPassword}
          />
          <button
            className="cc-danger"
            disabled={a.busy}
            onClick={() => {
              if (confirm("Account und private Cloud-Daten endgültig löschen?"))
                void a.run(() => c.service.deleteAccount(password));
            }}
          >
            Konto endgültig löschen
          </button>
        </details>
      </div>
      <Status message={a.message} />
    </>
  );
}
function CharacterManager() {
  const c = useCommunity(),
    a = useAction();
  const [characters, setCharacters] = useState<CommunityCharacter[]>([]),
    [name, setName] = useState(""),
    [classId, setClassId] = useState("1"),
    [level, setLevel] = useState("200"),
    [omega, setOmega] = useState("0"),
    [editing, setEditing] = useState<string | null>(null);
  const reloadCharacters = () =>
    c.store.read<CommunityCharacter[]>("characters", []).then(setCharacters);
  useEffect(() => {
    void reloadCharacters();
    const stop = c.store.subscribe?.((key) => {
      if (key === "characters") void reloadCharacters();
    });
    const remote = () => {
      void reloadCharacters();
    };
    window.addEventListener("companion:cloud-applied", remote);
    return () => {
      stop?.();
      window.removeEventListener("companion:cloud-applied", remote);
    };
  }, [c.store]);
  const save = async (next: CommunityCharacter[]) => {
    await c.store.write("characters", next);
    setCharacters(next);
    window.dispatchEvent(new Event("companion:cloud-applied"));
  };
  return (
    <div className="cc-panel">
      <h2>Deine Charaktere</h2>
      <p>
        Angaben sind selbst gepflegt und nicht von DOFUS bestätigt. Website und
        Desktop verwenden dieselben Charakter-IDs; Berufsstände werden über die
        gemeinsame Datenreplikation synchronisiert.
      </p>
      <form
        className="cc-form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          void a.run(async () => {
            const character = characterSchema.parse({
              id: editing ?? crypto.randomUUID(),
              name,
              classId: Number(classId),
              className: classes.find((c) => c.id === Number(classId))!.name,
              level: Number(level),
              omegaLevel: Number(omega),
              server: c.profile!.server,
              professions: {},
            });
            await save([
              ...characters.filter((c) => c.id !== character.id),
              character,
            ]);
            setEditing(null);
            setName("");
          });
        }}
      >
        <Field label="Charaktername" value={name} onChange={setName} />
        <label className="cc-field">
          Klasse
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Stufe"
          type="number"
          value={level}
          onChange={setLevel}
          min={1}
          max={200}
        />
        <Field
          label="Omega"
          type="number"
          value={omega}
          onChange={setOmega}
          min={0}
        />
        <button disabled={a.busy}>
          {editing ? "Charakter speichern" : "Charakter hinzufügen"}
        </button>
      </form>
      <div className="cc-cards">
        {characters.map((ch) => (
          <article className="cc-card" key={ch.id}>
            <img
              className="cc-class"
              src={`/classes/${ch.classId}.webp`}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <h3>{ch.name}</h3>
            <button
              onClick={() => {
                setEditing(ch.id);
                setName(ch.name);
                setClassId(String(ch.classId));
                setLevel(String(ch.level));
                setOmega(String(ch.omegaLevel ?? 0));
              }}
            >
              Bearbeiten
            </button>
            <p>
              {ch.className} · Stufe {ch.level}
              {ch.omegaLevel ? ` · Ω ${ch.omegaLevel}` : ""}
            </p>
            <button
              onClick={() =>
                void a.run(async () => {
                  await c.service.saveProfile({
                    ...c.profile!,
                    mainCharacterId: ch.id,
                    ...(confirm(
                      "Companion-Anzeigenamen ebenfalls auf diesen DOFUS-Namen ändern?",
                    )
                      ? { dofusName: ch.name }
                      : {}),
                  });
                  await c.refresh();
                })
              }
            >
              {c.profile?.mainCharacterId === ch.id
                ? "Hauptcharakter"
                : "Als Hauptcharakter wählen"}
            </button>
            <button
              onClick={() => {
                if (confirm(`${ch.name} entfernen?`))
                  void a.run(() =>
                    save(characters.filter((x) => x.id !== ch.id)),
                  );
              }}
            >
              Entfernen
            </button>
          </article>
        ))}
      </div>
      {c.membership?.status === "approved" && (
        <button
          disabled={a.busy}
          onClick={() =>
            void a.run(async () => {
              if (
                !confirm(
                  "Diese Charakterinformationen für Gildenmitglieder sichtbar machen?",
                )
              )
                return;
              const path = `guildCharacters/${c.user!.uid}`,
                current = await c.service.get<{ revision: number }>(path);
              if (current)
                await c.service.edit(path, { characters }, current.revision);
              else
                await setDoc(c.service.ref(path), {
                  uid: c.user!.uid,
                  characters,
                  revision: 1,
                  lastAudit: "",
                  updatedAt: serverTimestamp(),
                });
              a.setMessage("Charaktere mit der Gilde geteilt.");
            })
          }
        >
          Charaktere ausdrücklich mit Gilde teilen
        </button>
      )}
      <Status message={a.message} />
    </div>
  );
}
function PersonalLibrary() {
  const c = useCommunity(),
    a = useAction();
  const [tab, setTab] = useState("Builds"),
    [builds, setBuilds] = useState<Record<string, any>[]>([]),
    [editedBuild, setEditedBuild] = useState<Build | null>(),
    [journal, setJournal] = useState<Journal>(emptyJournal()),
    [progress, setProgress] = useState<Record<string, unknown>>({}),
    [routes, setRoutes] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const [saved, market, routeRows] = await Promise.all([
        c.store.read<Record<string, any>[]>("builder:saved", []),
        c.store.read("market:journal-v1", emptyJournal()),
        c.store.read<Record<string, unknown>[]>(
          "backend:world_saved_routes",
          [],
        ),
      ]);
      const quests: Record<string, unknown> = {};
      for (const key of await c.store.keys())
        if (key.startsWith("progress:"))
          quests[key] = await c.store.read(key, []);
      if (active) {
        setBuilds(saved);
        setJournal(importJournal(JSON.stringify(market)));
        setProgress(quests);
        setRoutes(routeRows);
      }
    };
    const receive = () => {
      void load().catch((e) => a.setMessage(String(e)));
    };
    receive();
    const stop = c.store.subscribe?.((key) => {
      if (
        [
          "builder:saved",
          "market:journal-v1",
          "backend:world_saved_routes",
        ].includes(key) ||
        key.startsWith("progress:")
      )
        receive();
    });
    window.addEventListener("companion:cloud-applied", receive);
    return () => {
      active = false;
      stop?.();
      window.removeEventListener("companion:cloud-applied", receive);
    };
  }, [c.store]);
  return (
    <div className="cc-panel">
      <h2>Deine persönliche Cloud-Bibliothek</h2>
      <p>
        Diese Daten sind ausschließlich für deinen Account sichtbar. Die
        Lagerberechnung verwendet dieselbe Logik wie das Marktjournal der
        Desktop-App.
      </p>
      <div className="cc-tabs">
        {[
          "Builds",
          "Marktjournal",
          "Warenlager",
          "Questfortschritt",
          "Farmrouten",
        ].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Builds" ? (
        <>
          <button onClick={() => setEditedBuild(null)}>
            Neuen Build planen
          </button>
          {editedBuild !== undefined && (
            <Suspense fallback={<p>Builder wird geladen …</p>}>
              <BuildEditor
                store={c.store}
                initial={editedBuild ?? undefined}
                onClose={() => setEditedBuild(undefined)}
              />
            </Suspense>
          )}
          <div className="cc-cards">
            {builds.map((b) => (
              <article className="cc-card" key={b.id}>
                <h3>{b.name || "Unbenannter Build"}</h3>
                <p>
                  {b.active ? "Aktives Set" : "Gespeichertes Set"} · Revision{" "}
                  {b.revision ?? 0}
                </p>
                <details>
                  <summary>Ausrüstung & gespeicherte Werte ansehen</summary>
                  <pre>{JSON.stringify(b, null, 2)}</pre>
                </details>
                <button onClick={() => setEditedBuild(b as Build)}>
                  Build bearbeiten
                </button>
                <button
                  onClick={() =>
                    void a.run(async () => {
                      const now = new Date().toISOString(),
                        current = await c.store.read<Build[]>(
                          "builder:saved",
                          [],
                        );
                      await c.store.write("builder:saved", [
                        ...current,
                        {
                          ...b,
                          id: crypto.randomUUID(),
                          name: (b.name + " · Variante").slice(0, 100),
                          active: false,
                          revision: 1,
                          createdAt: now,
                          updatedAt: now,
                        },
                      ]);
                      window.dispatchEvent(
                        new Event("companion:cloud-applied"),
                      );
                    })
                  }
                >
                  Als Variante duplizieren
                </button>
                <button
                  onClick={() => {
                    if (confirm("Diesen gespeicherten Build entfernen?"))
                      void a.run(async () => {
                        const current = await c.store.read<Build[]>(
                          "builder:saved",
                          [],
                        );
                        await c.store.write(
                          "builder:saved",
                          current.filter((x) => x.id !== b.id),
                        );
                        window.dispatchEvent(
                          new Event("companion:cloud-applied"),
                        );
                      });
                  }}
                >
                  Build entfernen
                </button>
                <button onClick={() => download(`build-${b.id}.json`, b)}>
                  Build exportieren
                </button>
              </article>
            ))}
            {!builds.length && (
              <Empty>Noch keine synchronisierten Builds vorhanden.</Empty>
            )}
          </div>
        </>
      ) : tab === "Warenlager" ? (
        <div className="cc-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Gegenstand</th>
                <th>Server</th>
                <th>Bestand</th>
                <th>Bekannte Einstandskosten</th>
                <th>Geschätzter Marktwert</th>
              </tr>
            </thead>
            <tbody>
              {portfolio(journal.trades).map((p) => {
                const estimate = currentEstimate(journal, p);
                return (
                  <tr key={p.key}>
                    <td>{p.item.name}</td>
                    <td>{p.server}</td>
                    <td>{p.quantity.toLocaleString("de-DE")}</td>
                    <td>
                      {p.cost.toLocaleString("de-DE")} K
                      {p.unknownQuantity > 0 &&
                        ` · ${p.unknownQuantity} Stück ohne bekannte Kosten`}
                    </td>
                    <td>
                      {estimate
                        ? `${estimate.value.toLocaleString("de-DE")} K`
                        : "Keine Preisannahme"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : tab === "Marktjournal" ? (
        <>
          <div className="cc-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Zeitpunkt</th>
                  <th>Gegenstand</th>
                  <th>Server</th>
                  <th>Art</th>
                  <th>Menge</th>
                  <th>Gesamtpreis</th>
                  <th>Gebühren</th>
                </tr>
              </thead>
              <tbody>
                {journal.trades.map((t) => (
                  <tr key={t.id}>
                    <td>{new Date(t.at).toLocaleDateString("de-DE")}</td>
                    <td>{t.item.name}</td>
                    <td>{t.server}</td>
                    <td>
                      {
                        {
                          buy: "Kauf",
                          sell: "Verkauf",
                          "stock-in": "Lagerzugang",
                          "stock-out": "Lagerabgang",
                        }[t.kind]
                      }
                    </td>
                    <td>{t.quantity}</td>
                    <td>{t.total.toLocaleString("de-DE")} K</td>
                    <td>{t.fees} K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>
              {journal.observations.length} Preisbeobachtungen ·{" "}
              {journal.notes.length} Notizen
            </summary>
            <pre>
              {JSON.stringify(
                {
                  observations: journal.observations,
                  targets: journal.targets,
                  notes: journal.notes,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </>
      ) : tab === "Questfortschritt" ? (
        <>
          {Object.entries(progress).map(([key, value]) => (
            <details key={key}>
              <summary>Charakter {key.slice(9)}</summary>
              <pre>{JSON.stringify(value, null, 2)}</pre>
            </details>
          ))}
          {!Object.keys(progress).length && (
            <Empty>Noch kein Questfortschritt synchronisiert.</Empty>
          )}
        </>
      ) : (
        <>
          {routes.map((row) => (
            <details key={String(row.id)}>
              <summary>Gespeicherte Route {String(row.id)}</summary>
              <pre>
                {typeof row.content === "string"
                  ? JSON.stringify(JSON.parse(row.content), null, 2)
                  : JSON.stringify(row, null, 2)}
              </pre>
            </details>
          ))}
          {!routes.length && (
            <Empty>Noch keine gespeicherten Farmrouten synchronisiert.</Empty>
          )}
        </>
      )}
      <Status message={a.message} />
    </div>
  );
}
function NotificationCenter() {
  const c = useCommunity(),
    a = useAction(),
    page = usePage<{ id: string; text: string; read: boolean }>(
      `users/${c.user!.uid}/notifications`,
    );
  return (
    <div className="cc-panel">
      <div className="cc-toolbar">
        <h2>Benachrichtigungen</h2>
        <button onClick={() => void page.load()}>Aktualisieren</button>
      </div>
      {page.data.map((n) => (
        <div className="cc-comment" key={n.id}>
          <p>
            {!n.read && <strong>Neu · </strong>}
            {n.text}
          </p>
          {!n.read && (
            <button
              disabled={a.busy}
              onClick={() =>
                void a.run(async () => {
                  const { updateDoc } = await import("firebase/firestore");
                  await updateDoc(
                    c.service.ref(`users/${c.user!.uid}/notifications/${n.id}`),
                    { read: true },
                  );
                  await page.load();
                })
              }
            >
              Als gelesen markieren
            </button>
          )}
        </div>
      ))}
      {!page.loading && !page.data.length && (
        <Empty>Keine Benachrichtigungen.</Empty>
      )}
      {page.more && (
        <button onClick={() => void page.load(true)}>
          Weitere Benachrichtigungen
        </button>
      )}
      <Status message={a.message || page.error} />
    </div>
  );
}
function GuildNoticeFeed() {
  const c = useCommunity(),
    guild = usePage<{ id: string; text: string }>("guildAnnouncements"),
    events = usePage<{ id: string; text: string }>(
      "activityAnnouncements",
      "recipientUids",
      c.user!.uid,
      "array-contains",
    );
  return (
    <div className="cc-panel">
      <h2>Gilden- & Aktivitätsmeldungen</h2>
      {[...guild.data, ...events.data].map((n) => (
        <p className="cc-notice" key={n.id}>
          {n.text}
        </p>
      ))}
      {!guild.data.length && !events.data.length && (
        <Empty>Noch keine Gildenmeldungen.</Empty>
      )}
      {guild.more && (
        <button onClick={() => void guild.load(true)}>
          Weitere Gildenmeldungen
        </button>
      )}
      {events.more && (
        <button onClick={() => void events.load(true)}>
          Weitere Aktivitätsmeldungen
        </button>
      )}
      <Status message={guild.error || events.error} />
    </div>
  );
}
function GuildJoin() {
  const c = useCommunity(),
    a = useAction();
  return (
    <div className="cc-panel">
      <h2>{c.settings?.guildName || "Gilde noch nicht eingerichtet"}</h2>
      <p>{c.settings?.description}</p>
      <p>Nur bestätigte Mitglieder erhalten Zugriff auf private Gildendaten.</p>
      <p>Antrag: {c.membership?.status ?? "Noch nicht gestellt"}</p>
      <button
        disabled={a.busy || !!c.membership}
        onClick={() => void a.run(() => c.service.requestMembership())}
      >
        Mitgliedschaft beantragen
      </button>
      <Status message={a.message} />
    </div>
  );
}
function GuildHome() {
  const c = useCommunity();
  return (
    <>
      <div className="cc-panel cc-guild-banner">
        {c.settings?.emblem ? (
          <GuildEmblem path={c.settings.emblem} />
        ) : (
          <Shield size={60} />
        )}
        <div>
          <small>{c.settings?.server || "Server noch nicht eingestellt"}</small>
          <h2>{c.settings?.guildName || "Gilde einrichten"}</h2>
          <p>
            {c.settings?.description ||
              "Ein Administrator kann die bestehende Gilde hier einrichten."}
          </p>
          {c.settings?.discordUrl && (
            <a href={c.settings.discordUrl} target="_blank" rel="noreferrer">
              Gilden-Discord öffnen
            </a>
          )}
        </div>
      </div>
      <div className="cc-panel">
        <h3>Gildenregeln & Aufnahme</h3>
        <p className="cc-prewrap">
          {c.settings?.rules || "Noch keine Regeln hinterlegt."}
        </p>
        <p>{c.settings?.admission}</p>
      </div>
      <Marketplace visibility="guild" />
    </>
  );
}
function GuildEmblem({
  path,
  preview = false,
}: {
  path: string;
  preview?: boolean;
}) {
  const { service } = useCommunity();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setUrl("");
    setError("");
    if (path.startsWith("data:image/")) {
      setUrl(path);
      return;
    }
    void service
      .readEmblem(path)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [service, path]);
  return url ? (
    <img
      className={preview ? "cc-emblem" : undefined}
      src={url}
      alt={preview ? "Wappenvorschau" : "Gildenwappen"}
    />
  ) : (
    <span role="status">
      {error ? "Wappen nicht verfügbar: " + error : "Wappen wird geladen …"}
    </span>
  );
}
function usePage<T>(
  path: string,
  filterField?: string,
  filterValue?: string,
  filterOp: WhereFilterOp = "==",
  enabled = true,
) {
  const { service, user } = useCommunity();
  const recent =
    path === "audit" ||
    path.endsWith("/comments") ||
    path.includes("/notifications") ||
    path.endsWith("Announcements");
  const [data, setData] = useState<T[]>([]),
    [cursor, setCursor] = useState<DocumentSnapshot>(),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const generation = useRef(0);
  const [live, setLive] = useState(true);
  const load = useCallback(
    async (append = false) => {
      setLive(!append);
      const ticket = ++generation.current;
      setLoading(true);
      setError("");
      try {
        const page = await service.page<T>(
          path,
          filterField ? [where(filterField, filterOp, filterValue)] : [],
          append ? cursor : undefined,
          recent,
        );
        if (ticket !== generation.current) return;
        setData((old) => (append ? [...old, ...page.items] : page.items));
        setCursor(page.cursor);
        setMore(page.hasMore);
      } catch (e) {
        if (ticket === generation.current) setError(String(e));
      } finally {
        if (ticket === generation.current) setLoading(false);
      }
    },
    [service, path, filterField, filterValue, filterOp, recent, cursor],
  );
  useEffect(() => {
    if (!live || !enabled) return;
    setLoading(true);
    setError("");
    const stop = onSnapshot(
      query(
        collection(service.db, path),
        ...(filterField ? [where(filterField, filterOp, filterValue)] : []),
        ...(recent
          ? [orderBy("createdAt", "desc"), orderBy(documentId(), "desc")]
          : [orderBy(documentId())]),
        limit(25),
      ),
      (snapshot) => {
        setData(snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as T));
        setCursor(snapshot.docs.at(-1));
        setMore(snapshot.size === 25);
        setLoading(false);
      },
      (error) => {
        setError(error.message);
        setLoading(false);
      },
    );
    return () => {
      generation.current++;
      stop();
    };
  }, [
    service,
    path,
    filterField,
    filterValue,
    filterOp,
    recent,
    user?.uid,
    live,
    enabled,
  ]);
  return { data, loading, error, more, load };
}
function Members() {
  const page = usePage<Membership>("memberships");
  return (
    <div className="cc-panel">
      <div className="cc-toolbar">
        <h2>
          <Users size={22} />
          Gildenmitglieder
        </h2>
        <button onClick={() => void page.load()}>Aktualisieren</button>
      </div>
      <p>
        Ein Account pro Zeile. Ausdrücklich geteilte Charaktere und echte
        Profilaktivität; kein erfundener Ingame-Onlinestatus.
      </p>
      <MemberDirectory
        service={useCommunity().service}
        members={page.data}
        contact={(uid) => <Contact uid={uid} />}
      />
      {page.more && (
        <button onClick={() => void page.load(true)}>
          Weitere Mitglieder laden
        </button>
      )}
      <Status message={page.error} />
    </div>
  );
}
function Marketplace({ visibility }: { visibility: "guild" | "global" }) {
  const c = useCommunity(),
    a = useAction(),
    page = usePage<Listing>("listings", "visibility", visibility);
  const [search, setSearch] = useState(""),
    [itemSearch, setItemSearch] = useState(""),
    [items, setItems] = useState<CatalogItem[]>([]),
    [item, setItem] = useState<CatalogItem | null>(null),
    [quantity, setQuantity] = useState("1"),
    [price, setPrice] = useState("0"),
    [server, setServer] = useState(c.profile?.server ?? ""),
    [type, setType] = useState<"sell" | "buy" | "swap">("sell"),
    [description, setDescription] = useState(""),
    [mine, setMine] = useState(false),
    [offerType, setOfferType] = useState(""),
    [offerServer, setOfferServer] = useState(""),
    [offerPrice, setOfferPrice] = useState(""),
    [offerLevel, setOfferLevel] = useState("200"),
    [offerCategory, setOfferCategory] = useState(""),
    [onlyAvailable, setOnlyAvailable] = useState(true),
    [tab, setTab] = useState("offers");
  return (
    <div className="cc-panel">
      <div className="cc-toolbar">
        <h2>
          <ShoppingBag size={22} />{" "}
          {visibility === "guild" ? "Gildenmarktplatz" : "Globaler Marktplatz"}
        </h2>
        <button onClick={() => void page.load()}>
          <RefreshCw size={16} />
          Aktualisieren
        </button>
      </div>
      <div className="cc-tabs">
        <button
          className={tab === "offers" ? "active" : ""}
          onClick={() => setTab("offers")}
        >
          Angebote
        </button>
        <button
          className={tab === "reservations" ? "active" : ""}
          onClick={() => setTab("reservations")}
        >
          Meine Reservierungen
        </button>
      </div>
      {tab === "reservations" ? (
        <Reservations />
      ) : (
        <>
          <details className="cc-create">
            <summary>Neues Angebot erstellen</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void a.run(async () => {
                  if (!item)
                    throw Error(
                      "Bitte einen Gegenstand aus dem Katalog auswählen.",
                    );
                  await c.service.createListing({
                    itemId: item.id,
                    itemLevel: item.level ?? 0,
                    category: item.category ?? "",
                    itemName: item.name,
                    iconUrl: item.iconUrl,
                    quantity: Number(quantity),
                    price: Number(price),
                    server,
                    type,
                    visibility,
                    description,
                  });
                  await page.load();
                  a.setMessage("Angebot erstellt.");
                });
              }}
            >
              <div className="cc-toolbar">
                <Field
                  label="Gegenstand im DOFUS-Katalog suchen"
                  value={itemSearch}
                  onChange={setItemSearch}
                />
                <button
                  type="button"
                  disabled={a.busy || !c.searchItems}
                  onClick={() =>
                    void a.run(async () =>
                      setItems(await c.searchItems!(itemSearch)),
                    )
                  }
                >
                  <Search size={16} />
                  Suchen
                </button>
              </div>
              <div className="cc-search-results">
                {items.map((i) => (
                  <button
                    type="button"
                    className={item?.id === i.id ? "active" : ""}
                    key={i.id}
                    onClick={() => setItem(i)}
                  >
                    {i.iconUrl && <img src={i.iconUrl} alt="" />}
                    {i.name} · Stufe {i.level ?? "?"}
                  </button>
                ))}
              </div>
              {item && <p>Ausgewählt: {item.name}</p>}
              <div className="cc-form-grid">
                <Field
                  label="Menge"
                  type="number"
                  value={quantity}
                  onChange={setQuantity}
                  min={1}
                />
                <Field
                  label="Kama-Preis pro Stück"
                  type="number"
                  value={price}
                  onChange={setPrice}
                  min={0}
                />
                <Field label="Server" value={server} onChange={setServer} />
                <label className="cc-field">
                  Angebotsart
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as typeof type)}
                  >
                    <option value="sell">Verkaufen</option>
                    <option value="buy">Suchen</option>
                    <option value="swap">Tauschen</option>
                  </select>
                </label>
              </div>
              <Field
                label="Beschreibung, individuelle Werte, Exomagie oder Tauschgegenstand"
                value={description}
                onChange={setDescription}
                required={false}
              />
              <p>
                Dein privates Warenlager und Marktjournal werden dadurch nicht
                veröffentlicht.
              </p>
              <button className="cc-primary" disabled={a.busy}>
                Angebot veröffentlichen
              </button>
            </form>
          </details>
          <div className="cc-toolbar">
            <Field
              label="Name, Beschreibung, Typ oder Server · geladene Angebote"
              value={search}
              onChange={setSearch}
              required={false}
            />
            <label className="cc-check">
              <input
                type="checkbox"
                checked={mine}
                onChange={(e) => setMine(e.target.checked)}
              />
              Meine Angebote
            </label>
          </div>
          <div className="cc-form-grid">
            <label className="cc-field">
              Angebotstyp
              <select
                value={offerType}
                onChange={(e) => setOfferType(e.target.value)}
              >
                <option value="">Alle</option>
                <option value="sell">Verkaufen</option>
                <option value="buy">Gesucht</option>
                <option value="swap">Tauschen</option>
              </select>
            </label>
            <Field
              label="Angebotsserver"
              value={offerServer}
              onChange={setOfferServer}
              required={false}
            />
            <Field
              label="Maximaler Stückpreis"
              type="number"
              value={offerPrice}
              onChange={setOfferPrice}
              required={false}
            />
            <Field
              label="Bis Gegenstandslevel"
              type="number"
              value={offerLevel}
              onChange={setOfferLevel}
              min={0}
              max={200}
            />
            <Field
              label="Kategorie / Typ-ID"
              value={offerCategory}
              onChange={setOfferCategory}
              required={false}
            />
            <label className="cc-check">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
              />
              Nur offene, verfügbare Angebote
            </label>
          </div>
          <div className="cc-cards">
            {page.data
              .filter(
                (l) =>
                  (!mine || l.ownerUid === c.user!.uid) &&
                  (!offerType || l.type === offerType) &&
                  (!offerServer ||
                    l.server
                      .toLowerCase()
                      .includes(offerServer.toLowerCase())) &&
                  (!offerPrice || l.price <= Number(offerPrice)) &&
                  (l.itemLevel ?? 0) <= Number(offerLevel) &&
                  (!offerCategory ||
                    (l.category ?? "").includes(offerCategory)) &&
                  (!onlyAvailable ||
                    (l.status === "open" && l.available > 0)) &&
                  JSON.stringify([l.itemName, l.server, l.type, l.description])
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .sort(
                (x, y) =>
                  Number(y.server === c.profile?.server) -
                  Number(x.server === c.profile?.server),
              )
              .map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  reload={() => page.load()}
                />
              ))}
          </div>
          {!page.loading && !page.data.length && (
            <Empty>
              Noch keine Angebote. Erstelle das erste echte Angebot.
            </Empty>
          )}
          {page.more && (
            <button onClick={() => void page.load(true)}>
              Weitere Angebote laden
            </button>
          )}
        </>
      )}
      <Status message={page.error || a.message} />
    </div>
  );
}
function ListingCard({
  listing,
  reload,
}: {
  listing: Listing;
  reload: () => Promise<unknown>;
}) {
  const c = useCommunity(),
    a = useAction(),
    [quantity, setQuantity] = useState("1");
  const [l, setListing] = useState(listing);
  useEffect(
    () =>
      c.service.watch<Listing>(
        `listings/${listing.id}`,
        (value) => {
          if (value) setListing(value);
        },
        (e) => a.setMessage(e.message),
      ),
    [c.service, listing.id],
  );
  return (
    <article className="cc-card">
      <div className="cc-item-header">
        {l.iconUrl && <img src={l.iconUrl} alt="" loading="lazy" />}
        <div>
          <small>
            {{ sell: "Verkaufen", buy: "Gesucht", swap: "Tauschen" }[l.type]} ·{" "}
            {l.status}
          </small>
          <h3>{l.itemName}</h3>
        </div>
      </div>
      <div className="cc-price">
        {l.price.toLocaleString("de-DE")} <small>K / Stück</small>
      </div>
      <p>
        {l.available} / {l.quantity} verfügbar · <strong>{l.server}</strong>
        {l.server !== c.profile?.server && " · anderer Server"}
      </p>
      <p>{l.description}</p>
      <Contact uid={l.ownerUid} />
      <ReportAction target={`listings/${l.id}`} />
      {l.ownerUid !== c.user!.uid && l.status === "open" && (
        <div className="cc-toolbar">
          <Field
            label="Teilmenge anfragen"
            type="number"
            value={quantity}
            onChange={setQuantity}
            min={1}
            max={l.available}
          />
          <button
            disabled={a.busy}
            onClick={() =>
              void a.run(async () => {
                await c.service.reserve(l.id, Number(quantity));
                a.setMessage(
                  "Reservierungsanfrage gesendet. Der Verkäufer muss sie bestätigen.",
                );
              })
            }
          >
            Reservieren
          </button>
        </div>
      )}
      {l.ownerUid === c.user!.uid && (
        <>
          <OwnedEditor
            path={`listings/${l.id}`}
            record={l}
            fields={[
              ["price", "Kama pro Stück"],
              ["quantity", "Gesamtmenge"],
              ["server", "Server"],
              ["description", "Beschreibung"],
            ]}
          />
          <button
            disabled={a.busy}
            onClick={() =>
              void a.run(async () => {
                await c.service.edit(
                  `listings/${l.id}`,
                  { status: l.status === "open" ? "paused" : "open" },
                  l.revision,
                );
                await reload();
              })
            }
          >
            {l.status === "open" ? "Pausieren" : "Öffnen"}
          </button>
          <button
            disabled={a.busy}
            onClick={() => {
              if (confirm("Angebot zurückziehen?"))
                void a.run(async () => {
                  await c.service.edit(
                    `listings/${l.id}`,
                    { status: "withdrawn" },
                    l.revision,
                  );
                  await reload();
                });
            }}
          >
            Zurückziehen
          </button>
        </>
      )}
      <details>
        <summary>Kommentare</summary>
        <Comments listingId={l.id} />
      </details>
      <Status message={a.message} />
    </article>
  );
}
function OwnedEditor({
  path,
  record,
  fields,
}: {
  path: string;
  record: { revision: number };
  fields: [string, string][];
}) {
  const c = useCommunity(),
    a = useAction(),
    [snapshot, setSnapshot] = useState<
      (Record<string, unknown> & { revision: number }) | null
    >(null),
    [changes, setChanges] = useState<Record<string, unknown>>({});
  return (
    <>
      <button
        onClick={() => {
          setSnapshot({ ...record } as Record<string, unknown> & {
            revision: number;
          });
          setChanges({});
        }}
      >
        Eigene Angaben bearbeiten
      </button>
      {snapshot && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void a.run(async () => {
              const patch = { ...changes };
              if (typeof patch.startsAt === "string")
                patch.startsAt = new Date(patch.startsAt).toISOString();
              await c.service.edit(path, patch, snapshot.revision);
              setSnapshot(null);
            });
          }}
        >
          <div className="cc-form-grid">
            {fields.map(([field, label]) => (
              <Field
                key={field}
                label={label}
                type={typeof snapshot[field] === "number" ? "number" : "text"}
                value={String(changes[field] ?? snapshot[field] ?? "")}
                onChange={(value) =>
                  setChanges((old) => ({
                    ...old,
                    [field]:
                      typeof snapshot[field] === "number"
                        ? Number(value)
                        : value,
                  }))
                }
                required={false}
              />
            ))}
          </div>
          <dl>
            {Object.entries(changes).map(([key, value]) => (
              <div key={key}>
                <dt>{fields.find(([f]) => f === key)?.[1]}</dt>
                <dd>
                  {String(snapshot[key])} → {String(value)}
                </dd>
              </div>
            ))}
          </dl>
          <button disabled={a.busy || !Object.keys(changes).length}>
            Änderungen speichern
          </button>
          <button type="button" onClick={() => setSnapshot(null)}>
            Verwerfen
          </button>
          <Status message={a.message} />
        </form>
      )}
    </>
  );
}
function ReportAction({ target }: { target: string }) {
  const c = useCommunity(),
    a = useAction(),
    [reason, setReason] = useState("");
  return (
    <details>
      <summary>Inhalt melden</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void a.run(async () => {
            await c.service.report(target, reason);
            setReason("");
            a.setMessage("Meldung zur Prüfung übermittelt.");
          });
        }}
      >
        <Field
          label="Grund der Meldung · mindestens 10 Zeichen"
          value={reason}
          onChange={setReason}
        />
        <button disabled={a.busy || reason.trim().length < 10}>
          Meldung absenden
        </button>
        <Status message={a.message} />
      </form>
    </details>
  );
}
function Comments({ listingId }: { listingId: string }) {
  const c = useCommunity(),
    a = useAction(),
    page = usePage<{ id: string; ownerUid: string; text: string }>(
      `listings/${listingId}/comments`,
    ),
    [text, setText] = useState("");
  return (
    <div>
      {page.data.map((comment) => (
        <div className="cc-comment" key={comment.id}>
          <p>{comment.text}</p>
          <Contact uid={comment.ownerUid} />
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void a.run(async () => {
            await c.service.comment(listingId, text);
            setText("");
            await page.load();
          });
        }}
      >
        <Field label="Kommentar" value={text} onChange={setText} />
        <button disabled={a.busy}>Kommentar senden</button>
      </form>
      {page.more && (
        <button onClick={() => void page.load(true)}>Weitere Kommentare</button>
      )}
      <Status message={a.message || page.error} />
    </div>
  );
}
function Reservations() {
  const c = useCommunity(),
    a = useAction(),
    [side, setSide] = useState("buyerUid");
  const page = usePage<Reservation>("reservations", side, c.user!.uid);
  return (
    <>
      <div className="cc-tabs">
        <button onClick={() => setSide("buyerUid")}>Meine Anfragen</button>
        <button onClick={() => setSide("sellerUid")}>
          Anfragen zu meinen Angeboten
        </button>
        <button onClick={() => void page.load()}>Aktualisieren</button>
      </div>
      {page.data.map((r) => (
        <div className="cc-card" key={r.id}>
          <b>
            {r.quantity} Stück · {r.state}
          </b>
          <p>Angebot {r.listingId}</p>
          <Contact
            uid={r.sellerUid === c.user!.uid ? r.buyerUid : r.sellerUid}
          />
          {(r.state === "requested" || r.state === "accepted") && (
            <>
              <button
                disabled={a.busy}
                onClick={() =>
                  void a.run(async () => {
                    await c.service.reservation(r.id, "withdrawn");
                    await page.load();
                  })
                }
              >
                Zurückziehen
              </button>
              {r.sellerUid === c.user!.uid &&
                (r.state === "requested" ? (
                  <>
                    <button
                      disabled={a.busy}
                      onClick={() =>
                        void a.run(async () => {
                          await c.service.reservation(r.id, "accepted");
                          await page.load();
                        })
                      }
                    >
                      Annehmen
                    </button>
                    <button
                      disabled={a.busy}
                      onClick={() =>
                        void a.run(async () => {
                          await c.service.reservation(r.id, "rejected");
                          await page.load();
                        })
                      }
                    >
                      Ablehnen
                    </button>
                  </>
                ) : (
                  <button
                    disabled={a.busy}
                    onClick={() =>
                      void a.run(async () => {
                        await c.service.reservation(r.id, "completed");
                        await page.load();
                      })
                    }
                  >
                    Abschließen
                  </button>
                ))}
            </>
          )}
        </div>
      ))}
      {page.more && (
        <button onClick={() => void page.load(true)}>
          Weitere Reservierungen
        </button>
      )}
      <Status message={a.message || page.error} />
    </>
  );
}
function Activities({ kind }: { kind: "event" | "group" }) {
  const c = useCommunity(),
    a = useAction(),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [date, setDate] = useState(""),
    [timezone, setTimezone] = useState(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    [capacity, setCapacity] = useState("8"),
    [minLevel, setMinLevel] = useState("1"),
    [meeting, setMeeting] = useState(""),
    [dungeon, setDungeon] = useState("0"),
    [activityType, setActivityType] = useState("Dungeon-Run"),
    [wantedClasses, setWantedClasses] = useState<number[]>([]),
    [wantedRoles, setWantedRoles] = useState<string[]>([]),
    [resourceName, setResourceName] = useState(""),
    [targetQuantity, setTargetQuantity] = useState("0"),
    [filter, setFilter] = useState(""),
    [calendar, setCalendar] = useState<CalendarView>("list"),
    [anchor, setAnchor] = useState(new Date()),
    [selected, setSelected] = useState<string | null>(null),
    [calendarRows, setCalendarRows] = useState<Activity[]>([]),
    [calendarError, setCalendarError] = useState(""),
    [calendarLimit, setCalendarLimit] = useState(25),
    [mine, setMine] = useState(false);
  const page = usePage<Activity>(
    "activities",
    "kind",
    kind,
    "==",
    calendar === "list",
  );
  const days = calendarDays(anchor, calendar),
    firstDay = new Date(days[0]),
    lastDay = new Date(days.at(-1)!);
  firstDay.setHours(0, 0, 0, 0);
  lastDay.setHours(24, 0, 0, 0);
  const rangeStart = firstDay.toISOString(),
    rangeEnd = lastDay.toISOString();
  useEffect(() => {
    if (calendar === "list") return;
    setCalendarError("");
    const constraints = [
      where("kind", "==", kind),
      where("startsAt", ">=", rangeStart),
      where("startsAt", "<", rangeEnd),
      orderBy("startsAt"),
      orderBy(documentId()),
    ];
    return onSnapshot(
      query(
        collection(c.service.db, "activities"),
        ...constraints,
        limit(calendarLimit),
      ),
      (snapshot) =>
        setCalendarRows(snapshot.docs.map((d) => d.data() as Activity)),
      (error) => setCalendarError(error.message),
    );
  }, [calendar, kind, rangeStart, rangeEnd, c.service, calendarLimit]);
  const visible = (calendar === "list" ? page.data : calendarRows)
    .filter(
      (event) =>
        JSON.stringify([event.title, event.server, event.description])
          .toLowerCase()
          .includes(filter.toLowerCase()) &&
        (!mine ||
          event.ownerUid === c.user!.uid ||
          !!event.participants[c.user!.uid]),
    )
    .sort((x, y) => x.startsAt.localeCompare(y.startsAt));
  return (
    <div className="cc-panel">
      <div className="cc-toolbar">
        <h2>
          <CalendarDays size={22} />
          {kind === "event" ? "Gildenaktivitäten" : "Dungeon-Gruppen"}
        </h2>
        <button onClick={() => void page.load()}>Aktualisieren</button>
      </div>
      <details className="cc-create">
        <summary>
          {kind === "event" ? "Event organisieren" : "Gruppe erstellen"}
        </summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void a.run(async () => {
              await c.service.createActivity({
                kind,
                title,
                description,
                server: c.profile!.server,
                startsAt: zonedInstant(date, timezone),
                timezone,
                meeting,
                dungeonId: Number(dungeon),
                minLevel: Number(minLevel),
                capacity: Number(capacity),
                activityType,
                wantedClasses,
                wantedRoles,
                resourceName,
                targetQuantity: Number(targetQuantity),
              });
              await page.load();
              setTitle("");
            });
          }}
        >
          <div className="cc-form-grid">
            <label className="cc-field">
              Aktivitätstyp
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
              >
                {[
                  "Dungeon-Run",
                  "Farmaktion",
                  "Questaktion",
                  "Gildentreffen",
                  "PvM",
                  "Freies Event",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <Field label="Titel" value={title} onChange={setTitle} />
            <Field
              label="Datum & Uhrzeit (lokale Eingabe)"
              type="datetime-local"
              value={date}
              onChange={setDate}
            />
            <Field
              label="Anzeige-Zeitzone"
              value={timezone}
              onChange={setTimezone}
            />
            <Field
              label="Teilnehmerlimit"
              type="number"
              value={capacity}
              onChange={setCapacity}
              min={1}
              max={100}
            />
            <Field
              label="Mindestlevel"
              type="number"
              value={minLevel}
              onChange={setMinLevel}
              min={1}
              max={200}
            />
            <Field
              label="Treffpunkt"
              value={meeting}
              onChange={setMeeting}
              required={false}
            />
            <label className="cc-field">
              Dungeon
              <select
                value={dungeon}
                onChange={(e) => setDungeon(e.target.value)}
                required={kind === "group"}
              >
                <option value="0">Kein Dungeon / freie Aktivität</option>
                {c.dungeons?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Field
            label="Beschreibung, Farmziel & gesuchte Rollen"
            value={description}
            onChange={setDescription}
            required={false}
          />
          <div className="cc-form-grid">
            <Field
              label="Ressource / Farmziel (optional)"
              value={resourceName}
              onChange={setResourceName}
              required={false}
            />
            <Field
              label="Zielmenge"
              type="number"
              value={targetQuantity}
              onChange={setTargetQuantity}
              min={0}
              max={1000000}
            />
          </div>
          <details>
            <summary>Gesuchte Klassen und Rollen</summary>
            <div className="cc-form-grid">
              {classes.map((ch) => (
                <label className="cc-check" key={ch.id}>
                  <input
                    type="checkbox"
                    checked={wantedClasses.includes(ch.id)}
                    onChange={(e) =>
                      setWantedClasses((old) =>
                        e.target.checked
                          ? [...old, ch.id]
                          : old.filter((id) => id !== ch.id),
                      )
                    }
                  />
                  {ch.name}
                </label>
              ))}
            </div>
            <div className="cc-toolbar">
              {[
                "Schaden",
                "Tank",
                "Heilung",
                "Unterstützung",
                "Positionierung",
                "Flexibel",
              ].map((role) => (
                <label className="cc-check" key={role}>
                  <input
                    type="checkbox"
                    checked={wantedRoles.includes(role)}
                    onChange={(e) =>
                      setWantedRoles((old) =>
                        e.target.checked
                          ? [...old, role]
                          : old.filter((r) => r !== role),
                      )
                    }
                  />
                  {role}
                </label>
              ))}
            </div>
          </details>
          <button disabled={a.busy} className="cc-primary">
            Veröffentlichen
          </button>
        </form>
      </details>
      <div className="cc-toolbar">
        <Field
          label="Geladene Aktivitäten filtern"
          value={filter}
          onChange={setFilter}
          required={false}
        />
        <label className="cc-check">
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => setMine(e.target.checked)}
          />
          Meine Aktivitäten
        </label>
        <select
          aria-label="Kalenderansicht"
          value={calendar}
          onChange={(e) => {
            setCalendar(e.target.value as CalendarView);
            setCalendarLimit(25);
            setSelected(null);
          }}
        >
          <option value="list">Liste</option>
          <option value="week">Woche</option>
          <option value="month">Monat</option>
        </select>
      </div>
      {calendar !== "list" && (
        <>
          <div className="cc-toolbar">
            <button
              onClick={() => {
                const d = new Date(anchor);
                if (calendar === "month") {
                  d.setDate(1);
                  d.setMonth(d.getMonth() - 1);
                } else d.setDate(d.getDate() - 7);
                setAnchor(d);
                setCalendarLimit(25);
                setSelected(null);
              }}
            >
              Zurück
            </button>
            <b>
              {anchor.toLocaleDateString("de-DE", {
                month: "long",
                year: "numeric",
              })}
            </b>
            <button
              onClick={() => {
                setAnchor(new Date());
                setCalendarLimit(25);
              }}
            >
              Heute
            </button>
            <button
              onClick={() => {
                const d = new Date(anchor);
                if (calendar === "month") {
                  d.setDate(1);
                  d.setMonth(d.getMonth() + 1);
                } else d.setDate(d.getDate() + 7);
                setAnchor(d);
                setCalendarLimit(25);
                setSelected(null);
              }}
            >
              Weiter
            </button>
          </div>
          <p>
            Kalenderanzeige: {Intl.DateTimeFormat().resolvedOptions().timeZone}.
            Einen Termin für Details und Teilnahme auswählen.
          </p>
          <ActivityCalendar
            activities={visible}
            anchor={anchor}
            view={calendar}
            onSelect={setSelected}
          />
          {calendarRows.length === calendarLimit && calendarLimit < 100 && (
            <button
              onClick={() => setCalendarLimit((n) => Math.min(100, n + 25))}
            >
              Weitere Termine im Zeitraum laden
            </button>
          )}
          {calendarRows.length === 100 && (
            <p>
              100 Termine geladen. Für weitere Einträge die Listenansicht
              verwenden.
            </p>
          )}
        </>
      )}
      <div className="cc-cards">
        {visible
          .filter((event) => calendar === "list" || event.id === selected)
          .map((event) => (
            <ActivityCard key={event.id} activity={event} />
          ))}
      </div>
      {!page.loading && !page.data.length && (
        <Empty>Hier ist noch nichts geplant.</Empty>
      )}
      {calendar === "list" && page.more && (
        <button onClick={() => void page.load(true)}>
          Weitere Aktivitäten
        </button>
      )}
      <Status message={calendarError || page.error || a.message} />
    </div>
  );
}
function ActivityCard({ activity }: { activity: Activity }) {
  const c = useCommunity(),
    a = useAction(),
    [event, setEvent] = useState(activity),
    [characters, setCharacters] = useState<CommunityCharacter[]>([]),
    [characterId, setCharacterId] = useState(""),
    [role, setRole] = useState("Flexibel");
  useEffect(
    () =>
      c.service.watch<Activity>(
        `activities/${activity.id}`,
        (v) => {
          if (v) setEvent(v);
        },
        (e) => a.setMessage(e.message),
      ),
    [c.service, activity.id],
  );
  useEffect(() => {
    void c.store
      .read<CommunityCharacter[]>("characters", [])
      .then(setCharacters);
  }, [c.store]);
  return (
    <article className="cc-card">
      <small>
        {event.status} · {event.server}
      </small>
      <h3>{event.title}</h3>
      <p>
        {new Date(event.startsAt).toLocaleString("de-DE", {
          timeZone: event.timezone,
        })}{" "}
        · {event.timezone}
      </p>
      <p>{event.description}</p>
      <p>
        {event.activityType || "Gildenaktivität"}
        {event.resourceName
          ? ` · Farmziel: ${event.resourceName} × ${event.targetQuantity ?? 0}`
          : ""}
      </p>
      {!!event.wantedClasses?.length && (
        <p>
          Gesuchte Klassen:{" "}
          {event.wantedClasses
            .map((id) => classes.find((c) => c.id === id)?.name ?? id)
            .join(", ")}
        </p>
      )}
      {!!event.wantedRoles?.length && (
        <p>Gesuchte Rollen: {event.wantedRoles.join(", ")}</p>
      )}
      <p>Treffpunkt: {event.meeting || "Nach Absprache"}</p>
      <b>
        {event.joined}/{event.capacity} Plätze · ab Stufe {event.minLevel}
      </b>
      <ul>
        {Object.entries(event.participants).map(([uid, p]) => (
          <li key={uid}>
            {p.name} · {p.role} ·{" "}
            {p.status === "waiting" ? "Warteliste" : "Dabei"}
          </li>
        ))}
      </ul>
      <Contact uid={event.ownerUid} />
      <ReportAction target={`activities/${event.id}`} />
      {event.ownerUid === c.user!.uid && (
        <OwnedEditor
          path={`activities/${event.id}`}
          record={event}
          fields={[
            ["title", "Titel"],
            ["description", "Beschreibung"],
            ["startsAt", "Termin (ISO 8601 mit Zeitzone)"],
            ["timezone", "Anzeige-Zeitzone"],
            ["meeting", "Treffpunkt"],
            ["minLevel", "Mindestlevel"],
            ["capacity", "Teilnehmerlimit"],
          ]}
        />
      )}
      {event.status === "open" && (
        <>
          <label className="cc-field">
            Dein Charakter
            <select
              value={characterId}
              onChange={(e) => setCharacterId(e.target.value)}
            >
              <option value="">Charakter wählen</option>
              {characters.map((ch) => (
                <option value={ch.id} key={ch.id}>
                  {ch.name} · {ch.level}
                </option>
              ))}
            </select>
          </label>
          <select
            aria-label="Gruppenrolle"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {[
              "Schaden",
              "Tank",
              "Heilung",
              "Unterstützung",
              "Positionierung",
              "Flexibel",
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button
            disabled={a.busy || !characterId}
            onClick={() =>
              void a.run(async () => {
                const ch = characters.find((ch) => ch.id === characterId);
                if (!ch) throw Error("Charakter auswählen.");
                if (ch.server !== event.server)
                  throw Error(
                    "Charakter und Aktivität müssen auf demselben Server sein.",
                  );
                await c.service.participate(event.id, {
                  characterId,
                  name: ch.name,
                  level: ch.level,
                  role,
                });
              })
            }
          >
            Beitreten / Warteliste
          </button>
          {event.participants[c.user!.uid] && (
            <button
              onClick={() =>
                void a.run(() => c.service.participate(event.id, null))
              }
            >
              Verlassen
            </button>
          )}
          {event.ownerUid === c.user!.uid && (
            <button
              onClick={() => {
                if (confirm("Aktivität absagen?"))
                  void a.run(() =>
                    c.service.edit(
                      `activities/${event.id}`,
                      { status: "cancelled" },
                      event.revision,
                    ),
                  );
              }}
            >
              Absagen
            </button>
          )}
        </>
      )}
      <Status message={a.message} />
    </article>
  );
}

function AdminAccess() {
  const c = useCommunity(),
    a = useAction();
  const [modal, setModal] = useState(false),
    [unlocked, setUnlocked] = useState(false),
    [password, setPassword] = useState("");
  const expires = useRef(0),
    lastActive = useRef(0);
  const allowed = c.user?.emailVerified && ["owner", "admin"].includes(c.role);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null,
      dialog = document.querySelector<HTMLElement>(".cc-modal"),
      oldOverflow = document.body.style.overflow;
    if (!dialog) return;
    const items = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => {
      (
        dialog.querySelector<HTMLElement>('input[type="password"]') ??
        items()[0]
      )?.focus();
    });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = items(),
        first = elements[0],
        last = elements.at(-1);
      if (!first) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    dialog.addEventListener("keydown", trap);
    return () => {
      cancelAnimationFrame(frame);
      dialog.removeEventListener("keydown", trap);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [modal, unlocked]);
  useEffect(() => {
    setUnlocked(false);
    setModal(false);
    setPassword("");
    expires.current = 0;
  }, [c.user?.uid, c.role]);
  useEffect(() => {
    if (!unlocked) return;
    const touch = () => {
      lastActive.current = Date.now();
    };
    touch();
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    const timer = setInterval(() => {
      if (
        Date.now() > expires.current ||
        Date.now() - lastActive.current > 300000
      )
        setUnlocked(false);
    }, 1000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, [unlocked]);
  if (!allowed) return null;
  return (
    <>
      <button
        className="cc-siren"
        aria-label="Administration öffnen"
        title="Administration"
        onClick={() => setModal(true)}
      >
        <Siren size={19} />
      </button>
      {modal && (
        <div className="cc-modal-backdrop" role="presentation">
          <section
            className="cc cc-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-admin-heading"
            onKeyDown={(e) => {
              if (e.key === "Escape") setModal(false);
            }}
          >
            <button
              className="cc-close"
              aria-label="Schließen"
              onClick={() => setModal(false)}
            >
              <X />
            </button>
            {unlocked ? (
              <>
                <div className="cc-toolbar">
                  <h2 id="cc-admin-heading">
                    <Siren />
                    Administration · {c.profile?.dofusName || c.user?.email}
                  </h2>
                  <button
                    onClick={() => {
                      setUnlocked(false);
                      setModal(false);
                    }}
                  >
                    Adminmodus verlassen
                  </button>
                </div>
                <AdminPanel />
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void a.run(async () => {
                    await c.service.reauthenticate(password);
                    setPassword("");
                    expires.current = Date.now() + 14 * 60000;
                    setUnlocked(true);
                  });
                }}
              >
                <h2 id="cc-admin-heading">Administrationszugang bestätigen</h2>
                <p>
                  Erneut mit deinem persönlichen Firebase-Accountpasswort
                  anmelden. Die Datenbank prüft zusätzlich Rolle und Aktualität
                  der Anmeldung.
                </p>
                <Field
                  label="Dein persönliches Accountpasswort"
                  type="password"
                  value={password}
                  onChange={setPassword}
                />
                <button className="cc-primary" disabled={a.busy}>
                  Sicher entsperren
                </button>
                <Status message={a.message} />
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
const adminSections = [
  "Dashboard",
  "Gildeneinstellungen",
  "Mitgliederverwaltung",
  "Ränge & Berechtigungen",
  "Charakterverwaltung",
  "Marktplatzverwaltung",
  "Reservierungen",
  "Events & Aktivitäten",
  "Dungeon-Gruppen",
  "Teilnehmer & Wartelisten",
  "Moderation",
  "Änderungsverlauf",
];
function AdminPanel() {
  const c = useCommunity();
  const [tab, setTab] = useState("Dashboard");
  return (
    <div className="cc-admin-layout">
      <nav aria-label="Administration">
        {adminSections.map((s) => (
          <button
            key={s}
            className={tab === s ? "active" : ""}
            onClick={() => setTab(s)}
          >
            {s}
          </button>
        ))}
      </nav>
      <div>
        {tab === "Gildeneinstellungen" ? (
          <GuildSettings />
        ) : tab === "Dashboard" ? (
          <AdminDashboard />
        ) : tab === "Ränge & Berechtigungen" ? (
          <div className="cc-panel">
            <h3>Geschützte Systemrollen</h3>
            <p>
              Deine technische Rolle: {c.role}. Technische Rollen werden
              ausschließlich durch den vertrauenswürdigen Betreiber-Bootstrap
              vergeben. Ein Gildenrang verleiht keine Systemrechte. Der letzte
              Besitzer kann im Client weder entfernt noch herabgestuft werden.
            </p>
            <p>
              Ingame-Ränge und Anzeigenamen lassen sich in der
              Mitgliederverwaltung bearbeiten.
            </p>
          </div>
        ) : tab === "Mitgliederverwaltung" ? (
          <AdminTable
            path="memberships"
            fields={["displayName", "rank", "status"]}
          />
        ) : tab === "Charakterverwaltung" ? (
          <AdminCharacters />
        ) : tab === "Marktplatzverwaltung" ? (
          <AdminTable
            path="listings"
            filter={["visibility", "guild"]}
            fields={[
              "itemName",
              "itemId",
              "price",
              "server",
              "description",
              "type",
              "status",
            ]}
          />
        ) : tab === "Reservierungen" ? (
          <AdminReservations />
        ) : tab === "Events & Aktivitäten" ? (
          <AdminTable
            path="activities"
            filter={["kind", "event"]}
            fields={[
              "title",
              "description",
              "startsAt",
              "timezone",
              "meeting",
              "minLevel",
              "capacity",
              "status",
            ]}
          />
        ) : tab === "Dungeon-Gruppen" ? (
          <AdminTable
            path="activities"
            filter={["kind", "group"]}
            fields={[
              "title",
              "description",
              "startsAt",
              "timezone",
              "meeting",
              "minLevel",
              "capacity",
              "status",
            ]}
          />
        ) : tab === "Moderation" ? (
          <>
            <AdminTable
              path="reports"
              fields={["target", "reason", "status", "resolution"]}
            />
            <CommentModeration />
          </>
        ) : tab === "Teilnehmer & Wartelisten" ? (
          <AdminParticipants service={c.service} />
        ) : (
          <AuditLog />
        )}
      </div>
    </div>
  );
}
function AdminDashboard() {
  const members = usePage<Membership>("memberships"),
    offers = usePage<Listing>("listings", "visibility", "guild"),
    events = usePage<Activity>("activities"),
    c = useCommunity();
  return (
    <div>
      <h3>Verwaltungsübersicht</h3>
      <p>
        Aus den aktuell geladenen Datensätzen; weitere Seiten können zusätzliche
        Einträge enthalten.
      </p>
      <div className="cc-cards">
        {[
          [
            "Bestätigte Mitglieder",
            members.data.filter((m) => m.status === "approved").length,
          ],
          [
            "Offene Anträge",
            members.data.filter((m) => m.status === "pending").length,
          ],
          [
            "Aktive Gildenangebote",
            offers.data.filter((l) => l.status === "open").length,
          ],
          [
            "Offene Aktivitäten",
            events.data.filter((e) => e.status === "open").length,
          ],
        ].map(([label, count]) => (
          <div className="cc-card" key={label}>
            <strong className="cc-price">{count}</strong>
            <p>{label}</p>
          </div>
        ))}
      </div>
      <p>{c.settings?.guildName || "Die Gilde ist noch nicht eingerichtet."}</p>
      <Status message={members.error || offers.error || events.error} />
    </div>
  );
}
async function emblemData(file: File) {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 5000000
  )
    throw Error("Bitte PNG, JPEG oder WebP bis 5 MB wählen.");
  const bitmap = await createImageBitmap(file);
  if (
    bitmap.width < 1 ||
    bitmap.height < 1 ||
    bitmap.width > 8192 ||
    bitmap.height > 8192 ||
    bitmap.width * bitmap.height > 16000000
  ) {
    bitmap.close();
    throw Error(
      "Bild ist zu groß: maximal 16 Megapixel und 8192 Pixel pro Seite.",
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 192, 192);
  const scale = Math.min(192 / bitmap.width, 192 / bitmap.height);
  ctx.drawImage(
    bitmap,
    (192 - bitmap.width * scale) / 2,
    (192 - bitmap.height * scale) / 2,
    bitmap.width * scale,
    bitmap.height * scale,
  );
  bitmap.close();
  const data = canvas.toDataURL("image/webp", 0.8);
  if (data.length > 60000)
    throw Error("Wappen ist nach Komprimierung noch zu groß.");
  return data;
}
function GuildSettings() {
  const c = useCommunity(),
    a = useAction();
  const [value, setValue] = useState(c.settings),
    [reason, setReason] = useState("");
  if (!value || value.revision === undefined)
    return (
      <Empty>
        Der Betreiber muss zuerst die geschützte Gildenkonfiguration
        initialisieren.
      </Empty>
    );
  return (
    <form
      className="cc-panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (
          !confirm(
            "Gildenkonfiguration mit protokollierten Änderungen speichern?",
          )
        )
          return;
        void a.run(async () => {
          const oldEmblem = c.settings?.emblem ?? "";
          const finalValue = { ...value };
          if (value.emblem.startsWith("data:image/"))
            finalValue.emblem = await c.service.uploadEmblem(
              await (await fetch(value.emblem)).blob(),
            );
          await c.service.saveSettings(finalValue, reason);
          setValue({ ...finalValue, revision: value.revision + 1 });
          if (oldEmblem !== finalValue.emblem)
            await c.service.removeUnusedEmblem(oldEmblem);
          a.setMessage("Gildenkonfiguration gespeichert.");
        });
      }}
    >
      <h3>Gilde zentral bearbeiten</h3>
      <p>
        Die bestehende Gilde wird zentral eingerichtet. Archivieren entfernt den
        aktiven Gildenzugriff; gespeicherte Daten bleiben für eine
        Wiederherstellung erhalten.
      </p>
      <label className="cc-check">
        <input
          type="checkbox"
          checked={value.archived ?? false}
          onChange={(e) => setValue({ ...value, archived: e.target.checked })}
        />
        Gilde archivieren / logisch löschen
      </label>
      {value.emblem && <GuildEmblem path={value.emblem} preview />}
      <label className="cc-field">
        <Upload size={16} />
        Gildenwappen hochladen · PNG/JPEG/WebP, bis 5 MB
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              void a.run(async () =>
                setValue({ ...value, emblem: await emblemData(file) }),
              );
          }}
        />
      </label>
      <button type="button" onClick={() => setValue({ ...value, emblem: "" })}>
        Wappen entfernen
      </button>
      {(
        [
          ["guildName", "Gildenname"],
          ["server", "DOFUS-Server"],
          ["description", "Beschreibung"],
          ["discordUrl", "Discord-Einladungslink"],
          ["rules", "Gildenregeln"],
          ["admission", "Aufnahmebedingungen"],
          ["privacyUrl", "Datenschutz-URL"],
          ["termsUrl", "Nutzungsbedingungen-URL"],
          ["legalVersion", "Geprüfte Rechtstextversion"],
        ] as const
      ).map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={value[key]}
          onChange={(v) => setValue({ ...value, [key]: v })}
          required={false}
        />
      ))}
      <label className="cc-check">
        <input
          type="checkbox"
          checked={value.registrationEnabled}
          onChange={(e) =>
            setValue({ ...value, registrationEnabled: e.target.checked })
          }
        />
        Registrierung freigeben · erst nach vollständiger rechtlicher Prüfung
      </label>
      <Field label="Änderungsgrund" value={reason} onChange={setReason} />
      <button className="cc-primary" disabled={a.busy}>
        Änderungen bestätigen & speichern
      </button>
      <button type="button" onClick={() => setValue(c.settings)}>
        Verwerfen
      </button>
      <Status message={a.message} />
    </form>
  );
}
type AdminRow = { id: string; revision: number; [key: string]: unknown };
function AdminTable({
  path,
  fields,
  filter,
}: {
  path: string;
  fields: string[];
  filter?: [string, string];
}) {
  const c = useCommunity(),
    page = usePage<AdminRow>(path, filter?.[0], filter?.[1]),
    a = useAction(),
    [selected, setSelected] = useState<AdminRow | null>(null),
    [changes, setChanges] = useState<Record<string, unknown>>({}),
    [reason, setReason] = useState(""),
    [checked, setChecked] = useState<string[]>([]),
    [bulkStatus, setBulkStatus] = useState("approved"),
    [search, setSearch] = useState("");
  return (
    <div className="cc-panel">
      <div className="cc-toolbar">
        <h3>{path}</h3>
        <button onClick={() => void page.load()}>Aktualisieren</button>
      </div>
      <Field
        label="Geladene Datensätze filtern"
        value={search}
        onChange={setSearch}
        required={false}
      />
      {path === "memberships" && (
        <div className="cc-panel">
          <h4>Ausgewählte Mitgliedschaften verwalten · maximal 20</h4>
          <select
            aria-label="Status für Auswahl"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
          >
            {["approved", "rejected", "removed"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <Field
            label="Grund für Sammelaktion"
            value={reason}
            onChange={setReason}
          />
          <button
            disabled={a.busy || !checked.length || reason.trim().length < 5}
            onClick={() => {
              if (
                !confirm(
                  `${checked.length} Mitgliedschaften auf ${bulkStatus} setzen? Jeder Eintrag wird einzeln geprüft und protokolliert.`,
                )
              )
                return;
              void a.run(async () => {
                const failures: string[] = [];
                let done = 0;
                for (const id of checked) {
                  const row = page.data.find((r) => r.id === id);
                  if (!row) continue;
                  try {
                    await c.service.edit(
                      `memberships/${id}`,
                      { status: bulkStatus },
                      row.revision,
                      reason,
                      true,
                    );
                    done++;
                  } catch {
                    failures.push(id);
                  }
                }
                setChecked(failures);
                await page.load();
                a.setMessage(
                  `${done} Änderungen gespeichert.${failures.length ? ` ${failures.length} fehlgeschlagen; Auswahl bleibt zur Prüfung erhalten.` : ""}`,
                );
              });
            }}
          >
            Auswahl bestätigen ({checked.length})
          </button>
        </div>
      )}
      <div className="cc-table-scroll">
        <table>
          <thead>
            <tr>
              {path === "memberships" && <th>Auswahl</th>}
              <th>Datensatz</th>
              {fields.slice(0, 4).map((f) => (
                <th key={f}>{f}</th>
              ))}
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {page.data
              .filter((row) =>
                JSON.stringify(row)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((row) => (
                <tr key={row.id}>
                  {path === "memberships" && (
                    <td>
                      <input
                        aria-label={`Mitglied ${row.id} auswählen`}
                        type="checkbox"
                        checked={checked.includes(row.id)}
                        disabled={
                          !checked.includes(row.id) && checked.length >= 20
                        }
                        onChange={(e) =>
                          setChecked((old) =>
                            e.target.checked
                              ? [...old, row.id]
                              : old.filter((id) => id !== row.id),
                          )
                        }
                      />
                    </td>
                  )}
                  <td>{row.id}</td>
                  {fields.slice(0, 4).map((f) => (
                    <td key={f}>{String(row[f] ?? "")}</td>
                  ))}
                  <td>
                    <button
                      onClick={() => {
                        setSelected(row);
                        setChanges({});
                        setReason("");
                      }}
                    >
                      Bearbeiten
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {page.more && (
        <button onClick={() => void page.load(true)}>Weitere Datensätze</button>
      )}
      {selected && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!confirm("Diese Änderungen mit Änderungsprotokoll übernehmen?"))
              return;
            void a.run(async () => {
              await c.service.edit(
                `${path}/${selected.id}`,
                changes,
                selected.revision,
                reason,
                true,
              );
              setSelected(null);
              await page.load();
            });
          }}
        >
          <h4>
            {selected.id} · Revision {selected.revision}
          </h4>
          {fields.map((field) => (
            <Field
              key={field}
              label={`${field} · bisher: ${String(selected[field] ?? "")}`}
              value={String(changes[field] ?? selected[field] ?? "")}
              onChange={(value) =>
                setChanges({
                  ...changes,
                  [field]:
                    typeof selected[field] === "number" ? Number(value) : value,
                })
              }
              required={false}
            />
          ))}
          <Field label="Änderungsgrund" value={reason} onChange={setReason} />
          <button disabled={a.busy}>Bestätigen & speichern</button>
          <button type="button" onClick={() => setSelected(null)}>
            Abbrechen
          </button>
        </form>
      )}
      <Status message={a.message || page.error} />
    </div>
  );
}
function AdminCharacters() {
  const c = useCommunity(),
    a = useAction(),
    page = usePage<{
      id: string;
      uid: string;
      revision: number;
      characters: CommunityCharacter[];
    }>("guildCharacters"),
    [selected, setSelected] = useState<{
      row: string;
      revision: number;
      character: CommunityCharacter;
    } | null>(null),
    [reason, setReason] = useState("");
  return (
    <div className="cc-panel">
      <h3>Geteilte Gildencharaktere korrigieren</h3>
      <p>
        Änderungen betreffen die freigegebenen Gildenangaben. Private
        Charakterdaten anderer Accounts bleiben geschützt.
      </p>
      {page.data.map((row) => (
        <div key={row.id}>
          <h4>{row.uid}</h4>
          {row.characters.map((ch) => (
            <button
              key={ch.id}
              onClick={() =>
                setSelected({
                  row: row.id,
                  revision: row.revision,
                  character: ch,
                })
              }
            >
              {ch.name} · {ch.className} · {ch.level} · Ω {ch.omegaLevel}
            </button>
          ))}
        </div>
      ))}
      {selected && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void a.run(async () => {
              const validated = characterSchema.parse(selected.character),
                row = page.data.find((r) => r.id === selected.row)!;
              if (!confirm("Gildencharakter mit Änderungsverlauf korrigieren?"))
                return;
              await c.service.edit(
                `guildCharacters/${row.id}`,
                {
                  characters: row.characters.map((ch) =>
                    ch.id === validated.id ? validated : ch,
                  ),
                },
                selected.revision,
                reason,
                true,
              );
              setSelected(null);
              await page.load();
            });
          }}
        >
          {(
            [
              "name",
              "className",
              "classId",
              "level",
              "omegaLevel",
              "server",
            ] as const
          ).map((key) => (
            <Field
              key={key}
              label={key}
              value={String(selected.character[key])}
              onChange={(value) =>
                setSelected({
                  ...selected,
                  character: {
                    ...selected.character,
                    [key]:
                      typeof selected.character[key] === "number"
                        ? Number(value)
                        : value,
                  },
                })
              }
            />
          ))}
          <Field label="Änderungsgrund" value={reason} onChange={setReason} />
          <button disabled={a.busy}>Korrektur bestätigen</button>
        </form>
      )}
      {page.more && (
        <button onClick={() => void page.load(true)}>Weitere Charaktere</button>
      )}
      <Status message={a.message || page.error} />
    </div>
  );
}
function AdminReservations() {
  const c = useCommunity(),
    a = useAction(),
    [id, setId] = useState(""),
    [state, setState] = useState<ReservationState>("withdrawn"),
    [reason, setReason] = useState("");
  return (
    <>
      <GuildReservationList select={setId} />
      <form
        className="cc-panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            confirm(
              "Gildenreservierung einschließlich atomarer Bestandskorrektur ändern?",
            )
          )
            void a.run(() => c.service.reservation(id, state, reason));
        }}
      >
        <h3>Gildenreservierung moderieren</h3>
        <p>
          Die Regeln prüfen Gildensichtbarkeit, Rollen, Zustandsübergang und
          atomare Angebotsmenge.
        </p>
        <Field label="Reservierungs-ID" value={id} onChange={setId} />
        <select
          aria-label="Neuer Reservierungsstatus"
          value={state}
          onChange={(e) => setState(e.target.value as ReservationState)}
        >
          {["withdrawn", "accepted", "rejected", "completed"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <Field label="Änderungsgrund" value={reason} onChange={setReason} />
        <button disabled={a.busy}>Korrektur bestätigen</button>
        <Status message={a.message} />
      </form>
    </>
  );
}
function GuildReservationList({ select }: { select: (id: string) => void }) {
  const c = useCommunity(),
    offers = usePage<Listing>("listings", "visibility", "guild"),
    [rows, setRows] = useState<Reservation[]>([]),
    [error, setError] = useState(""),
    [state, setState] = useState("requested"),
    [offer, setOffer] = useState("");
  useEffect(() => {
    setRows([]);
    setError("");
    if (!offer) return;
    return onSnapshot(
      query(
        collection(c.service.db, "reservations"),
        where("listingId", "==", offer),
        limit(100),
      ),
      (snap) => setRows(snap.docs.map((d) => d.data() as Reservation)),
      (e) => setError(e.message),
    );
  }, [c.service, offer]);
  return (
    <div className="cc-panel">
      <h3>Reservierungsübersicht</h3>
      <p>
        Ein Gildenangebot auswählen. Private globale Reservierungen anderer
        Mitglieder bleiben geschützt.
      </p>
      <label className="cc-field">
        Angebot
        <select value={offer} onChange={(e) => setOffer(e.target.value)}>
          <option value="">Angebot wählen</option>
          {offers.data.map((l) => (
            <option key={l.id} value={l.id}>
              {l.itemName} · {l.server} · {l.available}/{l.quantity}
            </option>
          ))}
        </select>
      </label>
      {offers.more && (
        <button onClick={() => void offers.load(true)}>
          Weitere Gildenangebote
        </button>
      )}
      <label className="cc-field">
        Status
        <select value={state} onChange={(e) => setState(e.target.value)}>
          {[
            "all",
            "requested",
            "accepted",
            "completed",
            "withdrawn",
            "rejected",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <div className="cc-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Anfrage</th>
              <th>Käufer</th>
              <th>Menge</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => state === "all" || r.state === state)
              .map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>
                    <Contact uid={r.buyerUid} />
                  </td>
                  <td>{r.quantity}</td>
                  <td>{r.state}</td>
                  <td>
                    <button onClick={() => select(r.id)}>
                      Reservierung korrigieren
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {rows.length === 100 && (
        <p>
          100 Anfragen geladen. Einzelne weitere Anfragen über ihre ID prüfen.
        </p>
      )}
      <Status message={error || offers.error} />
    </div>
  );
}
function AuditLog() {
  const c = useCommunity(),
    a = useAction();
  const page = usePage<{
    id: string;
    actorUid: string;
    target: string;
    reason: string;
    before: unknown;
    after: unknown;
  }>("audit");
  return (
    <div className="cc-panel">
      <h3>Unveränderlicher Änderungsverlauf</h3>
      {page.data.map((log) => (
        <details key={log.id}>
          <summary>
            {log.target} · {log.reason}
          </summary>
          <p>Administrator: {log.actorUid}</p>
          <div className="cc-versions">
            <pre>{JSON.stringify(log.before, null, 2)}</pre>
            <pre>{JSON.stringify(log.after, null, 2)}</pre>
          </div>
          <button
            disabled={a.busy}
            onClick={() => {
              const reason = prompt(
                "Grund für die Rücknahme (mindestens fünf Zeichen). Nur unveränderte, fachlich sichere Werte werden zurückgenommen.",
              );
              if (reason && reason.trim().length >= 5)
                void a.run(async () => {
                  await c.service.undoAudit(log.id, reason);
                  await page.load();
                });
            }}
          >
            Fachwerte dieser Änderung zurücknehmen
          </button>
        </details>
      ))}
      {page.more && (
        <button onClick={() => void page.load(true)}>Weitere Änderungen</button>
      )}
      <Status message={a.message || page.error} />
    </div>
  );
}
function CommentModeration() {
  const page = usePage<Listing>("listings", "visibility", "guild"),
    [selected, setSelected] = useState("");
  return (
    <div className="cc-panel">
      <h3>Gildenkommentare moderieren</h3>
      <label className="cc-field">
        Gildenangebot
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Angebot wählen</option>
          {page.data.map((l) => (
            <option key={l.id} value={l.id}>
              {l.itemName} · {l.server}
            </option>
          ))}
        </select>
      </label>
      {page.more && (
        <button onClick={() => void page.load(true)}>
          Weitere Angebote laden
        </button>
      )}
      {selected && <CommentModerationRows listingId={selected} />}
      <Status message={page.error} />
    </div>
  );
}
function CommentModerationRows({ listingId }: { listingId: string }) {
  const c = useCommunity(),
    a = useAction(),
    page = usePage<{
      id: string;
      ownerUid: string;
      text: string;
      revision: number;
      moderated: boolean;
    }>(`listings/${listingId}/comments`),
    [reason, setReason] = useState("");
  return (
    <>
      <Field label="Moderationsgrund" value={reason} onChange={setReason} />
      {page.data.map((comment) => (
        <article className="cc-card" key={comment.id}>
          <p>{comment.text}</p>
          <Contact uid={comment.ownerUid} />
          {!comment.moderated && (
            <button
              disabled={a.busy || reason.trim().length < 5}
              onClick={() => {
                if (
                  confirm(
                    "Kommentar mit unveränderlichem Änderungsprotokoll moderieren?",
                  )
                )
                  void a.run(async () => {
                    await c.service.edit(
                      `listings/${listingId}/comments/${comment.id}`,
                      { text: "[Kommentar moderiert]", moderated: true },
                      comment.revision,
                      reason,
                      true,
                    );
                  });
              }}
            >
              Kommentar moderieren
            </button>
          )}
        </article>
      ))}
      {page.more && (
        <button onClick={() => void page.load(true)}>Weitere Kommentare</button>
      )}
      <Status message={a.message || page.error} />
    </>
  );
}
