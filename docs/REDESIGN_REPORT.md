# DOFUS Companion 0.6 — Umsetzung und Abnahme

Entwicklungsbranch: `codex/modern-dark-fantasy-ui`. Ausgangspunkt: `a26fc26` (0.5.0). Die bestehende React-/Tauri-/Fastify-/SQLite-Architektur, Berechnungen und Spiel-IDs bleiben erhalten. Der Auftrag wurde direkt im Repository umgesetzt; das vorhandene Spielbildmanifest wurde unverändert übernommen.

## 1. Überarbeitete Module

| Bereich | Umgesetzt | Einordnung |
|---|---|---|
| AppShell / Dashboard | Vier Navigationsgruppen, gespeicherte Gruppenzustände und Icon-Modus, mobile Modulwahl, Zurücknavigation, globale Suche, zuletzt besuchte Arbeitsbereiche, echte gespeicherte Builds und Routen | Vollständig für die vorhandenen Daten und Module |
| Weltkarte / Farming | Originalkarten erhalten, zwei einklappbare und mit Maus/Tastatur veränderbare Panels, gespeicherte Panelbreiten, Kartenobjekte mit Legende und Suche, direkte Routen-/Untergebietslinks, bisherige Ressourcenfilter, Markierungen und Routenfunktionen | Vollständig für belegte Daten; exakte Ressourcen-Spawns weiterhin nur aus eigenen bestätigten Funden |
| Gegenstände | Gemeinsame Typografie und Oberflächen, gespeicherte Raster-/Listenansicht, vorhandene Filter/Paginierung/Rezepte erhalten, priorisierte lokale Originalbilder mit mehreren Fallbackreferenzen | Vollständig im bestehenden Funktionsumfang |
| Builder | Gemeinsamer visueller Rahmen, echte Klassenporträts und Itemicons erhalten, AP blau / BP grün / LP rot, unveränderte Ausrüstung, Rolls, Exomagie, Setboni, Schaden, Vergleiche und Optimierer | Vollständig im vorhandenen Berechnungsumfang; bekannte komplexe Schadensmechaniken bleiben als Grenzen gekennzeichnet |
| Sets | Neues durchsuchbares, paginiertes Verzeichnis auf vorhandenen Builderdaten; Items und Boni nach getragener Teilezahl; beide Datenversionen getrennt | Neu umgesetzt; Sets ohne im Builder verfügbare Ausrüstung werden nicht durch erfundene Teile ergänzt |
| Dungeons / Monster | Bestehende Dungeon-Ansichten im gemeinsamen Rahmen; neues Bestiarium mit Suche, Paginierung, Graden, Zaubern, Drops und belegten Fundgebieten; Bossbilder bleiben erhalten | UI umgesetzt; vollständige redaktionell geprüfte Strategien sind weiterhin nur teilweise verfügbar |
| Berufe / Sammelquests | Original-Ressourcenbilder erhalten, bestehende Berufslevel und Quests, direkter Berufsfilter aus globaler Suche | Vollständig im bestehenden Funktionsumfang |
| Quests / Crafting / Almanax / Charaktere / Favoriten / OCR | Gemeinsame Farben, Abstände, Schriften, Panels, Fokuszustände und Navigation; vorhandene Formulare, Fortschritte, Rezepte, Klassenbilder und lokale OCR erhalten | Gemeinsamer Designrahmen umgesetzt; Fachformulare nutzen weiterhin ihre bewährten Datenflüsse |
| Übersetzer / Overlay | Gemeinsame Darstellung, transparente Fenster und zwei unabhängige lokale Übersetzer erhalten; Größenänderung, Positionierung, Hotkeys, Klickdurchleitung und Einstellungen bleiben an der vorhandenen nativen Implementierung | Visuell integriert; physisches Zusammenspiel mit allen DOFUS-/Monitor-/DPI-Konfigurationen bleibt ein manueller Praxistest |
| Discord Activity | Gemeinsame Tokens, angepasster Kopf-/Status-/Fehlerbereich, responsive Weltkarte mit denselben Kartenbildern und Kartenobjekten; Sitzungsschutz erhalten | Lokale Darstellung und Protokolltests geprüft; echte Discord-Anmeldung erfordert die vorhandene Hosting-/OAuth-Konfiguration |
| Discord Bot | Goldene Embed-Akzente, vorhandene Buttons/Paginierung/Owner-Prüfungen erhalten; Dungeonbilder als lokale Discord-Anhänge mit HTTPS-Fallback | Implementierung und synthetische Discord-Payloads geprüft; keine Nachrichten an echte Benutzer gesendet |

## 2. Designkomponenten

