import { test, expect } from "@playwright/test";
import { configure } from "./environment";

test.beforeEach(async ({ page }) => {
  await configure(page);
  await page.evaluate(async () => {
    const { write } = await import("/src/storage.ts");
    await write("onboarded", true);
    await write("ui:navigation-groups", {
      Entdecken: true,
      Planen: true,
      Tools: false,
      Persönlich: true,
    });
  });
});

test("Tools collapses, persists and keeps every navigation item reachable in a short window", async ({
  page,
}) => {
  await page.reload();
  const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
  await expect(nav.getByRole("button")).toHaveCount(18);
  await expect(
    nav.getByRole("button", { name: "Übersetzer", exact: true }),
  ).toHaveCount(0);
  await nav.getByRole("button", { name: "Tools", exact: true }).click();
  await expect(nav.getByRole("button")).toHaveCount(21);
  await page.reload();
  await expect(
    nav.getByRole("button", { name: "Tools", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.setViewportSize({ width: 1200, height: 650 });
  await nav.getByRole("button", { name: "Einstellungen", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Anzeige & Bedienkomfort" }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "Tools", exact: true }).click();
  await expect(nav.getByRole("button")).toHaveCount(18);
  await page.screenshot({ path: "artifacts/v5-navigation.png" });
});

test("all five themes change page surfaces and persist while AP BP LP retain semantic colors", async ({
  page,
}) => {
  await page.goto("/#/settings?section=appearance");
  await page.reload();
  const backgrounds = new Set<string>();
  for (const name of [
    "Obsidian & Gold",
    "Wald der Zwölf",
    "Sufokia",
    "Zwielicht",
    "Brâkmar",
  ]) {
    const button = page.getByRole("button", { name: new RegExp(name) });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    backgrounds.add(
      await page
        .locator(".appearance-settings")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    );
  }
  expect(backgrounds.size).toBe(5);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ember");
  await page.goto("/#/builder");
  for (const [name, color] of [
    ["ap", "rgb(120, 186, 255)"],
    ["bp", "rgb(147, 230, 156)"],
    ["lp", "rgb(255, 155, 159)"],
  ]) {
    await expect(
      page.locator(`.builder-summary-metrics .stat-${name} strong`),
    ).toHaveCSS("color", color);
  }
  await expect(page.locator(".stat-bp").first()).toContainText("BP");
  await page.screenshot({ path: "artifacts/v5-builder.png", fullPage: true });
  await page.goto("/#/settings?section=appearance");
  await page.getByRole("button", { name: /Sufokia/ }).click();
  await page.screenshot({ path: "artifacts/v5-themes.png", fullPage: true });
});

test("interior quest map preserves identity on the original background and coordinate-only links select a map", async ({
  page,
}) => {
  await page.goto("/#/world?mapId=99353610");
  await page.reload();
  const canvas = page.getByLabel(
    "Interaktive DOFUS-Weltkarte mit Originalkarten",
  );
  await expect(canvas).toHaveAttribute("data-background", "loaded");
  await expect(
    page.getByRole("combobox", { name: "Weltkarte", exact: true }),
  ).toHaveValue("1");
  await expect(page.locator(".world-details")).toContainText("99353610");
  await expect(page.locator(".world-details")).toContainText("Innenkarte");
  await expect(page.locator(".world-details h2")).toContainText("[-1, 2]");
  await page.screenshot({ path: "artifacts/v5-quest-map.png", fullPage: true });
  await page.goto("/#/world?x=7&y=-5");
  await expect(page.locator(".world-details h2")).toContainText("[7, -5]");
  await expect(page.getByLabel("Karte bei gleichen Koordinaten")).toBeVisible();
  await page.goto("/#/farming?x=-1&y=2");
  await expect(canvas).toHaveAttribute("data-background", "loaded");
  for (const width of [1366, 700]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
});

test("boss resource quest and drop images use local assets and remain visible offline", async ({
  page,
  context,
}) => {
  await page.goto("/#/dungeons/1");
  await page.reload();
  const boss = page.locator(".dungeon-detail-heading img");
  await expect(boss).toHaveAttribute("src", /\/game-assets\/monsters\//);
  await expect
    .poll(() => boss.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Strategie", exact: true }).click();
  await expect(page.locator(".combat-boss-plan")).toHaveCount(1);
  await expect(page.locator(".combat-spells")).toContainText("Reichweite");
  await page.getByRole("button", { name: "Drops", exact: true }).click();
  await expect(page.locator(".dungeon-drop-list img").first()).toHaveAttribute(
    "src",
    /\/game-assets\/items\//,
  );
  await page.goto("/#/professions");
  await expect(page.locator(".profession-card img")).toHaveCount(6);
  await expect(page.locator(".profession-card img").first()).toHaveAttribute(
    "src",
    /\/game-assets\/items\//,
  );
  await page
    .getByText("Verfügbare Sammelressourcen anzeigen", { exact: true })
    .click();
  await expect
    .poll(() => page.locator(".resource-title img").count())
    .toBeGreaterThan(6);
  await expect(
    page.locator(".resource-title h3", { hasText: /^Eisen$/ }),
  ).toHaveCount(1);
  expect(
    (await page
      .locator(".profession-resource-picker article")
      .first()
      .boundingBox())!.height,
  ).toBeLessThan(220);
  // Lazy images must be requested before disconnecting the browser server.
  // Opening the resource picker can move the quest cards below the viewport.
  await page.locator(".profession-card img").first().scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .locator(".profession-card img")
        .first()
        .evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBeGreaterThan(0);
  await context.setOffline(true);
  await expect
    .poll(() =>
      page
        .locator(".profession-card img")
        .first()
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: "artifacts/v5-professions.png",
    fullPage: true,
  });
  await context.setOffline(false);
});
