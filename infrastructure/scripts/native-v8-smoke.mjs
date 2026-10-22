// Attach to an explicitly launched packaged app. Never installs, launches, or
// closes a user's app and never sends global keyboard input.
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const version = JSON.parse(await readFile("package.json", "utf8")).version;
const endpoint = process.env.COMPANION_CDP ?? "http://127.0.0.1:9223";
const browser = await chromium.connectOverCDP(endpoint);
const page = browser
  .contexts()[0]
  .pages()
  .find(
    (p) =>
      p.url().startsWith("http://tauri.localhost") &&
      !p.url().includes("overlay=1"),
  );
assert.ok(
  page,
  "Packaged main WebView must be open before running this attach-only test.",
);
page.setDefaultTimeout(25_000);
const invoke = (cmd, args) =>
  page.evaluate(
    ({ cmd, args }) => window.__TAURI_INTERNALS__.invoke(cmd, args),
    { cmd, args },
  );
await expect
  .poll(() => invoke("local_connection"), { timeout: 30_000 })
  .toMatchObject({ url: "http://127.0.0.1:4310" });
const applicationId = await invoke("plugin:app|identifier");
assert.equal(
  applicationId,
  "fr.dofus.companion.qa.v8",
  "Only the isolated QA application may be exercised by this script",
);
const connection = await invoke("local_connection");
const request = async (path, body) => {
  const response = await fetch(connection.url + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${connection.token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal(response.status, 200, `${path}: ${response.status}`);
  return response.json();
};
assert.equal((await request("/health")).version, version);
assert.equal(
  (await request("/api/translator/status")).data.runtimeAvailable,
  true,
);
assert.equal(
  (await request("/api/translator/status")).data.ready,
  true,
  "Install models first, or pass COMPANION_TRANSLATOR_MODELS to the packaged app.",
);
const passed = [
  "packaged loopback backend matches version and bundled translator runtime/models are ready",
];
const originalUrl = page.url();
const native = await invoke("native_settings");
await invoke("plugin:sql|load", { db: "sqlite:companion.db" });
const keys = [
  "overlay-layouts-v2",
  "translator-preferences-v1",
  "world:active-route",
  "overlay-snapshot-v2",
  "appearance:theme",
  "navigation:tools-open",
  "ui:display",
  "ui:navigation-groups",
  "ui:sidebar-collapsed",
  "ui:world-layout",
  "ui:last-view",
  "ui:recent",
];
const backup = await invoke("plugin:sql|select", {
  db: "sqlite:companion.db",
  query: `SELECT key,value FROM records WHERE key IN (${keys.map((_, i) => "$" + (i + 1)).join(",")})`,
  values: keys,
});
const saveRecord = (key, value) =>
  invoke("plugin:sql|execute", {
    db: "sqlite:companion.db",
    query:
      "INSERT INTO records(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2",
    values: [key, JSON.stringify(value)],
  });
let overlay;
let overlayWasVisible = false;
try {
  await page.goto("http://tauri.localhost/#/world?mapId=99353610");
  await page.reload();
  await expect(page.locator("canvas[data-background='loaded']")).toBeVisible();
  await expect(page.getByLabel("Weltkarte", { exact: true })).toHaveValue("1");
  await expect(page.locator(".world-details")).toContainText("99353610");
  await page.screenshot({
    path: "artifacts/native-v8-atlas.png",
    fullPage: true,
  });
  passed.push(
    "embedded original world artwork loads in packaged WebView and interior quest target keeps its map identity",
  );
  await page.goto("http://tauri.localhost/#/settings?section=appearance");
  await page.getByRole("button", { name: /Sufokia/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");
  passed.push(
    "appearance preset is persisted by native SQLite and reapplied after reload",
  );
  await page.goto("http://tauri.localhost/#/builder");
  await expect(
    page.locator(".builder-summary-metrics .stat-ap strong"),
  ).toHaveCSS("color", "rgb(120, 186, 255)");
  await expect(
    page.locator(".builder-summary-metrics .stat-bp strong"),
  ).toHaveCSS("color", "rgb(147, 230, 156)");
  await expect(
    page.locator(".builder-summary-metrics .stat-lp strong"),
  ).toHaveCSS("color", "rgb(255, 155, 159)");
  passed.push(
    "packaged builder keeps AP BP LP semantic colors in an alternate theme",
  );
  await saveRecord("overlay-layouts-v2", {
    version: 1,
    activeId: "native-v8-fixture",
    profiles: [
      {
        id: "native-v8-fixture",
        name: "Native V8 Test",
        opacity: 94,
        fontSize: 14,
        background: "#14221b",
        compact: false,
        modules: [
          {
            id: "navigation",
            enabled: false,
            x: 12,
            y: 12,
            width: 360,
            height: 110,
          },
          {
            id: "translator-incoming",
            enabled: false,
            x: 12,
            y: 132,
            width: 360,
            height: 390,
            translator: {
              source: "fr",
              target: "de",
              automatic: false,
              minimized: false,
            },
          },
          {
            id: "translator-outgoing",
            enabled: false,
            x: 12,
            y: 532,
            width: 360,
            height: 390,
            translator: {
              source: "de",
              target: "fr",
              automatic: false,
              minimized: false,
            },
          },
        ],
      },
    ],
  });
  await invoke("save_native_settings", {
    settings: {
      ...native.settings,
      overlay: {
        ...native.settings.overlay,
        width: 460,
        height: 1000,
        clickThrough: false,
        locked: false,
      },
    },
  });
  // Start from deterministic independent directions; originals restored below.
  await saveRecord("translator-preferences-v1", [
    { source: "fr", target: "de", automatic: false, minimized: false },
    { source: "de", target: "fr", automatic: false, minimized: false },
  ]);
  await page.goto("http://tauri.localhost/#/translator");
  await page.reload();
  const cards = page.locator(".translator-card");
  await expect(cards).toHaveCount(2);
  await cards
    .nth(0)
    .getByLabel("Zu übersetzender Text")
    .fill("Salut, tu veux venir faire le donjon avec nous ?");
  await cards
    .nth(1)
    .getByLabel("Zu übersetzender Text")
    .fill("Ich bin in fünf Minuten bereit.");
  await cards
    .nth(0)
    .getByRole("button", { name: "Übersetzen", exact: true })
    .click();
  await cards
    .nth(1)
    .getByRole("button", { name: "Übersetzen", exact: true })
    .click();
  await expect(cards.nth(0).locator(".translator-output")).toContainText(
    /Dungeon|Verlies/i,
  );
  await expect(cards.nth(1).locator(".translator-output")).toContainText(
    /cinq minutes/i,
  );
  passed.push(
    "both packaged WebView translator cards execute real local FR→DE and DE→FR model inference",
  );
  for (const source of ["de", "fr", "en"])
    for (const target of ["de", "fr", "en"]) {
      if (source === target) continue;
      const result = await request("/api/translator/translate", {
        source,
        target,
        text: { de: "Ich bin bereit.", fr: "Je suis prêt.", en: "I am ready." }[
          source
        ],
      });
      assert.ok(result.data.text.trim());
      assert.equal(result.data.source, source);
      assert.equal(result.data.target, target);
    }
  passed.push(
    "all six directions through packaged service and bundled Python runtime",
  );
  await page.goto("http://tauri.localhost/#/settings?section=overlay");
  await expect(
    page.getByRole("button", {
      name: "Overlay & Hotkeys speichern",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Übersetzer · Nachrichten", { exact: true }).check();
  await page.getByLabel("Übersetzer · Antworten", { exact: true }).check();
  await page.getByLabel("Farmroute · Nächstes Ziel", { exact: true }).check();
  await page
    .getByRole("button", { name: "Overlay & Hotkeys speichern", exact: true })
    .click();
  // Explicit test navigation payload; this checks propagation/display, not route correctness.
  const navigation = {
    nextMapId: 75497730,
    coordinates: { x: 21, y: 14 },
    direction: "Test-Routenschritt",
    remaining: 3,
    resourceNames: ["Testressource"],
    step: 1,
    total: 4,
  };
  await saveRecord("world:active-route", navigation);
  await page.evaluate(
    (detail) =>
      window.dispatchEvent(new CustomEvent("companion:route", { detail })),
    navigation,
  );
  try {
    overlayWasVisible = await invoke("plugin:window|is_visible", {
      label: "overlay",
    });
  } catch {
    /* overlay not created yet */
  }
  if (!overlayWasVisible) await invoke("toggle_overlay");
  await expect
    .poll(() =>
      browser
        .contexts()[0]
        .pages()
        .some((p) => p.url().includes("overlay=1")),
    )
    .toBe(true);
  overlay = browser
    .contexts()[0]
    .pages()
    .find((p) => p.url().includes("overlay=1"));
  overlay.setDefaultTimeout(25_000);
  await expect(overlay.locator(".translator-card")).toHaveCount(2);
  await expect(
    overlay.getByText("Test-Routenschritt", { exact: false }),
  ).toBeVisible();
  await expect(overlay.getByText("[21, 14]", { exact: true })).toBeVisible();
  const overlayCards = overlay.locator(".translator-card");
  await overlayCards
    .nth(0)
    .getByLabel("Zu übersetzender Text")
    .fill("Salut, je suis prêt.");
  await overlayCards
    .nth(0)
    .getByRole("button", { name: "Übersetzen", exact: true })
    .click();
  await expect(overlayCards.nth(0).locator(".translator-output")).toContainText(
    /bereit/i,
  );
  passed.push(
    "independent native overlay contains both cards, real local translation, route coordinates and progress snapshot",
  );
  await mkdir("artifacts", { recursive: true });
  await overlay.screenshot({ path: "artifacts/v8-native-overlay.png" });
  await page.goto("http://tauri.localhost/#/translator");
  await page.screenshot({
    path: "artifacts/v8-native-translator.png",
    fullPage: true,
  });
} finally {
  for (const key of keys) {
    const previous = backup.find((row) => row.key === key);
    if (previous)
      await invoke("plugin:sql|execute", {
        db: "sqlite:companion.db",
        query:
          "INSERT INTO records(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2",
        values: [key, previous.value],
      }).catch(() => {});
    else
      await invoke("plugin:sql|execute", {
        db: "sqlite:companion.db",
        query: "DELETE FROM records WHERE key=$1",
        values: [key],
      }).catch(() => {});
  }
  await invoke("save_native_settings", { settings: native.settings }).catch(
    () => {},
  );
  if (overlay && !overlayWasVisible)
    await invoke("toggle_overlay").catch(() => {});
  await page.goto(originalUrl).catch(() => {});
  await page.reload().catch(() => {});
  // Disconnect CDP only; do not shut down the user's native app.
  await browser.close().catch(() => {});
}
const report = {
  testedAt: new Date().toISOString(),
  version,
  runtime: "Windows x64 / Tauri QA identifier / WebView2",
  isolatedProfile: true,
  applicationId,
  scope:
    "Same release source and frontend, separate native application identifier to protect productive SQLite/settings profiles; installer executable is validated separately by signature and ZIP checks.",
  passed,
  notTested: [
    "physical DOFUS window coexistence",
    "all monitor/DPI combinations",
    "system-wide external-network firewall blocking",
    "global keyboard chords",
  ],
  fixtureData:
    "Navigation snapshot is explicit fixture; translator results are real local inference. Only backed-up UI preference records were temporarily edited and restored.",
};
await writeFile(
  "docs/native-v8-test.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
