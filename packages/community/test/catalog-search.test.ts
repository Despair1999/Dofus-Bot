import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { searchCatalog, type CatalogItem } from "../src/catalog-search";
import { guildProfileSchema, guildSettingsSchema } from "../src/model";
const items: CatalogItem[] = JSON.parse(
  readFileSync(
    new URL(
      "../../../apps/website/public/community-items.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
test("complete versioned market catalog includes tradeable resources, consumables, equipment and cosmetics", () => {
  const wool = searchCatalog(items, "Fresssackwolle");
  assert.ok(wool.some((i) => i.id === 384 && i.category === "resources"));
  assert.equal(searchCatalog(items, "384")[0].id, 384);
  assert.ok(searchCatalog(items, "Gobball Wool").some((i) => i.id === 384));
  assert.ok(searchCatalog(items, "wolle").length > 1);
  assert.equal(searchCatalog(items, "").length, items.length);
  for (const category of ["equipment", "resources", "consumables", "cosmetics"])
    assert.ok(items.filter((i) => i.category === category).length > 1000);
  assert.ok(items.every((i) => i.tradeable === true));
  assert.equal(
    searchCatalog([{ ...items[0], tradeable: false }], items[0].name).length,
    0,
  );
});
test("search tolerates accents and does not truncate matching results", () => {
  const sample = Array.from({ length: 75 }, (_, i) => ({
    id: i + 1,
    name: `Étoffe ${i}`,
    iconUrl: "",
    tradeable: true,
  }));
  assert.equal(searchCatalog(sample, "etoffe").length, 75);
});
test("guild biography is optional text with bounded fields, no role or membership injection", () => {
  assert.deepEqual(
    guildProfileSchema.parse({
      personalStatus: "Dungeon 🎲",
      biography: "Zeile 1\nZeile 2",
    }),
    { personalStatus: "Dungeon 🎲", biography: "Zeile 1\nZeile 2" },
  );
  assert.equal(
    guildProfileSchema.safeParse({
      personalStatus: "x".repeat(101),
      biography: "",
    }).success,
    false,
  );
  assert.equal(
    guildProfileSchema.safeParse({
      personalStatus: "",
      biography: "x".repeat(501),
    }).success,
    false,
  );
  assert.equal(
    guildProfileSchema.safeParse({
      personalStatus: "",
      biography: "",
      role: "owner",
    }).success,
    false,
  );
  assert.equal(
    guildProfileSchema.safeParse({ personalStatus: "", biography: "" }).success,
    true,
  );
});
test("settings validate before writes and normalize supported Discord invitations", () => {
  const value = {
    guildName: "Test",
    server: "Test",
    description: "",
    rules: "",
    admission: "",
    discordUrl: "discord.gg/abc",
    emblem: "",
    registrationEnabled: true,
    privacyUrl: "https://example.test/privacy",
    termsUrl: "https://example.test/terms",
    legalVersion: "test",
  };
  assert.equal(
    guildSettingsSchema.parse(value).discordUrl,
    "https://discord.gg/abc",
  );
  assert.equal(
    guildSettingsSchema.safeParse({
      ...value,
      discordUrl: "https://discord.com/channels/123",
    }).success,
    false,
  );
  assert.equal(
    guildSettingsSchema.safeParse({
      ...value,
      emblem: "data:image/webp;base64,invalid",
    }).success,
    false,
  );
});
