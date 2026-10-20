import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
export const backend =
  process.env.COMPANION_E2E_BACKEND ?? "http://127.0.0.1:4310";
export const token = readFileSync(
  process.env.COMPANION_E2E_TOKEN_FILE ?? ".data/backend-token",
  "utf8",
).trim();
export async function configure(page: Page) {
  await page.addInitScript(
    (token) => sessionStorage.setItem("companion-token", token),
    token,
  );
  await page.goto("/");
  await page.evaluate(async (url) => {
    const { write } = await import("/src/storage.ts");
    await write("config", { url, token: "" });
  }, backend);
  await page.reload();
}
