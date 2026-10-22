# DOFUS Companion

**v0.4.0 – Weltkarte, Farmrouten, Dungeons und Offline-Übersetzer.** Der bestehende Companion enthält jetzt einen lokalen schematischen Atlas mit 40 Weltkarten und 15.409 Kartenpositionen, 118 unterschiedlichen Sammelitems (124 Sammelaktionen), versionierte Dungeon-/Monsterdaten und sechs Berufsquests. Zwei reguläre Overlaykarten übersetzen DE/EN/FR mit lokalen Argos-Modellen. Die Modelle werden einmalig nach Klick heruntergeladen; die Python-/Inferenzruntime ist im Windows-Paket enthalten.

Die Routen verwenden ausschließlich bekannte Kartenübergänge und eigene bestätigte Ressourcenfunde. Gebietsangaben sind keine genauen Sammelstellen oder aktuellen Spawns. Nicht belegte Raumzusammenstellungen, Strategien und Aktivitätszustände bleiben ausdrücklich offen. Umfang, Quellen, Tests und noch erforderliche externe Discord-Konfiguration: [v0.4-Stand](V4_IMPLEMENTATION_STATUS.md), [Weltkartenimport](WORLD_DATA_IMPORT.md), [Dungeonimport](DUNGEON_DATA_IMPORT.md), [Übersetzer](docs/OFFLINE_TRANSLATOR.md), [Discord Activity](ACTIVITY_SETUP.md).

Eine deutschsprachige, unabhängige Spielhilfe für DOFUS 3: Windows-Desktop mit React/Tauri, lokales Backend und optionaler Discord-Bot. **v0.3.0** ergänzt einen Ausrüstungs-Builder mit Charakter-Sets, gemeinsamen Effektfiltern, versionierten Zaubern, Schadensvorschau, Vergleichen und einem Optimierer im Hintergrund. Gelieferte Bilder aller 19 Klassen sind integriert. Die bisherigen Such-, Quest-, OCR-, Crafting-, Almanax- und Overlay-Module bleiben erhalten.