`apps/desktop/src/ui/` bündelt Tokens, Navigation, Workspace, globale Suche, Einstellungen und gemeinsame Komponenten: Seitentitel, Suchfeld, Leerzustand, Lade-Skeleton, Statusbadge und nativer modaler Dialog. Die neue Standardpalette „Obsidian & Gold“ verwendet Anthrazit/Navy, Gold und Türkis. Die bisherigen vier Paletten und ihre gespeicherten IDs bleiben erhalten. Fokusmarkierungen, Systempräferenz für reduzierte Bewegung sowie eine zusätzliche Einstellung dafür gelten auch für bestehende Module.

Die neun Einstellungsbereiche sind Allgemein, Darstellung, Navigation, Overlay, Tastenkürzel, Sprache, Daten & Updates, Discord und Erweitert. UI-Textgröße, Dichte, Bewegung und Wiederherstellung werden gespeichert; native Fenster erhalten Anzeigeänderungen über Tauri-Ereignisse. Die Textgrößenoption ist keine vollständige betriebssystemweite DPI-Skalierung.

## 3. UX-Verbesserungen

`Ctrl+K` öffnet eine tastaturbedienbare Suche über echte Gegenstände, Sets, Monster, Dungeons, Quests, Ressourcen, Berufe, private Builds, Koordinaten und Modulaktionen. Abgebrochene Suchanfragen können neue Ergebnisse nicht überschreiben. Pfeiltasten/Enter wählen Ergebnisse; Escape und Klick außerhalb schließen den Dialog. Der Fokus kehrt zum auslösenden Steuerelement zurück. Einzelne nicht erreichbare Suchquellen werden benannt, während andere Treffer nutzbar bleiben.

Die Karte importiert 834 reale `HintData`-Einträge mit überprüften Karten-/Welt-IDs: 45 Zaaps, 130 Dungeonhinweise und 659 weitere Orte. Klassifikation und Positionen kommen aus den Originaldaten. Sie erzeugen weder neue Übergänge noch Ressourcen-Spawns. Die bekannten gerichteten Kartenübergänge und ihre Einschränkungen bleiben erhalten. Kartensuche, Koordinatenlinks, Untergebiete und gespeicherte Routen behalten die Identität einzelner Karten.

## 4. Weiterverwendete Assets

Das ursprüngliche Manifest und seine 13.645 WebP-Dateien bleiben unverändert. Zusammen mit vorhandenen Klassenporträts/-miniaturen und Klassenzaubericons wurden 14.519 Bilddateien geprüft. Zusätzlich verweist `retained-index.json` auf bereits vorhandene, anhand von `iconId` belegte Klassenzauberdateien; es enthält keine neuen Bilder. Itembilder nutzen zuerst die bestehende lokale Zuordnung, danach die ursprüngliche Referenz. Erst nach fehlgeschlagenen verfügbaren Referenzen erscheint ein ausdrücklich beschrifteter Platzhalter.

Die Bilddiagnose unter Daten & Updates zeigt beobachtete Ladefehler der aktuellen Sitzung. Sie speichert nur bereinigte Pfade im Arbeitsspeicher, keine Zugangsschlüssel oder Benutzertexte, und meldet nichts an externe Dienste.

## 5. Ergänzte Bilder

Keine zusätzlichen Spielbilder heruntergeladen und keine vorhandenen korrekten Bilder entfernt. Die neuen Oberflächen verwenden dieselben vorhandenen Klassen-, Item-, Ressourcen-, Monster-, Zauber- und Kartenbilder. Neu ist die zuverlässigere Darstellung vorhandener Bossbilder in Discord als Dateianhang.

## 6. Bildquellen und Rechte

