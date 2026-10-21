import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { ZodError } from "zod";
import { PersonalStore } from "../src/store.js";
import { registerActivity } from "../src/activity.js";
import { registerWorld } from "../src/world.js";
import { createApp } from "../src/app.js";
import { GameDataStore } from "@dofus/game-data";

const secret = "owner-companion-secret-at-least-thirty-two-characters";
async function fixture() {
  const old = {
    client: process.env.DISCORD_CLIENT_ID,
    secret: process.env.DISCORD_CLIENT_SECRET,
    bot: process.env.DISCORD_TOKEN,
  };
  process.env.DISCORD_CLIENT_ID = "123";
  process.env.DISCORD_CLIENT_SECRET = "server-only-secret";
  process.env.DISCORD_TOKEN = "server-only-bot";
  const personal = new PersonalStore(":memory:"),
    app = Fastify();
  let calls = 0;
  const members = new Map([
    ["instance-a", ["user-a"]],
    ["instance-b", ["user-b"]],
  ]);
  const fetcher: typeof fetch = async (input, init) => {
    calls++;
    const url = String(input);
    if (url.endsWith("/oauth2/token")) {
      const code = new URLSearchParams(init!.body as URLSearchParams).get(
        "code",
      );
      if (code === "denied")
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      return Response.json({
        access_token: `access-${code}`,
        expires_in: 3600,
      });
    }
    if (url.endsWith("/oauth2/@me")) {
      const bearer = (init!.headers as Record<string, string>).Authorization;
      return Response.json({
        application: { id: bearer.endsWith("wrong-app") ? "999" : "123" },
        user: {
          id: bearer.endsWith("user-b") ? "user-b" : "user-a",
          username: "Testspieler",
        },
      });
    }
    const instanceId = decodeURIComponent(url.split("/").at(-1)!);
    return Response.json({
      application_id: "123",
      instance_id: instanceId,
      users: members.get(instanceId) ?? [],
    });
  };
  app.setErrorHandler((error, _request, reply) =>
    reply
      .code(
        error instanceof ZodError
          ? 400
          : ((error as { statusCode?: number }).statusCode ?? 500),
      )
      .send({ error: error instanceof Error ? error.message : String(error) }),
  );
  registerWorld(app, personal);
  registerActivity(app, personal, secret, fetcher);
  async function challenge(remoteAddress = "127.0.0.1") {
    const result = await app.inject({
      method: "POST",
      url: "/api/activity/challenge",
      payload: {},
      remoteAddress,
    });
    assert.equal(result.statusCode, 200);
    return result.json().data.state as string;
  }
  async function login(code = "user-a", instanceId = "instance-a") {
    const state = await challenge();
    return app.inject({
      method: "POST",
      url: "/api/activity/token",
      payload: { code, state, instanceId },
    });
  }
  async function close() {
    await app.close();
    personal.close();
    for (const [name, value] of [
      ["DISCORD_CLIENT_ID", old.client],
      ["DISCORD_CLIENT_SECRET", old.secret],
      ["DISCORD_TOKEN", old.bot],
    ]) {
      if (value === undefined) delete process.env[name!];
      else process.env[name!] = value;
    }
  }
  return {
    app,
    personal,
    challenge,
    login,
    close,
    members,
    calls: () => calls,
  };
}