Windows-Pakete: [Releases](https://github.com/Despair1999/Dofus-Bot/releases). Für bestehende Installationen: **Einstellungen → Nach Updates suchen**. Details: [UPDATE_GUIDE.md](UPDATE_GUIDE.md). Umsetzungsgrenzen und ausgeführte Prüfungen: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), [TEST_REPORT.md](TEST_REPORT.md).

Der geprüfte öffentliche Katalog enthält 21.554 Items, 4.743 Rezepte, 1.976 Quests und 19 Klassen. [Datenqualität und Import](DATA_IMPORT.md) dokumentieren auch fehlende Bildreferenzen und Effekttexte. Der Windows-Release liefert diesen Katalog mit; persönliche Profile und Fortschritte bleiben davon getrennt.

Der Builder liefert getrennte Ausrüstungs-/Set-/Zauberdaten für DOFUS 3.6.12.16 und 3.7.12.12 mit. Je Datenstand sind 836 Klassensprüche mit 1.729 Rängen enthalten. Komplexe Zustandsmechaniken werden nicht mit erfundenen exakten Schäden ersetzt. [Builder-Prüfbericht](BUILDER_TEST_REPORT.md), [Berechnungsumfang](DAMAGE_ENGINE_SPEC.md), [Datenquellen](SPELL_DATA_SOURCES.md).

## Schnellstart unter Windows

Voraussetzung: Node.js 22.15 oder neuer. Im Repository:

```powershell
.\infrastructure\scripts\setup.ps1
.\infrastructure\scripts\start.ps1 -Mode Web
```

Anschließend http://127.0.0.1:1420 öffnen. Das Setup installiert pnpm/Dependencies, erzeugt eine private `.env` mit zufälligem Schlüssel und führt TypeScript-Prüfung und Tests aus. In der Browseransicht den `COMPANION_TOKEN` aus `.env` unter Einstellungen eintragen. Ohne `.env` erzeugt das Backend seinen Schlüssel in `.data/backend-token`. Schlüssel niemals veröffentlichen.

Die native Entwicklung starten mit `start.ps1 -Mode Desktop`; dafür werden Rust, Microsoft Visual Studio C++ Build Tools und WebView2 benötigt. Der native Build startet sein mitgeliefertes Backend automatisch und übernimmt den lokalen Schlüssel. Die installierte Anwendung benötigt keine separate Node-Installation. Details: [Installation](docs/INSTALLATION.md).

Ein lokaler Windows-Installer und ein Portable-ZIP wurden tatsächlich gebaut und getestet. Paketnamen, Prüfsummen und Grenzen: [Windows-Build](docs/BUILD.md).

## Bereits nutzbar

- Suchvorschläge während der Eingabe, Direktdetails, mehrsprachige Suche, Kategorien, Typ/Stufe/Sortierung, vollständige Trefferzahlen und Pagination.
- Questdaten von dofus-sqlite herunterladen, SHA-256 prüfen und atomar importieren; deutsche/französische Namen, bekannte Schritte und Ziele durchsuchen.
- Charaktere registrieren, Fortschritt manuell bestätigen und zwischen Desktop und dem optionalen privaten Discord-Zugriff synchronisieren.
- Lokale OCR mit Tesseract für freigegebene/importierte Screenshots, Textabgleich und manuell bestätigte Vorschläge. Sprachmodelle benötigen beim ersten Download Internet.
- Bebilderte Materialnamen, skalierbare Rezeptmengen, eigene Serverpreis-/Bestandsprofile, CSV und gespeicherte Crafting-Projekte; unbekannte Preise erzeugen keinen erfundenen Gewinn.
- Suchbares Klassen-Dropdown mit stabilen IDs, Almanax-Wochen-/Monatsansicht, Einkaufslisten und Kalenderexport, Aufgaben und Favoriten.
- Separates Overlay mit Modulpositionen/-größen, Profilen, Transparenz, Fixierung, Click-through und festem Rettungs-Hotkey. Tastenkombinationen durch Drücken aufnehmen und dauerhaft speichern.
- Discord: Charakterformular, Profile/Questfortschritt, Itemauswahl, Questsuche, Crafting-Rechner und persistente Dungeon-Gruppen mit Warteliste/Erinnerung.

## Entwicklungsbefehle

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm test:ocr
pnpm build
pnpm --filter @dofus/backend smoke
pnpm --filter @dofus/discord-bot register
```

Für den Bot sind Discord-Zugangsdaten in `.env` erforderlich. Persönliche Befehle sind auf `DISCORD_OWNER_ID` beschränkt; OAuth und Mehrbenutzer-Kontoverknüpfung sind noch nicht implementiert. Ein ausgeschalteter Rechner kann keinen Discord-Bot betreiben. [Bot-Anleitung](apps/discord-bot/README.md).

## Updates und Veröffentlichung

„Nach Updates suchen“ ist in den Einstellungen eingebaut. Windows-Updates werden über GitHub Releases bezogen und mit dem ursprünglichen Tauri-Signierschlüssel geprüft. Veröffentlichte Versionen und ihre Download-Dateien dürfen durch weitere Builds nicht ersetzt werden. [Release-Einrichtung](infrastructure/RELEASES.md).

Die GitHub-Workflows enthalten Checks, Windows-Build und eine signierte Release-Pipeline. GitHub Actions müssen tatsächlich laufen, bevor deren Erfolg behauptet werden kann. [Testbericht](docs/TEST_REPORT.md), [Architektur](ARCHITECTURE.md), [Datenquellen](docs/SOURCES.md), [Docker](infrastructure/docker/README.md).

Keine automatischen Spielaktionen, Prozessinjektion, Spieltoken-/Passwortabfrage oder ungefragte Bildschirmübertragung. Externe Guides werden verlinkt, nicht kopiert. DOFUS und zugehörige Spielinhalte gehören ihren jeweiligen Rechteinhabern; dieses Projekt ist unabhängig von Ankama.