Technische Herkunft, Versionen und Archive sind in `packages/game-data/assets/image-sources.json`, dem unveränderten Bildmanifest, `docs/GAME_ARTWORK.md` und `REDESIGN_ASSET_AUDIT.json` dokumentiert. Die [Primärquelle dofus-sqlite](https://github.com/ledouxm/dofus-sqlite) beschreibt die Originaldaten und ID-Beziehungen. Eine technische Veröffentlichung oder Downloadmöglichkeit belegt keine urheberrechtliche Erlaubnis zur Weiterverbreitung der Spielgrafiken. Eine allgemeine, eindeutig anwendbare Freigabe für zusätzliche Bilder wurde nicht festgestellt. Deshalb wurden keine weiteren ungeklärt nutzbaren Bilder beschafft; die ausdrücklich zu erhaltenden vorhandenen Assets bleiben funktional eingebunden.

## 7. Verbleibende Asset-/Datenlücken

Die aktuellen 896 Monster und 137 ausdrücklich referenzierten Bosse besitzen Bilder; alle 40 Kartenwelten sowie Sammelressourcen und Sammelquest-Items bleiben lokal abgedeckt. Ein aktueller Dungeoneintrag ohne ausdrückliche Bossreferenz (Arachnas, #96) bleibt mit klar definiertem Fallback sichtbar. Im historischen Datenstand bestehen zusätzliche fehlende Illustrations-/Zauberreferenzen und ein nicht lokal abgedecktes Builder-Item; die vollständigen IDs stehen im Audit. Historische Werte werden nicht durch aktuelle Werte ersetzt. Wiederverwendete Grafiken stammen aus dem dokumentierten vorhandenen Bildpaket.

Der schreibgeschützte Katalogaudit umfasst außerdem alle 21.554 Gegenstände über fünf Kategorien, 1.976 Quests und 24.591 Rezept-Zutatenzeilen. 21.550 Gegenstände haben lokal abgedeckte Bildreferenzen. Für vier kosmetische Einträge (#12426, #12427, #13210, #13212) fehlt weiterhin ein lokales Icon; die ursprünglichen Referenzen und Fallbacks bleiben bestehen.

15 Gruppen bytegleicher Bilddateien wurden gefunden. Sie werden als Auditbefund dokumentiert; Dateien und IDs werden deshalb nicht automatisch zusammengelegt. Der Audit prüft Pfade, Dateiformate, Inhalte und Referenzen. Er behauptet keine manuelle Sichtprüfung oder Rechteklärung jedes einzelnen Bildes.

## 8. Testergebnisse

Bestanden: 108 Modul-/Integrationstests, 44 Browser-E2E-Tests, fünf Typechecks, ESLint sowie neun Produktions-UI-Prüfungen. Der native Windows-/WebView2-Test besteht sieben Prüfblöcke einschließlich beider lokaler Übersetzer, aller sechs Übersetzungsrichtungen und des separaten Overlays. Er verwendet identische Releasequellen mit der überprüften separaten Anwendungskennung `fr.dofus.companion.qa.v6`; das produktive Profil bleibt unberührt. Die eigenen nativen Dienste und Übersetzungsworker wurden nach dem Test vollständig beendet.

Der gebündelte Dienstwechsel 0.5.0 → 0.6.0 erhält im isolierten SQLite-Test Charaktere, Questfortschritte, Builds, Berufsstände und Markierungen. NSIS-Installer und Portable-Paket sind gebaut. Die bestehende Update-Signatur wird unabhängig akzeptiert, ein manipulierter Installer abgewiesen; ZIP-CRCs und exakte Produktionspayloads sind geprüft. Installer-SHA256: `309f270f7283d379cdb2fd0569cd96073eaab4c7a100e9e1f21915b9946ce99e`.

Die Einzelbelege stehen in den maschinenlesbaren `*-v6-*.json`-/`REDESIGN_VALIDATION.json`-Berichten. Produktionsprüfungen verwenden den tatsächlich gebauten Vite-Code mit einem isolierten Backend; externe Bildserver sind dabei gesperrt. Lokale Benutzerprofile werden von Entwicklungs- und Browsertests nicht verwendet.

## 9. Dateien und Commits

Die ersten beiden Implementierungscommits sind `09ec42f` (gemeinsamer Workspace/Suche) und `7a19dcb` (Kartenhinweise/Panels/Discord-Bilder). Weitere Commits dokumentieren Tests und Release-Abnahme. Die Änderungen sind auf dem Entwicklungsbranch nachvollziehbar getrennt: Oberfläche/Navigation/Suche, Daten-/Kartenintegration, Tests/Audit und Release-Abnahme. Betroffene Hauptpfade sind `apps/desktop/src/ui/`, `App.tsx`, Items-/Dungeon-/Weltkartenansichten, drei ergänzte GET-API-Bereiche, Bot-Darstellung, `packages/core/src/world.ts` und der zusätzliche Kartenhinweisimport. Persönliche Profile und bestehende Spielrecord-IDs wurden nicht migriert oder ersetzt. Die Versionsnummer ist 0.6.0; Endpunkt und Signierschlüssel des bestehenden Updaters bleiben erhalten.

## 10. Offene Aufgaben / praktische Grenzen

Nicht als erledigt ausgegeben werden: vollständige patchgeprüfte Strategietexte für sämtliche Dungeons, fehlende rechtlich geklärte historische Bilder, serverseitig belegte exakte Ressourcen-Spawns, vollständige Übersetzung der Benutzeroberfläche, universelle DPI-/Monitor-/DOFUS-Koexistenzprüfung und eine echte Discord-Produktiv-Anmeldesitzung. Diese Punkte benötigen zusätzliche verlässliche Quellen, Nutzungsrechte oder eine reale Zielumgebung. Die vorhandenen Funktionen bleiben dabei erreichbar; es wurden keine scheinbar funktionsfähigen Schalter für nicht konfigurierte Dienste ergänzt.
