# Lokaler Companion-Dienst

Node 22.15+, `pnpm --filter @dofus/backend dev`. Standard: `127.0.0.1:4310`.
SQLite-Datenbanken liegen in `.data/` am Repository-Stamm, unabhängig vom Arbeitsverzeichnis.
`DATA_DIR` und `PORT` sind konfigurierbar. Standardmäßig bindet der Dienst an Loopback. Für Docker kann `HOST=0.0.0.0` explizit gesetzt werden; Portfreigaben sollen weiterhin auf `127.0.0.1` begrenzt werden.

## Zugriff

Öffentliche lesende Spielendpunkte benötigen keinen Schlüssel. Private Daten und sämtliche Schreibzugriffe verlangen `Authorization: Bearer <COMPANION_TOKEN>` mit mindestens 32 Zeichen.
Ohne gesetzte Umgebungsvariable wird ein zufälliger Schlüssel unter `.data/backend-token` gespeichert. Schlüssel niemals committen oder in Browser-URLs eintragen. Windows-Dateirechte erben vom Profilverzeichnis; der Node-Dateimodus ist dort keine ACL-Garantie.

Das ist ein **lokaler Einzelbenutzerbetrieb**, keine fertige öffentliche Mehrbenutzer-Plattform und kein Discord-OAuth. Der Bot muss private Aufrufe auf seine konfigurierte Besitzer-ID begrenzen. Für ein öffentliches Deployment sind HTTPS, Benutzerkonten, Rollen und eine gesonderte Tokenverwaltung erforderlich.

## Endpunkte

Alle Antworten enthalten `{data:...}`; externe Daten zusätzlich `source`, `fetchedAt`, `cached`, `stale`.

- `GET /health`, `GET /api/status`
- `GET /api/items?q=Gelano&lang=de`, `GET /api/items/2469?category=equipment&lang=de`
- `GET /api/almanax?date=2026-10-20&lang=de`, `GET /api/game/version`
- `GET /api/quests?q=...&lang=de`, `GET /api/quests/:id`
- `GET /api/data/status`, `POST /api/data/update` (202 startet geprüften Import; Status enthält Verlauf/Fehler)
- `GET/POST /api/characters`; POST `{name,server,className,level}`
- `PUT /api/characters/:id`; Felder wie POST plus `expectedVersion`
- `DELETE /api/characters/:id`
- `GET /api/characters/:id/progress`
- `PUT /api/characters/:id/progress`; `{questId,step,status,expectedVersion,mutationId}`
- `GET /api/account/export`, `DELETE /api/account`

Questschritt ist ein nullbasierter Fortschrittszähler (0 bis Anzahl Schritte), Status `active|paused|completed`. Beim ersten Speichern ist `expectedVersion:0`; spätere Änderungen verwenden die zuletzt geladene Version. HTTP 409 enthält `current` für sichtbare Konfliktauflösung. Jeder Vorgang benötigt eine neue UUID als `mutationId`; Wiederholungen desselben Vorgangs liefern identisch das gespeicherte Resultat. Änderungen verwenden eine SQLite-Transaktion, Fremdschlüssel und Cascade-Löschung.

## Quellen / Ausfallverhalten

Verwendete Routen wurden mit der aktuellen offiziellen OpenAPI abgeglichen: https://raw.githubusercontent.com/dofusdude/api-docs/main/openapi-3.0.yaml und live getestet (Bericht via `pnpm --filter @dofus/backend smoke`). Adapter: Timeout 8 Sekunden pro Versuch, maximal drei Versuche bei Netzwerk-/Serverfehlern, Exponential Backoff, Retry-After bei 429, Circuit Breaker, Response-Validierung, persistenter Cache, als veraltet markierter Cache-Fallback. Kein Ersatz durch erfundene Spielinformationen. Hauptdatenquelle unterstützt DOFUS 3 und Deutsch/Französisch. Quests werden getrennt über `@dofus/game-data` importiert. HTTP-Abfragen haben kein öffentlich garantiertes Anbieter-Ratelimit; daher werden Anfragen gecacht und lokale Zugriffe begrenzt.

## Tests

`pnpm --filter @dofus/backend test` prüft echte isolierte SQLite-Datenbanken, API-Authentifizierung, Eingabevalidierung, Charakterverwaltung, Transaktionen, idempotente Wiederholung, Versionskonflikte und Ausfall-/Ratelimit-/Cacheverhalten mit klar benannten Fixtures. `smoke` ruft echte öffentliche Endpunkte auf und ist getrennt vom Offline-Testlauf.
