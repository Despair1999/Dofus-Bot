# Prüfbericht v0.2.2

Umgebung: Windows x64, Node 22.15, pnpm 11.25, Rust/Tauri 2, Chromium und Microsoft WebView2. Datum: 20.10.2026. Historische v0.1-Ergebnisse stehen unverändert unter [docs/TEST_REPORT.md](docs/TEST_REPORT.md).

## Automatisierte Prüfung

- `pnpm typecheck`: alle fünf Workspaces erfolgreich.
- `pnpm lint`: erfolgreich.
- `pnpm test`: **41 Tests erfolgreich**, davon Core 6, Spieldaten 8, Desktop 10, Backend 8 und Discord 9.
- Rust: sechs native Tests erfolgreich, einschließlich realer Listener-Eigentumsprüfung und Windows-Job-Lebensdauer. Eine interne Kindprozess-Fixture wird nicht separat ausgeführt. Der Release-Signaturtest wird zusätzlich ausdrücklich mit dem tatsächlich signierten Installer ausgeführt.
- Browser: **18 End-to-End-Fälle erfolgreich**. Einschließlich Material-/Almanax-Link, F8-/Strg-Umschalt-D-Aufnahme und absichtlich verzögerter alter Suchanfrage. Native WebView2-/Dienstprüfungen separat.
- Vollständiger realer Quellenimport: 21.554 eindeutige Item-IDs und 1.976 Quests, keine nicht aufgelösten API-IDs oder Rezeptmaterialziele. [Importbericht](design/catalog-import-v2.json).
- Live-Bildprüfung: 20 von 20 Stichproben aus allen fünf Kategorien erfolgreich als PNG geladen. Dies ist keine vollständige HTTP-Prüfung sämtlicher Bildadressen. [Bildprüfung](design/image-audit-v2.json).
- Installierter öffentlicher Startkatalog: transaktionale Übernahme in einen leeren Datenbestand ausgeführt; zweiter Aufruf überspringt vorhandenen vollständigen Katalog.
- Neue Legacy-Migration geprüft: Profil-ID, Name, Server, Stufe, Version und Questfortschritt bleiben erhalten; bekannte Klasse bekommt eine ID, unbekannte Klassenbezeichnung bleibt unverändert.

## Abnahmefälle des Updateauftrags

| Fälle | Tatsächlicher Nachweis / Grenze |
|---|---|
| 1–4 | Live-Suchvorschau `gela`, Gelano-ID 2469 direkt öffnen, vollständige Ergebnisse und strikte Kategorien geprüft. |
| 5 | Verzögerte Anfrage `gela` und danach `gelano`: Die ältere Antwort ersetzt die neuen Suchvorschläge nicht. |
| 6–9 | Alle Kategorien und Mengen gegen Originalbestand geprüft; 20 echte Bilddownloads plus sichtbare Rezept-/Itembilder. Fehlende Bildreferenzen dokumentiert. |
| 10–14 | Echte Kategoriehierarchie und Elternzählung, Questsuche/Schritte sowie kompletter Import geprüft. Voraussetzungen/Erfolge dargestellt; vollständige interpretierte Questketten nicht vorhanden. Zwei Originalguides über Webquellen verifiziert. |
| 15–19 | Itemkopf, acht Gelano-Materialien, Mengenwechsel 1→7, Materialnamen und Materialdetail-Link geprüft. Unbekannte Preise bleiben unbekannt. |
| 20–22 | Alle 19 Klassen, Alias-Suche und stabile Sacrieur-ID geprüft; Erstellung/Bearbeitung und Legacy-Datenerhalt abgedeckt. Neutrale eigene Symbole. |
| 23–25 | Wochenansicht mit sieben Tagen, Vor-/Zurücknavigation und Ressourcenlink geprüft. Monats-/Zeitzonenlogik separat getestet. |
| 26–29 | Aufnahme echter Tastendrücke im Browser, dauerhafte Belegung und Rücksetzen geprüft. Native Registrierung und Reserved-/Duplicate-Prüfung separat. |
| 30–31 | Native OS-F8-Umschaltung, Rettungskombination, Click-through-Abschaltung, Deckkraft/Geometrie über Prozessneustart, sauberes und hartes Beenden geprüft. Alter v0.1-Dienst aus anderem Verzeichnis erfolgreich übernommen. [Nativer Bericht](docs/native-v2-test.json). |
| 32 | Physischer Mehrmonitor-/DPI-Test nicht ausgeführt. Sichtbarkeitsbegrenzung und Positionswiederherstellung implementiert. |
| 33–36 | Alte Dienst-Dateisperre reproduziert; kompletter v0.2.2-Installer erfolgreich bis zum Windows-Registryeintrag geprüft. Original-/manipulierte Installersignatur getestet. Profile/Fortschritt über echte alte und neue Dienstpakete in einer isolierten Datenbank geprüft; vorhandene native Aufgaben/Favoriten/Overlay-Einstellungen separat über den Installer erhalten. |
| 37 | Neun Discord-Modul-/Loopback-Tests erfolgreich; echte Discord-Anmeldung nicht ausgeführt. |
| 38 | Offline-Detailcache, ausstehender Fortschritt und Reconnect erfolgreich geprüft. |
| 39–40 | Layouts bei 600, 1366, 1920, 2560 und 3440 Pixeln auf horizontalen Überlauf geprüft; Screenshots erstellt. Verschiedene physische DPI-Skalierungen nicht getestet. |

