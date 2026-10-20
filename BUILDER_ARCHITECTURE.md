# Builder architecture

The builder extends the existing React/Tauri application and local Fastify service. It does not read game processes or claim to know live equipment.

- `packages/core/src/builder.ts`: versioned build schema, stable effect IDs, shared SQL filters, equipment compatibility, characteristics, set tiers, requirements and direct damage strategies.
- `packages/core/src/optimizer.ts`: deterministic bounded beam search; invoked in a dedicated browser worker, with progress and cancellation. Unknown requirements and effects prevent a candidate being certified valid.
- `apps/backend/src/builder.ts`: additive personal migrations, indexed numeric effects, version-isolated catalogs, authenticated project APIs, optimistic revisions and target profiles.
- `apps/desktop/src/v3`: three-column equipment workspace, shared filters, spell simulator, comparison, worker UI and local drafts/outbox.
- `packages/game-data/assets/builder-data.json`: public reproducible data only. The build bundles this file alongside Node/backend. No personal data is distributed.
- `infrastructure/scripts/import-builder-data.py`: raw SQLite and verified API snapshot importer. Original effect action IDs, spell IDs and version relationships remain available.

Personal project rows reference the existing character IDs with `ON DELETE SET NULL`. Deleting a character with builds requires an explicit choice. Active builds mean selected in Companion. Calculated values are regenerated from inputs and the named snapshot, never treated as authoritative stored state.

3.6.12.16 and 3.7.12.12 are separate namespaces. A version change clears incompatible equipment and spell buffs. Spell variants and all ranks are imported. Historical 3.6 item/set `rid` references are resolved from the original JSON reference tables using exact Python integers. Rounded SQLite references are never used to identify instances. Both 3.6 equipment and 931 set records are available. 3.7 numeric item effects and 940 set records use the matching Dofusdude version.

Equipment positions come from ItemTypeData / ItemSuperTypeData, not translated strings: amulet 0, weapon 1, rings 2/4, belt 3, boots 5, hat 6, cape 7, pet/mount 8, six Dofus/trophy positions 9–14, shield 15. Combat companions and Perceptor equipment are not treated as character stat gear.

## Reference comparison

Public reference inspected: https://dofuscreator.com/ (20 October 2026), plus user screenshots. No application source or private endpoints copied.

| Public reference function | Companion implementation |
|---|---|
| Visual equipment and characteristic panels | Existing dark/lime design; source-compatible slots |
| Item selection, effects and level filters | Shared indexed ID-based predicate in picker and encyclopedia |
| Editing individual rolls and exos | Per-build item instances; source data immutable |
| Set effects | Exactly one tier for the distinct equipped item count |
| Spells and training | Versioned original action lines and explicitly limited direct simulation |
| Buffs and target assumptions | Explicit editable assumptions; raw source conditions retained |
| Project management | Local service, character association, optimistic revisions, offline drafts/outbox |
| Fashionista | Independent deterministic worker search, bounded scope explicitly shown |
| Sharing | Own versioned JSON format; configured owner Discord integration |

No direct import of Creator projects is implemented without a documented public exchange format.
