import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
const page = browser.contexts()[0].pages()[0];
await page.reload();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await expect(
  page.getByRole("heading", { name: "Bereit für dein nächstes Abenteuer?" }),
).toBeVisible({ timeout: 20000 });
await page.getByTitle("Synchronisieren", { exact: true }).click();
await expect(page.getByText("Synchronisierung abgeschlossen.")).toBeVisible({
  timeout: 15000,
});
await page.getByLabel("Globale Suche").fill("Gelano");
await page.getByRole("button", { name: "Suchen", exact: true }).click();
await page
  .getByRole("button")
  .filter({ has: page.locator("strong", { hasText: /^Gelano$/ }) })
  .first()
  .click();
await expect(
  page.getByRole("heading", { name: "Gelano", exact: true }),
).toBeVisible({ timeout: 15000 });
await page.getByRole("button", { name: "Favoriten", exact: true }).click();
if (!(await page.getByRole("button", { name: /Gelano Gegenstand/ }).count())) {
  await page.getByRole("button", { name: "Gegenstände", exact: true }).click();
  await page
    .getByRole("button", { name: "Favorit umschalten", exact: true })
    .click();
  await page.getByRole("button", { name: "Favoriten", exact: true }).click();
}
await expect(
  page.getByRole("button", { name: /Gelano Gegenstand/ }),
).toBeVisible();
await page.getByRole("button", { name: "Einstellungen", exact: true }).click();
await page
  .getByRole("button", { name: "Scanner-Hotkey registrieren", exact: true })
  .click();
await expect(
  page.getByText("Hotkey für den Scanner registriert."),
).toBeVisible();
await page.getByRole("button", { name: "Deaktivieren", exact: true }).click();
await expect(page.getByText("Hotkey deaktiviert.")).toBeVisible();
await page.getByRole("button", { name: "overlay", exact: true }).click();
await expect(
  page.getByText("DOFUS Companion · Quest", { exact: true }),
).toBeVisible();
await page.getByTitle("Hauptfenster öffnen").click();
await page.getByRole("button", { name: "compact", exact: true }).click();
await expect(page.locator(".app.compact")).toBeVisible();
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "hotbar", exact: true }).click();
await expect(page.locator(".mini")).toBeVisible();
await page.getByTitle("Hauptfenster", { exact: true }).click();
await expect(
  page.getByRole("heading", { name: "Einstellungen", exact: true }),
).toBeVisible();
await page.getByRole("button", { name: "Bildschirm erkennen OCR" }).click();
await page
  .locator("input[type=file]")
  .setInputFiles("tests/ocr/fixtures/de.png");
await page.getByRole("button", { name: "OCR starten" }).click();
await expect(page.locator("textarea")).toHaveValue(/Prüfung des Schülers/, {
  timeout: 90000,
});
await expect(
  page.getByText("Analyse beendet. Zuordnung bitte bestätigen."),
).toBeVisible();
await page.getByRole("button", { name: "Übersicht", exact: true }).click();
await mkdir("artifacts", { recursive: true });
await page.screenshot({ path: "artifacts/native-windows.png", fullPage: true });
if (errors.length) throw new Error(errors.join("\n"));
await writeFile(
  "docs/native-test.json",
  JSON.stringify(
    {
      testedAt: new Date().toISOString(),
      runtime: "Windows x64 Tauri release EXE / WebView2",
      url: page.url(),
      passed: [
        "native launch",
        "bundled backend automatic startup",
        "automatic local authentication",
        "actual Gelano search + recipe",
        "native SQLite favorite",
        "global hotkey registration and removal",
        "overlay enter and leave",
      "compact enter and leave",
      "mini hotbar enter and leave",
        "actual local screenshot OCR in production WebView2",
      ],
      pageErrors: errors,
    },
    null,
    2,
  ),
);
await browser.close();
console.log("Native Windows smoke passed");
