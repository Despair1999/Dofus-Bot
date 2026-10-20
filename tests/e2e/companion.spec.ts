import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
const token = readFileSync(
  process.env.COMPANION_E2E_TOKEN_FILE || ".data/backend-token",
  "utf8",
).trim();
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (token) => sessionStorage.setItem("companion-token", token),
    token,
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Dein nächstes/, level: 1 }),
  ).toBeVisible();
});
test("dashboard task survives restart, narrow layout stays within viewport", async ({
  page,
}) => {
  await page.getByLabel("Neue Aufgabe").fill("Testaufgabe aus E2E");
  await page.getByTitle("Aufgabe hinzufügen").click();
  await page.reload();
  await expect(
    page.getByText("Testaufgabe aus E2E", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Testaufgabe aus E2E erledigt").check();
  await page.reload();
  await expect(page.getByLabel("Testaufgabe aus E2E erledigt")).toBeChecked();
  mkdirSync("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/dashboard.png", fullPage: true });
  await page.setViewportSize({ width: 600, height: 900 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: "artifacts/compact-browser.png",
    fullPage: true,
  });
});
test("real item search details recipe crafting and offline favorite", async ({
  page,
  context,
}) => {
  await page.getByLabel("Gegenstände suchen").fill("Gelano");
  await page.getByRole("button", { name: "Suchen", exact: true }).click();
  await page
    .getByRole("button")
    .filter({ has: page.locator("strong", { hasText: /^Gelano$/ }) })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Gelano", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Herstellungsrezept", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Favorit umschalten", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Rezept planen", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page.getByRole("button", { name: "Favoriten", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Gelano Gegenstand/ }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: /Gelano Gegenstand/ }).click();
  await expect(
    page.getByRole("heading", { name: "Gelano", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Gelano", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
});
test("create character, real quest progress offline queue and reconnect", async ({
  page,
  request,
}) => {
  const name = `E2E-${Date.now()}`;
  let id = "";
  try {
    await page.getByRole("button", { name: "Charaktere", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Server", { exact: true }).fill("Testserver");
    await page.getByRole("combobox", { name: "Klasse", exact: true }).click();
    await page.getByRole("option", { name: /Sacrieur/ }).click();
    await page.getByLabel("Stufe", { exact: true }).fill("100");
    await page
      .getByRole("button", { name: "Registrieren", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    const chars = await request.get("http://127.0.0.1:4310/api/characters", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const created = (await chars.json()).data.find((c: any) => c.name === name);
    id = created.id;
    expect(created.classId).toBe(11);
    await page
      .getByRole("button", { name: "Profil bearbeiten", exact: true })
      .click();
    await page.getByLabel("Profilstufe", { exact: true }).fill("101");
    await page
      .getByRole("button", { name: "Profil speichern", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Charakter aktualisiert." }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Quest-Assistent", exact: true })
      .click();
    await page.getByLabel("Quests durchsuchen").fill("Endstation Astrub");
    await page
      .getByRole("button")
      .filter({
        has: page.locator("strong", { hasText: /^Endstation Astrub$/ }),
      })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Endstation Astrub",
        exact: true,
        level: 2,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Als aktuellen Schritt bestätigen" })
      .first()
      .click();
    await expect(
      page.getByText("Fortschritt gespeichert und synchronisiert."),
    ).toBeVisible();
    await page.route("http://127.0.0.1:4310/**", (route) => route.abort());
    await page
      .getByRole("button", { name: "Abschließen", exact: true })
      .click();
    await expect(
      page.getByText("Lokal gespeichert. Synchronisierung steht aus."),
    ).toBeVisible();
    await page.unroute("http://127.0.0.1:4310/**");
    await page.getByTitle("Synchronisieren", { exact: true }).click();
    await expect(
      page.getByText("Synchronisierung abgeschlossen."),
    ).toBeVisible();
    const progress = await request.get(
      `http://127.0.0.1:4310/api/characters/${id}/progress`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect((await progress.json()).data[0].status).toBe("completed");
  } finally {
    if (id)
      await request.delete(`http://127.0.0.1:4310/api/characters/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  }
});
test("scanner is opt-in and handles empty input without auto progress", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Bildschirm erkennen OCR" }).click();
  await expect(
    page.getByRole("button", { name: "OCR starten" }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Bilder verlassen dein Gerät nicht/),
  ).toBeVisible();
});
