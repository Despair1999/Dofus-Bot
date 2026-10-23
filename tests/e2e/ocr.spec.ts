import { configure, backend } from "./environment";
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => configure(page));
test("screenshot is analyzed locally by the real browser OCR worker", async ({
  page,
}) => {
  test.setTimeout(120000);
  const uploads: string[] = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    const publicSettingsListener =
      url.hostname === "firestore.googleapis.com" &&
      url.pathname === "/google.firestore.v1.Firestore/Listen/channel";
    if (publicSettingsListener) {
      // Firebase uses POST for its read-only Listen transport. It must never carry OCR inputs/results.
      expect(r.postData() ?? "").not.toMatch(
        /data:image|image\/png|iVBORw0KGgo|Prüfung des Schülers|\x89PNG/,
      );
    }
    if (
      ["POST", "PUT"].includes(r.method()) &&
      !r.url().startsWith(`${backend}/api/recognize`) &&
      !publicSettingsListener
    )
      uploads.push(r.url());
    if (r.url().endsWith("/api/recognize")) {
      expect(r.postDataJSON()).toHaveProperty("text");
      expect(r.postData()).not.toMatch(/data:image|base64|image\/png/);
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Bildschirm erkennen OCR" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles("tests/ocr/fixtures/de.png");
  await expect(
    page.getByAltText("Freigegebener Screenshot zur lokalen Analyse"),
  ).toBeVisible();
  await page.getByRole("button", { name: "OCR starten" }).click();
  await expect(page.locator("textarea")).toHaveValue(/Prüfung des Schülers/, {
    timeout: 90000,
  });
  await expect(
    page.getByText("Analyse beendet. Zuordnung bitte bestätigen."),
  ).toBeVisible();
  expect(uploads).toEqual([]);
});
