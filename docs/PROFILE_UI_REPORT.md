# DOFUS Companion 0.7.0 – Profil und Spieloberfläche

Veröffentlicht am 22. Oktober 2026: [Release v0.7.0](https://github.com/Despair1999/Dofus-Bot/releases/tag/v0.7.0), [PR #4](https://github.com/Despair1999/Dofus-Bot/pull/4). Der öffentliche bestehende Update-Endpunkt liefert 0.7.0 mit der lokal geprüften Signatur aus; Nachweis: `UPDATE_v0.7.0_PUBLIC.json`. Abruf in der Anwendung: Einstellungen → Daten & Updates → Nach Updates suchen. Es wurde kein Update in der laufenden Benutzerinstanz installiert.

Gezielte Weiterentwicklung des bestehenden grünen Dark-Mode-Designs. Grundlage ist der Benutzerauftrag vom 22. Oktober 2026 mit den neun Bildreferenzen. Bestehende Spielkataloge, Charakter-IDs, Klassen-IDs und Berechnungen bleiben erhalten.

## 1. Behobene Fehler — vollständig

- Das Kartenrad verwendet einen nativen, korrekt entfernten `wheel`-Listener mit `passive: false`. `preventDefault` verhindert das Mitscrollen der Seite; der Zoom bleibt am Mauszeiger verankert. Außerhalb der Kartenfläche scrollt die Seite normal.
- Die grünen Questflächen waren Koordinatenbuttons mit unpassenden globalen Buttonfarben. Eigene kontrastreiche Stile und umbrechende Flexzeilen machen Koordinaten und Aktion wieder lesbar. Die Aktion bleibt funktionsfähig.
- Gespeicherte Routen zeigen ihren Status erst nach abgeschlossener Kartenauswahl; ein älterer asynchroner Ladevorgang kann die neue Auswahl nicht überschreiben.
- Auf schmalen Fenstern überstimmt die mobile Hauptinhaltsregel nun auch den spezifischeren Desktop-Selektor. Dadurch bleibt das Profil bei 420 Pixeln erreichbar.

## 2. Kartenbedienung — vollständig

Mausanker, Drag, Zoomtasten, Vollbild, gespeicherte Panelgrößen und echte Map-IDs bleiben erhalten. Filterpanels besitzen unabhängiges Scrollverhalten. Hoverinformationen zeigen Namen, Kategorie, Koordinaten und Map-ID. Marker werden aus zwischengespeicherten SVG-Bildern gezeichnet; pro Symbol wird nur ein Ladehandler registriert.

## 3. Kartensymbole — vollständig mit eigenen Alternativen

`GameGlyph.tsx` enthält selbst gezeichnete SVG-Symbole für Zaaps, Dungeons, Quests, Orientierungspunkte, Transport, Werkstätten, Verkaufsräume, Tempel, Gebietsmarkierungen, Besitz, Anomalien, Ressourcen und persönliche Ziele. Die zwölf vorhandenen Quellenkategorien sind einzeln filterbar. Kategorien erzeugen keine neuen Orte oder Ressourcen-Spawns. Auswahl und Route behalten ihre eigene Hervorhebung.

Die geprüften Seiten [DOFUS](https://www.dofus.com/), [DofusDB-Karte](https://dofusdb.fr/de/tools/map) und [Dofus Creator](https://dofuscreator.com/) liefern keine belegte allgemeine Weiterverteilungserlaubnis für deren Grafiken. Deshalb wurden keine neuen geschützten Marker kopiert.

## 4. Builder-Slots — vollständig

Alle 16 Slots verwenden eine zentrale Zuordnung: Hut, Amulett, Waffe, zwei Ringe, Schild, Umhang, Gürtel, Stiefel, Begleiter und sechs Dofus/Trophäen. Leere Slots zeigen ihr eigenes Kategorieicon und eine eindeutige Beschriftung. Belegte Slots behalten echte Itembilder. Austauschen, Rolls bearbeiten, Entfernen und versionsrichtige Itemdetails sind erreichbar; Hovertexte und zugängliche Beschriftungen erläutern die Aktionen. Die mittige Klassenabbildung und die untere Dofus-Reihe bleiben bestehen.

## 5. Einheitliche Attribute — vollständig für vorhandene strukturierte Werte

`attributes.tsx` erweitert die vorhandenen stabilen Charakteristik-IDs um deutsche Namen, Kategorien, Icons, Reihenfolge, Farben, Zahlenformate und Einheiten. AP sind blau, BP grün, Leben rot; Erde braun, Feuer orange, Wasser blau, Luft grün und Neutral grau. Gemeinsame Komponenten stellen Attribute, Gruppen, Effektbereiche und Vergleichsdifferenzen dar. Prozentzeichen stehen nur an prozentualen Charakteristiken. Nicht numerische oder unbekannte Effekte behalten ihren Originaltext.

## 6. Sets und Builder — vollständig

Itemdetails, Setboni, Builder und Profil verwenden dieselben Attributzeilen. Die fünf Buildergruppen lassen sich einklappen. Vergleiche behalten Ausgangs-, Ziel- und Differenzwerte. Die Berechnungsimplementierung in `packages/core/src/builder.ts` bleibt unverändert.

Setseiten zeigen Originalbilder, Voraussetzungen, ausgewählte Bonusstufe und die tatsächlich im aktiven Companion-Build getragenen Teile. Die Setstufe wird aus vorhandenen Items abgeleitet; fehlen diese Daten, steht ausdrücklich „Stufe nicht verfügbar“. Boni werden nicht zusätzlich berechnet oder doppelt gezählt.

Itemlinks aus historischen Builds und Sets transportieren die Spielversion. Der kompatibel ergänzte Item-Endpunkt liefert bei expliziter historischer Version deren tatsächliche Werte; fehlende historische Rezepte werden als nicht verfügbar benannt. Ein fehlendes Item liefert 404 und wird nicht durch einen aktuellen Datensatz ersetzt.

## 7. Charakterverwaltung — vollständig

Jeder Charakter besitzt eine eigene Detailroute mit Kopfbereich, Klassenbild und den Tabs Allgemein, Ausrüstung und Fortschritt. Name, Klasse, Stufe, Server, aktiver Status, Bearbeitung und Profilwechsel sind sichtbar. Das reine Öffnen eines anderen Profils ändert den aktiven Charakter nicht.

Die Profilseite verwendet reale gespeicherte Builds, Berufslevel und erfassten Questfortschritt. Der Ausrüstungstab zeigt die tatsächlichen Builditems, Gesamtwerte einschließlich berechneter LP und Setboni. Schnellaktionen öffnen Builder, Quests, Berufe und Farmrouten. Es gibt keine erfundenen Ränge, Erfolge, Gilden oder Ausrüstungsdarstellung auf der Figur.

Die kompakte Übersicht bleibt erhalten. Die Klassenauswahl bietet zusätzlich ein durchsuchbares Raster aller 19 unterstützten Klassen; die vorhandenen stabilen IDs einschließlich Klasse 20 bleiben erhalten.

## 8. Klassenillustrationen und Quellen — teilweise

Ein gemeinsamer Resolver `ClassArtwork.tsx` verwaltet Klassen-ID, Name, Icon, großes vorhandenes Portrait, Quelle, Varianten und Fallback. Übersicht, Profil, Builder, Klassenwahl und Dashboard verwenden dieselbe Zuordnung. Bilder werden proportional und unbeschnitten dargestellt.

**Es wurden keine neuen Ganzkörperillustrationen heruntergeladen.** Die vorhandenen 19 Bilder stammen aus dem vom Benutzer bereitgestellten Archiv; Importzuordnung, Dateinamen und Hashes sind in `design/class-images/import-report.json` dokumentiert. Diese Zuordnung wird beibehalten und nicht nach visueller Vermutung geändert. Die vorhandenen Dateien sind Portraits; eine größere Darstellung erzeugt daraus keine Ganzkörpergrafik. Entsprechend bezeichnet die Oberfläche sie als Klassenportraits und bietet keine erfundenen Varianten an.

Die [Dofus-Creator-Rechteseite](https://dofuscreator.com/privacy-policy) beschreibt dessen eigene Beziehung zu Ankama; sie belegt keine Unterlizenz an dieses Projekt. Nutzbare Ganzkörperbilder pro Klasse bleiben daher offen, bis passende Dateien mit geklärter Berechtigung vorliegen. Für bestehende Spielassets wird keine neue Rechteklärung behauptet.

## 9. Dashboard — vollständig

Der aktive Charakter mit passendem Klassenbild steht weiter oben. Kompaktere Abstände und ein reduzierter Suchbereich schaffen Platz für bestehende Quests, Builds, Farmrouten, letzte Module und Favoriten. Globale Suche und Ctrl+K bleiben erhalten. Alle Anzeigen basieren auf vorhandenen Daten.

## 10. Sidebar und Lesbarkeit — vollständig

Kompaktere Typografie und Abstände, einklappbare Gruppen und Icon-Modus bleiben erhalten. Unter Einstellungen → Navigation können Module angeheftet werden; die eigene Gruppe bleibt nach Neustart erhalten. Navigation und Hauptinhalt scrollen unabhängig. Der Charakterbereich am unteren Rand öffnet das aktive Profil. Fokuszustände, Hovertexte und semantische Farben bleiben auch bei anderen Farbschemen erkennbar; die Standardpalette bleibt grün.

## 11. Tests

Erfolgreich: **112 Unit-/Integrationstests, 49 Browsertests, Typecheck in fünf Paketen, Lint, Monorepo-Build und zwölf Produktionsoberflächen-Prüfblöcke**. Die isolierte Dienstmigration von 0.6.0 auf 0.7.0 erhält Charakter, Questfortschritt, Build und Berechnung; Berufs- und Markerdaten bleiben auch nach Neustart erhalten.

Die verbindlichen Ergebnisse stehen maschinenlesbar in `PROFILE_UI_VALIDATION.json`. Geprüft werden Typecheck und Lint, sämtliche Unit- und Browsertests, Monorepo-Build, endgültiger Windows-Installer, Produktionsoberfläche mit blockierten externen Bildanfragen, Update-Signatur einschließlich Manipulationsablehnung, exakte ZIP-Payloads und isolierte Dienstmigration von 0.6.0 auf 0.7.0.

Neue Tests prüfen Kartenrad und Seitenscrollen, Questkoordinaten in unterschiedlichen Größen, 16 Slotzuordnungen, strukturierte und historische Itemwerte, Attributformatierung, alle Klassen-IDs, reale Profil-/Builddaten, Charakterwechsel, Klassenraster, angeheftete Module und Layouts bis 420 Pixel. Bestehende Tests prüfen unter anderem Setboni, Schadensrechnung, Optimierer, Routen, Übersetzer, Overlay und Discord-Datenverträge.

**Native Einschränkung:** Der neue WebView2-Smoke-Test wurde übersprungen, weil eine Benutzerinstanz läuft. Diese wurde weder geschlossen noch verändert. Produktionsbrowserprüfungen und Installer-/Signaturprüfungen ersetzen keinen tatsächlichen interaktiven WebView2-Durchlauf. Physische Monitor-/DPI-Kombinationen und Discord-Liveanmeldung bleiben ungetestet.

## 12. Geänderte Dateien und Commits

Implementierung: `WorldCanvas.tsx`, `WorldPage.tsx`, Questkomponenten/-CSS, `BuilderPage.tsx`, Item- und Setansichten, `CharactersPage.tsx`, `ClassSelector.tsx`, `CharacterProfile.tsx`, `ClassArtwork.tsx`, `attributes.tsx`, `GameGlyph.tsx`, `PinnedModules.tsx`, `App.tsx`, Navigation, Dashboard und Design-CSS. Das Backend ergänzt ausschließlich strukturierte versionsgebundene Itemeffekte. Versionen und Releaseprüfungen werden für 0.7.0 fortgeschrieben.

Tests und Paketierung: `game-ui.test.ts`, `profile-game-ui.spec.ts`, Produktions-/Signatur-/Paket-/Upgradeprüfungen unter `infrastructure/scripts/`. Implementierungscommit: `4bb262d`, Abnahme und Paketierung: `c611187` auf `codex/profile-and-game-ui`. Die finale Quellrevision und Datei-SHA256 stehen in `BUILD_v0.7.0_SHA256.json`. Die Abnahme prüft zusätzlich unveränderte vorhandene Assets und Berechnungsdateien gegenüber `d1736db`.

## 13. Verbleibende Einschränkungen

- Teilweise: große Klassenportraits sind integriert; rechtmäßig verfügbare Ganzkörpervarianten fehlen weiterhin.
- Offen: interaktiver nativer Test von 0.7.0, physische DPI-/Mehrmonitorprüfungen und Discord-Liveanmeldung.
- Bestehende Grenzen: unvollständig patchverifizierte Dungeonstrategien und vier fehlende kosmetische Katalogicons; dieser gezielte UI-Auftrag erfindet dafür keine Daten oder Ersatzbilder.
- Kein vollständiger Charakterrenderer, keine automatische Auslesung des Spielprofils und keine behaupteten Ranglistenwerte. Companion-Daten bleiben die tatsächliche Datenquelle.
