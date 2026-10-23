import { test, expect } from "@playwright/test";
import { configure, backend, token } from "./environment";
test.beforeEach(async ({ page }) => {
  await configure(page);
  await page.evaluate(async () => {
    const { write } = await import("/src/storage.ts");
    await write("onboarded", true);
  });
  await page.reload();
});
test("map wheel zoom keeps page scroll fixed and outside scrolling still works", async ({
  page,
}) => {
  await page.goto("/#/world?x=7&y=-5");
  const canvas = page.getByLabel(
    "Interaktive DOFUS-Weltkarte mit Originalkarten",
  );
  await expect(canvas).toHaveAttribute("data-background", "loaded");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + box!.width * 0.6, Math.min(650, box!.y + 120));
  const before = await page.evaluate(() => scrollY);
  const footer = await page.locator(".world-map-footer").textContent();
  await page.mouse.wheel(0, -300);
  await expect
    .poll(() => page.locator(".world-map-footer").textContent())
    .not.toBe(footer);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(before);
  await page.mouse.move(250, 250);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
  await page.screenshot({ path: "artifacts/v7-map-wheel.png" });
});
test("quest coordinates remain readable and fit within their objective rows", async ({
  page,
}) => {
  await page.goto("/#/quests/945");
  await expect(page.locator(".v2-quest-detail h2")).toBeVisible();
  const buttons = page.locator(".v2-quest-coordinate");
  await expect.poll(() => buttons.count()).toBeGreaterThan(0);
  for (const width of [1366, 700]) {
    await page.setViewportSize({ width, height: 1000 });
    const button = buttons.first();
    await button.scrollIntoViewIfNeeded();
    const style = await button.evaluate((e) => {
      const s = getComputedStyle(e);
      return { color: s.color, background: s.backgroundColor };
    });
    expect(style.color).not.toBe(style.background);
    const r = await button.boundingBox(),
      parent = await button.locator("..").boundingBox();
    expect(r!.x).toBeGreaterThanOrEqual(parent!.x - 1);
    expect(r!.x + r!.width).toBeLessThanOrEqual(parent!.x + parent!.width + 1);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  await page.screenshot({ path: "artifacts/v7-quest.png", fullPage: true });
});
test("all equipment slots have category glyphs and item effects share the attribute system", async ({
  page,
  request,
}) => {
  await page.goto("/#/builder");
  const glyphs = page.locator(".equipment-slot .slot-select svg[data-glyph]");
  await expect(glyphs).toHaveCount(16);
  for (const name of [
    "hat",
    "amulet",
    "weapon",
    "ring",
    "shield",
    "cape",
    "belt",
    "boots",
    "companion",
    "dofus",
  ])
    await expect(
      page.locator(`.equipment-slot svg[data-glyph='${name}']`).first(),
    ).toBeVisible();
  await expect(
    page.locator(".equipment-slot").filter({
      has: page.getByRole("button", { name: "Hut auswählen", exact: true }),
    }),
  ).not.toHaveText(/Hut\s+Hut/);
  const r = await request.get(`${backend}/api/items/2469`);
  expect(
    (await r.json()).data.numericEffects.some(
      (e: { id: number }) => e.id === 12,
    ),
  ).toBe(true);
  const historical = await request.get(
    `${backend}/api/items/694?version=3.6.12.16`,
  );
  const historicalItem = (await historical.json()).data;
  expect(historicalItem.version).toBe("3.6.12.16");
  expect(
    historicalItem.numericEffects.some((e: { id: number }) => e.id === 10984),
  ).toBe(true);
  await page.goto("/#/items/694?version=3.6.12.16");
  await expect(page.locator(".v2-source")).toContainText("3.6.12.16");
  await page.goto("/#/items/2469");
  await expect(
    page.locator(".v2-item-summary [data-attribute='12']"),
  ).toContainText("AP");
  await expect(
    page.locator(".v2-item-summary [data-attribute='12'] strong"),
  ).toContainText("1");
});
test("character profile, active selection, real build equipment and class grid survive reload", async ({
  page,
  request,
}) => {
  const name = `Profil-${Date.now()}`;
  const created = await request.post(`${backend}/api/characters`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name,
      server: "QA",
      className: "Sacrieur",
      classId: 11,
      level: 200,
    },
  });
  expect(created.ok()).toBe(true);
  const character = (await created.json()).data;
  const createdBuild = await request.post(`${backend}/api/builder/builds`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: "Profil-Set",
      characterId: character.id,
      classId: 11,
      level: 200,
      gameVersion: "3.7.12.12",
      active: true,
      equipment: { ring1: { itemId: 2469, rolls: {}, exos: {} } },
    },
  });
  expect(createdBuild.ok()).toBe(true);
  const build = (await createdBuild.json()).data;
  try {
    await page.goto("/#/characters");
    await page.reload();
    await page
      .getByRole("button", { name: `${name} Profil öffnen`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".profile-stage img")).toHaveAttribute(
      "src",
      "/classes/11.webp",
    );
    const choose = page.getByRole("button", {
      name: "Als aktives Profil wählen",
      exact: true,
    });
    if (await choose.isVisible()) await choose.click();
    else
      await expect(
        page.getByRole("button", { name: "Aktives Profil", exact: true }),
      ).toBeDisabled();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Aktives Profil", exact: true }),
    ).toBeDisabled();
    await page.getByRole("tab", { name: "Ausrüstung", exact: true }).click();
    await expect(page.locator(".profile-equipment")).toContainText("Gelano");
    await expect(page.locator(".profile-equipment img")).toHaveAttribute(
      "src",
      /game-assets\/items/,
    );
    await expect(page.locator(".profile-life")).toBeVisible();
    await page.getByRole("tab", { name: "Allgemein", exact: true }).click();
    for (const width of [1440, 700, 420]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
    }
    await page.screenshot({
      path: "artifacts/v7-profile-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.screenshot({ path: "artifacts/v7-profile.png", fullPage: true });
    await page.getByRole("button", { name: "Bearbeiten", exact: true }).click();
    await page.getByRole("combobox", { name: "Profilklasse" }).click();
    await page.getByRole("button", { name: "Klassenraster anzeigen" }).click();
    await expect(
      page
        .getByRole("listbox", { name: "Verfügbare Klassen" })
        .getByRole("option"),
    ).toHaveCount(19);
    await page.getByLabel("Klasse suchen").fill("Iop");
    await page
      .getByRole("listbox", { name: "Verfügbare Klassen" })
      .getByRole("option", { name: /Iop/ })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Profilklasse" }),
    ).toContainText("Iop");
  } finally {
    await request.delete(`${backend}/api/builder/builds/${build.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await request.delete(`${backend}/api/characters/${character.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
});
test("pinned modules stay reachable after reload and map category filters expose dedicated symbols", async ({
  page,
}) => {
  await page.goto("/#/settings?section=navigation");
  await page
    .locator(".pinned-module-options")
    .getByLabel("Farmrouten", { exact: true })
    .check();
  await page.reload();
  await expect(page.locator(".ui-nav-pinned")).toContainText("Farmrouten");
  await page.goto("/#/world");
  await page.locator(".map-category-filter summary").click();
  await page.getByLabel("Werkstätten", { exact: true }).check();
  await expect(
    page.locator(".ui-point-list svg[data-glyph='workshop']").first(),
  ).toBeVisible();
});
