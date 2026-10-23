# Prüfbericht

Stand 23.10.2026. Der abschließende Stand mit 171 Workspace-Tests, 41 Community-Fällen, 54 Browserregressionen, nativer Windows-Prüfung, echtem Upgrade und produktiver Firebase-Abnahme ist in [COMMUNITY_ACCEPTANCE_0.10.0.md](COMMUNITY_ACCEPTANCE_0.10.0.md) dokumentiert. Die folgenden Zahlen sind frühere Zwischenstände und kein aktueller Veröffentlichungsnachweis.

## Prüfung

- `pnpm typecheck`: alle Workspace-Projekte erfolgreich.
- `pnpm lint`: erfolgreich.
- `pnpm test`: 166 erfolgreich, keine Fehler: Core 30, Community 24, Game Data 8, Website 7, Desktop 32, Backend 46, Discord 19.
- `pnpm test:community`: 39 erfolgreich, keine Fehler: 21 Rules-, zwölf SDK-Integrations-, ein lokaler Owner-Einrichtungs- und fünf Chromium-Browsertests.
- Desktop- und Website-Produktionsbuild erfolgreich. Vite meldet große JS-Chunks; Codeaufteilung bleibt eine mögliche Optimierung.

Nachgewiesen: echte Emulator-Registrierung, private Zustimmung, Verifikation, Reset, Login/Logout, zwei unabhängige Sync-Clients, Offline-Queue, idempotente Wiederholung, konkurrierende Revisionen, lokale Änderung während Upload, Konfliktentscheidung und dauerhafter Backend-Mutationszähler mit exakter Bestätigung.

Rules prüfen anonyme/unbestätigte Nutzer, deaktiviertes Onboarding, gefälschte Rollen/Profile, private Zustimmung gegenüber Admins, Mitgliedschaftsentzug, Auditfälschung, fremde/gemeinsame Daten, Mengenarithmetik und Zustandsübergänge, Kapazität und Teilnahme. Integration prüft Storage-Upload/Lesen/Austausch/Löschen unbenutzter Bilder, Archivierung/Wiederherstellung, verschachtelte Moderation und Kontolöschung mit Sperrmarker gegen alte Clients.

Fünf echte Chromium-Browsertests: regulärer Nutzer ohne Adminzugang; Website-Charakter erreicht Desktop/SQLite ohne Reload; falsches persönliches Adminpasswort verweigert, richtige Reauth erlaubt auditierte gemeinsame Konfigurationsänderung. Zusätzlich echtes Monatsraster mit Zeitzonenprüfung und ein Web-Ausrüstungsbuild, der bis in die bestehende Desktop-Builder-Tabelle gelangt. Isolierte gebaute Website-/Desktop-Testbundles; Screenshots lokal in `test-results/community-ui/`, nicht eingecheckt.

## Grenzen

CLI-Anmeldung ist erfolgreich erneuert. Live-Projekt, Datenbank und Bucket sind erreichbar. Verifizierter Auth-Owner wurde sicher zugeordnet, Registrierung bleibt aus. Produktive Rules/Indizes und Cross-Service-IAM noch nicht geändert. Keine echte E-Mail-Zustellung, produktiver Bucket, laufender Discord-Bot oder native Tauri-Installation end-to-end geprüft. Updater erhalten, kein Release veröffentlicht. Rechtstexte sind markierte Entwürfe; Registrierung standardmäßig gesperrt.

CI installiert Chromium und nutzt ausschließlich `demo-dofus-community`. Erwartetes PERMISSION_DENIED der Negativtests ist kein Fehler. Windows-Wrapper setzt Java-TCP-Fallback nur für seinen Prozess. [Bekannte Funktionsgrenzen](COMMUNITY_ARCHITECTURE.md).

## Folgeprüfung PR #11

Der ENOENT-Fehler auf frischen GitHub-Runnern ist behoben: Logordner wird vor synchronem Dateiöffnen erstellt; beide Vite-Ausgabeströme werden beim Teardown korrekt abgeschlossen. Der zusätzliche High-Auditbefund GHSA-m9gg-hp2v-232j wird durch die gezielte gRPC-Auflösung 1.14.6 behoben. Commit bfb9f61 wurde in GitHub Actions bei Community, Website und Quality Checks grün bestätigt; Folgeänderungen werden in demselben PR erneut geprüft.

Ergänzte Negativtests: Upload über 200 KB, falsches MIME, falsche Uploader-UID, unerlaubte zusätzliche Metadaten, verbotene Bucket-Auflistung und ungültige WebP-Signatur im Client. Rules können keine Bilddateien dekodieren; kein serverseitiges Scanning behaupten. Meldungen: Mindestabstand, privater Reporterzugriff, fremde Entscheidungen blockiert, Adminabschluss nur mit Audit. Rücknahme einer Kommentar-Moderation ist nur auf den nachweisbaren Originaltext und ohne zwischenzeitliche Änderung erlaubt. Lokale Owner-Einrichtung blockiert fremde Origins, fehlende Sitzungstoken und zu kurze Passwörter vor jedem Firebase-Aufruf.

Sommerzeit-/Zeitzonen-Unitprüfungen und Kalendernavigation ergänzen die Regression. Die Publication-Gate-Probe verweigert Veröffentlichung bei offenen Voraussetzungen wie erwartet. Signierter Kandidatenworkflow ist vorbereitet und enthält echte Signatur-/Manipulationsprüfung, wurde aber nicht ausgeführt; kein neues signiertes Windows-Artefakt oder Update-Manifest vorhanden.

Zusätzliche Session-Prüfung: Logout während einer auf Netzwerklesungen wartenden Adminänderung bricht die Mutation ab; der gemeinsame Datensatz bleibt unverändert. Die ursprüngliche UID wird vor administrativen Transaktionsschreibvorgängen erneut geprüft.
