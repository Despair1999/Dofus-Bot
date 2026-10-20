/** Real local OCR smoke test. First run downloads language data; images are processed locally. */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { matchText, normalize } from "../../apps/desktop/src/matching.js";
const require = createRequire(
  new URL("../../apps/desktop/package.json", import.meta.url),
);
const { createWorker, PSM } = require("tesseract.js");
const root = dirname(fileURLToPath(import.meta.url));
const cachePath = resolve(".data/ocr-models");
mkdirSync(cachePath, { recursive: true });
const candidates = [
  { id: 1, name: "Prüfung des Schülers", nameFr: "Épreuve de l’élève" },
  { id: 2, name: "Eine andere Aufgabe" },
];
const results: unknown[] = [];
for (const [fixture, lang, expected] of [
  ["de", "deu", "Prüfung des Schülers"],
  ["fr", "fra", "Épreuve de l’élève"],
] as const) {
  const started = Date.now();
  console.log(
    `Local OCR ${lang}; first run may download language model into ${cachePath}`,
  );
  const worker = await createWorker(lang, 1, {
    cachePath,
    ...(process.argv.includes("--offline")
      ? { langPath: "http://127.0.0.1:9/disabled" }
      : {}),
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const result = await worker.recognize(
      join(root, "fixtures", fixture + ".png"),
    );
    const hits = matchText(result.data.text, candidates);
    assert.ok(
      normalize(result.data.text).includes(normalize(expected)),
      `Expected title missing: ${result.data.text}`,
    );
    assert.equal(hits[0]?.id, 1, "Wrong recognized candidate");
    const blank = await worker.recognize(join(root, "fixtures", "blank.png"));
    assert.equal(matchText(blank.data.text, candidates).length, 0);
    const entry = {
      fixture: fixture + ".png",
      lang,
      synthetic: true,
      text: result.data.text,
      confidence: result.data.confidence,
      matchedId: hits[0]?.id,
      similarity: hits[0]?.score,
      blankText: blank.data.text,
      elapsedMs: Date.now() - started,
    };
    results.push(entry);
    console.log(JSON.stringify(entry));
  } finally {
    await worker.terminate();
  }
}
writeFileSync(
  join(root, "last-result.json"),
  JSON.stringify(
    {
      executedAt: new Date().toISOString(),
      engine: "tesseract.js 6, local WASM",
      offline: process.argv.includes("--offline"),
      results,
    },
    null,
    2,
  ),
);
console.log(
  "PASS: German and French local OCR; blank images do not identify quests.",
);
