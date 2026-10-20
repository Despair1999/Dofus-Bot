# Umsetzungsstand v0.3.0

Builder und Charakter-Update: [BUILDER_IMPLEMENTATION_STATUS.md](BUILDER_IMPLEMENTATION_STATUS.md), Prüfungen und Grenzen: [BUILDER_TEST_REPORT.md](BUILDER_TEST_REPORT.md). Enthalten sind der gemeinsame Filter-/Berechnungskern, zwei getrennte Spielversionen, historische Item-/Seteffekte, alle 19 Klassenbilder, Charakter-Sets, direkte Schadensstrategien und der deterministische Hintergrund-Optimierer. Komplexe Kampfzustände bleiben ausdrücklich begrenzt.

## Bestehende Module aus v0.2.x

Die Änderungen sind im vorhandenen Monorepo umgesetzt. Prüfungen und Release-Ergebnisse stehen in [TEST_REPORT.md](TEST_REPORT.md).

| Bereich | Stand und praktische Grenzen |
|---|---|
| Branding | Gelieferte Wortmarke und App-/Windows-Icons integriert. |
| Suche | Debounce, Request-Abbruch, Tastaturbedienung, Direktdetail, vollständige Trefferliste, Kategorien, Typ/Stufe/Sortierung, Pagination und Verlauf. |
| Itemkatalog | 21.554 Originalitems einschließlich 17.377 API-Ergänzungen; 4.743 Rezepte. Originaleinträge können versteckt oder historisch sein. Datenlücken dokumentiert. |
| Quests | 1.976 Quests, Originalkategorien plus Erfolgsbeziehungen, Schritte/Ziele, Materialien, Startpositionen und bestätigter Status. Kein vollständig interpretierter Questkettenplaner; einige Originalziele enthalten noch technische Platzhalter. |
| Guides | Verifizierte Originalartikel für zwei Questnamen, ansonsten gezielte Originalseitensuche. Kein genehmigungsloser Volltext-/Übersetzungsimport. |
| OCR | Freigegebene Screenshots lokal; eigener Backendabgleich des Texts mit vollständigem Katalog. Eindeutige Schrittvorschläge sind unbestätigt. Echte Spieljournalbilder und sämtliche DPI-Varianten sind nicht vollständig abgedeckt. |
| Crafting | Itemkopf, Materialbilder/-namen, Bedarf/Bestand, manuelle Serverpreise, unbekannte Preise, Gebühren, CSV, Projekte. Keine Live-Marktpreise. |
| Charaktere | 19 echte BreedData-Klassen, Alias-Suche und stabile IDs. Alte unklare Freitextklassen bleiben erhalten. Eigene neutrale Symbole statt offizieller Porträts ohne belegte Bildfreigabe. |
| Almanax | Wochen-/Monatsansicht, Tagesdetails, Mengen/Bilder, Ressourcenlinks, Bonusfavoriten, Einkaufslisten, CSV/ICS. Benötigt erreichbare API oder gespeicherte Tage. Kein erfundener Gottheitsname. |
| Overlay | Separates natives Fenster; Module, Profile, Größe, Position, Transparenz, Fixierung, Click-through mit festem Rettungs-Hotkey. Physische Mehrmonitor-/DPI-Prüfung separat ausstehend. |
| Hotkeys | Aufnahme tatsächlicher Tasten, Reservierungs-/Dublettenprüfung, native Registrierung, persistentes Speichern, Rollback bei Fehlern. |
| Bestehende Daten | Gleiche Speicherorte und Anwendungs-ID; additive Klassenmigration, öffentlicher Katalog getrennt von Benutzerinformationen; Offline-Outbox und Versionskonflikte bleiben erhalten. |
| Discord | Bestehende Commands und Owner-Gate kompatibel; 9 Modul-/Loopback-Tests. Ohne Bot-Anmeldung kein bestätigter Discord-Livetest. |
| Updater/Windows | Gleicher Minisign-Schlüssel wie v0.1; Download/Signatur/NSIS. Konkreter Build-/Upgrade-Nachweis siehe Testbericht. Kein Authenticode-Zertifikat. |
| Schatzsuche/Routing | Keine produktive DBI-Datenquelle; keine simulierten Zielpositionen. Overlaymodul kennzeichnet fehlende Quelldaten. |

Weiterhin außerhalb dieser Version: öffentliche Mehrbenutzerbereitstellung/OAuth, PostgreSQL/Redis/WebSocket, vollständige Build-/Zauber-/Monsterkatalogoberflächen und Live-Marktüberwachung. Diese Funktionen werden nicht als implementiert dargestellt.
