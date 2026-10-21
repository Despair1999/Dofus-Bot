import { test, expect } from "@playwright/test";

// UI contract tests use explicit test responses. Actual model/network-blocked
// inference is tested separately by test-translator-offline.py.
test("two independent translator cards: manual, debounced, clipboard and preference persistence", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/api/translator/status", (route) =>
    route.fulfill({
      json: {
        data: {
          ready: true,
          runtimeAvailable: true,
          installing: false,
          engine: "UI test fixture",
          models: [],
        },
      },
    }),
  );
  const requests: { source: string; target: string; text: string }[] = [];
  await page.route("**/api/translator/translate", async (route) => {
    const payload = route.request().postDataJSON() as (typeof requests)[number];
    requests.push(payload);
    await route.fulfill({
      json: { data: { text: `UI fixture: ${payload.text}`, pivot: false } },
    });
  });
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "companion-token",
      "translator-e2e-only-secret-0000000000",
    ),
  );
  await page.goto("/#/translator");
  const cards = page.locator(".translator-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).getByLabel("Ausgangssprache")).toHaveValue("fr");
  await expect(cards.nth(1).getByLabel("Ausgangssprache")).toHaveValue("de");
  await cards.nth(0).getByLabel("Zu übersetzender Text").fill("Bonjour");
  await cards
    .nth(0)
    .getByRole("button", { name: "Übersetzen", exact: true })
    .click();
  await expect(cards.nth(0).locator(".translator-output")).toHaveText(
    "UI fixture: Bonjour",
  );
  await expect(cards.nth(1).getByLabel("Zu übersetzender Text")).toHaveValue(
    "",
  );
  await cards
    .nth(0)
    .getByRole("button", { name: "Kopieren", exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "UI fixture: Bonjour",
  );
  await cards.nth(1).getByLabel("Automatisch übersetzen").check();
  await cards.nth(1).getByLabel("Zu übersetzender Text").fill("Antwort");
  await expect(cards.nth(1).locator(".translator-output")).toHaveText(
    "UI fixture: Antwort",
  );
  expect(requests).toEqual([
    { source: "fr", target: "de", text: "Bonjour" },
    { source: "de", target: "fr", text: "Antwort" },
  ]);
  await cards.nth(1).getByTitle("Sprachen tauschen").click();
  await expect(cards.nth(1).getByLabel("Ausgangssprache")).toHaveValue("fr");
  await page.reload();
  await expect(cards.nth(1).getByLabel("Ausgangssprache")).toHaveValue("fr");
  await expect(cards.nth(1).getByLabel("Automatisch übersetzen")).toBeChecked();
  await expect(cards.nth(0).getByLabel("Zu übersetzender Text")).toHaveValue(
    "",
  );
});

test("an old translation cannot replace an edited message and errors retain input", async ({
  page,
}) => {
  await page.route("**/api/translator/status", (route) =>
    route.fulfill({
      json: {
        data: {
          ready: true,
          runtimeAvailable: true,
          installing: false,
          engine: "UI test fixture",
          models: [],
        },
      },
    }),
  );
  await page.route("**/api/translator/translate", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route
      .fulfill({ status: 503, json: { error: "UI test: missing model" } })
      .catch(() => {});
  });
  await page.goto("/#/translator");
  const card = page.locator(".translator-card").first();
  const input = card.getByLabel("Zu übersetzender Text");
  await input.fill("Alter Text");
  await card.getByRole("button", { name: "Übersetzen", exact: true }).click();
  await input.fill("Neuer Text");
  await expect(card.locator(".translator-output")).not.toContainText(
    "Alter Text",
  );
  await card.getByRole("button", { name: "Übersetzen", exact: true }).click();
  await expect(card.getByRole("alert")).toHaveText("UI test: missing model");
  await expect(input).toHaveValue("Neuer Text");
});
