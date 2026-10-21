# Prüfbericht v0.4.0

Prüfdatum: 21.10.2026. Projekt: vorhandenes DOFUS-Companion-Monorepo, Windows x64.

## Abgeschlossene Code- und Oberflächenprüfungen

| Prüfung | Tatsächliches Ergebnis |
|---|---|
| `pnpm typecheck` | Alle fünf Workspacepakete erfolgreich |
| `pnpm lint` | Erfolgreich, keine ESLintfehler |
| `pnpm test` und abschließende Discord-Nachprüfung | 104 verschiedene Tests erfolgreich: Core 29, Game Data 8, Desktop 13, Discord 19, Backend 35 |
| Vollständige Playwright-Reihe | 33/33 erfolgreich gegen isoliertes Backend auf Port 4311 und echten öffentlichen Katalog |
| Nachprüfung der neuen Oberflächen | 6/6 erfolgreich nach abschließenden UI-Änderungen |
| Neuer Dungeonimport | Zwei SQLite-Snapshots mit geprüften SHA-256-Digests/Integrität tatsächlich importiert |
| Zusätzliche Dungeon-Nachprüfung | 7/7 erfolgreich nach Ergänzung der recherchierten, unbestätigten Guide-Notizen |

Die vollständige Browserreihe umfasst bisherige Builder-/Katalog-/Crafting-/Quest-/Charakter-/Offline-/OCR-/Hotkeyfunktionen sowie neue Weltkarte, identische Koordinaten mit verschiedenen Map-IDs, unverbundene Karten ohne erfundene Kanten, responsive Ansichten mit 600 und 1366 Pixeln, Berufsquestverknüpfung, Datenlückenanzeige und Activity-Fallback.

Die beiden Translator-Browsertests verwenden ausdrücklich definierte HTTP-Testantworten, um Debounce, unabhängige Karten, veraltete Antworten, Fehler, Clipboard und Persistenz deterministisch zu prüfen. Sie sind kein Nachweis neuronaler Übersetzungsqualität. Dafür wurden separat alle sechs Sprachrichtungen mit echten lokalen Modellen bei blockierter externer Socket-Erstellung ausgeführt; zusätzlich wurden sechs REST-Anfragen mit einer Kopie der gebündelten Pythonruntime geprüft. Ergebnisse und Umfang: [Offline-Übersetzer](docs/OFFLINE_TRANSLATOR.md).

Die Discord-Activity-Tests verwenden kontrollierte Discordantworten für OAuth-App-ID, Challenge/Replay, Instanzteilnahme, Ablauf, Sitzungstrennung, Versionskonflikte und verweigerten Zugriff auf private Companion-Daten. Ohne öffentliche HTTPS-Installation und Developer-Portal-Konfiguration ist dies kein Discord-Livenachweis. Die neuen Bot-Embeds/-Buttons/-Commands sind lokal gegen Discord.js-Grenzen und echte importierte Dungeonbeispiele getestet; es wurde keine Nachricht an fremde Discordbenutzer versendet.

Die PNG-Prüfungen dekodieren die erzeugten PNG-Chunks, prüfen CRC und Rasterpixel und bestätigen, dass ohne ausdrückliche Graphkante keine Verbindungslinie gezeichnet wird. Private Marker verändern die öffentliche Vorschau nicht.

## Windows und Release

Die tatsächlich gebaute Portable-Ausgabe wurde über WebView2 getestet: zwei unabhängige Desktopkarten übersetzen FR→DE und DE→FR mit echten lokalen Modellen, alle sechs Richtungen funktionieren über den gebündelten Dienst, und das native Overlay zeigt beide Karten sowie die übertragene Navigationsansicht. Nach Beendigung der eigenen Testanwendung waren Backend und Pythonworker beendet. Geänderte UI-Präferenzen und native Einstellungen wurden gesichert und wiederhergestellt. Nachweise: [native Abnahme](docs/native-v4-test.json), [Prozesslebensdauer](docs/native-v4-lifecycle.json).

Der echte v0.3-Dienst und der neue gebündelte Dienst wurden nacheinander mit einer separaten SQLite-Testdatenbank gestartet. Charakter, Questfortschritt, Build und berechnete Werte blieben unverändert; neue Berufslevel, Fortschritte und Marker überstanden einen Neustart. [Migrationstest](docs/service-upgrade-v4-test.json).

Der tatsächliche NSIS-Preinstall-Helfer hat einen isolierten v0.3-Testdienst beendet und die zuvor gesperrte `node.exe` austauschbar gemacht. Es wurde dabei kein produktiver Installer ausgeführt und keine Uninstall-Registry verändert. [Service-Guard-Nachweis](docs/install-guard-v4-test.json).

Rust: sechs Tests erfolgreich; die als eigenständiger Kindprozess benutzte Listenerfixture ist im normalen Durchlauf absichtlich ignoriert. Der endgültige Installer wurde mit dem bestehenden Update-Schlüssel signiert. Eine unabhängige Ed25519/Minisign-Prüfung bestätigt Originaldatei, signierten Kommentar und Schlüsselzuordnung und weist eine manipulierte Datei zurück. [Signaturbericht](docs/release-v4-signature-test.json). Auch die ausdrücklich aktivierte Rust-Prüfung mit `minisign-verify` hat Original und manipulierten Installer korrekt unterschieden: ein weiterer Test erfolgreich.

Erstellte Windows-Artefakte: `DOFUS-Companion-0.4.0-setup.exe` mit `.sig`, Setup-ZIP, vollständiges Portable-ZIP und unveränderter öffentlicher Katalogsnapshot. Die Modelle gehören nicht zum Installer; nach ausdrücklichem Klick werden sie einmalig von der offiziellen Quelle geladen. Der Installer benötigt rund 71 MiB, das vollständige Portable-ZIP rund 110 MiB. Prüfsummen werden im Release veröffentlicht.

## Veröffentlichung und Updatekanal

[v0.4.0 wurde veröffentlicht](https://github.com/Despair1999/Dofus-Bot/releases/tag/v0.4.0). Sämtliche hochgeladenen Dateien wurden anhand von Größe und GitHub-SHA-256-Digest mit den lokalen Artefakten verglichen. Die tatsächliche öffentliche `releases/latest/download/latest.json` liefert Version 0.4.0 und die signierte Installer-URL. [Artefakt-Prüfsummen](docs/BUILD_v0.4.0_SHA256.json).

Die tatsächlich installierte v0.3-Anwendung wurde zusätzlich ohne Installeraufruf gestartet. Ihr nativer Tauri-Updater erkennt über seinen unveränderten konfigurierten HTTPS-Kanal v0.4.0 als Update. Es wurde keine produktive Installation überschrieben. [Updatekanal-Abnahme](docs/update-v4-channel-test.json).

Die GitHub-Typescript-Qualitätsprüfung des Implementierungscommits ist erfolgreich. Der zusätzliche GitHub-Windows-Job wird nicht als abgeschlossen behauptet, solange er noch läuft; der oben dokumentierte lokale Windows-Build und die nativen Prüfungen wurden tatsächlich ausgeführt.

Nicht automatisch bestätigt: physisches Zusammenspiel mit einem laufenden DOFUS-Fenster, alle Monitor-/DPI-Kombinationen, Discord-Hosting/Portal-Aktivierung, vollständige Raum-/Strategiedaten und ein tatsächlicher Installerwechsel in der persönlichen produktiven Windowsinstallation. Der Service-Guard-Test ist separat als begrenzter Test des tatsächlichen NSIS-Helfers gekennzeichnet.