## Release-Nachweis

Windows-x64-NSIS-Installer, Setup-ZIP und Portable-ZIP wurden gebaut. v0.2.0 und v0.2.1 wurden während der Abnahme zurückgezogen: Der alte Dienst blieb bestehen und blockierte den Austausch seiner Node-Datei. v0.2.2 übernimmt den eigenen Dienst bereits vor dem Dateiaustausch durch einen eingebetteten Installer-Helfer und schützt neue Dienste durch ein Windows-Jobobjekt.

Der vollständige NSIS-Lauf mit einem kontrollierten, dateisperrenden v0.1-Dienst liefert Exitcode 0 und Windows-Registryversion 0.2.2. [Installerbericht](docs/installer-transition-v2-test.json). Die installierte App startet anschließend mit Dienstversion 0.2.2. Native Aufgaben, Favoriten und Overlay-Einstellungen wurden erhalten. Im tatsächlichen nativen Benutzerbestand lagen keine Charaktere vor; der Erhalt von Profilen und pausiertem Questfortschritt wurde deshalb mit beiden echten Dienstpaketen in einer **getrennten Testdatenbank** geprüft. [Dienstmigration](docs/service-upgrade-v2-test.json).

v0.2.2 ist auf GitHub veröffentlicht; die SHA256-Prüfsummen aller sieben Release-Dateien stimmen mit den lokalen Artefakten überein. Der tatsächlich installierte v0.1.0-Client hat über „Nach Updates suchen“ den signierten GitHub-Download und die NSIS-Installation erfolgreich abgeschlossen. Windows-Registry, native App und Backend melden anschließend 0.2.2. Vorhandene SQL-Aufgaben, Favoriten und Overlay-Einstellungen blieben erhalten. Die anschließende Updatesuche bestätigt die aktuelle freigegebene Version. [Upgradebericht](docs/update-v2-test.json).

Die eigene Testaufgabe wurde entfernt und die isolierte Testinstallation deinstalliert. Die Benutzerdatenbank blieb erhalten. Der getrennte Profil-/Fortschrittsnachweis ist im oben verlinkten Dienstmigrationsbericht dokumentiert.

## Bekannte Grenzen

Keine echten Discord-Zugangsdaten verwendet, kein physischer Mehrmonitor-/DPI-Test und keine vollständige Prüfung realer DOFUS-Journal-Screenshots. 3.086 Einträge ohne Bildreferenz, nur 17.377 mit zusätzlichen formatierten API-Effekten; Originaltyp 264 ohne Typ-Metadaten. Einzelne Questzieltexte enthalten Quellplatzhalter. Keine erfundenen Marktpreise, Gottheitsnamen oder Schatzsuchenziele. Keine übernommenen Volltextguides und keine pauschale Rechtefreigabe für offizielle Klassenporträts. Kein Windows-Authenticode-Zertifikat.
