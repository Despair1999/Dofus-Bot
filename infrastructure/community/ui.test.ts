import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "@playwright/test";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { PersonalStore } from "../../apps/backend/src/store.js";
import { GameDataStore } from "../../packages/game-data/src/index.ts";
import { createApp } from "../../apps/backend/src/app.js";
import { mkdirSync, createWriteStream } from "node:fs";
const projectId = "demo-dofus-community",
  admin = initializeApp({ projectId }, "ui-tests"),
  token = "local-ui-emulator-test-bearer-at-least-32-characters",
  password = "emulator-ui-password-123";
let browser: Browser, website: Page, desktop: Page, adminPage: Page;
const children: ChildProcess[] = [];
const personal = new PersonalStore(":memory:"),
  game = new GameDataStore(":memory:");
let backend: Awaited<ReturnType<typeof createApp>>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function ready(url: string) {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* An absent fixture user is expected on the first run. */
    }
    await sleep(250);
  }
  throw Error("Dev server not ready: " + url);
}
async function vite(pkg: string, port: string) {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const folder = ".data/community-ui-dist";
  const log = createWriteStream(`test-results/community-vite-${port}.log`);
  const build = spawn(
    command,
    [
      "--filter",
      pkg,
      "exec",
      "vite",
      "build",
      "--mode",
      "emulator-test",
      "--outDir",
      folder,
    ],
    {
      env: { ...process.env, VITE_COMMUNITY_EMULATORS: "true" },
      shell: process.platform === "win32",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  build.stdout?.pipe(log, { end: false });
  build.stderr?.pipe(log, { end: false });
  await new Promise<void>((resolve, reject) => {
    build.once("error", reject);
    build.once("exit", (code) =>
      code === 0 ? resolve() : reject(Error("Fixture build failed: " + pkg)),
    );
  });
  const child = spawn(
    command,
    [
      "--filter",
      pkg,
      "exec",
      "vite",
      "preview",
      "--outDir",
      folder,
      "--host",
      "127.0.0.1",
      "--port",
      port,
      "--strictPort",
    ],
    {
      env: { ...process.env, VITE_COMMUNITY_EMULATORS: "true" },
      shell: process.platform === "win32",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  children.push(child);
}
before(
  async () => {
    const auth = getAuth(admin),
      db = getFirestore(admin);
    for (const [uid, email, role] of [
      ["ui-player", "ui-player@example.test", "member"],
      ["ui-owner", "ui-owner@example.test", "owner"],
    ]) {
      try {
        await auth.deleteUser(uid);
      } catch {
        /* An absent fixture user is expected on the first run. */
      }
      await auth.createUser({ uid, email, password, emailVerified: true });
      await db.doc(`profiles/${uid}`).set({
        uid,
        dofusName: uid === "ui-player" ? "Nehra" : "Gildenleitung",
        discordName: uid + "99",
        server: "Test",
        mainCharacterId: "",
        legalVersion: "ui-test-v1",
        legalAcceptedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.doc(`memberships/${uid}`).set({
        uid,
        status: "approved",
        rank: role === "owner" ? "Gildenleitung" : "Mitglied",
        displayName: "",
        revision: 1,
        lastAudit: "",
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (role === "owner") await db.doc(`roles/${uid}`).set({ role });
    }
    await db.doc("platform/legal").set({
      registrationEnabled: false,
      privacyUrl: "",
      termsUrl: "",
      legalVersion: "ui-test-v1",
      revision: 1,
      lastAudit: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
    await db.doc("platform/config").set({
      guildName: "UI-Testgilde",
      server: "Test",
      description: "Gemeinsam die Welt der Zwölf entdecken.",
      discordUrl: "",
      emblem: "",
      rules: "Private Regeln",
      admission: "",
      revision: 1,
      lastAudit: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
    backend = await createApp({
      personal,
      game,
      token,
      allowedTestOrigins: ["http://127.0.0.1:1442"],
    });
    await backend.listen({ host: "127.0.0.1", port: 4331 });
    await Promise.all([
      vite("@dofus/website", "4175"),
      vite("@dofus/desktop", "1442"),
    ]);
    await Promise.all([
      ready("http://127.0.0.1:4175"),
      ready("http://127.0.0.1:1442"),
    ]);
    browser = await chromium.launch({ headless: true });
    website = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
    });
    desktop = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
    });
    adminPage = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
    });
    for (const page of [website, adminPage])
      await page.addInitScript(() =>
        sessionStorage.setItem("dofus-companion-preview-v1", "granted"),
      );
    await desktop.addInitScript(
      ({ token }) => {
        sessionStorage.setItem("companion-token", token);
        const req = indexedDB.open("dofus-companion", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("records");
        req.onsuccess = () => {
          const tx = req.result.transaction("records", "readwrite");
          tx.objectStore("records").put(
            { url: "http://127.0.0.1:4331", token: "" },
            "config",
          );
        };
      },
      { token },
    );
    mkdirSync("test-results/community-ui", { recursive: true });
  },
  { timeout: 180000 },
);
after(async () => {
  if (desktop)
    await desktop
      .screenshot({
        path: "test-results/community-ui/desktop-final.png",
        fullPage: true,
      })
      .catch(() => {});
  await browser?.close();
  for (const child of children) {
    if (process.platform === "win32" && child.pid)
      await new Promise<void>((resolve) => {
        spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        }).once("exit", () => resolve());
      });
    else child.kill();
  }
  await backend?.close();
  personal.close();
  game.close();
  await deleteApp(admin);
});
async function login(page: Page, url: string, email: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByRole("heading", { name: "Willkommen zurück" }).waitFor();
  await page.getByRole("textbox", { name: "E-Mail", exact: true }).fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page
    .locator(".cc-account-grid form")
    .getByRole("button", { name: "Anmelden", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Cloud-Synchronisierung", exact: false })
    .waitFor();
}
test(
  "website and desktop show shared account; normal users never see admin access",
  async () => {
    await login(
      website,
      "http://127.0.0.1:4175/community/account",
      "ui-player@example.test",
    );
    await website
      .getByRole("button", { name: "Cloud-Daten verwenden", exact: false })
      .click();
    await login(
      desktop,
      "http://127.0.0.1:1442/#/account",
      "ui-player@example.test",
    );
    await desktop
      .getByRole("button", { name: "Cloud-Daten verwenden", exact: false })
      .click();
    assert.equal(
      await website
        .getByRole("button", { name: "Administration öffnen" })
        .count(),
      0,
    );
    assert.equal(
      await desktop
        .getByRole("button", { name: "Administration öffnen" })
        .count(),
      0,
    );
    await website.screenshot({
      path: "test-results/community-ui/account-website.png",
      fullPage: true,
    });
    await desktop.screenshot({
      path: "test-results/community-ui/account-desktop.png",
      fullPage: true,
    });
  },
  { timeout: 120000 },
);
test(
  "a character created on website reaches the desktop character manager without a reload",
  async () => {
    await website
      .getByLabel("Charaktername", { exact: true })
      .fill("Cloud-Charakter");
    await website
      .getByRole("button", { name: "Charakter hinzufügen", exact: true })
      .click();
    await desktop
      .getByRole("heading", { name: "Cloud-Charakter", exact: true })
      .waitFor({ timeout: 30000 });
    const stored = await backend.inject({
      url: "/api/characters",
      headers: {
        authorization: `Bearer ${token}`,
        "x-companion-account": "ui-player",
      },
    });
    assert.ok(
      stored
        .json()
        .data.some((c: { name: string }) => c.name === "Cloud-Charakter"),
    );
    await desktop.screenshot({
      path: "test-results/community-ui/cloud-character.png",
      fullPage: true,
    });
  },
  { timeout: 45000 },
);
test(
  "admin siren requires real reauthentication and edits shared guild data",
  async () => {
    await login(
      adminPage,
      "http://127.0.0.1:4175/community/account",
      "ui-owner@example.test",
    );
    await adminPage
      .getByRole("button", { name: "Administration öffnen" })
      .click();
    await adminPage
      .getByLabel("Dein persönliches Accountpasswort", { exact: true })
      .fill("incorrect-password");
    await adminPage.getByRole("button", { name: "Sicher entsperren" }).click();
    await adminPage.locator(".cc-modal .cc-notice").waitFor();
    assert.equal(
      await adminPage
        .getByRole("navigation", { name: "Administration", exact: true })
        .count(),
      0,
    );
    await adminPage
      .getByLabel("Dein persönliches Accountpasswort", { exact: true })
      .fill(password);
    await adminPage.getByRole("button", { name: "Sicher entsperren" }).click();
    await adminPage
      .getByRole("navigation", { name: "Administration", exact: true })
      .waitFor();
    await adminPage
      .getByRole("button", { name: "Gildeneinstellungen", exact: true })
      .click();
    await adminPage
      .getByLabel("Gildenname", { exact: true })
      .fill("Gemeinsame Testgilde");
    await adminPage
      .getByLabel("Änderungsgrund", { exact: true })
      .fill("Integrationstest für zentrale Gildendaten");
    adminPage.once("dialog", (dialog) => dialog.accept());
    await adminPage
      .getByRole("button", { name: "Änderungen bestätigen & speichern" })
      .click();
    await adminPage
      .getByText("Gildenkonfiguration gespeichert.", { exact: true })
      .waitFor();
    assert.equal(
      (await getFirestore(admin).doc("platform/config").get()).data()!
        .guildName,
      "Gemeinsame Testgilde",
    );
    await adminPage.screenshot({
      path: "test-results/community-ui/admin-settings.png",
      fullPage: true,
    });
  },
  { timeout: 45000 },
);
