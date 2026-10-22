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
test("command palette searches real records, supports keyboard navigation, and restores focus", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: /Globale Suche/ });
  await trigger.click();
  const input = page.getByRole("combobox", { name: "Globale Suche" });
  await input.fill("Gelano");
  const option = page.getByRole("option", { name: /Gelano/ }).first();
  await expect(option).toBeVisible();
  await expect(option.locator("img")).toHaveAttribute(
    "src",
    /game-assets\/items/,
  );
  await input.press("ArrowDown");
  await input.press("ArrowUp");
  await input.press("Enter");
  await expect(page).toHaveURL(/#\/items\/\d+/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await trigger.focus();
  await page.keyboard.press("Control+k");
  await expect(input).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
test("coordinate commands and saved map panel dimensions work without changing map identity", async ({
  page,
}) => {
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox", { name: "Globale Suche" });
  await input.fill("[-1,2]");
  await input.press("Enter");
  await expect(page.locator(".world-details h2")).toHaveText("[-1, 2]");
  await expect(
    page.getByLabel("Interaktive DOFUS-Weltkarte mit Originalkarten"),
  ).toHaveAttribute("data-background", "loaded");
  const separator = page.getByRole("separator", { name: "Filterbreite" });
  await separator.focus();
  await separator.press("ArrowRight");
  await expect(separator).toHaveAttribute("aria-valuenow", "266");
  await page.getByRole("button", { name: "Details ein-/ausblenden" }).click();
  await expect(page.locator(".world-details")).toHaveCount(0);
  await page.reload();
  await expect(separator).toHaveAttribute("aria-valuenow", "266");
  await expect(
    page.getByRole("button", { name: "Details ein-/ausblenden" }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Details ein-/ausblenden" }).click();
  await page.getByLabel("Kartenobjekte suchen").fill("Zaap");
  await expect(page.locator(".ui-point-list button").first()).toContainText(
    "Zaap",
  );
  await page.screenshot({
    path: "artifacts/redesign-world.png",
    fullPage: true,
  });
});
test("real monster and set browsers paginate and open versioned details", async ({
  page,
}) => {
  await page.goto("/#/monsters");
  await page.getByLabel("Monster suchen").fill("147");
  await page
    .locator(".ui-card-grid button")
    .filter({ hasText: "#147" })
    .first()
    .click();
  await expect(page.locator(".ui-object-hero")).toContainText(
    "Königlicher Fresssack",
  );
  await expect(page.locator(".ui-object-hero img")).toHaveAttribute(
    "src",
    /game-assets\/monsters/,
  );
  await page.getByRole("tab", { name: "Fundorte" }).click();
  await expect(
    page.getByRole("button", { name: "Dungeon öffnen" }).first(),
  ).toBeVisible();
  await page.goto("/#/sets");
  await expect(page.locator(".ui-set-card")).toHaveCount(40);
  const first = await page.locator(".ui-set-card").first().textContent();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await expect(page.locator(".ui-set-card").first()).not.toHaveText(first!);
  await page.locator(".ui-set-card").first().click();
  await expect(
    page.getByRole("heading", { name: "Setboni vergleichen" }),
  ).toBeVisible();
  await expect(page.locator(".ui-object-hero img").first()).toBeVisible();
  await page.screenshot({
    path: "artifacts/redesign-sets.png",
    fullPage: true,
  });
});
test("sidebar icon mode and display preferences persist and mobile navigation reaches all modules", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Seitenleiste einklappen" }).click();
  await expect(page.locator(".ui-sidebar")).toHaveAttribute(
    "data-collapsed",
    "true",
  );
  await page.reload();
  await expect(page.locator(".ui-sidebar")).toHaveAttribute(
    "data-collapsed",
    "true",
  );
  await page.goto("/#/settings?section=appearance");
  await page.getByLabel("Informationsdichte").selectOption("compact");
  await page.getByLabel("Animationen", { exact: true }).selectOption("reduced");
  await page.getByLabel("UI-Textgröße").selectOption("1.1");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await expect(page.getByLabel("UI-Textgröße")).toHaveValue("1.1");
  await page.setViewportSize({ width: 600, height: 900 });
  await page.getByLabel("Modul wählen").selectOption("monsters");
  await expect(
    page.getByRole("heading", { name: "Kenne deinen Gegner." }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
test("failed local item image retries the original reference and exposes a clear fallback", async ({
  page,
}) => {
  await page.route("**/game-assets/items/*.webp", (r) => r.abort());
  await page.route("https://api.dofusdu.de/**", (r) => r.abort());
  await page.goto("/#/items?q=Gelano");
  await expect(
    page
      .locator(".v2-item-card")
      .first()
      .getByRole("img", { name: /Kein Bild/ }),
  ).toBeVisible();
  await page.goto("/#/settings?section=data");
  await expect(page.locator(".ui-asset-failures li").first()).toBeVisible();
});

test("last workspace restores on an empty startup URL while explicit links keep priority", async ({
  page,
}) => {
  await page.goto("/#/monsters/147");
  await expect(page.locator(".ui-object-hero")).toContainText(
    "Königlicher Fresssack",
  );
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { read } = await import("/src/storage.ts");
        return read("ui:last-view", "");
      }),
    )
    .toBe("/monsters/147");
  await page.evaluate(async () => {
    const { write } = await import("/src/storage.ts");
    await write("ui:restore-view", true);
  });
  await page.goto("about:blank");
  await page.goto("/");
  await expect(page).toHaveURL(/#\/monsters\/147/);
  await expect(page.locator(".ui-object-hero")).toContainText(
    "Königlicher Fresssack",
  );
  await page.goto("/#/sets");
  await page.reload();
  await expect(page).toHaveURL(/#\/sets$/);
});

test("saved route links hydrate real route data from the dashboard destination", async ({
  page,
  request,
}) => {
  const response = await request.post(`${backend}/api/world/personal/routes`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: "Redesign route fixture",
      startMapId: 88212757,
      targetMapIds: [],
      roundTrip: false,
    },
  });
  expect(response.ok()).toBe(true);
  const saved = (await response.json()).data;
  try {
    await page.goto(`/#/farming?routeId=${saved.id}`);
    await expect(page.getByLabel("Start Map-ID")).toHaveValue("88212757");
    await expect(page.locator(".world-notice[role=status]")).toContainText(
      "Route geladen: Redesign route fixture",
    );
    await expect(page.locator(".world-details")).toContainText("88212757");
  } finally {
    await request.delete(`${backend}/api/world/personal/routes/${saved.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
});
