// Read-only acceptance: installed v0.3 checks the actual signed release channel.
// No downloadAndInstall call and no installer execution.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
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
const running = execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-Command",
    "@(Get-Process dofus-companion -ErrorAction SilentlyContinue).Count",
  ],
  { windowsHide: true, encoding: "utf8" },
).trim();
if (running !== "0" || (await listening(4310)) || (await listening(9223))) {
  console.log("Skipped: another Companion is running; no process changed.");
  process.exit(0);
}
const fixture = await mkdtemp(resolve(".data/update-check-v4-"));
const executable = join(
  process.env.LOCALAPPDATA,
  "DOFUS Companion",
  "dofus-companion.exe",
);
const child = spawn(executable, [], {
  windowsHide: true,
  stdio: "ignore",
  env: {
    ...process.env,
    WEBVIEW2_USER_DATA_FOLDER: join(fixture, "webview"),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9223",
  },
});
let browser, page;
try {
  await expect
    .poll(
      async () => {
        if (child.exitCode !== null)
          throw Error("Installed application ended early");
        return (await listening(9223)) && (await listening(4310));
      },
      { timeout: 30000 },
    )
    .toBe(true);
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
  await page.waitForFunction(() => !!window.__TAURI_INTERNALS__);
  const current = await page.evaluate(() =>
    window.__TAURI_INTERNALS__.invoke("plugin:app|version"),
  );
  assert.equal(current, "0.3.0");
  const update = await page.evaluate(() =>
    window.__TAURI_INTERNALS__.invoke("plugin:updater|check", {
      timeout: 30000,
    }),
  );
  assert.equal(update.version, "0.4.0");
  assert.equal(update.currentVersion, "0.3.0");
  const report = {
    testedAt: new Date().toISOString(),
    fromVersion: current,
    toVersion: update.version,
    actualInstalledUpdaterRecognizesRelease: true,
    installerExecuted: false,
    release: "https://github.com/Despair1999/Dofus-Bot/releases/tag/v0.4.0",
    scope:
      "Read-only check by actual installed Tauri v0.3 against configured published HTTPS update channel; no automatic installation",
  };
  await writeFile(
    "docs/update-v4-channel-test.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  if (page)
    await page
      .evaluate(() =>
        window.__TAURI_INTERNALS__.invoke("plugin:window|close", {
          label: "main",
        }),
      )
      .catch(() => {});
  if (browser) await browser.close().catch(() => {});
  for (let i = 0; i < 15 && child.exitCode === null; i++)
    await new Promise((done) => setTimeout(done, 500));
  if (child.exitCode === null) child.kill();
}
