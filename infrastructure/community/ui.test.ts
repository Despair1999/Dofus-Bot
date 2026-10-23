import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { chromium, expect, type Browser, type Page } from "@playwright/test";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { PersonalStore } from "../../apps/backend/src/store.js";
import { GameDataStore } from "../../packages/game-data/src/index.ts";
import { createApp } from "../../apps/backend/src/app.js";
import {
  mkdirSync,
  createWriteStream,
  openSync,
  mkdtempSync,
  type WriteStream,
} from "node:fs";
import { join, resolve } from "node:path";
import { finished } from "node:stream/promises";
const projectId = "demo-dofus-community",
  admin = initializeApp({ projectId }, "ui-tests"),
  token = "local-ui-emulator-test-bearer-at-least-32-characters",
  password = "emulator-ui-password-123";
let browser: Browser, website: Page, desktop: Page, adminPage: Page;
const children: ChildProcess[] = [];
const logs: WriteStream[] = [];
const fixtureErrors: Error[] = [];
mkdirSync(".data", { recursive: true });
const personal = new PersonalStore(
    join(mkdtempSync(resolve(".data/community-hub-ui-")), "personal.sqlite"),
  ),
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
  // A fresh checkout has no test-results directory. Open synchronously so failures
  // belong to this hook instead of becoming unhandled errors after tests pass.
  mkdirSync("test-results", { recursive: true });
  const log = createWriteStream("", {
    fd: openSync(`test-results/community-vite-${port}.log`, "w"),
  });
  log.on("error", (error) => fixtureErrors.push(error));
  logs.push(log);
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
  child.stdout?.pipe(log, { end: false });
  child.stderr?.pipe(log, { end: false });
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
      registrationEnabled: true,
      privacyUrl: "https://dofus-companion.web.app/datenschutz",
      termsUrl: "https://dofus-companion.web.app/nutzungsbedingungen",
      guildActive: true,
      legalVersion: "ui-test-v1",
      revision: 1,
      lastAudit: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
    await db.doc("platform/config").set({
      archived: false,
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
  for (const log of logs) {
    log.end();
    await finished(log);
  }
  personal.close();
  game.close();
  await deleteApp(admin);
  assert.deepEqual(
    fixtureErrors,
    [],
    "Fixture logging must finish without asynchronous errors",
  );
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

test(
  "calendar renders real month cells and preserves the chosen event timezone",
  async () => {
    await website.goto("http://127.0.0.1:4175/community/events");
    await website.getByText("Event organisieren", { exact: true }).click();
    await website
      .getByLabel("Titel", { exact: true })
      .fill("UI Kalendertermin");
    const now = new Date(),
      day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    await website
      .getByLabel("Datum & Uhrzeit (lokale Eingabe)", { exact: true })
      .fill(day + "T20:00");
    await website
      .getByLabel("Anzeige-Zeitzone", { exact: true })
      .fill("Europe/Berlin");
    await website
      .getByRole("button", { name: "Veröffentlichen", exact: true })
      .click();
    await website
      .getByRole("heading", { name: "UI Kalendertermin", exact: true })
      .waitFor();
    await website
      .getByLabel("Kalenderansicht", { exact: true })
      .selectOption("month");
    await website.getByRole("grid").waitFor();
    assert.equal(await website.getByRole("gridcell").count(), 42);
    await website.getByRole("button", { name: /UI Kalendertermin/ }).click();
    await website
      .getByRole("heading", { name: "UI Kalendertermin", exact: true })
      .waitFor();
    const saved = await getFirestore(admin)
      .collection("activities")
      .where("title", "==", "UI Kalendertermin")
      .get();
    assert.equal(saved.docs[0].data().timezone, "Europe/Berlin");
    assert.equal(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Berlin",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(saved.docs[0].data().startsAt)),
      "20:00",
    );
    await website.screenshot({
      path: "test-results/community-ui/calendar.png",
      fullPage: true,
    });
  },
  { timeout: 45000 },
);

test(
  "shared web builder saves a real equipment build to the desktop",
  async () => {
    await website.goto("http://127.0.0.1:4175/community/account");
    await website
      .getByRole("button", { name: "Neuen Build planen", exact: true })
      .click();
    await website
      .getByLabel("Buildname", { exact: true })
      .fill("UI geteilter Build");
    await website
      .getByLabel("Passenden Gegenstand suchen", { exact: true })
      .fill("Spitzhut");
    await website
      .getByRole("button", { name: /Spitzhut.*Stufe/ })
      .first()
      .click();
    await website
      .getByRole("button", {
        name: "Build speichern & synchronisieren",
        exact: true,
      })
      .click();
    await website
      .getByRole("heading", { name: "UI geteilter Build", exact: true })
      .waitFor();
    const start = Date.now();
    let builds: any[] = [];
    while (Date.now() - start < 20000) {
      const r = await backend.inject({
        url: "/api/builder/builds",
        headers: {
          authorization: `Bearer ${token}`,
          "x-companion-account": "ui-player",
        },
      });
      builds = r.json().data ?? [];
      if (builds.some((b) => b.name === "UI geteilter Build")) break;
      await sleep(150);
    }
    const saved = builds.find((b) => b.name === "UI geteilter Build");
    assert.ok(saved, "Web build must reach existing desktop builder table");
    assert.ok(Object.keys(saved.equipment).length > 0);
  },
  { timeout: 45000 },
);

test(
  "account character reaches sidebar and professions, survives restart and reaches an isolated second backend",
  async () => {
    await desktop.goto("http://127.0.0.1:1442/#/professions");
    const option = desktop
      .getByLabel("Aktiver Charakter", { exact: true })
      .locator("option")
      .filter({ hasText: "Cloud-Charakter" });
    await option.waitFor({ state: "attached" });
    await desktop
      .getByLabel("Aktiver Charakter", { exact: true })
      .selectOption((await option.getAttribute("value"))!);
    await desktop.locator(".profession-manager summary").click();
    const farmer = desktop.getByLabel("Bauer Berufslevel", { exact: true });
    await farmer.fill("200");
    await farmer.press("Tab");
    const wood = desktop.getByLabel("Holzfäller Berufslevel", { exact: true });
    await wood.fill("150");
    await wood.press("Tab");
    const card = desktop.locator(".profession-card").first();
    await card.locator('input[type="number"]').fill("3");
    await card
      .getByRole("button", { name: "Fortschritt speichern", exact: true })
      .click();
    const headers = {
      authorization: `Bearer ${token}`,
      "x-companion-account": "ui-player",
    };
    const chars = (
      await backend.inject({ url: "/api/characters", headers })
    ).json().data;
    const character = chars.find((c: any) => c.name === "Cloud-Charakter");
    assert.ok(character);
    let snapshot: any;
    for (let attempt = 0; attempt < 100; attempt++) {
      snapshot = (
        await backend.inject({
          url: `/api/profession-personal/${character.id}`,
          headers,
        })
      ).json().data;
      if (
        snapshot?.levels.some((l: any) => l.jobId === 28 && l.level === 200) &&
        snapshot?.levels.some((l: any) => l.jobId === 2 && l.level === 150) &&
        snapshot?.quests.some((q: any) => q.quantity === 3)
      )
        break;
      await sleep(100);
    }
    assert.ok(
      snapshot.levels.some((l: any) => l.jobId === 28 && l.level === 200),
    );
    assert.ok(
      snapshot.levels.some((l: any) => l.jobId === 2 && l.level === 150),
    );
    assert.ok(snapshot.quests.some((q: any) => q.quantity === 3));
    await backend.close();
    backend = await createApp({
      personal,
      game,
      token,
      allowedTestOrigins: ["http://127.0.0.1:1442"],
    });
    await backend.listen({ host: "127.0.0.1", port: 4331 });
    await desktop.reload();
    await desktop.locator(".profession-manager summary").click();
    await expect(
      desktop.getByLabel("Bauer Berufslevel", { exact: true }),
    ).toHaveValue("200");
    await expect(
      desktop.getByLabel("Holzfäller Berufslevel", { exact: true }),
    ).toHaveValue("150");
    const otherStore = new PersonalStore(
      join(
        mkdtempSync(resolve(".data/community-hub-second-")),
        "personal.sqlite",
      ),
    );
    const otherBackend = await createApp({
      personal: otherStore,
      game,
      token,
      allowedTestOrigins: ["http://127.0.0.1:1442"],
    });
    const address = await otherBackend.listen({ host: "127.0.0.1", port: 0 });
    const page = await browser.newPage();
    try {
      await page.addInitScript(
        ({ token, address }) => {
          sessionStorage.setItem("companion-token", token);
          const req = indexedDB.open("dofus-companion", 1);
          req.onupgradeneeded = () => req.result.createObjectStore("records");
          req.onsuccess = () =>
            req.result
              .transaction("records", "readwrite")
              .objectStore("records")
              .put({ url: address, token: "" }, "config");
        },
        { token, address },
      );
      await login(
        page,
        "http://127.0.0.1:1442/#/account",
        "ui-player@example.test",
      );
      await page
        .getByRole("button", { name: "Cloud-Daten verwenden", exact: false })
        .click();
      for (let attempt = 0; attempt < 150; attempt++) {
        const response = await otherBackend.inject({
          url: `/api/profession-personal/${character.id}`,
          headers,
        });
        if (
          response.statusCode === 200 &&
          response
            .json()
            .data.levels.some((l: any) => l.jobId === 2 && l.level === 150)
        ) {
          assert.ok(
            response.json().data.quests.some((q: any) => q.quantity === 3),
          );
          break;
        }
        if (attempt === 149)
          assert.fail(
            "Second isolated backend did not receive professions and gathering progress",
          );
        await sleep(100);
      }
      await page.goto("http://127.0.0.1:1442/#/professions");
      await page.locator(".profession-manager summary").click();
      await expect(
        page.getByLabel("Bauer Berufslevel", { exact: true }),
      ).toHaveValue("200");
    } finally {
      await page.close();
      await otherBackend.close();
      otherStore.close();
    }
  },
  { timeout: 100000 },
);

test(
  "guild hub replaces duplicate marketplace, opens accessible profiles and synchronizes biography",
  async () => {
    await website.goto("http://127.0.0.1:4175/community/account");
    website.once("dialog", (d) => d.accept());
    await website
      .getByRole("button", {
        name: "Charaktere ausdrücklich mit Gilde teilen",
        exact: true,
      })
      .click();
    await website
      .getByText("Charaktere mit der Gilde geteilt.", { exact: true })
      .waitFor();
    await website.goto("http://127.0.0.1:4175/community/members");
    await website
      .getByRole("heading", { name: "Gildenmitglieder", exact: true })
      .waitFor();
    assert.equal(
      await website
        .getByRole("navigation", { name: "Community", exact: true })
        .getByRole("link", { name: "Mitglieder", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await website
        .getByRole("heading", { name: "Gildenmarktplatz", exact: true })
        .count(),
      0,
    );
    const playerName = (
      await getFirestore(admin).doc("profiles/ui-player").get()
    ).data()!.dofusName;
    await website
      .getByRole("button", {
        name: `Profil von ${playerName} öffnen`,
        exact: true,
      })
      .click();
    const dialog = website.getByRole("dialog", {
      name: playerName,
      exact: true,
    });
    await dialog.waitFor();
    await dialog
      .getByRole("button", { name: "Profil bearbeiten", exact: true })
      .click();
    await dialog
      .getByLabel("Persönlicher Status", { exact: true })
      .fill("Heute für Dungeons verfügbar 🎲");
    await dialog
      .getByLabel("Biografie", { exact: true })
      .fill("Helfe gern\nbei Erfolgen. <b>Kein HTML</b>");
    await dialog
      .getByRole("button", { name: "Profil speichern", exact: true })
      .click();
    await dialog
      .getByText("Helfe gern\nbei Erfolgen. <b>Kein HTML</b>", { exact: true })
      .waitFor();
    assert.equal(
      await dialog.locator("b").filter({ hasText: "Kein HTML" }).count(),
      0,
    );
    await website.keyboard.press("Escape");
    assert.equal(await website.getByRole("dialog").count(), 0);
    await desktop.goto("http://127.0.0.1:1442/#/guild");
    await desktop
      .getByRole("button", {
        name: `Profil von ${playerName} öffnen`,
        exact: true,
      })
      .click();
    await desktop
      .getByRole("dialog")
      .getByText("Heute für Dungeons verfügbar 🎲", { exact: true })
      .waitFor();
    await desktop.keyboard.press("Escape");
    const ownerName = (
      await getFirestore(admin).doc("profiles/ui-owner").get()
    ).data()!.dofusName;
    await website
      .getByRole("button", {
        name: `Profil von ${ownerName} öffnen`,
        exact: true,
      })
      .click();
    assert.equal(
      await website
        .getByRole("dialog")
        .getByRole("button", { name: "Profil bearbeiten", exact: true })
        .count(),
      0,
    );
    await website.keyboard.press("Escape");
    await website
      .getByRole("button", {
        name: `Profil von ${playerName} öffnen`,
        exact: true,
      })
      .click();
    await website
      .getByRole("dialog")
      .getByRole("button", { name: "Profil bearbeiten", exact: true })
      .click();
    await website
      .getByRole("dialog")
      .getByLabel("Persönlicher Status", { exact: true })
      .fill("");
    await website
      .getByRole("dialog")
      .getByLabel("Biografie", { exact: true })
      .fill("");
    await website
      .getByRole("dialog")
      .getByRole("button", { name: "Profil speichern", exact: true })
      .click();
    await website
      .getByRole("dialog")
      .getByText("Noch keine Biografie hinterlegt.", { exact: true })
      .waitFor();
    await website.keyboard.press("Escape");
  },
  { timeout: 60000 },
);

test(
  "guild emblem PNG, JPEG and WebP use Blob conversion and replace safely in website and desktop",
  async () => {
    await adminPage
      .getByRole("button", { name: "Gildeneinstellungen", exact: true })
      .click();
    for (const mime of ["image/png", "image/jpeg", "image/webp"]) {
      const encoded = await adminPage.evaluate((mime) => {
        const canvas = document.createElement("canvas");
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#a1ce62";
        ctx.fillRect(8, 8, 32, 32);
        return canvas.toDataURL(mime).split(",")[1];
      }, mime);
      await adminPage.locator('input[type="file"]').setInputFiles({
        name:
          "guild-qa." + (mime === "image/jpeg" ? "jpg" : mime.split("/")[1]),
        mimeType: mime,
        buffer: Buffer.from(encoded, "base64"),
      });
      const preview = adminPage.getByRole("img", {
        name: "Wappenvorschau",
        exact: true,
      });
      await expect(preview).toHaveAttribute("src", /^blob:/);
      await preview.evaluate(async (img: HTMLImageElement) => {
        await img.decode();
      });
      if (mime === "image/png")
        assert.equal(
          await preview.evaluate((img: HTMLImageElement) => {
            const canvas = document.createElement("canvas");
            canvas.width = 192;
            canvas.height = 192;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0);
            return ctx.getImageData(0, 0, 1, 1).data[3];
          }),
          0,
        );
      await adminPage
        .getByLabel("Änderungsgrund", { exact: true })
        .fill("Wappenkonvertierung und Austausch prüfen");
      adminPage.once("dialog", (d) => d.accept());
      await adminPage
        .getByRole("button", {
          name: "Änderungen bestätigen & speichern",
          exact: true,
        })
        .click();
      await adminPage
        .getByText("Gildenkonfiguration gespeichert.", { exact: true })
        .waitFor();
      const config = (
        await getFirestore(admin).doc("platform/config").get()
      ).data()!;
      assert.match(config.emblem, /^guild-emblems\/default\/.*\.webp$/);
      await desktop.goto("http://127.0.0.1:1442/#/guild");
      const displayed = desktop
        .getByRole("img", { name: "Gildenwappen", exact: true })
        .first();
      await displayed.waitFor();
      await displayed.evaluate(async (img: HTMLImageElement) => {
        await img.decode();
      });
    }
    await adminPage
      .getByRole("button", { name: "Wappen entfernen", exact: true })
      .click();
    await adminPage
      .getByLabel("Änderungsgrund", { exact: true })
      .fill("Testwappen kontrolliert entfernen");
    adminPage.once("dialog", (d) => d.accept());
    await adminPage
      .getByRole("button", {
        name: "Änderungen bestätigen & speichern",
        exact: true,
      })
      .click();
    await adminPage
      .getByText("Gildenkonfiguration gespeichert.", { exact: true })
      .waitFor();
    assert.equal(
      (await getFirestore(admin).doc("platform/config").get()).data()!.emblem,
      "",
    );
  },
  { timeout: 70000 },
);

test(
  "marketplace shows resource catalog, live seller identity, Discord and both admin visibility scopes",
  async () => {
    await website.goto("http://127.0.0.1:4175/community/marketplace");
    for (const scope of ["Gildenmarktplatz", "Globaler Marktplatz"]) {
      await website.getByRole("button", { name: scope, exact: true }).click();
      await website
        .getByText("Neues Angebot erstellen", { exact: true })
        .click();
      await website
        .getByLabel("Gegenstand im DOFUS-Katalog suchen", { exact: true })
        .fill("384");
      await website
        .getByRole("button", { name: "Suchen", exact: true })
        .click();
      await website
        .locator(".cc-search-results")
        .getByRole("button", { name: /Fresssackwolle/ })
        .click();
      await website
        .getByLabel("Kama-Preis pro Stück", { exact: true })
        .fill("55");
      await website
        .getByRole("button", { name: "Angebot veröffentlichen", exact: true })
        .click();
      await website.getByText("Angebot erstellt.", { exact: true }).waitFor();
      const card = website
        .locator(".cc-card")
        .filter({
          has: website.getByRole("heading", {
            name: "Fresssackwolle",
            exact: true,
          }),
        })
        .first();
      const seller = (
        await getFirestore(admin).doc("profiles/ui-player").get()
      ).data()!.dofusName;
      await card
        .locator(".cc-seller strong")
        .getByText(seller, { exact: true })
        .waitFor();
      assert.equal(await card.locator(".cc-discord-contact svg").count(), 1);
      assert.equal(
        await card.getByText("Inhalt melden", { exact: true }).count(),
        1,
      );
    }
    await adminPage
      .getByRole("button", { name: "Marktplatzverwaltung", exact: true })
      .click();
    const panel = adminPage.locator(".cc-panel").filter({
      has: adminPage.getByRole("heading", {
        name: "Marktplatzverwaltung",
        exact: true,
      }),
    });
    await panel
      .getByLabel("Geladene Datensätze filtern", { exact: true })
      .fill("Fresssackwolle");
    await expect(panel.locator("tbody tr")).toHaveCount(2);
    await panel
      .getByLabel("Sichtbarkeit", { exact: true })
      .selectOption("global");
    await expect(panel.locator("tbody tr")).toHaveCount(1);
    assert.equal(await panel.locator("tbody button").isDisabled(), true);
    await panel
      .getByLabel("Sichtbarkeit", { exact: true })
      .selectOption("guild");
    await expect(panel.locator("tbody tr")).toHaveCount(1);
    assert.equal(await panel.locator("tbody button").isEnabled(), true);
    const offers = await getFirestore(admin).collection("listings").get();
    assert.equal(offers.docs.filter((d) => d.data().itemId === 384).length, 2);
  },
  { timeout: 60000 },
);
