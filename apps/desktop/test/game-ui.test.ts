import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { statDefinitions, slotDefinitions } from "@dofus/core";
import {
  attributeDefinitions,
  attribute,
  formatAttribute,
  EffectRows,
} from "../src/ui/attributes";
import GameGlyph, {
  slotGlyph,
  markerAppearance,
  glyphImage,
  mapCategories,
} from "../src/ui/GameGlyph";
import { classIllustrations } from "../src/ui/ClassArtwork";
test("shared attribute metadata covers every existing characteristic with correct units and semantic colors", () => {
  assert.equal(attributeDefinitions.length, statDefinitions.length);
  assert.equal(
    new Set(attributeDefinitions.map((d) => d.id)).size,
    statDefinitions.length,
  );
  for (const [id] of statDefinitions) {
    const d = attribute(id)!;
    assert.ok(d.label && d.category && d.color && d.icon);
  }
  assert.equal(attribute(12)!.color, "#78baff");
  assert.equal(attribute(8)!.color, "#93e69c");
  assert.equal(attribute(9)!.color, "#ff9b9f");
  assert.equal(attribute(29)!.unit, "%");
  assert.equal(attribute(22)!.label, "Glück");
  assert.equal(attribute(999999), undefined);
});
test("attribute formatting preserves signs, percentages and unsupported source effects", () => {
  assert.equal(formatAttribute(-1200), "-1.200");
  assert.equal(formatAttribute(12.5, "%", true), "+12,5 %");
  const html = renderToStaticMarkup(
    createElement(EffectRows, {
      effects: [
        { id: 12, min: 1, max: 2, label: "1 bis 2 AP" },
        { id: 99999, min: 3, max: 3, label: "Unbekannter Originaleffekt" },
        {
          id: 13,
          min: 50,
          max: 50,
          label: "Aktiver Quelleffekt",
          active: true,
        },
      ],
    }),
  );
  assert.match(html, /data-attribute="12"/);
  assert.match(html, /1 – 2/);
  assert.match(html, /Unbekannter Originaleffekt/);
  assert.match(html, /Aktiver Quelleffekt/);
  assert.doesNotMatch(html, /data-attribute="99999"/);
});
test("every equipment slot and source map category has a distinct meaningful vector mapping", () => {
  for (const [slot] of slotDefinitions) {
    const glyph = slotGlyph(slot),
      html = renderToStaticMarkup(createElement(GameGlyph, { name: glyph }));
    assert.ok(html.includes(`data-glyph="${glyph}"`));
    assert.notEqual(glyph, slot === "shield" ? "hat" : "shield");
  }
  assert.equal(slotGlyph("ring1"), slotGlyph("ring2"));
  assert.equal(slotGlyph("dofus6"), "dofus");
  assert.equal(Object.keys(mapCategories).length, 12);
  assert.equal(markerAppearance({ kind: "zaap", categoryId: 9 }).glyph, "zaap");
  assert.equal(
    markerAppearance({ kind: "poi", categoryId: 3 }).glyph,
    "workshop",
  );
  assert.ok(glyphImage("zaap", "#65d6d0").startsWith("data:image/svg+xml,"));
});
test("class artwork retains all nineteen imported ID references and does not pretend to provide full-body variants", () => {
  const root = resolve("../.."),
    report = JSON.parse(
      readFileSync(
        resolve(root, "design/class-images/import-report.json"),
        "utf8",
      ),
    );
  assert.equal(Object.keys(classIllustrations).length, 19);
  for (const entry of report.classes) {
    const mapped = classIllustrations[entry.classId];
    assert.equal(mapped.large, entry.asset);
    assert.equal(mapped.format, "portrait");
    assert.deepEqual(mapped.variants, []);
    assert.ok(
      existsSync(resolve(root, "apps/desktop/public", mapped.large.slice(1))),
    );
  }
});
