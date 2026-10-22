import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DiscordSDK } from "@discord/embedded-app-sdk";
import { Compass, RefreshCw, Users } from "lucide-react";
import WorldPage, { type ShareState } from "./WorldPage";
import "./activity.css";

type Login = {
  token: string;
  user: { id: string; username: string };
  expires: number;
};
type Session = {
  instanceId: string;
  userId: string;
  revision: number;
  state: ShareState | null;
  updatedBy: string | null;
};
class ActivityError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
// Authentication is held only in memory, including across React StrictMode's
// development effect replay. No token, identity or session is written to storage.
let authentication: Promise<Login> | null = null;
async function call<T>(
  path: string,
  token?: string,
  body?: unknown,
  method?: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: method ?? (body ? "POST" : "GET"),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new ActivityError(
      String(result.error ?? "Die Activity-Anfrage ist fehlgeschlagen."),
      response.status,
    );
  return result.data as T;
}
async function authenticate(): Promise<Login> {
  if (window.parent === window)
    throw Error(
      "Öffne diese Activity über Discord. Die lokale Companion-Weltkarte findest du in der Hauptanwendung.",
    );
  const configuration = await call<{
    configured: boolean;
    clientId: string | null;
  }>("/api/activity/config");
  if (!configuration.configured || !configuration.clientId)
    throw Error(
      "Diese Activity ist noch nicht eingerichtet. HTTPS-Hosting und Discord-Konfiguration fehlen.",
    );
  const sdk = new DiscordSDK(configuration.clientId);
  await sdk.ready();
  const challenge = await call<{ state: string }>(
    "/api/activity/challenge",
    undefined,
    {},
  );
  const authorization = await sdk.commands.authorize({
    client_id: configuration.clientId,
    response_type: "code",
    scope: ["identify"],
    prompt: "none",
    state: challenge.state,
  });
  const login = await call<Login & { access_token: string }>(
    "/api/activity/token",
    undefined,
    {
      code: authorization.code,
      state: challenge.state,
      instanceId: sdk.instanceId,
    },
  );
  await sdk.commands.authenticate({ access_token: login.access_token });
  return { token: login.token, user: login.user, expires: login.expires };
}
function loginOnce() {
  authentication ??= authenticate().catch((error) => {
    authentication = null;
    throw error;
  });
  return authentication;
}
export default function ActivityApp() {
  const [login, setLogin] = useState<Login | null>(null),
    [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState(""),
    [connecting, setConnecting] = useState(true),
    [attempt, setAttempt] = useState(0),
    [connected, setConnected] = useState(false);
  const revision = useRef(0),
    latestState = useRef<ShareState | null>(null);
  useEffect(() => {
    let cancelled = false;
    setConnecting(true);
    setError("");
    void loginOnce()
      .then((value) => {
        if (!cancelled) setLogin(value);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setConnecting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  useEffect(() => {
    if (!login) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined,
      pending = false;
    async function poll() {
      if (controller.signal.aborted || document.hidden || pending) return;
      pending = true;
      try {
        const value = await call<Session>(
          "/api/activity/session",
          login!.token,
          undefined,
          undefined,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          if (value.revision >= revision.current) {
            revision.current = value.revision;
            latestState.current = value.state;
            setSession(value);
          }
          setConnected(true);
          setError("");
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setConnected(false);
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        pending = false;
        if (!controller.signal.aborted && !document.hidden)
          timer = setTimeout(() => void poll(), 3000);
      }
    }
    const visibility = () => {
      clearTimeout(timer);
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", visibility);
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [login]);
  const config = useMemo(
    () => ({ url: location.origin, token: login?.token ?? "" }),
    [login?.token],
  );
  const share = useCallback(
    async (state: ShareState) => {
      if (!login) throw Error("Zuerst bei Discord anmelden.");
      try {
        const result = await call<{ revision: number; state: ShareState }>(
          "/api/activity/session",
          login.token,
          { expectedRevision: revision.current, state },
          "PUT",
        );
        revision.current = result.revision;
        latestState.current = result.state;
        setSession((old) =>
          old ? { ...old, ...result, updatedBy: login.user.id } : old,
        );
      } catch (e) {
        if (e instanceof ActivityError && e.status === 409) {
          const fresh = await call<Session>(
            "/api/activity/session",
            login.token,
          );
          revision.current = fresh.revision;
          latestState.current = fresh.state;
          setSession(fresh);
        }
        throw e;
      }
    },
    [login],
  );
  function reconnect() {
    authentication = null;
    setLogin(null);
    setSession(null);
    revision.current = 0;
    setAttempt((value) => value + 1);
  }
  return (
    <main className="activity-app">
      <header className="activity-header">
        <div>
          <Compass size={24} />
          <span>
            <strong>DOFUS Companion</strong>
            <small>Gemeinsame Weltkarte in Discord</small>
          </span>
        </div>
        {login && (
          <span className="activity-identity">
            <Users size={15} />
            {login.user.username} ·{" "}
            {connected ? "Verbunden" : "Verbindung wird hergestellt"}
          </span>
        )}
      </header>
      {error && (
        <div className="activity-error" role="alert">
          <span>{error}</span>
          <button className="secondary" onClick={reconnect}>
            <RefreshCw size={14} /> Erneut verbinden
          </button>
        </div>
      )}
      {connecting && (
        <div className="activity-loading" role="status">
          <RefreshCw className="spin" /> Discord-Anmeldung wird vorbereitet …
        </div>
      )}
      {login && (
        <>
          <p className="activity-privacy">
            Nur ausdrücklich geteilte Karten und Routen gehören zu dieser
            Sitzung. Persönliche Companion-Daten werden nicht geladen.{" "}
            {session
              ? `Revision ${session.revision}`
              : "Sitzung wird geprüft …"}
          </p>
          <WorldPage
            config={config}
            activity
            farming={false}
            sharedState={session?.state}
            onShare={share}
          />
        </>
      )}
    </main>
  );
}
