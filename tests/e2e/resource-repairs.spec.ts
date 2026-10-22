import { test, expect } from "@playwright/test";
import { backend, configure, token } from "./environment";
const headers = { Authorization: `Bearer ${token}` };

test("a delayed crafting selection cannot reopen an item after X", async ({
  page,
}) => {
  await configure(page);
  await page.evaluate(async () => {
    const { write } = await import("/src/storage.ts");
    await write("onboarded", true);
  });
  await page.goto("/#/craft");
  await page.reload();
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
  await page.route("**/api/items/*", async (route) => {
    if (/\/api\/items\/\d+\?/.test(route.request().url()))
      await new Promise((r) => setTimeout(r, 600));
    await route.continue();
  });
  await search.fill("Piou");
  const option = page.getByRole("option").first();
  await expect(option).toBeVisible();
  const delayed = page.waitForResponse((r) =>
    /\/api\/items\/\d+\?/.test(r.url()),
  );
  await option.click();
  await page
    .getByRole("button", { name: "Auswahl aufheben", exact: true })
    .click();
  await delayed;
  await expect(page.locator(".craft-selection")).toHaveCount(0);
  await expect(search).toHaveValue("");
});
test.beforeEach(async ({ page }) => {
  await configure(page);
  await page.evaluate(async () => {
    const { write } = await import("/src/storage.ts");
    await write("onboarded", true);
  });
});

