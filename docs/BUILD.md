# Geprüfter Windows-Build 0.1.0

Lokal wurden ein Windows-x64-NSIS-Installer und ein installationsfrei startbares ZIP erzeugt. Die Dateien liegen im ignorierten Verzeichnis `artifacts/`:

- `DOFUS-Companion-0.1.0-setup.exe`
- `DOFUS-Companion-0.1.0-setup.exe.sig` (Tauri-Updatesignatur)
- `Dofus-Companion-0.1.0-portable.zip`

SHA-256 und Dateigrößen: [BUILD_SHA256.json](BUILD_SHA256.json). Die Binärdateien werden nicht in Git eingecheckt. GitHub Actions erzeugt Installer und Portable-ZIP als Workflow-Artefakte; die separate Release-Pipeline benötigt die dokumentierten Signierschlüssel und veröffentlicht zunächst einen Entwurf.

Das ZIP vollständig entpacken. Die EXE benötigt den mitgelieferten `service`-Ordner und Microsoft Edge WebView2. Node und Backend sind enthalten. Der native Start, automatische lokale Authentifizierung, echte Itemsuche, SQLite-Favoriten, Hotkey-Registrierung, alle vier Ansichten und lokale Screenshot-OCR wurden aus dem Portable-Verzeichnis geprüft. Die schnelle Folge Compact → Dashboard → Hotbar wird serialisiert, damit ältere Fensteroperationen keine neuere Auswahl überschreiben.

Nach dem ersten Start Questdaten unter **Einstellungen → Questdaten importieren** laden. Es handelt sich um einen großen Download; ein fehlgeschlagener Import erhält den vorherigen Datenbestand. Bereits erfolgreich importiert und geprüft wurden 1.976 Quests.

Die Tauri-Updatesignatur wurde lokal erzeugt. Ein Authenticode-Zertifikat und ein veröffentlichtes Update sind noch nicht eingerichtet; ein echtes Upgrade zwischen zwei installierten Versionen wurde nicht getestet. Weitere Grenzen: [Implementierungsstand](../IMPLEMENTATION_STATUS.md).

Erneuter Build:

```powershell
pnpm --filter @dofus/desktop tauri build --bundles nsis
.\infrastructure\scripts\package-portable.ps1
```

Rust/C++ Build Tools müssen im PATH verfügbar sein. Entwicklungsstart und Einrichtung: [Installation](INSTALLATION.md).
