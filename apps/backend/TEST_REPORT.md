# Ausgeführte Backend-Prüfungen

Datum: 20.10.2026, Windows, Node 22.15.0.

## Automatisierte Tests

Direkter Aufruf während pnpm-11-Installationskonfiguration:

`node node_modules/tsx/dist/cli.mjs --test packages/core/tests/*.test.ts apps/backend/tests/*.test.ts`

Ergebnis: **13 Tests bestanden, 0 fehlgeschlagen** (6 Core-Tests und nach Erweiterung 7 Backend-Tests). Getestet wurden normalisierte Zuordnung, Materialaggregation, Gewinnrechnung, zyklische Questvoraussetzungen, Graphnavigation ohne erfundene Wege, Eingabevalidierung, echte SQLite-Persistenz, REST-Zugriffsschutz, Charaktere, Fortschrittskonflikte, idempotente Wiederholung, Löschkaskaden, Kategorie-Endpunkte, validierter Itemcache, veralteter Cache bei simulierter Störung, 429/Retry-After/Circuit Breaker und Ablehnung ungültiger Quellantworten. Externe Antworten in diesen Tests sind eindeutig künstliche Test-Fixtures.

`node node_modules/typescript/bin/tsc -p apps/backend/tsconfig.json --noEmit`

`node node_modules/typescript/bin/tsc -p packages/core/tsconfig.json --noEmit`

Beide Typechecks erfolgreich ohne Diagnosen.

## Echte Live-Abfragen

`node node_modules/tsx/dist/cli.mjs apps/backend/scripts/smoke.ts`

Erfolgreich am **20.10.2026 um 14:39:06 UTC**:

| Abfrage | Tatsächliches Ergebnis |
| --- | --- |
| `/dofus3/v1/de/items/search?query=Gelano&limit=30` | 30 Ergebnisse, validiertes Schema |
| `/dofus3/v1/de/items/equipment/2469` | Gelano, 8 Rezeptzutaten |
| `/dofus3/v1/de/almanax/2026-10-20` | Almanax-Datum 2026-10-20, Opfergabe und Bonus |
| `/dofus3/v1/meta/version` | DOFUS 3.7.12.12 |

Die Routen wurden anhand der Anbieter-OpenAPI geprüft: https://raw.githubusercontent.com/dofusdude/api-docs/main/openapi-3.0.yaml . Die lokale Questdatenbank enthält einen gesondert geprüften Import über `@dofus/game-data`; dessen Bericht befindet sich beim Datenpaket.

Zusätzlich live geprüft: `/dofus3/v1/de/items/resources/search?query=Holz&limit=2` lieferte zwei Ressourcen, `/dofus3/v1/de/items/equipment/search?query=Gelano&limit=2` zwei Ausrüstungsgegenstände.

## Gebündelter eigenständiger Dienst

`node infrastructure/scripts/bundle-backend.mjs`

`node infrastructure/scripts/test-bundled-backend.mjs --game-data .data/game-data.sqlite`

Am 20.10.2026 um 14:44:23 UTC erfolgreich: Start von `resources/node.exe resources/backend.mjs` mit Arbeitsverzeichnis außerhalb des Repositorys, temporärer Datenablage und Port 4311. Health-Check, echte Itemsuche (30 Ergebnisse), importierte Questdaten (1.976), Zurückweisung unautorisierter Zugriffe, Charakterregistrierung sowie Speichern, identische Wiederholung und Versionskonflikt eines echten importierten Questfortschritts funktionierten. Maschineller Bericht: `docs/bundled-backend-test.json`.

Die Ressourcen enthalten die Lizenzhinweise der tatsächlich gebündelten Node-Version und vollständige im npm-Paket mitgelieferte Lizenzdateien der Backend-Abhängigkeiten.

## Grenzen

Kein Test einer echten Discord-Sitzung ohne Zugangsdaten. Keine Behauptung über Mehrbenutzer-OAuth, öffentliches Hosting, PostgreSQL, WebSockets oder native Windows-OCR durch diese Backend-Prüfungen. Timeout-/Ratelimit-/Ausfalltests verwenden kontrollierte HTTP-Fixtures; der Live-Smoke-Test simuliert keinen Anbieter-Ausfall.
