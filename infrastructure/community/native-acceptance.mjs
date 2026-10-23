import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import net from "node:net";
import { chromium, expect } from "@playwright/test";
const listening = (port) =>
  new Promise((done) => {
    const s = net.connect({ host: "127.0.0.1", port });
    s.once("connect", () => {
      s.destroy();
      done(true);
    });
    s.once("error", () => done(false));
  });
assert.equal(
  await listening(4319),
  false,
  "Existing backend must not be interrupted.",
);
assert.equal(
  await listening(9223),
  false,
  "Existing debugger must not be interrupted.",
);
const config = JSON.parse(
  readFileSync(".data/community-native-qa.json", "utf8"),
);
assert.equal(config.identifier, "fr.dofus.companion.qa.community");
const child = spawn(
  resolve(".data/community-native-qa-runtime/dofus-companion.exe"),
  [],
  {
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      WEBVIEW2_USER_DATA_FOLDER: resolve(".data/community-native-qa-webview"),
      COMPANION_QA_PORT: "4319",
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9223",
    },
  },
);
let browser, page;
const checks = [],
  errors = [];
try {
  for (let i = 0; i < 60; i++) {
    assert.equal(child.exitCode, null, "QA app exited during startup");
    if ((await listening(9223)) && (await listening(4319))) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
  page = browser
    .contexts()[0]
    .pages()
    .find(
      (p) =>
        p.url().startsWith("http://tauri.localhost") &&
        !p.url().includes("overlay=1"),
    );
  assert.ok(page);
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(30000);
  const invoke = (cmd, args) =>
    page.evaluate(
      ({ cmd, args }) => window.__TAURI_INTERNALS__.invoke(cmd, args),
      { cmd, args },
    );
  assert.equal(await invoke("plugin:app|identifier"), config.identifier);
  const connection = await invoke("local_connection");
  assert.equal(connection.url, "http://127.0.0.1:4319");
  const request = async (path, body) => {
    const r = await fetch(connection.url + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${connection.token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.ok(r.ok, path);
    return r.json();
  };
  const version = JSON.parse(readFileSync("package.json", "utf8")).version;
  assert.equal((await request("/health")).version, version);
  assert.equal((await fetch(connection.url + "/api/characters")).status, 401);
  await page.getByRole("button", { name: "Übersicht", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Dein nächstes/, level: 1 }),
  ).toBeVisible();
  checks.push(
    "isolated native identifier and WebView startup",
    "bundled backend version and API authorization",
    "dashboard renders",
  );
  const character = (
    await request("/api/characters", {
      name: "Native QA " + Date.now(),
      server: "QA",
      className: "Cra",
      classId: 9,
      level: 123,
    })
  ).data;
  assert.ok(character.id);
  assert.ok(
    (await request("/api/characters")).data.some((c) => c.id === character.id),
  );
  checks.push("native bundled SQLite character persistence");
  await invoke("toggle_overlay");
  await expect
    .poll(() =>
      browser
        .contexts()[0]
        .pages()
        .some((p) => p.url().includes("overlay=1")),
    )
    .toBe(true);
  await invoke("toggle_overlay");
  checks.push("native overlay opens and toggles");
  const personal = page
    .getByRole("button", { name: "Persönlich", exact: false })
    .first();
  const account = page
    .getByRole("button", { name: "Companion-Account", exact: false })
    .first();
  if (!(await account.isVisible()) && (await personal.count()))
    await personal.click();
  await account.click();
  await page.locator('input[type="email"]').waitFor();
  checks.push("native shared Community login renders");
  assert.deepEqual(errors, []);
  mkdirSync("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/community-native.png" });
  const sig = JSON.parse(
    readFileSync("test-results/community-candidate-signature.json", "utf8"),
  );
  writeFileSync(
    "test-results/community-native-acceptance.json",
    JSON.stringify(
      {
        version,
        checkedAt: new Date().toISOString(),
        passed: true,
        checks,
        installerSha256: sig.sha256,
        qaIdentifier: config.identifier,
        userProfileTouched: false,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
} finally {
  if (page) {
    try {
      await page.evaluate(() =>
        window.__TAURI_INTERNALS__.invoke("plugin:window|close", {
          label: "main",
        }),
      );
    } catch {
      /* Native close tears down CDP. */
    }
  }
  if (browser) {
    try {
      await browser.close();
    } catch {
      /* App already exited. */
    }
  }
  if (child.exitCode === null) {
    await Promise.race([
      once(child, "exit"),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
    if (child.exitCode === null) child.kill();
  }
}
