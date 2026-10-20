# Implementierungsstand · 2026-10-20

**Kein vollständiger Abschluss des Masterprompts.** Die Anwendung enthält nutzbare Kernabläufe; die folgende Matrix unterscheidet Code-/Offline-Tests von echten externen und nativen Tests. „Nicht implementiert“ ergänzt die vorgegebenen Statuswerte, damit reine Wünsche nicht als vorbereitete Integration erscheinen.

| Bereich | Status | Nachweis / Einschränkung |
|---|---|---|
| Monorepo, React/Vite, Fastify, gemeinsame Modelle | Implementiert und getestet | TypeScript, Workspace-Tests und Frontend-Build; siehe Testbericht |
| Itemsuche und Details/Rezept | Implementiert und getestet | Geprüfte Dofusdude-Routen und Adaptertests; Live-Smoke-Bericht separat |
| Quests importieren, suchen und Schritte anzeigen | Implementiert und getestet | Reales dofus-sqlite-Schema, Integritätsprüfung und Importtests |
| Charaktere und bestätigter Questfortschritt | Implementiert und getestet | SQLite-/API-Tests, Validierung und Versionskonflikte |
| Offline-Outbox und Cache | Implementiert und getestet | API-Tests und Browser-E2E mit Offline-Änderung und Reconnect; native SQLite-Speicherung geprüft |
| OCR-Textzuordnung | Implementiert und getestet | Abgleich-/Unsicherheitstests; kein Nachweis aller Spieljournal-Screenshots/DPI-Fälle |
| Lokale Screenshot-OCR Deutsch/Französisch | Implementiert und getestet | Synthetische DE/FR-Bilder und Offline-Modellcache; echte Browser- und native WebView2-OCR ausgeführt. Tatsächliche Spielbilder/DPI noch ungetestet |
| Bildschirmfreigabe | Implementiert, Live-Test ausstehend | Manuelles getDisplayMedia, browserabhängig; native Windows Graphics Capture nicht implementiert |
| Windows Tauri, Overlay/Compact/Hotbar, Scanner-Hotkey | Implementiert und getestet | Windows-x64-EXE und NSIS gebaut; native Start-/SQLite-/Hotkey-/Overlay-Smokeprüfung erfolgreich. Compact/Hotbar und Mehrmonitor/DPI nicht vollständig geprüft, Click-through fehlt |
| Crafting-Mengen, eigene Preise/Bestand, Rechner | Implementiert und getestet | Gemeinsame Rechenlogik, UI speichert eigene Eingaben; keine Live-Marktpreise |
| Almanax | Implementiert und getestet | Adapter/Fehlerbehandlung; aktuelle Live-Erreichbarkeit siehe Quellen-/Testbericht |
| Discord-Commands, Modals, Selects, Embeds | Implementiert, benötigt Zugangsdaten | Botmodul TypeScript und 9 Offline-/Loopback-Tests erfolgreich; keine Anmeldung an Discord |
| Dungeon-Gruppen, Warteliste, Erinnerungen | Implementiert, benötigt Zugangsdaten | Persistenz/FIFO/Reminder getestet; Versand und Serverberechtigungen noch live zu prüfen |
| Fortschritt Desktop ↔ Discord | Implementiert, benötigt Zugangsdaten | Gemeinsames Backend, privater Owner-Gate; Discord-Ende-zu-Ende-Test ausstehend |
| App-Updateprüfung/Installation | Implementiert, Live-Test ausstehend | Tauri-Updater und GitHub-Workflow; veröffentlichte Version + passende Signierschlüssel nötig |
| Setup/Start/Docker/CI | Implementiert, Live-Test ausstehend | Skripte und Workflows vorhanden; externe CI-/Docker-Ausführung nicht behauptet |
| Externe Questguides | Vorbereitet, externe Genehmigung erforderlich | Originalsuche/Links nutzbar; Volltext-/Übersetzungsimport ohne Lizenz deaktiviert bzw. nicht implementiert |
| DBI-Schatzsuche und Weltkartenrouting | Nicht verfügbar wegen fehlender Datenquelle | Keine erfundene Zielposition; Quellenprüfung siehe SOURCES.md |
| PostgreSQL/Prisma, Redis, WebSocket | Nicht implementiert | SQLite-Einzelbenutzermodus statt vorgetäuschter Serverarchitektur |
| OAuth/Discord-Kontoverknüpfung, mehrere Benutzer/Geräte | Nicht implementiert | Keine öffentliche Mehrbenutzerbereitstellung |
| Buildmanager, Sets, Zauber/Monster/Dungeon-Kataloge | Nicht implementiert | Zusätzliche Quellen benötigen noch vollständige Adapter-/UI-Arbeit |
| Vollständiger Dofus-/Erfolgs-/Questkettenplaner | Nicht implementiert | Graphalgorithmus vorhanden; keine vollständige fachliche Oberfläche |
| Marktpreisverlauf, Preisalarme, Community-Marktdaten | Nicht implementiert | Nur manuell gespeicherte Kalkulationseingaben |
| Gildenverwaltung, Berufe, Eventkalender, Ranglisten | Nicht implementiert | Dungeon-Gruppe ersetzt keine vollständige Gildenverwaltung |
| Automatische Almanax-/News-/Patch-Benachrichtigungen | Nicht implementiert | Nur Gruppenzeit-Erinnerungen vorhanden |
| Eigenständiges Webdashboard mit OAuth | Nicht implementiert | Browseransicht derselben Desktop-UI ist verfügbar |
| KI-Integration, Übersetzungsdienst | Nicht implementiert | Keine simulierte KI oder externe Screenshot-Übermittlung |
| Windows Code Signing / produktive Cloud | Nicht implementiert | Zertifikat und Hosting fehlen; Tauri-Update-Signierung gesondert vorbereitet |

## Fortsetzungsauftrag

1. Native Start-/Hotkey-/Overlay-/OCR-Prüfung ist erfolgt. Als Nächstes Installer-Erstinstallation, reales Spieljournal/Itemtooltips, Compact/Hotbar und Mehrmonitor-/DPI-Fälle prüfen. Nachweise stehen in docs/TEST_REPORT.md.
2. Discord-Testanwendung konfigurieren, Commands auf einem Testserver veröffentlichen und die privaten Charakter-/Fortschritts- sowie Gruppenabläufe Ende zu Ende prüfen.
3. Ersten signierten Release veröffentlichen und Update von einer älteren installierten Version auf die neue Version tatsächlich testen.
4. Danach DBI-Verfügbarkeit/Navigation, Buildmanager und fachliche Quest-/Erfolgsdaten ausbauen. Für Mehrbenutzerbetrieb zunächst echte Kontoverknüpfung und Rechteisolierung entwickeln.
5. Große Restmodule einzeln implementieren und anhand echter UI-/Integrationsnachweise ergänzen. Keine Fake-Daten und keine bloßen Menüpunkte als fertige Funktionen zählen.
