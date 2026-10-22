import { spawn, execFileSync } from "node:child_process";
import { access, mkdtemp, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { chromium } from "@playwright/test";
import net from "node:net";
import assert from "node:assert/strict";

const nativeProcesses = execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-Command",
    "@(Get-Process dofus-companion -ErrorAction SilentlyContinue).Count",
  ],
  { windowsHide: true, encoding: "utf8" },
).trim();
const listening = (port) =>
  new Promise((done) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      done(true);
    });
    socket.once("error", () => done(false));
  });
if (
  nativeProcesses !== "0" ||
  (await listening(4310)) ||
  (await listening(9223))
) {
  const report = {
    version: JSON.parse(
      await (await import("node:fs/promises")).readFile("package.json", "utf8"),
    ).version,
    testedAt: new Date().toISOString(),
    skipped: true,
    reason:
      "Existing user Companion process or listener on 4310/9223; no user process was changed",
    passed: [],
  };
  await writeFile(
    "docs/native-v8-test.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
  process.exit(0);
}
if (!process.env.COMPANION_NATIVE_QA) {
  throw Error(
    "Native V8 validation requires an explicitly built QA-identifier executable; productive user profiles must remain untouched.",
  );
}
const executable = resolve(
  process.env.COMPANION_NATIVE_EXE ??
    ".data/portable-0.8.0/dofus-companion.exe",
);
await access(executable);
await access(resolve(dirname(executable), "service/translator/python.exe"));
const fixture = await mkdtemp(resolve(".data/native-v8-"));
const child = spawn(executable, [], {
  windowsHide: true,
  stdio: "ignore",
  env: {
    ...process.env,
    COMPANION_TRANSLATOR_MODELS: resolve(".data/translation-models"),
    WEBVIEW2_USER_DATA_FOLDER: resolve(fixture, "webview"),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9223",
  },
});
let testCode = null;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null)
      throw new Error(`Native app exited before readiness: ${child.exitCode}`);
    if ((await listening(9223)) && (await listening(4310))) break;
    await new Promise((done) => setTimeout(done, 1000));
  }
  assert.equal(await listening(9223), true, "CDP did not become ready");
  const runner = spawn(
    process.execPath,
    [resolve("infrastructure/scripts/native-v8-smoke.mjs")],
    { windowsHide: true, stdio: "inherit", env: process.env },
  );
  testCode = await new Promise((done) => runner.once("exit", done));
} finally {
  try {
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
    const page = browser
      .contexts()[0]
      .pages()
      .find(
        (p) =>
          p.url().startsWith("http://tauri.localhost") &&
          !p.url().includes("overlay=1"),
      );
    await page
      ?.evaluate(() =>
        window.__TAURI_INTERNALS__.invoke("plugin:window|close", {
          label: "main",
        }),
      )
      .catch(() => {});
    await browser.close().catch(() => {});
  } catch {
    /* app may already have closed */
  }
  for (let attempt = 0; attempt < 15 && child.exitCode === null; attempt++)
    await new Promise((done) => setTimeout(done, 1000));
  if (child.exitCode === null) child.kill();
  for (let attempt = 0; attempt < 15 && (await listening(4310)); attempt++)
    await new Promise((done) => setTimeout(done, 1000));
  const backendStopped = !(await listening(4310));
  const workerCount = execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $env:COMPANION_SMOKE_PYTHON }).Count",
    ],
    {
      windowsHide: true,
      encoding: "utf8",
      env: {
        ...process.env,
        COMPANION_SMOKE_PYTHON: resolve(
          dirname(executable),
          "service/translator/python.exe",
        ),
      },
    },
  ).trim();
  await writeFile(
    resolve(fixture, "lifecycle.json"),
    JSON.stringify(
      {
        nativePid: child.pid,
        testExitCode: testCode,
        backendStopped,
        workerProcessesRemaining: Number(workerCount),
        onlyOwnedNativeProcessStopped: true,
      },
      null,
      2,
    ),
  );
  await writeFile(
    "docs/native-v8-lifecycle.json",
    JSON.stringify(
      {
        version: JSON.parse(
          await (
            await import("node:fs/promises")
          ).readFile("package.json", "utf8"),
        ).version,
        testedAt: new Date().toISOString(),
        backendStopped,
        workerProcessesRemaining: Number(workerCount),
        onlyOwnedNativeProcessStopped: true,
      },
      null,
      2,
    ) + "\n",
  );
  assert.equal(
    backendStopped,
    true,
    "Owned backend must stop with packaged native app",
  );
  assert.equal(
    workerCount,
    "0",
    "Owned translator worker must stop with native app",
  );
}
assert.equal(testCode, 0, "Native v8 smoke failed");
console.log("Native v8 smoke and owned-backend shutdown passed.");
