# Windows-Updates

v0.2.1 verwendet dieselbe Anwendungs-ID `fr.dofus.companion`, denselben öffentlichen Minisign-Schlüssel und denselben GitHub-Endpunkt wie v0.1.0. Der private Schlüssel bleibt außerhalb der Versionsverwaltung.

## Für Anwender

In **Einstellungen → Anwendungsupdates → Nach Updates suchen** prüfen. Bei verfügbarer Version den Download starten und nach erfolgreicher Signaturprüfung installieren. Die Anwendung wird dabei beendet; anschließend über die Windows-Verknüpfung starten. Der v0.1-Updater besitzt noch die bisherige, einfachere Oberfläche.

Alternativ das Setup-ZIP vollständig entpacken und die enthaltene Setup-EXE starten. Bei einer bestehenden Installation denselben Installationsort verwenden. Für die portable Ausgabe das gesamte Portable-ZIP entpacken; EXE und `service`-Ordner gehören zusammen.

Persönliche Daten liegen in den vorhandenen Windows-AppData-Verzeichnissen, getrennt vom Programm. Der Installer löscht sie nicht. `personal.sqlite` erhält die additive Klassen-ID-Migration. Bestehende unklare Klassenbezeichnungen bleiben erhalten. Der öffentliche mitgelieferte Katalog wird nur bei fehlendem Itemkatalog aktiviert; vorhandene vollständige Spieldaten werden nicht durch eine ältere Paketkopie ersetzt.

## Für Maintainer

`pnpm typecheck`, `pnpm lint`, `pnpm test`, Browser-E2E und `cargo test` vor Veröffentlichung ausführen. Optional `COMPANION_CATALOG_PATH` auf einen geprüften öffentlichen `game-data.sqlite`-Snapshot setzen; der Backend-Bundler lehnt unbekannte Tabellen ab. Der Desktop startet ohne gesonderte Node-Installation.

```powershell
$env:COMPANION_CATALOG_PATH = (Resolve-Path '.data/game-data.sqlite').Path
pnpm --filter @dofus/desktop tauri build --bundles nsis
pnpm --filter @dofus/desktop exec tauri signer sign --private-key-path .data/updater.key --password= src-tauri/target/release/bundle/nsis/'DOFUS Companion_0.2.1_x64-setup.exe'
```

Der private Schlüssel darf niemals im Repository, ZIP, Log oder Release erscheinen. Windows-Authenticode und Tauri-Updatesignaturen sind unterschiedliche Verfahren: Eine gültige Updatesignatur unterdrückt keine Windows-SmartScreen-Warnung.

`latest.json` enthält Version, Veröffentlichungsdatum, Hinweise sowie für `windows-x86_64` die HTTPS-Installeradresse und die vollständige Base64-Signatur. Erst alle Assets hochladen und prüfen, dann den Entwurf veröffentlichen. Ein falscher Schlüssel, manipulierte Bytes oder eine fehlende Signatur dürfen niemals durch eine ungesicherte Installation umgangen werden.

Der Release-Workflow erzeugt weiterhin zunächst einen Entwurf. Er benötigt die Repositoryvariable `TAURI_UPDATER_PUBLIC_KEY` sowie das Secret `TAURI_SIGNING_PRIVATE_KEY`; bei verschlüsseltem Schlüssel zusätzlich dessen Passwort-Secret. Die lokale Release-Publikation kann den vorhandenen Git-Credential-Helper verwenden, ohne dessen Zugangsdaten auszugeben.

Spieldaten werden unabhängig unter **Einstellungen → Spieldaten** aktualisiert: Größen- und SHA-256-Prüfung, fortsetzbarer Download, transaktionaler Import. Fehler lassen den vorherigen Katalog bestehen. Bereits überprüfte Downloaddateien werden wiederverwendet.

v0.2.1 übernimmt einen nach dem alten v0.1-Updater zurückgebliebenen Dienst nur bei passendem Programmpfad oder beim exakt geprüften v0.1-Backendcode im ursprünglichen Portable-Bundle. Neue Hintergrunddienste sind an ein Windows-Jobobjekt gebunden und enden deshalb auch beim direkten Prozessende durch den Updater. Ein fremder Dienst auf Port 4310 wird nicht beendet.