test("Activity login binds a one-use challenge to IP and validates Discord instance membership", async () => {
  const f = await fixture();
  try {
    const state = await f.challenge();
    const payload = { state, code: "user-a", instanceId: "instance-a" };
    const result = await f.app.inject({
      method: "POST",
      url: "/api/activity/token",
      payload,
    });
    assert.equal(result.statusCode, 200);
    const token = result.json().data.token;
    assert.ok(token);
    assert.equal(result.headers["cache-control"], "no-store");
    const stored = f.personal.db
      .prepare("SELECT token_hash FROM discord_activity_tokens")
      .get() as { token_hash: string };
    assert.notEqual(stored.token_hash, token);
    const calls = f.calls();
    const replay = await f.app.inject({
      method: "POST",
      url: "/api/activity/token",
      payload,
    });
    assert.equal(replay.statusCode, 403);
    assert.equal(f.calls(), calls);
    const wrongIp = await f.challenge("10.20.30.40");
    const mismatch = await f.app.inject({
      method: "POST",
      url: "/api/activity/token",
      payload: { ...payload, state: wrongIp },
    });
    assert.equal(mismatch.statusCode, 403);
    assert.equal((await f.login("user-a", "instance-b")).statusCode, 403);
    assert.equal((await f.login("wrong-app")).statusCode, 403);
    assert.equal((await f.login("denied")).statusCode, 401);
  } finally {
    await f.close();
  }
});

test("Shared state is instance-scoped, rejects stale revisions and never proxies private farm observations", async () => {
  const f = await fixture();
  try {
    const first = (await f.login()).json().data.token as string,
      second = (await f.login("user-b", "instance-b")).json().data
        .token as string;
    const headers = { authorization: `Bearer ${first}` },
      other = { authorization: `Bearer ${second}` };
    const shared = {
      worldId: 1,
      mapIds: [88080663],
      resourceIds: [],
      title: "Gemeinsam",
    };
    const put = await f.app.inject({
      method: "PUT",
      url: "/api/activity/session",
      headers,
      payload: {
        expectedRevision: 0,
        state: {
          ...shared,
          privateNotes: "must-not-be-stored",
          characters: ["private"],
        },
      },
    });
    assert.equal(put.statusCode, 200);
    const value = (
      await f.app.inject({ url: "/api/activity/session", headers })
    ).json().data;
    assert.equal(value.revision, 1);
    assert.deepEqual(value.state, shared);
    const isolated = (
      await f.app.inject({ url: "/api/activity/session", headers: other })
    ).json().data;
    assert.equal(isolated.state, null);
    const conflict = await f.app.inject({
      method: "PUT",
      url: "/api/activity/session",
      headers,
      payload: { expectedRevision: 0, state: shared },
    });
    assert.equal(conflict.statusCode, 409);
    assert.equal(
      (await f.app.inject({ url: "/api/activity/session" })).statusCode,
      401,
    );
    assert.equal(
      (
        await f.app.inject({
          url: "/api/activity/session",
          headers: { authorization: `Bearer ${secret}` },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/activity/farm-route",
          headers,
          payload: { startMapId: 88080663, resourceIds: [6] },
        })
      ).statusCode,
      404,
    );
    f.personal.db.prepare("UPDATE discord_activity_tokens SET expires=0").run();
    assert.equal(
      (await f.app.inject({ url: "/api/activity/session", headers }))
        .statusCode,
      401,
    );
  } finally {
    await f.close();
  }
});

test("The complete companion API refuses an Activity token on every owner-only read", async () => {
  const f = await fixture(),
    game = new GameDataStore(":memory:");
  const ownerApp = await createApp({
    personal: f.personal,
    game,
    token: secret,
  });
  try {
    const token = (await f.login()).json().data.token as string;
    for (const url of [
      "/api/world/personal/markers",
      "/api/world/personal/routes",
      "/api/characters",
      "/api/builder/builds",
    ]) {
      const result = await ownerApp.inject({
        url,
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(result.statusCode, 401, url);
    }
    const config = await ownerApp.inject({ url: "/api/activity/config" });
    assert.deepEqual(Object.keys(config.json().data).sort(), [
      "clientId",
      "configured",
    ]);
    assert.equal(config.body.includes("server-only-secret"), false);
    assert.equal(config.body.includes("server-only-bot"), false);
    assert.equal(config.body.includes(secret), false);
  } finally {
    await ownerApp.close();
    game.close();
    await f.close();
  }
});
