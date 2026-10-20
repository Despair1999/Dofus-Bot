# Testbericht · 2026-10-20

Dieser Bericht trennt ausgeführte automatisierte Tests von geplanten oder zugangsdatenabhängigen Live-Tests. System: Windows, Node.js 22.15.0, pnpm 11.25.0.

| Modul | Ausgeführte Prüfung | Ergebnis |
|---|---|---|
| Core | Normalisierung/Matching, Mengen-/Gewinnrechnung, Abhängigkeiten/Zyklen, verifizierte Graphnavigation | 6 Unit-Tests bestanden |
| Backend | REST/Validierung, SQLite-Charaktere/Fortschritt, Auth, Konflikte, Cache/Adapterfehler | 7 Tests bestanden; siehe tatsächliche Workspace-Ausgabe |
| Game Data | Schema-/Importintegrität, Quests und Fehler-/Rollbackpfade | 4 Tests bestanden |
| Discord | Persistenz/FIFO, Gruppenvalidierung, Reminder, Commands/Embeds/Questpagination, Owner-Gate und echte Loopback-HTTP-Anfragen | 9 Tests bestanden, TypeScript-Prüfung bestanden |
| Desktop | Textabgleich und Unsicherheitsfälle | 5 Tests bestanden |

Gesamt: **31 bestandene Modultests und 5 bestandene Browser-Ende-zu-Ende-Tests**. `pnpm lint`, `pnpm typecheck`, `pnpm test`, Frontend-Build und `pnpm audit --prod --audit-level high` wurden erfolgreich ausgeführt; die Prüfung meldete keine bekannten Schwachstellen. Browser-E2E umfasst echte Itemsuche/Rezept, Offline-Favoriten, persistente Aufgaben, Charakteranlage und -bearbeitung, bestätigten Questfortschritt, Offline-Outbox/Reconnect sowie tatsächliche lokale OCR im Browser. Testcharaktere werden nach dem Test wieder gelöscht.

Der Windows-x64-Release-Build und NSIS-Installer wurden tatsächlich erzeugt. Die echte Tauri-EXE wurde gestartet und über WebView2 geprüft: automatischer Start des gebündelten Backends, automatische lokale Authentifizierung, echte Gelano-Abfrage, native SQLite-Favoriten, globale Hotkey-Registrierung/Abmeldung, Overlay betreten/verlassen und Screenshot-OCR in der Produktions-WebView. Keine JavaScript-Seitenfehler. Nachweis: [native-test.json](native-test.json). Dies prüft noch nicht alle Windows-Versionen, Installer-Dialoge oder Mehrmonitorfälle.

Das Backend-Bundle wurde außerhalb des Repositorys mit isoliertem Datenverzeichnis getestet: Health, Zugriffsschutz, echte Itemsuche, 1.976 importierte Quests, Charakter/Questfortschritt, Wiederholbarkeit und Versionskonflikt. Nachweis: [bundled-backend-test.json](bundled-backend-test.json).

Reale lokale OCR auf synthetischen, selbst erzeugten Bildern: Deutsch Konfidenz 95, Französisch 94, korrekte Titelzuordnung und Leerbild-Abweisung. Zweiter Lauf mit heruntergeladenen Modellen und absichtlich unerreichbarem Downloadziel bestand offline. Dies sind keine DOFUS-Screenshots und keine Qualitätsaussage über reale Spieloberflächen. Details: [OCR-Testbericht](../tests/ocr/TEST_REPORT.md).

Live-Datenprüfung und Zeitpunkte stehen in [SOURCES.md](SOURCES.md). Die reale dofus-sqlite-Quelle wurde untersucht und importiert; Quests werden nicht aus erfundenen Beispieldaten erzeugt. Backend-Live-Smoke wird gesondert mit `pnpm --filter @dofus/backend smoke` ausgeführt; sein Ergebnis muss aus der tatsächlichen Ausgabe übernommen werden.

Nicht bestätigt: alle realen Questjournal-/Itemtooltip-Screenshots, mehrere Monitore/DPI-Skalierungen, Click-through (nicht implementiert), gesamte Installer-Erstinstallation, Upgrade älterer Versionen, Live-Discord-Interaktionen, öffentliche OAuth-Synchronisierung, produktiver Docker-/Cloudbetrieb und erfolgreiche Remote-Actions-Läufe. Für nicht implementierte Module gibt es keinen angeblichen erfolgreichen Test.

Bot-Detailbericht: [TEST_RESULTS.md](../apps/discord-bot/TEST_RESULTS.md). Implementierungsgrenzen: [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md).
