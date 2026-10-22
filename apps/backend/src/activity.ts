import type { FastifyInstance, FastifyRequest } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { PersonalStore } from "./store.js";

const fail = (message: string, statusCode = 403) =>
  Object.assign(Error(message), { statusCode });
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const ids = z.array(z.number().int().positive()).max(100);
export const sharedMapState = z.object({
  worldId: z.number().int(),
  mapIds: ids,
  resourceIds: ids,
  title: z.string().max(160).default("Gemeinsame Route"),
});
export function registerActivity(
  app: FastifyInstance,
  personal: PersonalStore,
  companionToken: string,
  fetcher = fetch,
) {
  personal.db
    .exec(`CREATE TABLE IF NOT EXISTS discord_activity_tokens(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,instance_id TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS discord_activity_state(instance_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,state TEXT NOT NULL,updated_by TEXT NOT NULL);`);
  const challenges = new Map<string, { ip: string; expires: number }>();
  const checked = new Map<string, number>();
  const credentials = () => ({
    clientId: process.env.DISCORD_CLIENT_ID,
    secret: process.env.DISCORD_CLIENT_SECRET,
    bot: process.env.DISCORD_TOKEN,
  });
  const configured = () => Object.values(credentials()).every(Boolean);
  async function discord<T>(path: string, authorization: string): Promise<T> {
    const result = await fetcher(`https://discord.com/api/v10${path}`, {
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(10000),
    });
    if (!result.ok)
      throw fail("Discord-Anmeldung oder Sitzungsprüfung fehlgeschlagen.");
    return (await result.json()) as T;
  }
  async function membership(userId: string, instanceId: string) {
    const { clientId, bot } = credentials();
    const instance = await discord<{
      application_id: string;
      instance_id: string;
      users: string[];
    }>(
      `/applications/${clientId}/activity-instances/${encodeURIComponent(instanceId)}`,
      `Bot ${bot}`,
    );
    if (
      instance.application_id !== clientId ||
      instance.instance_id !== instanceId ||
      !instance.users.includes(userId)
    )
      throw fail("Du bist kein Teilnehmer dieser Activity.");
  }
  async function session(request: FastifyRequest) {
    const token = request.headers.authorization?.replace(/^Bearer /, "") ?? "";
    const key = digest(token);
    const row = personal.db
      .prepare(
        "SELECT user_id,instance_id,expires FROM discord_activity_tokens WHERE token_hash=?",
      )
      .get(key) as
      { user_id: string; instance_id: string; expires: number } | undefined;
    if (!row || row.expires <= Date.now())
      throw fail("Activity-Sitzung abgelaufen. Bitte erneut anmelden.", 401);
    if ((checked.get(key) ?? 0) < Date.now() - 30000) {
      await membership(row.user_id, row.instance_id);
      checked.set(key, Date.now());
    }
    return row;
  }
  app.get("/api/activity/config", () => ({
    data: {
      configured: configured(),
      clientId: credentials().clientId ?? null,
    },
  }));
  app.post("/api/activity/challenge", async (request, reply) => {
    if (!configured())
      throw fail(
        "Discord Activity benötigt HTTPS-Hosting und Developer-Portal-Konfiguration.",
        503,
      );
    for (const [key, value] of challenges)
      if (value.expires < Date.now()) challenges.delete(key);
    if (challenges.size >= 1000)
      throw fail("Zu viele Anmeldungen. Bitte später erneut versuchen.", 429);
    const state = randomBytes(32).toString("hex");
    challenges.set(state, { ip: request.ip, expires: Date.now() + 300000 });
    reply.header("Cache-Control", "no-store");
    return { data: { state } };
  });
  app.post("/api/activity/token", async (request, reply) => {
    if (!configured()) throw fail("Activity ist noch nicht konfiguriert.", 503);
    const input = z
      .object({
        code: z.string().min(1).max(2000),
        state: z.string().length(64),
        instanceId: z.string().min(1).max(200),
      })
      .parse(request.body);
    const challenge = challenges.get(input.state);
    challenges.delete(input.state);
    if (
      !challenge ||
      challenge.ip !== request.ip ||
      challenge.expires < Date.now()
    )
      throw fail("Ungültiger oder abgelaufener Anmeldevorgang.");
    const { clientId, secret } = credentials();
    const result = await fetcher("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: secret!,
        grant_type: "authorization_code",
        code: input.code,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!result.ok) throw fail("Discord hat den Anmeldecode abgelehnt.", 401);
    const oauth = z
      .object({ access_token: z.string(), expires_in: z.number().positive() })
      .parse(await result.json());
    const identity = await discord<{
      application: { id: string };
      user: { id: string; username: string };
    }>("/oauth2/@me", `Bearer ${oauth.access_token}`);
    if (identity.application.id !== clientId || !identity.user?.id)
      throw fail("Discord-Anmeldung gehört zu einer anderen Anwendung.");
    await membership(identity.user.id, input.instanceId);
    const token = randomBytes(32).toString("hex");
    const expires = Date.now() + Math.min(oauth.expires_in, 3600) * 1000;
    personal.db
      .prepare("DELETE FROM discord_activity_tokens WHERE expires<?")
      .run(Date.now());
    personal.db
      .prepare("INSERT INTO discord_activity_tokens VALUES(?,?,?,?)")
      .run(digest(token), identity.user.id, input.instanceId, expires);
    checked.set(digest(token), Date.now());
    reply.header("Cache-Control", "no-store");
    return {
      data: {
        access_token: oauth.access_token,
        token,
        user: identity.user,
        expires,
      },
    };
  });
  app.get("/api/activity/session", async (request, reply) => {
    const user = await session(request);
    const row = personal.db
      .prepare(
        "SELECT revision,state,updated_by FROM discord_activity_state WHERE instance_id=?",
      )
      .get(user.instance_id) as
      { revision: number; state: string; updated_by: string } | undefined;
    reply.header("Cache-Control", "no-store");
    return {
      data: {
        instanceId: user.instance_id,
        userId: user.user_id,
        revision: row?.revision ?? 0,
        state: row ? JSON.parse(row.state) : null,
        updatedBy: row?.updated_by ?? null,
      },
    };
  });
  app.put("/api/activity/session", async (request) => {
    const user = await session(request);
    const input = z
      .object({
        expectedRevision: z.number().int().nonnegative(),
        state: sharedMapState,
      })
      .parse(request.body);
    const value = JSON.stringify(input.state);
    const result =
      input.expectedRevision === 0
        ? personal.db
            .prepare(
              "INSERT OR IGNORE INTO discord_activity_state VALUES(?,1,?,?)",
            )
            .run(user.instance_id, value, user.user_id)
        : personal.db
            .prepare(
              "UPDATE discord_activity_state SET revision=revision+1,state=?,updated_by=? WHERE instance_id=? AND revision=?",
            )
            .run(value, user.user_id, user.instance_id, input.expectedRevision);
    if (!result.changes)
      throw fail(
        "Die gemeinsame Route wurde geändert. Neu laden und erneut teilen.",
        409,
      );
    return {
      data: { revision: input.expectedRevision + 1, state: input.state },
    };
  });
  // Only public graph calculations may use the owner's local backend credential.
  // Farm calculations access private observations and must never be delegated.
  for (const action of ["route"])
    app.post(`/api/activity/${action}`, async (request, reply) => {
      await session(request);
      const result = await app.inject({
        method: "POST",
        url: `/api/world/${action}`,
        headers: { authorization: `Bearer ${companionToken}` },
        payload: request.body as object,
      });
      return reply
        .code(result.statusCode)
        .type("application/json")
        .send(result.body);
    });
  app.addHook("onClose", async () => {
    checked.clear();
    challenges.clear();
  });
}
