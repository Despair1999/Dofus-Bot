import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const installed = resolve(process.env.LOCALAPPDATA, "DOFUS Companion");
const registry = () =>
  JSON.parse(
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' | Where-Object DisplayName -eq 'DOFUS Companion' | Select-Object DisplayVersion,InstallLocation | ConvertTo-Json -Compress",
      ],
      { encoding: "utf8", windowsHide: true },
    ),
  );
const before = registry();
assert.equal(resolve(before.InstallLocation.replaceAll('"', "")), installed);
assert.equal(before.DisplayVersion, "0.2.3");
await assert.rejects(fetch("http://127.0.0.1:4310/health"));
const fixture = await mkdtemp(resolve(".data/installer-v3-"));
const service = join(installed, "service");
const child = spawn(join(service, "node.exe"), [join(service, "backend.mjs")], {
  cwd: service,
  windowsHide: true,
  stdio: "ignore",
  env: {
    ...process.env,
    DATA_DIR: fixture,
    PORT: "4310",
    HOST: "127.0.0.1",
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
      { timeout: 20000 },
    )
    .toBe("0.2.3");
  const installer = spawn(
    resolve(`artifacts/DOFUS-Companion-${version}-setup.exe`),
    ["/S"],
    { windowsHide: true, stdio: "ignore" },
  );
  const [exitCode] = await once(installer, "exit");
  assert.equal(exitCode, 0);
  const after = registry();
  assert.equal(after.DisplayVersion, version);
  assert.equal(after.InstallLocation, before.InstallLocation);
  await expect.poll(() => child.exitCode).not.toBe(null);
  const report = {
    version,
    testedAt: new Date().toISOString(),
    installerExitCode: exitCode,
    registryVersion: after.DisplayVersion,
    previousInstalledVersion: before.DisplayVersion,
    installedServiceReleased: true,
    installLocationPreserved: true,
    scope:
      "Actual existing installation upgraded with signed NSIS while its old bundled service held node.exe open. Test service used separate SQLite data; installer retains user AppData.",
  };
  await writeFile(
    "docs/installer-transition-v3-test.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  if (child.exitCode === null) {
    const ended = once(child, "exit");
    child.kill();
    await ended;
  }
}
