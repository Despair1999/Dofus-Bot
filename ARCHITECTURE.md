# Architekturentscheidungen

## Laufzeit und Grenzen

pnpm-Monorepo mit TypeScript und Node.js 22.15+. React/Vite rendert dieselbe Oberfläche im Browser-Entwicklungsmodus oder im Tauri-2-Fenster. Rust stellt native Fenster-/Plugin-Funktionen bereit. Der Release-Build bündelt Node und Backend als Service-Ressourcen und startet/stoppt den Hintergrunddienst mit der Anwendung. Daten liegen im lokalen AppData-Verzeichnis; die native Oberfläche liest den lokalen Verbindungsschlüssel über einen begrenzten Rust-Befehl. Im Entwicklungsmodus liegen Backend-Daten unter `.data`. Fastify auf Port 4310 stellt eine REST-API bereit; Discord und Desktop verwenden dieselben Charakter-/Fortschrittsendpunkte und Spieldatenadapter.

`packages/core` enthält Charakter-/Fortschrittsmodelle, Validierung, Textabgleich, Material-/Gewinnrechner, Questabhängigkeiten mit Zyklenerkennung und BFS über ausdrücklich gelieferte Kartenkanten. Diese Algorithmen begründen keine bereits angeschlossene Weltkarte oder Schatzsuche. `packages/game-data` importiert das tatsächlich untersuchte dofus-sqlite-Schema. Die Herkunft/Version bleibt pro Quest erhalten; unbekannte Zielparameter werden nicht zu erfundenen Anweisungen.

## Datenhaltung

Der erste lauffähige lokale Modus nutzt SQLite statt des langfristig gewünschten PostgreSQL. Importierte Spieldaten (`game-data.sqlite`) und personenbezogene Daten (`personal.sqlite`) sind getrennt. Der Import prüft Quell-Schema, SQLite-Integrität, Downloadgröße und GitHub-SHA-256-Digest, berechnet Änderungen und übernimmt einen konsistenten Stand transaktional. Fehler lassen den bisherigen Stand bestehen.

Die Desktopoberfläche speichert lokale Records über das Tauri-SQL-Plugin; im Browser über IndexedDB. Eine Outbox bewahrt Offline-Fortschrittsänderungen. Der Server prüft `expectedVersion` und idempotente `mutationId`; Konflikte überschreiben nichts automatisch. Manuelles Verwerfen und erneutes Laden sind im UI erreichbar. Es gibt noch keine automatische fachliche Konfliktzusammenführung oder WebSocket-Verteilung.

## Authentifizierung

Ein lokales Einzelbenutzerprofil verwendet einen zufälligen Bearer-Schlüssel mit mindestens 32 Zeichen. Persönliche Routen und Schreibzugriffe benötigen diesen Schlüssel. Standardbindung ist 127.0.0.1; CORS und Rate-Limiting sind eingerichtet. Ein explizites HOST=0.0.0.0 ermöglicht Containerbetrieb; eine öffentliche Bereitstellung benötigt zusätzliche TLS-/Betriebssicherung. Discord erlaubt private Vorgänge ausschließlich der konfigurierten `DISCORD_OWNER_ID`. Dies ist kein OAuth-Kontoverknüpfungssystem und kein sicherer allgemeiner Mehrmandantenbetrieb.

## Spieldaten und OCR

Dofusdude liefert Items/Rezepte/Almanax über geprüfte Routen, mit Zeitlimits, Retry, Circuit Breaker und persistentem Cache. dofus-sqlite liefert importierte Quests. Weitere Quellen werden im Quellenbericht mit ihrem tatsächlichen Prüfergebnis geführt; fehlende Integrationen sind nicht durch Fake-Antworten ersetzt.

OCR verarbeitet manuell freigegebene Screenshots lokal in Tesseract. Beim ersten Start werden öffentlich verfügbare Sprachmodelle geladen. Screenshot-Inhalte werden nicht an eine OCR-Cloud geschickt. Bildschirmfreigabe hängt vom WebView-/Browser-Support ab; Dateiimport ist der nutzbare Ersatz. Es gibt kein Auslesen des Spielprozessspeichers und keinen Netzwerkverkehrmitschnitt.

## Discord und Releases

Discord verwendet persistente SQLite-Gruppen statt kurzlebiger Collector-Zustände. FIFO-Teilnehmerreihenfolge erzeugt Wartelisten, serverfremde Buttons werden abgewiesen. Erinnerungen werden alle 60 Sekunden geprüft; ein Prozessabbruch unmittelbar nach Versand und vor Bestätigung kann eine Wiederholung verursachen. Dungeon-Daten sind derzeit botlokal und werden noch nicht im Desktop angezeigt.

Tauri-Updater prüft kryptografisch signierte GitHub-Release-Artefakte. Der Verifikationsschlüssel ist Bestandteil des ausgelieferten Builds. Private Release-Signierschlüssel bleiben in Actions Secrets. Update-Signierung und Windows-Authenticode sind verschiedene Verfahren; ein Authenticode-Zertifikat ist nicht eingerichtet. CI und Releasejobs dokumentieren den vorgesehenen Prozess, ersetzen aber keinen tatsächlich ausgeführten nativen oder Live-Integrationstest.
