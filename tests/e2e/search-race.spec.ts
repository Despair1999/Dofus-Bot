import { configure } from "./environment";
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => configure(page));

test("a delayed old search never replaces newer suggestions", async ({
  page,
}) => {
  await page.route("**/api/items?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("q") === "gela")
      await new Promise((resolve) => setTimeout(resolve, 900));
    try {
      await route.continue();
    } catch {
      /* The client intentionally aborts the obsolete request. */
    }
  });
  await page.goto("/#/items/search");
  const input = page.getByRole("combobox", { name: "Gegenstände suchen" });
  const old = page.waitForRequest(
    (request) => new URL(request.url()).searchParams.get("q") === "gela",
  );
  await input.fill("gela");
  await old;
  await input.fill("gelano");
  const suggestions = page.getByRole("listbox", { name: "Suchvorschläge" });
  await expect(
    suggestions.getByRole("option", { name: /^Gelano / }),
  ).toBeVisible();
  await page.waitForTimeout(1100);
  await expect(suggestions).not.toContainText("Gelacape");
  await expect(input).toHaveValue("gelano");
});
