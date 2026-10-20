# Prüfbericht v0.2.0

Umgebung: Windows x64, Node 22.15, pnpm 11.25, Rust/Tauri 2, Chromium und Microsoft WebView2. Datum: 20.10.2026. Historische v0.1-Ergebnisse stehen unverändert unter [docs/TEST_REPORT.md](docs/TEST_REPORT.md).

## Automatisierte Prüfung

- `pnpm typecheck`: alle fünf Workspaces erfolgreich.
- `pnpm lint`: erfolgreich.
- `pnpm test`: **41 Tests erfolgreich**, davon Core 6, Spieldaten 8, Desktop 10, Backend 8 und Discord 9.
- Rust: vier native Validierungstests erfolgreich. Der separate Release-Signaturtest benötigt den gebauten Installer und wird ausdrücklich mit `--ignored` ausgeführt; Ergebnis siehe Release-Nachweis unten.
- Browser: **17 End-to-End-Fälle im gemeinsamen Lauf erfolgreich**. Ergänzte Materiallink-, Almanax-Ressourcenlink- sowie F8-/Strg-Umschalt-D-Aufnahmen anschließend gezielt erfolgreich geprüft.
- Vollständiger realer Quellenimport: 21.554 eindeutige Item-IDs und 1.976 Quests, keine nicht aufgelösten API-IDs oder Rezeptmaterialziele. [Importbericht](design/catalog-import-v2.json).
- Live-Bildprüfung: 20 von 20 Stichproben aus allen fünf Kategorien erfolgreich als PNG geladen. Dies ist keine vollständige HTTP-Prüfung sämtlicher Bildadressen. [Bildprüfung](design/image-audit-v2.json).
- Installierter öffentlicher Startkatalog: transaktionale Übernahme in einen leeren Datenbestand ausgeführt; zweiter Aufruf überspringt vorhandenen vollständigen Katalog.
- Neue Legacy-Migration geprüft: Profil-ID, Name, Server, Stufe, Version und Questfortschritt bleiben erhalten; bekannte Klasse bekommt eine ID, unbekannte Klassenbezeichnung bleibt unverändert.

## Abnahmefälle des Updateauftrags

| Fälle | Tatsächlicher Nachweis / Grenze |
|---|---|
| 1–4 | Live-Suchvorschau `gela`, Gelano-ID 2469 direkt öffnen, vollständige Ergebnisse und strikte Kategorien geprüft. |
| 5 | AbortController/Sequenzsicherung implementiert; Wechsel und Tastaturbedienung geprüft, kein gesonderter Netzwerklatenz-Stresstest. |
| 6–9 | Alle Kategorien und Mengen gegen Originalbestand geprüft; 20 echte Bilddownloads plus sichtbare Rezept-/Itembilder. Fehlende Bildreferenzen dokumentiert. |
| 10–14 | Echte Kategoriehierarchie und Elternzählung, Questsuche/Schritte sowie kompletter Import geprüft. Voraussetzungen/Erfolge dargestellt; vollständige interpretierte Questketten nicht vorhanden. Zwei Originalguides über Webquellen verifiziert. |
| 15–19 | Itemkopf, acht Gelano-Materialien, Mengenwechsel 1→7, Materialnamen und Materialdetail-Link geprüft. Unbekannte Preise bleiben unbekannt. |
| 20–22 | Alle 19 Klassen, Alias-Suche und stabile Sacrieur-ID geprüft; Erstellung/Bearbeitung und Legacy-Datenerhalt abgedeckt. Neutrale eigene Symbole. |
| 23–25 | Wochenansicht mit sieben Tagen, Vor-/Zurücknavigation und Ressourcenlink geprüft. Monats-/Zeitzonenlogik separat getestet. |
| 26–29 | Aufnahme echter Tastendrücke im Browser, dauerhafte Belegung und Rücksetzen geprüft. Native Registrierung und Reserved-/Duplicate-Prüfung separat. |
| 30–31 | Native OS-F8-Umschaltung, Rettungskombination, Click-through-Abschaltung, Deckkraft/Geometrie über vollständigen Prozessneustart und sauberes Beenden geprüft. Eine gefundene Windows-Fenstererzeugungsblockade wurde korrigiert und der vollständige Ablauf erneut erfolgreich ausgeführt. [Nativer Bericht](docs/native-v2-test.json). |
| 32 | Physischer Mehrmonitor-/DPI-Test nicht ausgeführt. Sichtbarkeitsbegrenzung und Positionswiederherstellung implementiert. |
| 33–36 | Kryptografische und Installer-/Upgrade-Ergebnisse werden nach dem finalen Build unten ergänzt; bis dahin kein bestätigter Live-Upgrade-Nachweis. |
| 37 | Neun Discord-Modul-/Loopback-Tests erfolgreich; echte Discord-Anmeldung nicht ausgeführt. |
| 38 | Offline-Detailcache, ausstehender Fortschritt und Reconnect erfolgreich geprüft. |
| 39–40 | Layouts bei 600, 1366, 1920, 2560 und 3440 Pixeln auf horizontalen Überlauf geprüft; Screenshots erstellt. Verschiedene physische DPI-Skalierungen nicht getestet. |

## Release-Nachweis

Ein Windows-x64-NSIS-Installer und ein Portable-ZIP wurden gebaut. Ein weiterer Build enthält die Korrektur der synchronen Windows-Overlay-Erzeugung. **Finale Signatur-, Installer- und Veröffentlichungsprüfung noch in Arbeit.** Dieser Absatz wird ausschließlich anhand tatsächlich ausgeführter Prüfungen aktualisiert.

## Bekannte Grenzen

Keine echten Discord-Zugangsdaten verwendet, kein physischer Mehrmonitor-/DPI-Test und keine vollständige Prüfung realer DOFUS-Journal-Screenshots. 3.086 Einträge ohne Bildreferenz, nur 17.377 mit zusätzlichen formatierten API-Effekten; Originaltyp 264 ohne Typ-Metadaten. Einzelne Questzieltexte enthalten Quellplatzhalter. Keine erfundenen Marktpreise, Gottheitsnamen oder Schatzsuchenziele. Keine übernommenen Volltextguides und keine pauschale Rechtefreigabe für offizielle Klassenporträts. Kein Windows-Authenticode-Zertifikat.
