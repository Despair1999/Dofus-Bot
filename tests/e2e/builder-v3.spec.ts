import { test, expect, type Page } from "@playwright/test";
const server = "http://127.0.0.1:4312";
const token = "builder-e2e-only-token-000000000000000000";
const headers = { authorization: "Bearer " + token };
async function setup(page: Page, path = "/builder") {
  await page.goto("/");
  await page.evaluate(
    async ({ url, token }) => {
      const { write } = await import("/src/storage.ts");
      sessionStorage.setItem("companion-token", token);
      await write("config", { url, token: "" });
      await write("onboarded", true);
    },
    { url: server, token },
  );
  await page.goto("/#" + path);
  await page.reload();
  await expect(page.locator(".builder-page")).toBeVisible();
  await expect(
    page.locator(".builder-page").getByText("Builder wird geladen …"),
  ).toHaveCount(0);
}
async function equip(page: Page, slot: string, id: number) {
  await page
    .getByRole("button", { name: slot + " auswählen", exact: true })
    .click();
  await page.getByLabel("Builder-Gegenstand suchen").fill(String(id));
  const button = page.getByRole("button", {
    name: "In " + slot + " ausrüsten",
    exact: true,
  });
  await expect(button).toHaveCount(1);
  await button.click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
}
test("builder navigation and supplied class images render without overflow at desktop and narrow widths", async ({
  page,
  request,
}) => {
  await setup(page);
  await expect(page.locator(".builder-class-heading img")).toHaveAttribute(
    "src",
    /classes\/9-thumb.webp/,
  );
  await expect
    .poll(() =>
      page
        .locator(".builder-class-heading img")
        .evaluate((i: HTMLImageElement) => i.naturalWidth),
    )
    .toBeGreaterThan(0);
  for (const width of [600, 1366, 1920, 2560, 3440]) {
    await page.setViewportSize({ width, height: 1100 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  for (const id of [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20,
  ]) {
    const r = await request.get(`/classes/${id}.webp`);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/webp");
  }
});
test("real items equip in distinct slots; totals and instance exomaging update immediately", async ({
  page,
  request,
}) => {
  await setup(page);
  await equip(page, "Ring 1", 2469);
  await expect(
    page.locator(".builder-summary-metrics strong").nth(0),
  ).toHaveText("8");
  await page
    .getByRole("button", { name: "Ring 1 bearbeiten", exact: true })
    .click();
  await page.getByText("Exomagie & Overmaging", { exact: true }).click();
  await page.getByLabel("Exomagie 8", { exact: true }).fill("1");
  await expect(
    page.locator(".builder-summary-metrics strong").nth(1),
  ).toHaveText("4");
  await page.locator("#builder-save").click();
  await expect(
    page.getByRole("status").filter({ hasText: "Build gespeichert" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".builder-summary-metrics strong").nth(1),
  ).toHaveText("4");
  const original = (
    await (
      await request.get(server + "/api/builder/items?q=2469&slot=ring1")
    ).json()
  ).data[0];
  expect(original.effects.find((e: { id: number }) => e.id === 12).max).toBe(1);
  await page
    .getByRole("button", { name: "Ring 1 entfernen", exact: true })
    .click();
  await expect(
    page.locator(".builder-summary-metrics strong").nth(0),
  ).toHaveText("7");
});
test("picker strictly limits slots and shares numeric filters with the encyclopedia", async ({
  page,
  request,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Hut auswählen", exact: true })
    .click();
  await page.getByLabel("Builder-Gegenstand suchen").fill("2469");
  await expect(
    page.getByText("0 passende Gegenstände", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Auswahl schließen" }).click();
  const effects = encodeURIComponent(JSON.stringify([{ id: 12, min: 1 }]));
  const a = (
    await (
      await request.get(
        server + "/api/builder/items?q=Gelano&effects=" + effects,
      )
    ).json()
  ).data;
  const b = (
    await (
      await request.get(server + "/api/items?q=Gelano&effects=" + effects)
    ).json()
  ).data;
  expect(a.map((i: { id: number }) => i.id)).toEqual(
    b.map((i: { id: number }) => i.id),
  );
  await page.getByRole("button", { name: "Gegenstände", exact: true }).click();
  await page.locator(".effect-filters summary").click();
  await page.getByLabel("AP", { exact: true }).check();
  await expect(page).toHaveURL(/effects=/);
  await page.getByLabel("Minimum 12").fill("1");
  await expect(page.locator(".v2-items-page")).toBeVisible();
  await page.getByRole("button", { name: "Effektfilter zurücksetzen" }).click();
  await expect(page.getByLabel("AP", { exact: true })).not.toBeChecked();
});
test("character Sets action adopts class/level and preserves multiple builds over reload", async ({
  page,
  request,
}) => {
  const name = "Builder-" + crypto.randomUUID().slice(0, 8);
  const c = (
    await (
      await request.post(server + "/api/characters", {
        headers,
        data: {
          name,
          server: "E2E",
          className: "Sacrieur",
          classId: 11,
          level: 180,
        },
      })
    ).json()
  ).data;
  await setup(page, "/builder?characterId=" + c.id);
  await expect(
    page.getByRole("heading", { name: name + " – Sets" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Neuer Build", exact: true }).click();
  await expect(page.getByLabel("Level", { exact: true })).toHaveValue("180");
  await expect(
    page.getByRole("combobox", { name: /Builder-Klasse/ }),
  ).toContainText("Sacrieur");
  await page.getByLabel("Buildname", { exact: true }).fill(name + " – Stärke");
  await page.locator("#builder-save").click();
  await expect(
    page.getByRole("status").filter({ hasText: "Build gespeichert" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Duplizieren", exact: true }).click();
  await page.locator("#builder-save").click();
  await expect(
    page.getByRole("status").filter({ hasText: "Build gespeichert" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Gespeicherte Sets" }).click();
  await expect(
    page
      .locator(".builder-saved-grid .builder-result")
      .filter({ hasText: name }),
  ).toHaveCount(2);
  await page.reload();
  const list = (
    await (
      await request.get(server + "/api/builder/builds?characterId=" + c.id, {
        headers,
      })
    ).json()
  ).data;
  expect(list).toHaveLength(2);
  await page.getByRole("button", { name: "Charaktere", exact: true }).click();
  const card = page.locator(".v2-character-card").filter({ hasText: name });
  await expect(card).toContainText("2 gespeicherte Sets");
  await card.getByRole("button", { name: "Sets", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: name + " – Sets" }),
  ).toBeVisible();
});
test("spell catalog switches versions without mixing mechanics and shows actual spell icons", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("tab", { name: "Zauber & Schaden" }).click();
  await expect(page.locator(".spell-card")).toHaveCount(44);
  await expect(
    page.locator(".spell-card").first().locator("img"),
  ).toHaveAttribute("src", /^\/spells\/\d+\.png$/);
  await page
    .getByRole("combobox", { name: "Datenversion", exact: true })
    .selectOption("3.6.12.16");
  await expect(page.locator(".spell-card")).toHaveCount(44);
  await expect(page.locator(".spell-card").first()).toContainText("3.6.12.16");
  await expect(
    page.locator(".spell-card").first().locator("h3"),
  ).not.toBeEmpty();
  await page
    .getByRole("button", { name: "Waffen anzeigen", exact: true })
    .click();
  await expect(
    page.getByText("Rüste eine Waffe aus, um deren Schaden zu prüfen."),
  ).toBeVisible();
});
test("offline edits survive reload and synchronize on reconnection", async ({
  page,
  request,
}) => {
  await setup(page);
  const name = "Offline-" + crypto.randomUUID().slice(0, 8);
  await page.getByLabel("Buildname", { exact: true }).fill(name);
  await page.locator("#builder-save").click();
  await expect(
    page.getByRole("status").filter({ hasText: "Build gespeichert" }),
  ).toBeVisible();
  await page.route(server + "/**", (r) => r.abort());
  await page.getByLabel("Buildname", { exact: true }).fill(name + " geändert");
  await page.locator("#builder-save").click();
  await expect(
    page.getByRole("status").filter({ hasText: "Offline gespeichert" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Buildname", { exact: true })).toHaveValue(
    name + " geändert",
  );
  await page.unroute(server + "/**");
  await page.getByRole("button", { name: /Synchronisieren \(1\)/ }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Builds synchronisiert" }),
  ).toBeVisible();
  const all = (
    await (
      await request.get(server + "/api/builder/builds", { headers })
    ).json()
  ).data;
  expect(all.some((b: { name: string }) => b.name === name + " geändert")).toBe(
    true,
  );
});
test("versioned JSON import/export validates schema and equipped IDs", async ({
  page,
}) => {
  await setup(page);
  await equip(page, "Ring 1", 2469);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Build exportieren", exact: true })
    .click();
  const downloaded = await download;
  const path = await downloaded.path();
  expect(path).toBeTruthy();
  const input = page.locator("input[type=file]").last();
  await input.setInputFiles(path!);
  await expect(
    page.getByRole("status").filter({ hasText: "Build importiert" }),
  ).toBeVisible();
  await expect(
    page.locator(".builder-summary-metrics strong").nth(0),
  ).toHaveText("8");
  await input.setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ format: "wrong", schema: 1, build: {} }),
    ),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Unbekanntes Austauschformat" }),
  ).toBeVisible();
});
test("optimizer runs outside UI thread, exposes progress and a bounded result or explicit failure", async ({
  page,
}) => {
  test.setTimeout(90000);
  await setup(page);
  await page.getByRole("tab", { name: "Optimierer" }).click();
  await page.getByRole("button", { name: "Gültige Builds suchen" }).click();
  await expect(page.locator(".builder-workspace")).toContainText(
    /Kandidaten geprüft/,
    { timeout: 60000 },
  );
  await expect(page.locator("progress")).toHaveJSProperty("value", 100);
  await expect(
    page.getByRole("button", { name: "Gültige Builds suchen" }),
  ).toBeEnabled();
});
test("comparison uses same spell version, target and buffs for all selected builds", async ({
  page,
  request,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const first = (
    await (
      await request.post(server + "/api/builder/builds", {
        headers,
        data: {
          name: "Vergleich A " + suffix,
          classId: 9,
          level: 200,
          gameVersion: "3.7.12.12",
        },
      })
    ).json()
  ).data;
  const second = (
    await (
      await request.post(server + "/api/builder/builds", {
        headers,
        data: {
          name: "Vergleich B " + suffix,
          classId: 9,
          level: 200,
          gameVersion: "3.7.12.12",
          buffs: [
            {
              id: "manual",
              name: "Buff nicht unbemerkt übernehmen",
              active: true,
              stats: { 32: 1000 },
            },
          ],
        },
      })
    ).json()
  ).data;
  await setup(page, "/builder/" + first.id);
  await page.getByRole("tab", { name: "Vergleichen", exact: true }).click();
  await page
    .locator(".builder-workspace")
    .getByLabel("Vergleich B " + suffix, { exact: true })
    .check();
  await expect(
    page.getByRole("heading", { name: "Identischer Zauber, identisches Ziel" }),
  ).toBeVisible();
  await expect(page.locator(".damage-comparison tbody tr")).toHaveCount(2);
  const spells = (
    await (
      await request.get(
        server + "/api/builder/spells?version=3.7.12.12&classId=9",
      )
    ).json()
  ).data;
  const valid = spells
    .flatMap((s: any) => s.levels.map((l: any) => ({ s, l })))
    .find(
      ({ l }: any) =>
        !l.restrictions.statesCriterion &&
        l.minRange <= 1 &&
        l.maxRange >= 1 &&
        l.effects.some((e: any) => e.kind === "damage") &&
        l.effects.every((e: any) => e.supported || e.kind === "buff") &&
        l.criticalEffects.every((e: any) => e.supported || e.kind === "buff"),
    );
  expect(valid).toBeTruthy();
  await page
    .getByRole("combobox", { name: "Vergleichszauber", exact: true })
    .selectOption(String(valid.s.id));
  await page
    .getByRole("combobox", { name: "Zauberrang", exact: true })
    .selectOption(String(valid.l.id));
  const cells = await page
    .locator(".damage-comparison tbody tr")
    .allTextContents();
  expect(cells[1]).toContain("0.00");
  expect(second.id).toBeTruthy();
});
