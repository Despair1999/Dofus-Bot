import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const base = process.argv[2] ?? "http://127.0.0.1:4187",
  browser = await chromium.launch({ headless: true });
const context = await browser.newContext(),
  page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  for (const path of ["/impressum", "/datenschutz", "/nutzungsbedingungen"]) {
    await page.goto(base + path);
    await page.getByText("Niklas Peter", { exact: false }).waitFor();
    const contact = await page.locator("address").innerText();
    assert.equal(
      contact.replace(/\r/g, ""),
      "DOFUS Companion\nNiklas Peter\nKoblenzer Straße, 54411 Hermeskeil\nE-Mail: sunbired@gmail.com",
    );
    assert.equal(
      await page.locator("#gate-password").count(),
      0,
      "Legal information must be available before the preview password.",
    );
    assert.equal(
      await page.locator('a[href="mailto:sunbired@gmail.com"]').count(),
      1,
    );
  }
  await page.goto(base + "/community/account");
  await page.getByLabel("ZUGANGSPASSWORT", { exact: false }).waitFor();
  await context.addInitScript(() =>
    sessionStorage.setItem("dofus-companion-preview-v1", "granted"),
  );
  await page.reload();
  await page.locator('input[type="email"]').waitFor();
  assert.ok(
    await page
      .getByRole("navigation", { name: "Community", exact: true })
      .count(),
  );
  assert.equal(
    await page
      .getByRole("heading", { name: "Die Gildenfunktionen folgen." })
      .count(),
    0,
  );
  const resources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((r) => r.name),
  );
  assert.equal(
    resources.some((u) => /builder-catalog/.test(u)),
    false,
    "Heavy builder data must be lazy.",
  );
  assert.deepEqual(errors, []);
  const config = await (await fetch(base + "/access-config.json")).json();
  assert.deepEqual(
    config,
    JSON.parse(
      readFileSync(
        new URL("../dist/access-config.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const response = await fetch(base + "/");
  assert.equal(
    await response.text(),
    readFileSync(new URL("../dist/index.html", import.meta.url), "utf8"),
  );
  const report = {
    checkedAt: new Date().toISOString(),
    base,
    passed: true,
    checks: [
      "exact operator data",
      "legal pages before password",
      "mailto contact",
      "website password retained",
      "full community login mounts",
      "builder catalog remains lazy",
      "no page errors",
      "HTML and verifier match tested build",
    ],
  };
  const folder = new URL("../../../.data/", import.meta.url);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    new URL(
      "community-website-" +
        (base.startsWith("https:") ? "live" : "local") +
        ".json",
      folder,
    ),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
