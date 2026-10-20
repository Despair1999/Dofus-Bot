# Builder update acceptance — v0.3.0

Windows x64 / Node 22.15.0 / React / Chromium / Tauri. Work began 20 October 2026; release acceptance continues 21 October 2026.

## Completed source checks

- TypeScript across all workspaces and ESLint pass.
- 72 workspace tests pass: core 25, game data 8, desktop 10, backend 16, Discord 13. Includes real catalog/set fixtures, independent damage examples, private endpoint authorization, optimistic revisions, restart persistence, character deletion policy and mocked owner-only Discord delivery.
- 27 browser E2E tests pass: nine new builder workflows and eighteen existing regression cases. Includes full OCR, real catalog lookup, character/quest progress, keyboard recording, old-request races, offline builder edits/reconnect and viewports 600/1366/1920/2560/3440.
- Original supplied class ZIP was imported and validated: 19 unique classes, originals retained, optimized WebP images/thumbnails and stable ID mapping. All 19 portraits loaded through the app.
- Source SHA256 checks: two original SQLite snapshots, historical 3.6 item/set JSON reference archives and spell image ZIP. No unresolved historical effect references.
- Per version, all 19 classes have 44 spells each (836 total), 1,729 ranks and zero missing rank/icon references. 3.6: 3,826 gear records / 931 sets. 3.7: 3,831 gear records / 940 sets.

## Acceptance groups

| Group             | Evidence                                                                                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: builder/slots  | Browser real Gelano equip/remove/mage and totals; backend rejects wrong/missing item IDs and slots; core schema and all source positions                                                        |
| B: set tiers      | Real King Jellix 1/2/3-piece fixtures, tier replacement/removal, duplicate set ring detection; original 3.6 references independently resolved                                                   |
| C: effect filters | Indexed AND/OR/signed ranges/absence; picker vs encyclopedia equality; browser reset and incompatible-slot search                                                                               |
| D: classes        | ZIP import report, 19 image loads, real class selector and character assignment                                                                                                                 |
| E: character sets | Multiple saved sets, duplication, editing, revision conflict, active selection, file-backed restart and character deletion/keep policy                                                          |
| F: spells         | Every class/version enumerated in integration tests; actual ranks/icons/critical lines; browser version switch                                                                                  |
| G: damage         | Independently published reference arithmetic, multi-line/critical/resistance/life-steal/heal tests, changing equipment/buffs, equal-condition comparison and unsupported-effect totals withheld |
| H: sync/Discord   | Offline browser reload and reconnect, shared backend snapshots, owner permissions, slash-command schema and mocked durable delivery/acknowledgment. No live Discord login performed             |
| I: Windows/update | Native/installer/signature checks passed; update publication follows below                                                                                                                      |

## Final release checks

- Windows release build and signed NSIS/portable packages completed.
- Six native Rust checks and eight actual Tauri/WebView2 smoke checks pass, including hotkeys, settings persistence and owned-service cleanup.
- Signature integration test accepts the original v0.3.0 installer and rejects modified bytes.
- Actual old/new bundled services preserve a character and quest progress; new active build and exo survive restart.
- Signed NSIS installer upgraded the existing v0.2.3 installation to v0.3.0 with its old service running. Registry version and install location verified; service used separate test data.
- Installed v0.3.0 Builder opens, supplied portrait loads, real item picker returns Gelano by ID.
- Machine-readable evidence: [release report](docs/builder-release-test.json), [service upgrade](docs/builder-service-upgrade-test.json), [installer](docs/installer-transition-v3-test.json), [native Builder](docs/builder-native-test.json), [native lifecycle](docs/native-v2-test.json).
- Published [v0.3.0](https://github.com/Despair1999/Dofus-Bot/releases/tag/v0.3.0) contains seven verified assets. Public latest.json returns HTTP 200 and version 0.3.0. The actual native v0.2.2 updater displays “Version 0.3.0 ist verfügbar.” The old portable copy remains on the update page; the normal installed copy is already v0.3.0.

## Practical limits

See [DAMAGE_ENGINE_SPEC.md](DAMAGE_ENGINE_SPEC.md) for non-supported combat mechanics and reference confidence. The optimizer searches deterministic bounded candidates, does not prove a global optimum, and refuses to certify unknown item conditions. No prices are invented; budget searches use explicitly supplied prices. No physical multi-monitor/DPI or live Discord/game-client measurement was performed. Game equipment is planned/selected in Companion, not read from the live client.
