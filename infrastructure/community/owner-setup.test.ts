import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
test("local owner setup rejects remote origins and missing secrets without contacting Firebase", async () => {
  const child = spawn(
    process.execPath,
    ["infrastructure/community/owner-setup.mjs"],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  try {
    const url = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Local setup startup timeout")),
        5000,
      );
      child.stdout.on("data", (data) => {
        const match = String(data).match(
          /http:\/\/127\.0\.0\.1:\d+\/\?token=[a-f0-9]+/,
        );
        if (match) {
          clearTimeout(timer);
          resolve(match[0]);
        }
      });
      child.once("error", reject);
    });
    const origin = new URL(url).origin,
      token = new URL(url).searchParams.get("token")!;
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(origin)).status, 403);
    assert.equal(
      (
        await fetch(origin + "/create", {
          method: "POST",
          headers: {
            Origin: "https://attacker.invalid",
            "X-Setup-Token": token,
          },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(origin + "/create", {
          method: "POST",
          headers: { Origin: origin },
          body: "{}",
        })
      ).status,
      403,
    );
    const invalid = await fetch(origin + "/create", {
      method: "POST",
      headers: { Origin: origin, "X-Setup-Token": token },
      body: JSON.stringify({ password: "short" }),
    });
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).error, /12 bis 128/);
  } finally {
    child.kill();
  }
});
