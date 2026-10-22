import { cp, access, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = resolve(root, ".data/translator-runtime");
const target = resolve(root, "apps/desktop/src-tauri/resources/translator");
try {
  await access(resolve(source, "python.exe"));
  await access(resolve(source, "companion-deps/ctranslate2/__init__.py"));
} catch {
  throw new Error(
    "Übersetzungsruntime fehlt. infrastructure/scripts/setup-translator.ps1 vor dem Windows-Build ausführen.",
  );
}
await cp(source, target, {
  recursive: true,
  force: true,
  filter: (path) => !path.includes("__pycache__"),
});
await cp(
  resolve(root, "apps/backend/runtime/translator.py"),
  resolve(target, "translator.py"),
);
await writeFile(
  resolve(target, "COMPANION-TRANSLATOR.txt"),
  `Offline translation runtime\nPython runtime: Python Software Foundation license (bundled LICENSE*)\nCTranslate2 4.8.0: MIT (bundled dist-info/licenses)\nSentencePiece 0.2.1: Apache-2.0 (bundled dist-info/licenses)\nNumPy 2.4.6: BSD-3-Clause (bundled dist-info/licenses)\nPyYAML 6.0.3: MIT\nSetuptools 84.2.1: MIT\nArgos models are NOT redistributed in this installer. User-initiated downloads from official Argos URLs. Model-provided metadata, README and licenses remain with installed packages.\n`,
);
console.log(
  "Übersetzungsruntime einschließlich Python und Bibliotheken gebündelt.",
);
