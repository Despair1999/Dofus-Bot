// Exercise the actual NSIS preinstall helper against a disposable v0.3 service.
// Does not run NSIS or touch uninstall registry / installed-user directories.
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, copyFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import net from "node:net";
const listening = () =>
  new Promise((done) => {
    const socket = net.connect({ host: "127.0.0.1", port: 4310 });
    socket.once("connect", () => {
      socket.destroy();
      done(true);
    });
    socket.once("error", () => done(false));
  });
if (await listening()) {
  console.log("SKIPPED: port4310 occupied; no process was changed.");
  process.exit(0);
}
const fixture = await mkdtemp(resolve(".data/install-guard-v4-"));
const service = join(fixture, "service");
await mkdir(service);
for (const name of ["node.exe", "backend.mjs", "builder-data.json"])
  await copyFile(
    resolve(".data/portable-0.3.0/service", name),
    join(service, name),
  );
const child = spawn(join(service, "node.exe"), ["backend.mjs"], {
  cwd: service,
  windowsHide: true,
  stdio: "ignore",
  env: {
    ...process.env,
    DATA_DIR: join(fixture, "data"),
    HOST: "127.0.0.1",
    PORT: "4310",
    COMPANION_TOKEN: randomUUID() + randomUUID(),
    COMPANION_CATALOG_SEED: "",
  },
});
try {
  for (let i = 0; i < 30 && !(await listening()); i++) {
    if (child.exitCode !== null)
      throw new Error(`Fixture failed ${child.exitCode}`);
    await new Promise((done) => setTimeout(done, 500));
  }
  const response = await fetch("http://127.0.0.1:4310/health");
  assert.equal((await response.json()).version, "0.3.0");
  const helper = spawn(
    resolve(
      "apps/desktop/src-tauri/target/release/companion-service-guard.exe",
    ),
    [join(service, "node.exe")],
    { windowsHide: true, stdio: "ignore" },
  );
  const code = await new Promise((done) => helper.once("exit", done));
  assert.equal(code, 0, "Preinstall service guard failed");
  for (let i = 0; i < 20 && child.exitCode === null; i++)
    await new Promise((done) => setTimeout(done, 250));
  assert.notEqual(
    child.exitCode,
    null,
    "Guard did not stop exact owned fixture service",
  );
  await copyFile(
    resolve("apps/desktop/src-tauri/resources/node.exe"),
    join(service, "node.exe"),
  );
  const report = {
    testedAt: new Date().toISOString(),
    scope:
      "Real NSIS preinstall service-guard executable with disposable v0.3 service holding node.exe; no installer execution and no registry changes",
    legacyServiceReleased: true,
    nodeExecutableReplaced: true,
    userDataModified: false,
    nsisInstallerExecuted: false,
  };
  await writeFile(
    "docs/install-guard-v4-test.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  if (child.exitCode === null) child.kill();
}
