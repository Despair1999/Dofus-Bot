import { build } from "esbuild";
import {
  mkdir,
  copyFile,
  readFile,
  writeFile,
  readdir,
} from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const resources = resolve(root, "apps/desktop/src-tauri/resources");
if (process.platform !== "win32" || process.arch !== "x64") {
  throw new Error(
    "Das Windows-x64-Paket benötigt einen Windows-x64-Node-Prozess. Für CI windows-latest verwenden.",
  );
}
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 15))
  throw new Error("Node >=22.15 benötigt (node:sqlite).");
await mkdir(resources, { recursive: true });
const result = await build({
  absWorkingDir: root,
  entryPoints: ["apps/backend/src/index.ts"],
  outfile: resolve(resources, "backend.mjs"),
  bundle: true,
  platform: "node",
  target: "node22.15",
  format: "esm",
  packages: "bundle",
  sourcemap: false,
  minify: false,
  legalComments: "eof",
  metafile: true,
  banner: {
    js: 'import { createRequire as __companionCreateRequire } from "node:module"; const require = __companionCreateRequire(import.meta.url);',
  },
});
await copyFile(process.execPath, resolve(resources, "node.exe"));

// Node embeds third-party notices in its release LICENSE. Preserve the exact
// version used for the bundled executable, never substitute a newer release.
const licensePath = resolve(resources, "NODE-LICENSE.txt");
let license;
try {
  const existing = await readFile(
    resolve(dirname(process.execPath), "LICENSE"),
    "utf8",
  );
  if (existing.includes("Node.js is licensed")) license = existing;
} catch {
  /* Windows installers commonly omit a separate LICENSE file. */
}
if (!license) {
  const url = `https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok)
    throw new Error(
      `Node-Lizenz nicht abrufbar (${response.status}). Build abgebrochen.`,
    );
  license = await response.text();
  if (!license.includes("Node.js is licensed"))
    throw new Error("Unerwarteter Inhalt der Node-Lizenz.");
}
await writeFile(licensePath, license);
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  if (!input.includes("node_modules")) continue;
  let folder = dirname(resolve(root, input));
  while (folder !== dirname(folder)) {
    try {
      const manifest = JSON.parse(
        await readFile(resolve(folder, "package.json"), "utf8"),
      );
      if (manifest.name && manifest.version) {
        packages.set(`${manifest.name}@${manifest.version}`, {
          folder,
          manifest,
        });
        break;
      }
    } catch {
      /* Some input files live in directories without a manifest. */
    }
    folder = dirname(folder);
  }
}
const notices = [
  "Dofus Companion Backend – gebündelte Drittanbieter-Lizenzen\n",
];
for (const [name, { folder, manifest }] of [...packages].sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  notices.push(
    `\n${"=".repeat(72)}\n${name}\nSPDX-Ausdruck laut Paket: ${manifest.license ?? "nicht angegeben"}\n`,
  );
  const files = (await readdir(folder)).filter((file) =>
    /^(license|licence|copying|notice)(\.|$)/i.test(file),
  );
  for (const file of files) {
    try {
      notices.push(
        `\n--- ${file} ---\n${await readFile(resolve(folder, file), "utf8")}\n`,
      );
    } catch {
      /* A directory named LICENSE is not a license text file. */
    }
  }
  if (!files.length)
    notices.push(
      "Kein gesonderter Lizenztext im veröffentlichten Paket enthalten.\n",
    );
}
await writeFile(resolve(resources, "BACKEND-LICENSES.txt"), notices.join(""));
await writeFile(
  resolve(resources, "backend-build.json"),
  JSON.stringify(
    {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      builtAt: new Date().toISOString(),
      inputs: Object.keys(result.metafile.inputs),
    },
    null,
    2,
  ),
);
console.log(
  `Backend und Node ${process.version} für Windows x64 gebündelt: ${resources}`,
);
