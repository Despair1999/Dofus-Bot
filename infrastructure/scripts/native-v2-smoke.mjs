import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { spawnSync, spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const endpoint = "http://127.0.0.1:9223";
const passed = [];
passed.push = (...values) => {
  console.log(...values);
  return Array.prototype.push.apply(passed, values);
};
function key(keys) {
  const down = keys
    .map((k) => `[CompanionKeyTest]::keybd_event(${k},0,0,[UIntPtr]::Zero);`)
    .join("");
  const up = [...keys]
    .reverse()
    .map((k) => `[CompanionKeyTest]::keybd_event(${k},0,2,[UIntPtr]::Zero);`)
    .join("");
  const code = `Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public static class CompanionKeyTest { [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, System.UIntPtr extra); }'; ${down}${up}`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", code], {
    windowsHide: true,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error("Windows keyboard test failed");
}
let browser = await chromium.connectOverCDP(endpoint);
let page = browser
  .contexts()[0]
  .pages()
  .find(
    (p) =>
      p.url().startsWith("http://tauri.localhost") &&
      !p.url().includes("overlay=1"),
  );
page.setDefaultTimeout(10000);
const invoke = (cmd, args) =>
  page.evaluate(
    ({ cmd, args }) => window.__TAURI_INTERNALS__.invoke(cmd, args),
    { cmd, args },
  );
const original = await invoke("native_settings");
assert.equal(original.startupError, null);
assert.equal(original.recoveryRegistered, true);
passed.push("native startup and global hotkey registration");
const catalog = await (
  await fetch("http://127.0.0.1:4310/api/catalog/status")
).json();
assert.ok(catalog.data.itemCount > 20000);
passed.push("bundled catalog activated automatically");
await invoke("toggle_overlay");
if (await invoke("plugin:window|is_visible", { label: "overlay" }))
  await invoke("toggle_overlay");
key([0x77]);
await expect
  .poll(() => invoke("plugin:window|is_visible", { label: "overlay" }))
  .toBe(true);
key([0x77]);
await expect
  .poll(() => invoke("plugin:window|is_visible", { label: "overlay" }))
  .toBe(false);
passed.push("actual Windows F8 toggles independent overlay on and off");
await invoke("toggle_overlay");
const changed = structuredClone(original.settings);
changed.overlay.width = 480;
changed.overlay.x = 100;
changed.overlay.y = 100;
changed.overlay.clickThrough = true;
await invoke("save_native_settings", { settings: changed });
key([0x11, 0x12, 0x10, 0x4f]);
await expect
  .poll(
    async () => (await invoke("native_settings")).settings.overlay.clickThrough,
  )
  .toBe(false);
await expect(page).toHaveURL(/#\/settings/);
passed.push(
  "actual Windows recovery chord disables click-through and opens settings",
);
const opacity = page.getByLabel(/^Deckkraft /);
await expect(opacity).toBeVisible();
const previousOpacity = await opacity.inputValue();
await opacity.fill("73");
await page
  .getByRole("button", { name: "Overlay & Hotkeys speichern", exact: true })
  .click();
await page.reload();
await expect(opacity).toHaveValue("73");
passed.push("overlay opacity and native geometry persist after reload");
await invoke("toggle_overlay");
const overlay = browser
  .contexts()[0]
  .pages()
  .find((p) => p.url().includes("overlay=1"));
await overlay.screenshot({ path: "artifacts/v2-native-overlay.png" });
await page.screenshot({
  path: "artifacts/v2-native-settings.png",
  fullPage: true,
});
// Closing main must also end its hidden overlay and owned service.
await invoke("plugin:window|close", { label: "main" }).catch(() => {});
await browser.close().catch(() => {});
await expect
  .poll(async () => {
    try {
      await fetch(endpoint + "/json/version");
      return false;
    } catch {
      return true;
    }
  })
  .toBe(true);
await expect
  .poll(async () => {
    try {
      await fetch("http://127.0.0.1:4310/health");
      return false;
    } catch {
      return true;
    }
  })
  .toBe(true);
passed.push("closing main also stops overlay and its own backend");
const child = spawn(resolve(".data/portable-0.2.0/dofus-companion.exe"), [], {
  windowsHide: true,
  detached: true,
  stdio: "ignore",
  env: {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9223",
  },
});
child.unref();
await expect
  .poll(async () => {
    try {
      return (await fetch(endpoint + "/json/version")).ok;
    } catch {
      return false;
    }
  })
  .toBe(true);
browser = await chromium.connectOverCDP(endpoint);
await expect
  .poll(() =>
    browser
      .contexts()[0]
      .pages()
      .some(
        (p) =>
          p.url().startsWith("http://tauri.localhost") &&
          !p.url().includes("overlay=1"),
      ),
  )
  .toBe(true);
page = browser
  .contexts()[0]
  .pages()
  .find(
    (p) =>
      p.url().startsWith("http://tauri.localhost") &&
      !p.url().includes("overlay=1"),
  );
page.setDefaultTimeout(10000);
await page.waitForLoadState("domcontentloaded");
await expect
  .poll(async () => {
    try {
      return await page.evaluate(() => !!window.__TAURI_INTERNALS__?.invoke);
    } catch {
      return false;
    }
  })
  .toBe(true);
assert.equal((await invoke("native_settings")).settings.overlay.width, 480);
await page.goto("http://tauri.localhost/#/settings");
await expect(page.getByLabel(/^Deckkraft /)).toHaveValue("73");
passed.push(
  "overlay settings and SQL layout survive full native process restart",
);
await page.getByLabel(/^Deckkraft /).fill(previousOpacity);
await page
  .getByRole("button", { name: "Overlay & Hotkeys speichern", exact: true })
  .click();
await invoke("save_native_settings", { settings: original.settings });
await invoke("plugin:window|close", { label: "main" }).catch(() => {});
await browser.close().catch(() => {});
await writeFile(
  "docs/native-v2-test.json",
  JSON.stringify(
    {
      testedAt: new Date().toISOString(),
      runtime: "Windows x64 / Tauri / WebView2",
      passed,
      notTested: [
        "physical multi-monitor movement",
        "all DPI scales",
        "actual DOFUS screenshots",
      ],
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ passed }));
