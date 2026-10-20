# DOFUS Companion

Eine deutschsprachige, unabhängige Spielhilfe für DOFUS 3: Windows-Desktop mit React/Tauri, lokales Backend, importierte Questdaten und optionaler Discord-Bot. Das Repository enthält eine erste funktionsfähige Implementierung wichtiger Kernabläufe. Der gesamte Umfang des Masterprompts ist **noch nicht fertig**; maßgeblich ist [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

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

- Gegenstände suchen, Werte/Rezept anzeigen, Namen kopieren und Favoriten speichern; echte Dofusdude-Daten, Cache mit Ausfallanzeige.
- Questdaten von dofus-sqlite herunterladen, SHA-256 prüfen und atomar importieren; deutsche/französische Namen, bekannte Schritte und Ziele durchsuchen.
- Charaktere registrieren, Fortschritt manuell bestätigen und zwischen Desktop und dem optionalen privaten Discord-Zugriff synchronisieren.
- Lokale OCR mit Tesseract für freigegebene/importierte Screenshots, Textabgleich und manuell bestätigte Vorschläge. Sprachmodelle benötigen beim ersten Download Internet.
- Materialbedarf, eigene Bestände/Preise und Erlös nach Zukaufkosten berechnen; keine erfundenen Marktpreise.
- Almanax, lokale Aufgaben, Favoriten, vier Fensteransichten, konfigurierbarer Scanner-Hotkey und lokale Speicherung mit Synchronisierungswarteschlange.
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

„Nach Updates suchen“ ist in den Einstellungen eingebaut. Windows-Updates werden über GitHub Releases bezogen und mit Tauri-Signaturen geprüft. Ein veröffentlichter Release und passende Signierschlüssel sind erforderlich; die Implementierung behauptet keinen bereits vorhandenen Update-Release. [Release-Einrichtung](infrastructure/RELEASES.md).

Die GitHub-Workflows enthalten Checks, Windows-Build und eine signierte Release-Pipeline. GitHub Actions müssen tatsächlich laufen, bevor deren Erfolg behauptet werden kann. [Testbericht](docs/TEST_REPORT.md), [Architektur](ARCHITECTURE.md), [Datenquellen](docs/SOURCES.md), [Docker](infrastructure/docker/README.md).

Keine automatischen Spielaktionen, Prozessinjektion, Spieltoken-/Passwortabfrage oder ungefragte Bildschirmübertragung. Externe Guides werden verlinkt, nicht kopiert. DOFUS und zugehörige Spielinhalte gehören ihren jeweiligen Rechteinhabern; dieses Projekt ist unabhängig von Ankama.
