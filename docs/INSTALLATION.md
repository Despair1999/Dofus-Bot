# Installation und Start

## Lokale Browseransicht

Node.js 22.15+ installieren, das Repository herunterladen/klonen und PowerShell im Projektordner öffnen:

```powershell
.\infrastructure\scripts\setup.ps1
.\infrastructure\scripts\start.ps1 -Mode Web
```

Das Startskript liest `.env`, startet Backend und Vite. Browser: http://127.0.0.1:1420. Falls PowerShell lokale Skripte gemäß Unternehmens-/Computerrichtlinie sperrt, die erlaubte PowerShell-Ausführungsrichtlinie des Geräts beachten; alternativ `.env` selbst als Prozessumgebung laden und die im README beschriebenen pnpm-Befehle benutzen.

Unter Einstellungen den privaten `COMPANION_TOKEN` aus `.env` setzen und „Verbindung testen & synchronisieren“ wählen. Wird das Backend ohne Umgebungs-Schlüssel gestartet, steht sein automatisch erzeugter Schlüssel in `.data/backend-token`. Unterschiedliche Schlüssel verursachen HTTP 401; immer den Schlüssel des tatsächlich laufenden Backends verwenden.

Erst „Questdaten importieren“ ausführen und den Status prüfen; der Quell-Download ist groß. Ohne erfolgreichen Import ist die Questsuche leer. Gegenstände und Almanax laden Daten bei Bedarf. Ohne Verbindung funktionieren bereits gespeicherte Inhalte und lokale Werkzeuge.

## Native Windows-Entwicklung

Windows 10/11 x64, WebView2, Rust über https://rustup.rs/ sowie Visual Studio Build Tools mit Desktopentwicklung C++ und Windows SDK installieren. Danach:

```powershell
.\infrastructure\scripts\start.ps1 -Mode Desktop
```

Das Skript startet bei Bedarf ein lokales Backend und führt Tauri aus. Die native Oberfläche übernimmt den lokalen Schlüssel automatisch. Der erste Rust-Build kann länger dauern. `start.ps1` ergänzt `%USERPROFILE%\.cargo\bin` für die Sitzung. Das Webfrontend alleine benötigt keinen Rust-Compiler.

## Windows-Installer und portable Datei

Nur tatsächlich erzeugte Artefakte aus einem geprüften lokalen Build oder erfolgreichen Actions-Run verwenden. Der Release-Build enthält Node und Backend unter seinen Service-Ressourcen und startet den lokalen Dienst automatisch; Daten/Protokoll liegen im AppData-Verzeichnis der Anwendung. Das Backend wird beim Schließen beendet. Eine separate Node-Installation ist für die installierte Anwendung nicht nötig. Der aktuelle Source-Stand erzeugt noch keine automatisch bestätigte Veröffentlichung. Unsigned CI-Installer können in SmartScreen als unbekannter Herausgeber erscheinen. Eine portable Auslieferung muss die Service-Ressourcen mitliefern; eine einzelne EXE reicht nicht aus und WebView2 wird weiterhin benötigt.

Für signierte Updates: [RELEASES.md](../infrastructure/RELEASES.md). Ein Tauri-Updateschlüssel ist kein Windows-Authenticode-Zertifikat. „Nach Updates suchen“ funktioniert erst mit einem veröffentlichten kompatiblen Manifest/Release; fehlende Releases sind kein Beweis einer aktuellen Installation.

## Discord

`.env` um `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, optional Testserver `DISCORD_GUILD_ID` und privaten Besitzer `DISCORD_OWNER_ID` ergänzen. Der Backend-Schlüssel muss derselbe sein wie im Desktop. `pnpm --filter @dofus/discord-bot register` registriert die Commands; `start.ps1 -Mode Discord` startet den Bot. Das Backend muss separat laufen. Details und Berechtigungen: [Bot-README](../apps/discord-bot/README.md).

Keine Ankama-Passwörter oder Spielsession-Tokens eingeben. Der Discord-Bot benötigt einen durchgehend laufenden Host. Bei ausgeschaltetem PC ist er offline.

## Häufige Probleme

- **4310/1420 bereits belegt:** vorhandene Companion-Prozesse schließen oder die zusammenpassende Backend-/Frontend-Konfiguration anpassen. Nicht wahllos fremde Prozesse beenden.
- **401:** Schlüssel in Einstellungen und Backend-Umgebung abgleichen. Kein Schlüssel wird öffentlich angezeigt.
- **Keine Questtreffer:** Importstatus und Datenversion prüfen, dann deutsche oder französische Suchbegriffe probieren.
- **429/503 externer Datenquelle:** warten; Cache wird als möglicherweise veraltet gekennzeichnet. Keine Live-Daten werden erfunden.
- **OCR-Freigabe nicht unterstützt:** einen selbst aufgenommenen Screenshot über „Screenshot öffnen“ importieren. Erste OCR benötigt Download des Sprachmodells.
- **Versionskonflikt:** ausstehende Änderungen bleiben erhalten. Serverstand prüfen; erst nach bewusster Entscheidung Outbox verwerfen und erneut synchronisieren.
- **pnpm-Build-Skripte:** Projektkonfiguration erlaubt die benötigten esbuild-/Tesseract-Skripte; keine unbekannten Dependencies pauschal freigeben.
- **Docker:** [Containeranleitung](../infrastructure/docker/README.md); benötigt installierte laufende Docker-Engine.
