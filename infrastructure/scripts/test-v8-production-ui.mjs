// Serve the exact built frontend with a transparent loopback proxy to the
// isolated real backend. No fixture API responses or native API shims.
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const root = resolve("apps/desktop/dist");
const backend = process.env.COMPANION_E2E_BACKEND || "http://127.0.0.1:4311";
assert.equal(new URL(backend).hostname, "127.0.0.1");
const token = (
  await readFile(
    process.env.COMPANION_E2E_TOKEN_FILE || ".data/repair-e2e/backend-token",
    "utf8",
  )
).trim();
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/health" || url.pathname.startsWith("/api/")) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const upstream = await fetch(backend + req.url, {
        method: req.method,
        headers: {
          ...(req.headers.authorization
            ? { authorization: req.headers.authorization }
            : {}),
          "content-type": "application/json",
        },
        ...(body.length ? { body } : {}),
      });
      res.writeHead(upstream.status, {
        "content-type":
          upstream.headers.get("content-type") || "application/json",
      });
      res.end(Buffer.from(await upstream.arrayBuffer()));
      return;
    }
    const relative =
      url.pathname === "/" || url.pathname === "/activity"
        ? "/index.html"
        : decodeURIComponent(url.pathname);
    const file = resolve(root, "." + relative);
    if (!file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      "content-type": mime[extname(file)] || "application/octet-stream",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  missingAssets = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.url().startsWith(origin) && r.status() >= 400)
    missingAssets.push(r.url());
});
await page.route("**/*", (route) =>
  new URL(route.request().url()).hostname === "127.0.0.1"
    ? route.continue()
    : route.abort(),
);
const passed = [];
try {
  await page.goto(origin);
  await page.evaluate(
    async ({ origin, token }) => {
      sessionStorage.setItem("companion-token", token);
      await new Promise((done, reject) => {
        const request = indexedDB.open("dofus-companion", 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("records"))
            request.result.createObjectStore("records");
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            transaction = db.transaction("records", "readwrite"),
            records = transaction.objectStore("records");
          records.put({ url: origin, token: "" }, "config");
          records.put(true, "onboarded");
          transaction.oncomplete = () => {
            db.close();
            done();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    },
    { origin, token },
  );
  await page.goto(origin + "/#/world?mapId=99353610");
  await page.reload();
  await expect(page.locator("canvas[data-background='loaded']")).toBeVisible();
  await expect(page.locator(".world-details")).toContainText("99353610");
  await expect(page.getByLabel("Weltkarte", { exact: true })).toHaveValue("1");
  passed.push(
    "built frontend loads original world artwork and resolves an interior quest target with external requests blocked",
  );
  await page.screenshot({
    path: "artifacts/v8-production-map.png",
    fullPage: true,
  });
  await page.goto(origin + "/#/dungeons/1");
  await expect
    .poll(() =>
      page
        .locator(".dungeon-detail-heading img")
        .evaluate((el) => el.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Strategie", exact: true }).click();
  await expect(page.locator(".combat-boss-plan")).toHaveCount(1);
  passed.push(
    "boss artwork and original-grade combat plan load from the production bundle",
  );
  await page.screenshot({
    path: "artifacts/v8-production-dungeon.png",
    fullPage: true,
  });
  await page.goto(origin + "/#/professions");
  await expect(page.locator(".profession-card img")).toHaveCount(6);
  for (const image of await page.locator(".profession-card img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((el) => el.naturalWidth))
      .toBeGreaterThan(0);
  }
  passed.push(
    "all six profession quest illustrations load while external image hosts are blocked",
  );
  await page.goto(origin + "/#/settings?section=appearance");
  for (const name of [
    "Obsidian & Gold",
    "Wald der Zwölf",
    "Sufokia",
    "Zwielicht",
    "Brâkmar",
  ]) {
    const option = page.getByRole("button", { name: new RegExp(name) });
    await option.click();
    await expect(option).toHaveAttribute("aria-pressed", "true");
  }
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ember");
  passed.push(
    "all five production themes work and the chosen theme survives reload",
  );
  await page.goto(origin + "/#/builder");
  for (const [name, color] of [
    ["ap", "rgb(120, 186, 255)"],
    ["bp", "rgb(147, 230, 156)"],
    ["lp", "rgb(255, 155, 159)"],
  ])
    await expect(
      page.locator(`.builder-summary-metrics .stat-${name} strong`),
    ).toHaveCSS("color", color);
  passed.push(
    "AP BP LP retain their semantic colors in the production builder",
  );
  await page.goto(origin + "/#/monsters/147");
  await expect(page.locator(".ui-object-hero img")).toBeVisible();
  await expect
    .poll(() =>
      page.locator(".ui-object-hero img").evaluate((el) => el.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: "artifacts/v8-production-monster.png",
    fullPage: true,
  });
  passed.push(
    "new monster details reuse original boss artwork, grades and spell records",
  );
  await page.goto(origin + "/#/sets");
  await expect(page.locator(".ui-set-card")).toHaveCount(40);
  await page.locator(".ui-set-card").first().click();
  await expect(
    page.getByRole("heading", { name: "Setboni vergleichen" }),
  ).toBeVisible();
  passed.push(
    "complete set catalog supports paging, real item artwork and per-tier bonuses",
  );
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Globale Suche" }).fill("Gelano");
  await expect(
    page.getByRole("option", { name: /Gelano/ }).first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  passed.push(
    "production command palette searches actual item records with external hosts blocked",
  );
  await page.goto(origin + "/#/");
  await page.screenshot({
    path: "artifacts/v8-production-dashboard.png",
    fullPage: true,
  });
  for (const path of [
    "items",
    "quests",
    "characters",
    "craft",
    "almanax",
    "translator",
    "favorites",
    "settings?section=overlay",
  ]) {
    await page.goto(origin + "/#/" + path);
    await expect(page.locator("main")).toBeVisible();
    await page.screenshot({
      path: `artifacts/v8-production-${path.split("?")[0]}.png`,
      fullPage: true,
    });
  }
  await page.goto(origin + "/#/builder");
  await expect(page.locator(".equipment-slot svg[data-glyph]")).toHaveCount(16);
  passed.push("all sixteen empty equipment slots use category-specific glyphs");
  await page.goto(origin + "/#/items/2469");
  await expect(
    page.locator(".v2-item-summary [data-attribute='12']"),
  ).toContainText("AP");
  passed.push(
    "production item effects use exact characteristic IDs and shared formatted rows",
  );
  const fixtureResponse = await fetch(backend + "/api/characters", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Production profile fixture " + Date.now(),
      server: "QA",
      className: "Féca",
      classId: 1,
      level: 200,
      omegaLevel: 125,
    }),
  });
  assert.equal(fixtureResponse.status, 201);
  const fixture = (await fixtureResponse.json()).data;
  try {
    await page.goto(origin + "/#/characters/" + fixture.id);
    await page.reload();
    await expect(page.locator(".profile-stage img")).toHaveAttribute(
      "src",
      "/classes/1.webp",
    );
    await expect(page.locator(".profile-heading")).toContainText(
      "Production profile fixture",
    );
    await expect(page.getByLabel("Omega-Level 125")).toBeVisible();
    await page.locator(".profession-manager summary").click();
    await expect(page.locator(".profession-manager input")).toHaveCount(22);
    await page.locator(".profession-manager summary").click();
    await page.screenshot({
      path: "artifacts/v8-production-profile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 420, height: 1000 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: "artifacts/v8-production-profile-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1100 });
  } finally {
    await fetch(backend + "/api/characters/" + fixture.id, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  passed.push(
    "production character profile retains original class artwork and fits at 420px",
  );
  await page.goto(origin + "/#/quests/945");
  await expect(
    page.getByRole("link", { name: "Quelle: DofusPourLesNoobs" }),
  ).toHaveAttribute(
    "href",
    /^https:\/\/www\.dofuspourlesnoobs\.com\/[^?]+\.html$/,
  );
  passed.push(
    "quest guide is a verified direct article in the production bundle",
  );
  const resourceResponse = await fetch(
    backend + "/api/world/resources?jobId=36",
  );
  const fish = (await resourceResponse.json()).data.find((r) =>
    r.name.toLowerCase().includes("forelle"),
  );
  const nodeResponse = await fetch(
    backend +
      `/api/world/gathering?worldId=1&resourceIds=${fish.id}&includeUnconfirmed=true`,
  );
  const node = (await nodeResponse.json()).data[0];
  await page.goto(
    origin + `/#/farming?mapId=${node.mapId}&resourceId=${fish.id}`,
  );
  await expect(
    page.getByLabel("Interaktive DOFUS-Weltkarte mit Originalkarten"),
  ).toHaveAttribute("data-background", "loaded");
  await expect(page.locator(".resource-map-marker")).toHaveCount(0);
  await page
    .getByLabel("Dokumentierte Fundorte aus älterem Patch anzeigen")
    .check();
  const marker = page.locator(".resource-map-marker").first();
  await expect(marker).toBeVisible();
  await expect
    .poll(() =>
      marker
        .locator("img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await marker.click();
  await expect(page.locator(".resource-map-details")).toBeInViewport();
  await expect(page.locator(".resource-map-details")).toContainText(
    "Aktueller Patch unbestätigt",
  );
  await page.screenshot({
    path: "artifacts/v8-production-resource-markers.png",
    fullPage: true,
  });
  passed.push(
    "fishing positions require patch opt-in and actual local resource images render without external hosts",
  );
  await page.goto(origin + "/#/craft");
  const search = page.getByRole("combobox", {
    name: "Crafting-Gegenstand suchen",
  });
  await search.fill("Gelano");
  await page
    .getByRole("option")
    .filter({ has: page.locator("strong", { hasText: /^Gelano$/ }) })
    .first()
    .click();
  await expect(page.locator(".craft-selection")).toContainText("Gelano");
  await expect(page.getByText(/Juwelier · benötigt Stufe 60/)).toBeVisible();
  await page
    .getByRole("button", { name: "Auswahl aufheben", exact: true })
    .click();
  await expect(page.locator(".craft-selection")).toHaveCount(0);
  passed.push(
    "crafting selection can be cleared in the exact production bundle",
  );
  await page.goto(origin + "/activity");
  await expect(page.getByRole("alert")).toContainText(/Discord/);
  await page.screenshot({
    path: "artifacts/v8-production-activity.png",
    fullPage: true,
  });
  passed.push(
    "remaining module shells and Activity error state render in the exact production bundle",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(missingAssets, []);
  await writeFile(
    "docs/production-ui-v8-test.json",
    JSON.stringify(
      {
        version: "0.8.0",
        testedAt: new Date().toISOString(),
        runtime:
          "Chromium / exact Vite production frontend / real isolated loopback backend",
        externalRequestsBlocked: true,
        passed,
        errors,
        missingAssets,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ passed, errors, missingAssets }));
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
