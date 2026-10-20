import test from "node:test";
import assert from "node:assert/strict";
import type { Client } from "discord.js";
import { buildInput, calculateBuild, type Build } from "@dofus/core";
import {
  buildEmbed,
  buildAttachment,
  dispatchBuildShare,
  type BuildSummary,
} from "../src/builder.js";
import { Backend } from "../src/api.js";
import { canAccess } from "../src/permissions.js";
import { commands } from "../src/commands.js";
const build: Build = {
  ...buildInput.parse({
    name: "Persönliches Set",
    classId: 11,
    level: 200,
    gameVersion: "3.7.12.12",
  }),
  id: "be027d7f-1d17-4271-b470-c21441360b25",
  revision: 1,
  createdAt: "2026-10-20T00:00:00Z",
  updatedAt: "2026-10-20T00:00:00Z",
};
const summary: BuildSummary = {
  build,
  calculation: calculateBuild(build, new Map(), new Map()),
  equipment: [],
  character: null,
};
test("all builder subcommands remain owner-only", () => {
  for (const sub of ["profil", "sets", "anzeigen", "vergleichen", "teilen"]) {
    assert.equal(canAccess("builder", sub, "stranger", "owner"), false);
    assert.equal(canAccess("builder", sub, "owner", "owner"), true);
  }
  const command = commands.find((c) => c.name === "builder")!;
  assert.deepEqual(
    command.options!.map((o) => o.name),
    ["profil", "sets", "anzeigen", "vergleichen", "teilen"],
  );
});
test("build embed and own exchange attachment contain actual reproducible inputs", () => {
  const embed = buildEmbed(summary).toJSON();
  assert.equal(embed.title, build.name);
  assert.ok(embed.fields?.some((f) => f.value.includes("7 AP")));
  const file = buildAttachment(build);
  const json = JSON.parse((file.attachment as Buffer).toString("utf8"));
  assert.equal(json.format, "dofus-companion-build");
  assert.equal(json.schema, 1);
  assert.equal(json.build.gameVersion, "3.7.12.12");
  assert.equal(json.build.id, build.id);
});
test("desktop share delivers only to configured owner and acknowledges the durable job", async () => {
  const calls: { path: string; body: unknown }[] = [];
  let destination = "";
  let sent = false;
  const api = {
    request: async (path: string, body?: unknown) => {
      calls.push({ path, body });
      return path.endsWith("/claim")
        ? { data: { ...summary, id: "job-id" } }
        : { data: {} };
    },
  } as unknown as Backend;
  const client = {
    users: {
      fetch: async (id: string) => {
        destination = id;
        return {
          send: async (payload: {
            allowedMentions: { parse: string[] };
            enforceNonce: boolean;
          }) => {
            assert.deepEqual(payload.allowedMentions.parse, []);
            assert.equal(payload.enforceNonce, true);
            sent = true;
          },
        };
      },
    },
  } as unknown as Client;
  assert.equal(await dispatchBuildShare(client, api, "configured-owner"), true);
  assert.equal(destination, "configured-owner");
  assert.equal(sent, true);
  assert.equal(calls[1].path, "/api/builder/shares/job-id/ack");
  assert.deepEqual(calls[1].body, { delivered: true });
});
test("failed Discord delivery is marked failed and never acknowledged as success", async () => {
  const acks: unknown[] = [];
  const api = {
    request: async (path: string, body: unknown) =>
      path.endsWith("/claim")
        ? { data: { ...summary, id: "failed-job" } }
        : (acks.push(body), { data: {} }),
  } as unknown as Backend;
  const client = {
    users: {
      fetch: async () => {
        throw Error("DM unavailable");
      },
    },
  } as unknown as Client;
  await assert.rejects(
    () => dispatchBuildShare(client, api, "owner"),
    /DM unavailable/,
  );
  assert.deepEqual(acks, [{ delivered: false, error: "DM unavailable" }]);
});
