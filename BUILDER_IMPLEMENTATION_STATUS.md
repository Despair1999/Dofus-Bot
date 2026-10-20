# Builder implementation status — v0.3.0

Implemented and validated on Windows x64, 21 October 2026.

The release includes the equipment builder with 16 slots, indexed shared effect filters, real set tiers, individual item rolls and exos, 19 supplied class portraits, character-associated saved/active sets, versioned spells and supported direct-damage calculations, equal-condition comparisons, a cancellable background optimizer, offline drafts and synchronization, JSON exchange, and private Discord builder commands/delivery.

Both game snapshots are complete for the imported scope: 3.6.12.16 contains 3,826 equipment records and 931 sets; 3.7.12.12 contains 3,831 equipment records and 940 sets. Each snapshot provides 836 class spells and 1,729 ranks. Historical effect references are resolved from original JSON using exact integers. No missing spell ranks/icons or unresolved historical effect references remain.

Validation: 72 workspace tests, 27 browser E2E tests, six native Rust tests and eight native Windows smoke checks pass. The original release signature verifies and a modified installer is rejected. Actual old/new bundled services preserve character/progress and builds across restart. The signed NSIS installer successfully upgrades the existing v0.2.3 installation while its old service is running. The installed v0.3.0 Builder loads its portrait and real item picker. Evidence: BUILDER_TEST_REPORT.md and docs/builder-release-test.json.

Practical boundaries: complex combat states, delayed/area mechanics and unrecognized effects are explicitly marked unsupported; a full damage total is withheld when required effects cannot be evaluated. The optimizer is bounded and does not certify a global optimum or unknown requirements. Live Discord login, physical multi-monitor/DPI coverage and game-client damage measurements were not performed. Companion does not read the player's live equipment. See DAMAGE_ENGINE_SPEC.md and SPELL_DATA_SOURCES.md.
