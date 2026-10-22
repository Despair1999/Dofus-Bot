import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { commands } from "../src/commands.js";
import { Backend } from "../src/api.js";
import {
  dungeonMessage,
  intelligenceButton,
  intelligenceCommand,
} from "../src/intelligence.js";
import { canAccess } from "../src/permissions.js";
import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import type { DungeonDataset, WorldRoute } from "@dofus/core";

const dataset = JSON.parse(
  readFileSync(
    new URL(
      "../../../packages/game-data/assets/dungeon-data.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as DungeonDataset;
function dungeon(): Parameters<typeof dungeonMessage>[0] {
  const v = dataset.versions["3.7.12.12"],
    d = v.dungeons[0];
  return {
    ...d,
    version: "3.7.12.12",
    monsters: v.monsters.filter((m) => d.monsterIds.includes(m.id)),
    editorial: {
      dungeonId: d.id,
      version: "3.7.12.12",
      status: "draft",
      mechanics: [],
      strategy: [],
      rooms: [],
      sources: [],
      reviewedAt: null,
    },
  };
}
test("Intelligence slash commands serialize within Discord option limits", () => {
  const serialized = commands;
  assert.equal(new Set(serialized.map((c) => c.name)).size, serialized.length);
  function options(values: unknown[]) {
    assert.ok(values.length <= 25);
    for (const raw of values) {
      const o = raw as {
        name: string;
        description?: string;
        options?: unknown[];
      };
      assert.ok(o.name.length >= 1 && o.name.length <= 32);
      if (o.description) assert.ok(o.description.length <= 100);
      if (o.options) options(o.options);
    }
  }
  for (const c of serialized) {
    assert.ok(c.name.length <= 32);
    assert.ok(c.description!.length <= 100);
    options(c.options ?? []);
  }
  assert.ok(serialized.some((c) => c.name === "karte"));
  assert.ok(serialized.some((c) => c.name === "farm"));
  assert.ok(serialized.some((c) => c.name === "beruf"));
  const farm = serialized.find((c) => c.name === "farm")!;
  assert.ok(farm.options!.some((o) => o.name === "route"));
  assert.ok(farm.options!.some((o) => o.name === "projekt"));
});
test("Actual dungeon embeds paginate, fit component/field limits and withhold unverified strategies", () => {
  const d = dungeon();
  d.name = "D".repeat(500);
  d.editorial.strategy = ["UNREVIEWED_PRIVATE_DRAFT"];
  const initial = dungeonMessage(d, "strategie");
  const json = initial.embeds[0].toJSON();
  assert.equal(json.color, 0xd9b96e);
  assert.match(json.thumbnail!.url, /^attachment:\/\/monster-\d+\.webp$/);
  assert.equal(initial.files.length, 1);
  assert.equal(json.title!.length, 256);
  assert.ok(!JSON.stringify(json).includes("UNREVIEWED_PRIVATE_DRAFT"));
  assert.match(json.fields![0].value, /Prüfung ausstehend/);
  d.editorial.status = "verified";
  d.editorial.strategy = Array.from(
    { length: 19 },
    (_, i) => `Schritt ${i}: ${"Beleg ".repeat(100)}`,
  );
  const message = dungeonMessage(d, "strategie", 999);
  const out = message.embeds[0].toJSON();
  assert.match(out.footer!.text, /4\/4/);
  assert.ok(out.fields![0].value.length <= 1024);
  assert.ok(message.components.length <= 5);
  for (const row of message.components) {
    const data = row.toJSON();
    assert.ok(data.components.length <= 5);
    for (const c of data.components) {
      if ("custom_id" in c) assert.ok(c.custom_id!.length <= 100);
    }
  }
  const last = message.components
    .find((row) =>
      row
        .toJSON()
        .components.some(
          (component) => "label" in component && component.label === "Weiter",
        ),
    )!
    .toJSON();
  assert.equal((last.components[1] as { disabled?: boolean }).disabled, true);
  assert.match(
    dungeonMessage(d, "strategie", -50).embeds[0].toJSON().footer!.text,
    /1\/4/,
  );
  d.monsters = [];
  d.bossIds = [];
  d.bossNames = [];
  d.entrance = null;
  assert.match(
    dungeonMessage(d).embeds[0].toJSON().description!,
    /Bosszuordnung offen/,
  );
  assert.match(
    dungeonMessage(d, "raeume").embeds[0].toJSON().fields![0].value,
    /Monsterbelegung/,
  );
});
test("Dungeon navigation validates stale/malformed button payloads before requesting backend", async () => {
  const api = new Backend("http://127.0.0.1:4311", "test");
  let path = "",
    deferred = false,
    edited = false;
  api.request = async <T>(value: string) => {
    path = value;
    return { data: dungeon() } as T;
  };
  const i = {
    customId: "intel:1:3.7.12.12:monster:0",
    deferUpdate: async () => {
      deferred = true;
    },
    editReply: async () => {
      edited = true;
    },
  } as unknown as ButtonInteraction;
  assert.equal(await intelligenceButton(i, api), true);
  assert.ok(deferred && edited);
  assert.match(path, /version=3.7.12.12/);
  i.customId = "intel:1:3.7.12.12:unknown:0";
  path = "";
  await assert.rejects(() => intelligenceButton(i, api));
  assert.equal(path, "");
  i.customId = "unrelated:1";
  assert.equal(await intelligenceButton(i, api), false);
});
test("Farm commands use private backend routes and the entrypoint owner gate denies other Discord users", async () => {
  for (const sub of ["route", "projekt", "teilen"]) {
    assert.equal(canAccess("farm", sub, "outsider", "owner"), false);
    assert.equal(canAccess("farm", sub, "owner", "owner"), true);
  }
  assert.equal(canAccess("farm", "ressource", "outsider", "owner"), true);
  const api = new Backend("http://127.0.0.1:4311", "test");
  const calls: { path: string; body?: unknown }[] = [];
  let result: unknown;
  const route: WorldRoute = {
    mapIds: [5],
    transitions: [],
    steps: 0,
    unreachableMapIds: [7],
    complete: false,
    roundTrip: false,
    warning: "Teilgraph",
  };
  api.request = async <T>(path: string, body?: unknown) => {
    calls.push({ path, body });
    return (path.endsWith("routes") ? { data: [] } : { data: route }) as T;
  };
  const options = {
    getSubcommand: () => "route",
    getInteger: (name: string) => (name === "start" ? 5 : 24),
    getString: () => null,
  };
  const i = {
    commandName: "farm",
    options,
    editReply: async (value: unknown) => {
      result = value;
    },
  } as unknown as ChatInputCommandInteraction;
  assert.equal(await intelligenceCommand(i, api), true);
  assert.equal(calls[0].path, "/api/world/farm-route");
  assert.deepEqual(calls[0].body, { startMapId: 5, resourceIds: [24] });
  assert.match(JSON.stringify(result), /Nicht erreichbar/);
  options.getSubcommand = () => "projekt";
  await intelligenceCommand(i, api);
  assert.equal(calls[1].path, "/api/world/personal/routes");
  assert.match(JSON.stringify(result), /Noch keine Routen/);
});
