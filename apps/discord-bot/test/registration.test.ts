import { test } from "node:test";
import assert from "node:assert/strict";
import { entryPointCommands } from "../src/registration.js";
test("slash registration preserves portal Activity entry points without copying readonly command IDs", () => {
  const commands = [
    { type: 1, name: "legacy" },
    {
      type: 4,
      name: "Launch",
      description: "Start",
      handler: 2,
      integration_types: [0],
      contexts: [0],
      id: "server-id",
    },
  ];
  assert.deepEqual(entryPointCommands(commands), [
    {
      type: 4,
      name: "Launch",
      description: "Start",
      handler: 2,
      integration_types: [0],
      contexts: [0],
    },
  ]);
  assert.deepEqual(entryPointCommands([]), []);
});
