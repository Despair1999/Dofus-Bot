import { configure, backend } from "./environment";
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => configure(page));

test("live catalog count, strict categories, pagination, exact IDs, and class source", async ({
  request,
}) => {
  const status = (
    await (await request.get(`${backend}/api/catalog/status`)).json()
  ).data;
  expect(status.itemCount).toBe(status.uniqueSourceItemCount);
  expect(status.itemCount).toBeGreaterThan(20000);
  expect(status.unmatchedApiIds).toEqual([]);
  expect(status.missingRecipeTargets).toBe(0);
  for (const group of ["equipment", "resources"]) {
    const result = await (
      await request.get(`${backend}/api/items?mainGroup=${group}`)
    ).json();
    expect(result.total).toBeGreaterThan(3000);
    expect(
      result.data.every((i: { mainGroup: string }) => i.mainGroup === group),
    ).toBe(true);
  }
  for (const category of [
    "equipment",
    "resources",
    "quest",
    "consumables",
    "cosmetics",
  ]) {
    const body = await (
      await request.get(`${backend}/api/items?category=${category}&pageSize=30`)
    ).json();
    expect(body.data).toHaveLength(30);
    expect(
      body.data.every((i: { category: string }) => i.category === category),
    ).toBe(true);
    expect(body.total).toBe(status.categoryCounts[category]);
  }
  const item = (await (await request.get(`${backend}/api/items/2469`)).json())
    .data;
  expect(item.name).toBe("Gelano");
  expect(item.recipe).toHaveLength(8);
  expect(
    item.recipe.every(
      (m: { name: string }) => m.name && m.name !== "Materialdaten fehlen",
    ),
  ).toBe(true);
  const classes = (await (await request.get(`${backend}/api/classes`)).json())
    .data;
  expect(classes).toHaveLength(19);
  expect(classes.find((c: { id: number }) => c.id === 11).name).toBe(
    "Sacrieur",
  );
});

test("suggestion opens exact item and recipe quantities multiply", async ({
  page,
}) => {
  await page.goto("/#/items/search");
  const search = page.getByRole("combobox", { name: "Gegenstände suchen" });
  await search.fill("gela");
  await page.getByRole("option", { name: /^Gelano / }).click();
  await expect(page).toHaveURL(/#\/items\/2469/);
  await expect(
    page.getByRole("heading", { name: "Gelano", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Rezept planen", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(8);
  const before = await page.locator("tbody tr").first().innerText();
  await page.getByLabel("Herstellungsmenge").fill("7");
  await expect(page.locator("tbody tr").first()).not.toHaveText(before);
  await expect(page.locator("tbody")).not.toContainText("Materialdaten fehlen");
  await expect(
    page.getByText("Gewinn nach Gebühren", { exact: true }),
  ).toBeVisible();
  await page.locator("tbody tr").first().getByRole("button").first().click();
  await expect(page).toHaveURL(/#\/items\/\d+/);
});

test("Enter lists all matches, keyboard selection and Escape work", async ({
  page,
}) => {
  await page.goto("/#/items/search");
  const search = page.getByRole("combobox", { name: "Gegenstände suchen" });
  await search.fill("gela");
  await expect(
    page.getByRole("listbox", { name: "Suchvorschläge" }),
  ).toBeVisible();
  await search.press("Escape");
  await expect(
    page.getByRole("listbox", { name: "Suchvorschläge" }),
  ).not.toBeVisible();
  await search.press("Enter");
  await expect(page).toHaveURL(/items\/search\?q=gela/);
  await expect(page.locator(".v2-item-card")).toHaveCount(6);
  await search.fill("gelano");
  await expect(
    page.getByRole("listbox", { name: "Suchvorschläge" }).getByRole("option"),
  ).toHaveCount(2);
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/#\/items\/\d+/);
});

test("filters reset correctly and browser back restores resource search", async ({
  page,
}) => {
  await page.goto("/#/items/search?mainGroup=resources&q=gobball");
  await page.getByLabel("Gegenstände suchen").fill("wolle");
  await page.getByRole("button", { name: "Suchen", exact: true }).click();
  const path = page.url();
  await expect(page.locator(".v2-item-card").first()).toBeVisible();
  await page.locator(".v2-item-card").first().click();
  await page.goBack();
  await expect(page).toHaveURL(path);
  await expect(page.getByLabel("Gegenstände suchen")).toHaveValue("wolle");
  await page.getByRole("button", { name: "Filter zurücksetzen" }).click();
  await expect(page.getByLabel("Gegenstandstyp")).toHaveValue("");
});

test("class dropdown searches aliases and exposes stable real class", async ({
  page,
}) => {
  await page.goto("/#/characters");
  await expect(page.getByLabel("Registrieren", { exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Klasse", exact: true }).click();
  await expect(
    page
      .getByRole("listbox", { name: "Verfügbare Klassen" })
      .getByRole("option"),
  ).toHaveCount(19);
  await page.getByLabel("Klasse suchen").fill("Sacrieur");
  await expect(
    page
      .getByRole("listbox", { name: "Verfügbare Klassen" })
      .getByRole("option"),
  ).toHaveCount(1);
  await page
    .getByRole("listbox", { name: "Verfügbare Klassen" })
    .getByRole("option")
    .click();
  await expect(
    page.getByRole("combobox", { name: "Klasse", exact: true }),
  ).toContainText("Sacrieur");
});

test("Almanax week navigation has seven dated cards", async ({ page }) => {
  await page.goto("/#/almanax");
  await expect(page.locator(".v2-day")).toHaveCount(7);
  const date = await page.getByLabel("Almanax-Datum wählen").inputValue();
  await page.getByLabel("Nächste Woche oder Monat").click();
  await expect(page.getByLabel("Almanax-Datum wählen")).not.toHaveValue(date);
  await page.getByLabel("Vorherige Woche oder Monat").click();
  await expect(page.getByLabel("Almanax-Datum wählen")).toHaveValue(date);
  await expect(page.locator(".v2-tribute-link")).toBeVisible();
  await page.locator(".v2-tribute-link").click();
  await expect(page).toHaveURL(/#\/items\/\d+/);
});

for (const width of [600, 1366, 1920, 2560, 3440]) {
  test(`catalog responsive layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/#/items/search?q=gelano");
    await expect(page.locator(".v2-item-card")).toHaveCount(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/v2-catalog-${width}.png`,
      fullPage: true,
    });
  });
}

test("hotkey recorder captures actual keys and persists the selected combination", async ({
  page,
}) => {
  await page.goto("/#/settings");
  const recorder = page.getByRole("button", {
    name: "Overlay ein-/ausblenden aufnehmen",
  });
  await recorder.click();
  await page.keyboard.press("F8");
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(recorder).toContainText("F8");
  const mainRecorder = page.getByRole("button", {
    name: "Hauptfenster öffnen aufnehmen",
  });
  await mainRecorder.click();
  await page.keyboard.press("Control+Shift+D");
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(mainRecorder).toContainText("D");
  await recorder.click();
  await page.keyboard.press("Control+Shift+Y");
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(recorder).toContainText("Y");
  await page
    .getByRole("button", { name: "Hotkeys dauerhaft speichern", exact: true })
    .click();
  await page.reload();
  await expect(recorder).toContainText("Y");
  await page
    .getByTitle("Overlay ein-/ausblenden zurücksetzen", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hotkeys dauerhaft speichern", exact: true })
    .click();
  await expect(recorder).toContainText("F8");
});
