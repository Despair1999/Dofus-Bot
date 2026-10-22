import { test, expect, type Page } from "@playwright/test";
import { backend, configure, token } from "./environment";
async function setup(page: Page, path = "/world") {
  await configure(page);
  await page.evaluate(async () => {
    const { write } = await import("/src/storage.ts");
    await write("onboarded", true);
  });
  await page.goto("/#" + path);
  await page.reload();
}
test("world map searches real coordinates, distinguishes duplicate map IDs and stays responsive", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await setup(page);
  await expect(page.getByLabel("Weltkarte", { exact: true })).toHaveValue("1");
  await page.getByLabel("Weltkarte", { exact: true }).selectOption("1");
  await page.getByLabel("Karten suchen").fill("[7,-5]");
  await expect
    .poll(() => page.locator(".world-results button").count())
    .toBeGreaterThanOrEqual(2);
  await page.locator(".world-results button").first().click();
  const canvas = page.getByLabel("Interaktive DOFUS-Weltkarte mit Originalkarten");
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  await canvas.click({
    position: { x: bounds!.width / 2, y: bounds!.height / 2 },
  });
  await expect(page.getByLabel("Karte bei gleichen Koordinaten")).toBeVisible();
  await expect(
    page.getByLabel("Karte bei gleichen Koordinaten").locator("option"),
  ).toHaveCount(2);
  await page.getByLabel("Ressourcen filtern").fill("Bronze");
  await expect(page.locator(".world-resource")).toHaveCount(1);
  await page.locator(".world-resource input").check();
  await expect(page.locator(".world-resource input")).toBeChecked();
  for (const width of [1366, 600]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  await page.setViewportSize({ width: 1366, height: 1000 });
  await page.screenshot({ path: "artifacts/v4-world.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("same-coordinate maps are not joined by an invented route and unknown farm prices stay unknown", async ({
  page,
}) => {
  await setup(page, "/farming");
  await page.getByLabel("Start Map-ID").fill("5");
  await page.getByLabel("Ziel Map-IDs").fill("7");
  await page
    .getByRole("button", { name: "Route berechnen", exact: true })
    .click();
  await expect(page.locator(".world-route")).toContainText("0 Kartenwechsel");
  await expect(page.locator(".world-route")).toContainText(
    "Nicht erreichbar: 7",
  );
  await expect(page.locator(".world-route ol li")).toHaveCount(1);
  await expect(page.getByLabel("Eigener Stückpreis · Kamas")).toHaveValue("");
});
test("profession quest opens constrained farming, and dungeon detail shows explicit evidence status", async ({
  page,
  request,
}) => {
  await setup(page, "/professions");
  const quest = page.locator(".profession-card").filter({ hasText: "Piocher" });
  await expect(quest).toHaveCount(1);
  await expect(quest).toContainText("10 ×");
  await page.screenshot({
    path: "artifacts/v4-professions.png",
    fullPage: true,
  });
  await quest.getByRole("button", { name: "Sammelroute planen" }).click();
  await expect(page).toHaveURL(/questId=945/);
  await expect(page).toHaveURL(/itemId=/);
  await expect(page.locator(".world-resource input:checked")).toHaveCount(1);
  await page.goto("/#/dungeons");
  await expect(page.locator(".dungeon-row").first()).toBeVisible();
  await page.locator(".dungeon-row").first().click();
  await expect(
    page.getByRole("navigation", { name: "Dungeoninformationen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Räume", exact: true }).click();
  await expect(page.locator(".dungeon-detail")).toContainText(
    /nicht|unbekannt|fehl|belegt/i,
  );
  await page.screenshot({ path: "artifacts/v4-dungeons.png", fullPage: true });
  // Actual isolated backend is used throughout; public counts are not mocked.
  const data = await request.get(`${backend}/api/world/status`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(data.status()).toBe(200);
  expect((await data.json()).data.maps).toBeGreaterThan(10000);
});

test("Activity opened outside Discord explains the required context without loading private profile data", async ({page}) => {
  const privateReads: string[] = [];
  page.on("request", request => { if (/\/api\/(?:characters|world\/personal|builder\/builds)/.test(request.url())) privateReads.push(request.url()); });
  await page.goto("/activity");
  await expect(page.getByRole("alert")).toContainText("Öffne diese Activity über Discord");
  await expect(page.getByRole("button", {name:"Erneut verbinden"})).toBeVisible();
  expect(privateReads).toEqual([]);
});
