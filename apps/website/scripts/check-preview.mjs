import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const dist = new URL("../dist/", import.meta.url);
const reports = new URL("../../../.data/", import.meta.url);
const base = process.argv[2] || "http://127.0.0.1:4187";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const requests = [],
  errors = [];
page.on("request", (r) => requests.push(r.url()));
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base + "/community/guild");
  await page
    .getByLabel("ZUGANGSPASSWORT", { exact: false })
    .fill("incorrect-preview-password");
  await page
    .getByRole("button", { name: /Zugang|Abenteuer|öffnen|betreten/i })
    .filter({ visible: true })
    .last()
    .click();
  await page.getByText("Dieses Zugangspasswort ist nicht korrekt.").waitFor();
  assert.equal(
    requests.some((u) => /\/assets\/App-.*\.js/.test(u)),
    false,
  );
  await context.addInitScript(() =>
    sessionStorage.setItem("dofus-companion-preview-v1", "granted"),
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "Die Gildenfunktionen folgen." })
    .waitFor();
  for (const route of ["/community/marketplace", "/community/account"]) {
    await page.goto(base + route);
    await page
      .getByRole("heading", { name: "Die Gildenfunktionen folgen." })
      .waitFor();
  }
  for (const route of ["/impressum", "/datenschutz", "/nutzungsbedingungen"]) {
    await page.goto(base + route);
    await page.getByRole("heading", { name: "Hier endet der Weg." }).waitFor();
    assert.equal(
      await page
        .locator(
          'a[href="/impressum"],a[href="/datenschutz"],a[href="/nutzungsbedingungen"],a[href="/community"]',
        )
        .count(),
      0,
    );
  }
  await page.goto(base + "/");
  await page.getByRole("heading", { name: /DEIN ABENTEUER/ }).waitFor();
  await page.goto(base + "/downloads");
  await page
    .getByRole("heading", { name: /Dein nächstes Abenteuer/ })
    .waitFor();
  assert.equal(
    requests.some((u) =>
      /identitytoolkit|securetoken|firestore\.googleapis|firebasestorage\.googleapis|google-analytics/.test(
        u,
      ),
    ),
    false,
  );
  assert.deepEqual(errors, []);
  const r = await fetch(base + "/access-config.json"),
    config = await r.json();
  assert.deepEqual(
    config,
    JSON.parse(readFileSync(new URL("access-config.json", dist), "utf8")),
  );
  if (base.startsWith("https:")) {
    assert.equal(r.headers.get("cache-control").includes("no-store"), true);
    const index = await fetch(base + "/");
    assert.equal(
      await index.text(),
      readFileSync(new URL("index.html", dist), "utf8"),
    );
    assert.equal(index.headers.get("x-robots-tag").includes("noindex"), true);
  }
  const result = {
    checkedAt: new Date().toISOString(),
    base,
    passed: true,
    checks: [
      "wrong password rejected",
      "app lazy until unlock",
      "community unavailable on deep links",
      "legal pages absent",
      "navigation and downloads render",
      "no cloud or analytics requests",
      "unchanged verifier",
      ...(base.startsWith("https:")
        ? [
            "deployed index matches tested build",
            "noindex and no-store headers",
          ]
        : []),
    ],
    positivePassword: "covered by unit test; live password not obtained",
  };
  mkdirSync(reports, { recursive: true });
  writeFileSync(
    new URL(
      "website-preview-" +
        (base.startsWith("https:") ? "live" : "local") +
        ".json",
      reports,
    ),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
