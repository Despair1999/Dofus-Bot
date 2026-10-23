import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, writeFile, open } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import net from "node:net";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
{
  const s = net.connect({ host: "127.0.0.1", port: 1420 });
  await new Promise((done, reject) => {
    s.once("connect", () => {
      s.destroy();
      reject(
        Error(
          "Existing desktop development server on 1420; refusing to touch it.",
        ),
      );
    });
    s.once("error", done);
  });
}
const dir = await mkdtemp(resolve(".data/community-regression-")),
  token = randomUUID() + randomUUID(),
  tokenPath = join(dir, "test-token");
await writeFile(tokenPath, token);
const listener = net.createServer();
listener.listen(0, "127.0.0.1");
await once(listener, "listening");
const port = listener.address().port;
await new Promise((r) => listener.close(r));
const service = resolve("apps/desktop/src-tauri/resources"),
  log = await open(join(dir, "servers.log"), "w");
const backend = spawn(join(service, "node.exe"), ["backend.mjs"], {
  cwd: service,
  windowsHide: true,
  stdio: ["ignore", log.fd, log.fd],
  env: {
    ...process.env,
    DATA_DIR: dir,
    PORT: String(port),
    HOST: "127.0.0.1",
    COMPANION_TOKEN: token,
    COMPANION_CATALOG_SEED: join(service, "catalog-seed.sqlite"),
    COMPANION_TRANSLATOR_MODELS: resolve(".data/translation-models"),
  },
});
const windows = process.platform === "win32",
  pnpm = windows ? "pnpm.cmd" : "pnpm";
const vite = spawn(
  pnpm,
  [
    "--filter",
    "@dofus/desktop",
    "exec",
    "vite",
    "--host",
    "127.0.0.1",
    "--port",
    "1420",
    "--strictPort",
  ],
  { shell: windows, windowsHide: true, stdio: ["ignore", log.fd, log.fd] },
);
async function ready(url) {
  for (let i = 0; i < 120; i++) {
    if (backend.exitCode !== null || vite.exitCode !== null)
      throw Error("Isolated regression server exited; inspect " + dir);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw Error("Server readiness timeout.");
}
let code;
try {
  await ready(`http://127.0.0.1:${port}/health`);
  await ready("http://127.0.0.1:1420");
  const status = await (
    await fetch(`http://127.0.0.1:${port}/api/catalog/status`)
  ).json();
  assert.ok(status.data.itemCount > 20000);
  // Compile the cold Vite dependency graph before starting per-test time budgets.
  const warmBrowser = await chromium.launch({ headless: true });
  try {
    const warmPage = await warmBrowser.newPage();
    await warmPage.goto("http://127.0.0.1:1420", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
  } finally {
    await warmBrowser.close();
  }
  const tests = spawn(
    pnpm,
    [
      "exec",
      "playwright",
      "test",
      ...(process.argv.includes("--last-failed") ? ["--last-failed"] : []),
    ],
    {
      shell: windows,
      windowsHide: true,
      stdio: "inherit",
      env: {
        ...process.env,
        COMPANION_E2E_BACKEND: `http://127.0.0.1:${port}`,
        COMPANION_E2E_TOKEN_FILE: tokenPath,
      },
    },
  );
  [code] = await once(tests, "exit");
} finally {
  backend.kill();
  if (windows && vite.exitCode === null)
    execFileSync("taskkill", ["/PID", String(vite.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  else vite.kill();
  await log.close();
}
process.exit(code ?? 1);
