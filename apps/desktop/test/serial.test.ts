import { test } from "node:test";
import assert from "node:assert/strict";
import { createSerialQueue } from "../src/serial";
test("rapid window requests wait for earlier native transitions", async () => {
  const queue = createSerialQueue();
  const order: string[] = [];
  let unlock!: () => void;
  const gate = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  const first = queue(async () => {
    order.push("compact-start");
    await gate;
    order.push("compact-end");
  });
  const second = queue(async () => {
    order.push("dashboard");
  });
  const third = queue(async () => {
    order.push("hotbar");
  });
  await Promise.resolve();
  assert.deepEqual(order, ["compact-start"]);
  unlock();
  await Promise.all([first, second, third]);
  assert.deepEqual(order, [
    "compact-start",
    "compact-end",
    "dashboard",
    "hotbar",
  ]);
});
test("a failed native operation does not block later requests", async () => {
  const queue = createSerialQueue();
  await assert.rejects(
    queue(async () => {
      throw new Error("native");
    }),
  );
  let ran = false;
  await queue(async () => {
    ran = true;
  });
  assert.equal(ran, true);
});