test("documented fishing markers require opt-in, expose patch provenance and retain zoom position", async ({
  page,
  request,
}) => {
  const resources = (
    await (
      await request.get(`${backend}/api/world/resources?jobId=36`, { headers })
    ).json()
  ).data;
  const resource =
    resources.find((r: any) => r.name.toLowerCase().includes("forelle")) ??
    resources[0];
  const locations = (
    await (
      await request.get(
        `${backend}/api/world/gathering?resourceIds=${resource.id}&worldId=1&includeUnconfirmed=true`,
        { headers },
      )
    ).json()
  ).data;
  expect(locations.length).toBeGreaterThan(0);
  const node = locations[0];
  await page.goto(`/#/farming?mapId=${node.mapId}&resourceId=${resource.id}`);
  await page.reload();
  const canvas = page.getByLabel(
    "Interaktive DOFUS-Weltkarte mit Originalkarten",
  );
  await expect(canvas).toHaveAttribute("data-background", "loaded");
  await expect(page.locator(".resource-map-marker")).toHaveCount(0);
  await page
    .getByLabel("Dokumentierte Fundorte aus älterem Patch anzeigen")
    .check();
  const marker = page
    .getByRole("button", { name: `${resource.name} Fundstellen anzeigen` })
    .first();
  await expect(marker).toBeVisible();
  await expect
    .poll(() =>
      marker
        .locator("img")
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await marker.click();
  await expect(page.locator(".resource-map-details")).toContainText(
    "Aktueller Patch unbestätigt",
  );
  await expect(page.locator(".resource-map-details")).toContainText("3.7.4.4");
  const old = await page.evaluate(() => scrollY),
    box = await marker.boundingBox();
  await page.mouse.move(box!.x + 10, box!.y + 10);
  await page.mouse.wheel(0, -250);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(old);
  await page.getByLabel("Start Map-ID").fill(String(node.mapId));
  await page
    .getByRole("button", { name: "Fundorte planen", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Geschätzte Fundortreihenfolge" })
      .or(page.locator('[aria-label="Geschätzte Fundortreihenfolge"]')),
  ).toContainText("Keine geprüfte Wegstrecke");
  await page.screenshot({
    path: "artifacts/v8-fishing-markers.png",
    fullPage: true,
  });
});

test("Omega and all professions persist with character-specific values", async ({
  page,
  request,
}) => {
  const name = `Omega-${Date.now()}`;
  const response = await request.post(`${backend}/api/characters`, {
    headers,
    data: {
      name,
      server: "QA",
      className: "Féca",
      classId: 1,
      level: 200,
      omegaLevel: 125,
    },
  });
  expect(response.status()).toBe(201);
  const c = (await response.json()).data;
  try {
    await page.goto(`/#/characters/${c.id}`);
    await page.reload();
    await expect(page.getByLabel("Omega-Level 125")).toBeVisible();
    await page.locator(".profession-manager summary").click();
    await expect(page.locator(".profession-manager input")).toHaveCount(22);
    const input = page.getByLabel("Schmiedmagier Berufslevel", { exact: true });
    await input.fill("150");
    await input.press("Tab");
    await expect
      .poll(async () => {
        const p = (
          await (
            await request.get(`${backend}/api/profession-personal/${c.id}`, {
              headers,
            })
          ).json()
        ).data;
        return p.levels.find((l: any) => l.jobId === 44)?.level;
      })
      .toBe(150);
    await page.reload();
    await page.locator(".profession-manager summary").click();
    await expect(input).toHaveValue("150");
    await page.getByRole("button", { name: "Bearbeiten", exact: true }).click();
    await expect(page.getByLabel("Omega-Level", { exact: true })).toHaveValue(
      "125",
    );
    await page.getByLabel("Omega-Level", { exact: true }).fill("126");
    await page
      .getByRole("button", { name: "Profil speichern", exact: true })
      .click();
    await expect(page.getByLabel("Omega-Level 126")).toBeVisible();
  } finally {
    await request.delete(`${backend}/api/characters/${c.id}`, { headers });
  }
});

test("craft X resets only selection and calculations while preserving saved stock and prices", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const { write } = await import("/src/storage.ts");
    await write("craft", {
      prices: { 971: 55 },
      stock: { 971: 7 },
      server: "QA",
      savedAt: "2026-10-22",
    });
  });
  await page.goto("/#/craft");
  await page.reload();
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
  await page.getByLabel("Herstellungsmenge").fill("4");
  await page.getByLabel("Verkaufspreis pro Stück").fill("999");
  await page
    .getByRole("button", { name: "Auswahl aufheben", exact: true })
    .click();
  await expect(page.locator(".craft-selection")).toHaveCount(0);
  await expect(page.locator("tbody tr")).toHaveCount(0);
  const saved = await page.evaluate(async () => {
    const { read } = await import("/src/storage.ts");
    return read("craft", null);
  });
  expect(saved).toMatchObject({
    prices: { 971: 55 },
    stock: { 971: 7 },
    server: "QA",
  });
  await search.fill("Gelano");
  await page
    .getByRole("option")
    .filter({ has: page.locator("strong", { hasText: /^Gelano$/ }) })
    .first()
    .click();
  await expect(page.getByLabel("Herstellungsmenge")).toHaveValue("1");
  await expect(page.getByLabel("Verkaufspreis pro Stück")).toHaveValue("");
});

test("quest source uses a verified direct article and OCR explains only implemented capabilities", async ({
  page,
}) => {
  await page.goto("/#/quests/945");
  await expect(page.locator(".v2-quest-detail h2")).toBeVisible();
  const source = page.getByRole("link", { name: "Quelle: DofusPourLesNoobs" });
  await expect(source).toHaveAttribute(
    "href",
    /^https:\/\/www\.dofuspourlesnoobs\.com\/[^?]+\.html$/,
  );
  await expect(source).toHaveAttribute("target", "_blank");
  await page.goto("/#/scanner");
  await expect(
    page.getByText("Was kann die Bildschirmerkennung?", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Items und Quests finden", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "OCR starten", exact: true }),
  ).toBeVisible();
  await page.goto("/#/world");
  const accordion = page.locator(".map-category-filter");
  await expect(accordion.locator("summary svg")).toBeVisible();
  await accordion.locator("summary").click();
  await expect(accordion).toHaveAttribute("open", "");
  await accordion.locator("summary").press("Enter");
  await expect(accordion).not.toHaveAttribute("open", "");
});
