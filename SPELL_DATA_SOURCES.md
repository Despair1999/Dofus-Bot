# Versioned spell sources

Reviewed on 20 October 2026. Source metadata and SHA256 digests: [design/builder-sources.json](design/builder-sources.json). Import/coverage: [design/builder-import-report.json](design/builder-import-report.json).

- DOFUS 3.6.12.16: https://github.com/ledouxm/dofus-sqlite/releases/tag/v6.0_3.6.12.16
- Historical 3.6 equipment and set references: original `itemsdata.json` and `itemsetsdata.json` from the same 3.6 release, verified digests in [design/builder-raw-assets.json](design/builder-raw-assets.json). Their exact 64-bit reference IDs resolve the precision loss in the SQLite conversion.
- DOFUS 3.7.12.12: https://github.com/ledouxm/dofus-sqlite/releases/tag/v6.0_3.7.12.12
- Images: published `images-spell.zip` from the latter release, SHA256 verified, exact `1x/sort_<iconId>.png` members resolved for imported class spells. Images are shared icon assets, not substitutes for versioned spell mechanics.
- Current item effects and all set tiers: https://api.dofusdu.de/dofus3/v1/ ; API version endpoint matched the existing 3.7.12.12 equipment snapshot before retrieval.

BreedData.breedSpellsId plus SpellVariantData and its junction enumerate all class spells. SpellData.spellLevels/SpellLevelData preserve all ranks, action lines, critical lines, costs, ranges, casting restrictions, state criteria and zones. EffectData retains effect descriptions and characteristic identities. Variant choices remain explicit IDs.

Every imported spell carries its exact gameplay version. Spell damage computation uses only the selected version. Complex lines retain action IDs, targeting, duration/delay and original descriptions and are marked unsupported when no audited strategy exists.
