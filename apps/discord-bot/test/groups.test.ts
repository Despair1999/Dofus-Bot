import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Groups } from "../src/groups.js";
import { commands } from "../src/commands.js";
import { groupMessage, itemEmbed, itemMenu, questMessage } from "../src/ui.js";
import { Backend } from "../src/api.js";
import { canAccess } from "../src/permissions.js";
import { createServer } from "node:http";
test("Group roster persists, duplicates rejected, waiting list promoted", () => {
  const dir = mkdtempSync(join(tmpdir(), "dofus-bot-")),
    path = join(dir, "test.sqlite");
  let db = new Groups(path);
  try {
    const group = db.create({
      guildId: "g",
      channelId: "c",
      ownerId: "owner",
      title: "Test dungeon",
      capacity: 2,
      startsAt: Date.now() + 3600000,
    });
    db.join(group.id, "g", "second");
    db.join(group.id, "g", "second");
    db.join(group.id, "g", "wait");
    assert.deepEqual(db.get(group.id)?.members, ["owner", "second", "wait"]);
    assert.throws(
      () => db.join(group.id, "other-guild", "intruder"),
      /nicht gefunden/,
    );
    db.leave(group.id, "g", "second");
    assert.deepEqual(db.get(group.id)?.members, ["owner", "wait"]);
    db.attach(group.id, "message");
    db.close();
    db = new Groups(path);
    assert.deepEqual(db.get(group.id)?.members, ["owner", "wait"]);
    assert.equal(db.get(group.id)?.messageId, "message");
    const rendered = groupMessage(db.get(group.id)!);
    assert.equal(rendered.embeds[0].data.fields?.[0].name, "Teilnehmer 2/2");
    assert.equal(rendered.components[0].components.length, 2);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("Group size, title, and start are validated", () => {
  const db = new Groups(":memory:");
  try {
    const input = {
      guildId: "g",
      channelId: "c",
      ownerId: "o",
      title: "T",
      capacity: 2,
      startsAt: Date.now() + 600000,
    };
    assert.throws(() => db.create({ ...input, capacity: 0 }));
    assert.throws(() => db.create({ ...input, title: "" }));
    assert.throws(() => db.create({ ...input, startsAt: 0 }));
  } finally {
    db.close();
  }
});
test("Reminders are scoped to the next fifteen minutes and acknowledged", () => {
  const db = new Groups(":memory:");
  try {
    const now = Date.now();
    const group = db.create({
      guildId: "g",
      channelId: "c",
      ownerId: "o",
      title: "T",
      capacity: 2,
      startsAt: now + 600000,
    });
    assert.equal(db.due(now).length, 0);
    db.attach(group.id, "m");
    assert.equal(db.due(now).length, 1);
    db.markReminded(group.id);
    assert.equal(db.due(now).length, 0);
  } finally {
    db.close();
  }
});
test("Commands have unique names and serialize to Discord payloads", () => {
  assert.equal(new Set(commands.map((x) => x.name)).size, commands.length);
  for (const command of commands) {
    assert.ok(command.description.length <= 100);
    assert.ok(command.name.length <= 32);
  }
  assert.ok(commands.some((x) => x.name === "dungeon"));
});
test("Item output uses real supplied fields and caps Discord text limits", () => {
  const item = {
    id: 1,
    name: "X".repeat(400),
    type: "Ring",
    level: 60,
    category: "equipment",
    description: "A".repeat(5000),
    effects: ["+1"],
  };
  const result = itemEmbed(item).toJSON();
  assert.equal(result.title?.length, 256);
  assert.equal(result.description?.length, 3000);
  assert.equal(result.fields?.[0].value, "60");
  assert.equal(
    itemMenu([item]).components[0].options[0].toJSON().label.length,
    100,
  );
});
test("Remote backend bearer tokens require HTTPS", () => {
  assert.throws(() => new Backend("http://example.com", "secret"), /HTTPS/);
  assert.doesNotThrow(() => new Backend("http://127.0.0.1:4310", "secret"));
  assert.throws(() => new Backend("file:///private", "secret"));
});
test("Quest pagination clamps pages and keeps all known steps reachable", () => {
  const quest = {
    id: 1,
    name: "Quest",
    nameFr: "Quête",
    level: 1,
    requirements: "",
    source: "test fixture",
    version: "test",
    updatedAt: "2026-10-20",
    steps: [
      { id: 1, name: "A", description: "First", objectives: [] },
      { id: 2, name: "B", description: "Second", objectives: [] },
    ],
  };
  const first = questMessage(quest, -1),
    last = questMessage(quest, 100);
  assert.match(first.embeds[0].data.description!, /First/);
  assert.equal(first.components[0].components[0].data.disabled, true);
  assert.match(last.embeds[0].data.description!, /Second/);
  assert.equal(last.components[0].components[1].data.disabled, true);
});
test("Only configured owner may read or mutate personal state", () => {
  assert.equal(canAccess("charakter", "profil", "other", "owner"), false);
  assert.equal(canAccess("charakter", "registrieren", "owner", "owner"), true);
  assert.equal(canAccess("quest", "schritt", "other", "owner"), false);
  assert.equal(canAccess("quest", "suchen", "other", "owner"), true);
  assert.equal(canAccess("quest", "info", "other", "owner"), true);
  assert.equal(
    canAccess("quest", "unknown-future-private-action", "other", "owner"),
    false,
  );
});
test("Backend client transmits auth and handles failed writes", async () => {
  const received: {
    method: string | undefined;
    url: string | undefined;
    auth: string | undefined;
    body: string;
  }[] = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    received.push({
      method: req.method,
      url: req.url,
      auth: req.headers.authorization,
      body,
    });
    res.setHeader("content-type", "application/json");
    if (req.url === "/fail") {
      res.statusCode = 503;
      res.end("{}");
    } else if (req.method === "PUT") {
      res.statusCode = 409;
      res.end("{}");
    } else res.end(JSON.stringify({ data: [{ id: "character" }] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const api = new Backend(`http://127.0.0.1:${address.port}`, "test-token");
    const result = await api.request<{ data: { id: string }[] }>(
      "/api/characters",
    );
    assert.equal(result.data[0].id, "character");
    assert.equal(received[0].auth, "Bearer test-token");
    await api.request("/api/characters", { name: "Test" });
    assert.equal(received[1].method, "POST");
    assert.deepEqual(JSON.parse(received[1].body), { name: "Test" });
    await assert.rejects(api.request("/fail"), /503/);
    await assert.rejects(api.progress("test", { expectedVersion: 1 }), /409/);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
