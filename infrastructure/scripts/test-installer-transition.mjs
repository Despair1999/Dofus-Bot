import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { expect } from "@playwright/test";
const version = JSON.parse(await readFile("package.json", "utf8")).version;
await expect
  .poll(
    async () => {
      try {
        await fetch("http://127.0.0.1:4310/health");
        return false;
      } catch {
        return true;
      }
    },
    { timeout: 15000 },
  )
  .toBe(true);
const fixture = await mkdtemp(resolve(".data/installer-service-"));
const service = resolve(".data/upgrade-install/service");
const child = spawn(join(service, "node.exe"), [join(service, "backend.mjs")], {
  windowsHide: true,
  stdio: "ignore",
  env: {
    ...process.env,
    DATA_DIR: fixture,
    HOST: "127.0.0.1",
    PORT: "4310",
    COMPANION_TOKEN: randomUUID() + randomUUID(),
    COMPANION_CATALOG_SEED: "",
  },
});
try {
  await expect
    .poll(
      async () => {
        try {
          return (await (await fetch("http://127.0.0.1:4310/health")).json())
            .version;
        } catch {
          return "";
        }
      },
      { timeout: 15000 },
    )
    .toBe("0.1.0");
  const installer = spawn(
    resolve(
      `apps/desktop/src-tauri/target/release/bundle/nsis/DOFUS Companion_${version}_x64-setup.exe`,
    ),
    ["/S"],
    { windowsHide: true, stdio: "ignore" },
  );
  const [exitCode] = await once(installer, "exit");
  assert.equal(exitCode, 0);
  const registry = execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' | Where-Object DisplayName -eq 'DOFUS Companion').DisplayVersion",
    ],
    { windowsHide: true, encoding: "utf8" },
  ).trim();
  assert.equal(
    registry,
    version,
    "Installer must complete registry stage, not only replace the EXE",
  );
  await expect.poll(() => child.exitCode).not.toBe(null);
  const report = {
    testedAt: new Date().toISOString(),
    version,
    scope:
      "Real silent NSIS installer with a controlled v0.1 service locking the installed node.exe; service data isolated from user databases",
    installerExitCode: exitCode,
    registryVersion: registry,
    legacyServiceReleased: true,
    preinstallGuardCompleted: true,
  };
  await writeFile(
    "docs/installer-transition-v2-test.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  if (child.exitCode === null) {
    const ended = once(child, "exit");
    child.kill();
    await ended;
  }
}
