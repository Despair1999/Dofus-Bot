import { test, expect } from "@playwright/test";
test("screenshot is analyzed locally by the real browser OCR worker", async ({
  page,
}) => {
  test.setTimeout(120000);
  const uploads: string[] = [];
  page.on("request", (r) => {
    if (
      ["POST", "PUT"].includes(r.method()) &&
      !r.url().startsWith("http://127.0.0.1:4310/api/recognize")
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
