# DOFUS Companion 0.8.0 – Fehlerbehebung und Datenqualität

## 1. Gefundene Probleme

Ressourcenregionen erlaubten keine belastbare Auswahl konkreter Sammelkarten. Präzise externe Karten-/Zelldaten fehlten im Import; persönliche Beobachtungen waren die einzige exakte Eingabe. Der Kartenausschnitt lädt höchstens 2.500 Karten. Der Berufsimport beschränkte die Liste absichtlich auf sechs Sammelberufe. Omega-Level fehlten. Crafting besaß keine verlässliche Abwahl und erlaubte verspätete Auswahlantworten. Quest-Direktlinks waren auf zwei Namen begrenzt. Der OCR-Bereich erklärte seine tatsächlichen Einsatzmöglichkeiten unzureichend.

## 2. Ursachen und Korrekturprinzip

`SubAreaData.harvestables` beschreibt Gebiete, keine Sammelstellen auf jeder zugehörigen Karte. `map_interactions` enthält Karten-/Zell-/Grafik-IDs, aber keine bisher eindeutig belegte Zuordnung zu einer Sammelressource. Diese Daten werden weiterhin nicht zu Spawns umgedeutet. Ressourcenmarker werden jetzt unabhängig vom begrenzten Kartenabruf geladen. Das verhindert, dass ein genauer Marker durch die 2.500-Karten-Grenze verschwindet.

Crafting hatte getrennte Eltern-/Kind-Auswahlzustände und ungeschützte asynchrone Auswahlanfragen. Die Abwahl setzt beide Auswahlzustände zurück; eine Revisionsnummer verhindert, dass alte Antworten eine geschlossene oder neuere Auswahl überschreiben. Preise, Inventarbestände, Serverprofile und gespeicherte Projekte bleiben erhalten.

## 3. Geänderte Dateien und Module

- `packages/core/src/world.ts`: versionierte Fundstellen und reine Bildschirmprojektion/Clusterbildung.
- `apps/backend/src/world.ts`: Quellenfundorte, persönliche Beobachtungen, Berufs-/Stufenfilter, kanonische Ressourcen-IDs und nachvollziehbare Routenplanung.
- `apps/desktop/src/v4/WorldPage.tsx`, `WorldCanvas.tsx`, `ResourceLayer.tsx`, `world.css`: sichtbare Ressourcenbilder, Details, Filter, Cluster, Wegpunkte und Kategorie-Chevron.
- `packages/core/src/index.ts`, `apps/backend/src/store.ts`, `app.ts`: additive Omega-Spalte, Eingabevalidierung, kompatible Antworten und Schutz persönlicher Daten.
- `ProfessionLevels.tsx`, `OmegaBadge.tsx`, Charakter- und Berufsseiten: gemeinsame Berufsverwaltung und goldene Omega-Anzeige.
- `CraftingPage.tsx`, Itemtypen und App-Anbindung: Abwahl, Anfrageabgleich und Rezept-Berufsstufen.
- `quest-guides.ts`, `SourceLink.tsx`, Quest-/Dungeonansichten: geprüfte direkte Quellenartikel und gemeinsamer externer Link.
- `Scanner.tsx`: kompakte Erklärung ausschließlich vorhandener OCR-Fähigkeiten.
- Import-, Test-, Signatur-, Paket- und Release-Skripte sowie zugehörige Datenqualitätsberichte.

Die bestehenden Bilder und die eigentliche Builder-Berechnung bleiben unverändert. Bestehende Karten, IDs, Ressourcen-Skilldatensätze, Übergänge, Dungeons und Monster werden nicht ersetzt. Die Datenexports werden additiv um Fundstellen, weitere Berufe und Rezept-Berufsanforderungen ergänzt.

## 4. Farmrouten und Ressourcenanzeige

**Technische Korrekturen umgesetzt; aktuelle Quellenbestätigung bleibt teilweise offen.**

Die Datenmodelle trennen explizite Quellenpositionen, persönliche Beobachtungen und regionale Vorkommen. DofusDB-Datensätze werden anhand von Item-ID, Skill, Beruf, Mindeststufe, Map-ID, Zelle, Koordinaten, Untergebiet und Quellenwelt geprüft. Eine Position entsteht niemals aus einer Gebietszugehörigkeit oder einer sichtbaren Wasserfläche.

Ressourcenbilder erscheinen mit kontrastreichem Rahmen, berufsabhängiger Farbe, Zähler, Tooltip und größerer Klickfläche. Bei kleinem Zoom werden Bildschirmcluster gebildet; die zugrunde liegenden Koordinaten und Map-IDs verändern sich nicht. Die Detailansicht zeigt Ressource, Beruf, Stufe, Koordinaten, Karte, Anzahl dokumentierter Zellen und Quellenpatch. Bedingte Fundstellen bleiben gekennzeichnet; ohne erfüllbare Bedingungsprüfung werden sie nicht automatisch eingeplant.

Die Farmplanung verlangt einen Start und berücksichtigt Ressourcenauswahl, Berufsfilter, maximale Stufe, persönliche Berufslevel, ausgeschlossene Karten, Welt und Questrestriktionen. Historische Quellenfundorte fließen nur nach ausdrücklicher Aktivierung ein. Ziele werden nach Entfernung geordnet und auf die gewählte Anzahl begrenzt. Diese Liste heißt ausdrücklich **geschätzte Besuchsreihenfolge**. Nur vorhandene gerichtete Kartenübergänge erzeugen eine gezeichnete Wegstrecke. Fehlende Verbindungen bleiben unerreichbar; es werden keine Wege durch Hindernisse oder zwischen Kartenwelten erfunden. Wegpunkte sind anklickbar. Geänderte Filter verwerfen veraltete Routenergebnisse.

## 5. Geprüfte Quellen

- Bestehender aktueller Export: [dofus-sqlite 3.7.12.12](https://github.com/ledouxm/dofus-sqlite/releases/tag/v6.0_3.7.12.12), mit erhaltenen SHA256 und separat vorgehaltenem Stand 3.6.12.16.
- Konkrete Karten-/Zellen-/Itempositionen: [DofusDB recoltables2](https://api.dofusdb.fr/recoltables2).
- Ressourcen-Skillmetadaten: [DofusDB skills](https://api.dofusdb.fr/skills); Berufsliste aus `JobData` und getrennten versionsgleichen SQLite-Quellen.
- Quellenversion: [DofusDB version](https://api.dofusdb.fr/version) meldete beim Abruf **3.7.4.4**, gegenüber **3.7.12.12** im Companion. Dieser Unterschied wird nicht verborgen oder umetikettiert.
- Questartikel: veröffentlichte [DofusPourLesNoobs-Sitemap](https://www.dofuspourlesnoobs.com/sitemap.xml), gefolgt von erfolgreichen Artikelabrufen mit passendem Titel.

Weitere Quellen wurden eingeordnet: [Dofus Map](https://dofus-map.com/) zeigt Version 2.48.8 und wird nicht als aktueller Unity-Positionsbeleg übernommen. [DofusJobs](https://github.com/wApMorty/DofusJobs) kombiniert DofusDB mit Dofus-Map-Positionen und beschreibt eigene Begrenzungen; daraus entsteht kein unabhängiger Patchnachweis. [OpenDofusDB](https://openddb.dev/) verwendet denselben bereits geprüften dofus-sqlite-Ursprung und liefert damit keine zweite unabhängige Bestätigung der Sammelzellen.

Reproduzierbarer Positionsimport: `python infrastructure/scripts/fetch-gathering-source.py`, anschließend `python infrastructure/scripts/import-gathering-locations.py`. Der Snapshot verbleibt lokal; Herkunft, Abrufzeit, Patch und SHA256 stehen im eingebundenen Export und Audit. Der Quellenabgleich erfordert Netzwerkzugriff; die Anwendung verwendet anschließend den lokalen Export.

## 6. Ergebnisse der Datenvalidierung

| Prüfung | Ergebnis |
|---|---:|
| Abgerufene Quellenkarten | 4.999 |
| Geprüfte ursprüngliche Ressourcen-/Zellangaben | 15.842 |
| Referenzkonsistente, explizite Karten-/Ressourcen-/Zellzuordnungen | 13.987 |
| Davon dokumentierte Angelzellen | 3.527 |
| Quellenwelt stimmt nicht mit dem lokalen Datensatz überein; verworfen | 1.303 |
| Kein passender unterstützter Ressourcen-Skill; verworfen | 548 |
| Doppelte Zellzuordnungen; entfernt | 4 |
| Mit DofusDB abgeglichene Skill-/Item-/Berufs-/Stufenzuordnungen | 124 von 124 identisch |
| Eindeutige Berufsressourcen nach Zusammenführung gleicher Skills | 85 |
| Davon Holzfäller / Bergmann / Alchemist / Bauer / Fischer | 20 / 16 / 13 / 13 / 23 |
| Für den aktuellen Patch bestätigte externe Sammelzellen | **0** |
| Wegen abweichendem Quellenpatch unbestätigte Sammelzellen | **13.987** |

Die 85 Berufsressourcen sind nicht der vollständige Itemkatalog, sondern die konkreten Sammel-Skillzuordnungen. Grundwert-/Sonderaktionen und alte Skill-IDs bleiben im ursprünglichen Export und im Detailendpunkt erhalten. Gleiche Berufsressourcen erscheinen in der Auswahl nur einmal; alte IDs bleiben als Aliase nutzbar. Jäger-Sammelquests bleiben vorhanden; aus Monsterbeute werden keine festen Sammelstellen erfunden.

Vollständige Datenqualitätszahlen: `GATHERING_DATA_AUDIT.json`. Die Referenzprüfung ist **keine aktuelle Ingame-Spawnprüfung**. Der versionsfremde Positionsbestand ist standardmäßig ausgeblendet und aus aktuellen bestätigten Routen ausgeschlossen. Eigene explizite Beobachtungen bleiben nutzbar, werden aber nicht als Echtzeit-Spawn bezeichnet.

## 7. Omega-Level und Berufsverwaltung

Omega wird unabhängig vom normalen Level gespeichert. Die additive SQLite-Migration 4 ergänzt `omega_level`, ohne Charaktere oder Builds neu anzulegen; Migration 3 bleibt dem bestehenden Builder vorbehalten. Leere Eingabe bedeutet kein Omega-Level. Zulässig sind nichtnegative ganze Zahlen, positive Werte erst bei regulärer Stufe 200. Es wird keine erfundene spielinterne Obergrenze eingeführt; die technische Grenze ist die sichere Ganzzahldarstellung. Alte Clients ohne das neue Feld behalten vorhandene Omega-Werte beim Aktualisieren. Explizites `null` löscht ausschließlich den Omega-Wert.

Ein eigener goldener Badge erscheint in Profil, Übersicht und Dashboard; die Profilauswahl ergänzt Omega als Text. Die reguläre Stufe, Klasse und der Server bleiben sichtbar. Der zugrunde liegende [Ankama-Devblog zu Omega](https://www.dofus.com/fr/forum/1069-evolutions/2256797-niveaux-omega) war durch eine Robot-Prüfung nicht direkt auslesbar; es wird keine darüber hinausgehende neue Spielmechanik behauptet.

Die aktuelle `JobData`-Liste liefert **22 Berufe** nach Ausschluss des technischen Grundwert-Eintrags. Alte Beispiele wie eigenständiger Bäcker/Fischhändler werden nicht blind ergänzt. Sammel-, Handwerks-, Magier- und weitere Berufe sind getrennt bearbeitbar. Level 1–200 werden pro Charakter in der vorhandenen Tabelle gespeichert; leere Eingabe setzt nur diesen Wert auf unbekannt. Profil und Berufsmodul verwenden dieselbe Komponente und API. Farmfilter verwenden diese Daten; Crafting zeigt versionsgleiche Rezeptberufe und Mindeststufen einschließlich „unbekannt“, „ausreichend“ oder „noch nicht ausreichend“.

## 8. Questquellen

**1.494 direkte Artikel** für **1.976 Katalogquests** wurden über eindeutige französische Namen, veröffentlichte Sitemap-URLs, HTTP-Erfolg und passenden Seitentitel verifiziert. **482 Quests** besitzen keinen eindeutigen geprüften Artikel und erhalten keinen erfundenen Direktlink. Links werden über Quest-ID und zusätzlich passenden französischen Namen zugeordnet, damit historische IDs keine versehentliche fremde Zuordnung erhalten.

Die kleine Quellenzeile steht unten in den Details. `SourceLink` wird auch bei Dungeon-Guides verwendet. Links besitzen HTTPS, externes Symbol, `target="_blank"` und `noopener noreferrer`; in Tauri öffnet der vorhandene Opener den externen Browser. Fremde Volltexte und Bilder werden nicht kopiert. Audit: `QUEST_GUIDE_AUDIT.json`; erneute Prüfung: `verify-quest-guides.py`.

## 9. Weitere UI-Verbesserungen

Der Kartenkategorienbereich besitzt ein rechtsbündiges Chevron, Rotation zum echten offenen Zustand, Hover-/Fokusdarstellung und native Tastaturbedienung. Kategorien und ihre Filter bleiben bestehen.

Crafting erhält oben rechts das beschriftete X „Auswahl aufheben“. Auswahl, Rezeptansicht, Menge, Verkaufspreis, temporäre Filter und laufende Auswahlantworten werden zurückgesetzt. Dauerhafte Preise, Bestand und Projekte werden nicht gelöscht. Neue Gegenstände übernehmen keine alten Verkaufskalkulationen.

OCR erklärt kompakt die tatsächlich implementierten Funktionen: freigegebenes Fenster oder Screenshot lokal auslesen, Text korrigieren, Items/Quests abgleichen und Vorschläge selbst bestätigen. Automatische Koordinatenerkennung, Monstererkennung, direkte Übersetzung und Kopierfunktionen werden nicht als vorhandene Fähigkeiten ausgegeben. Die Aufnahme automatisiert keine Spielaktionen.

## 10. Testergebnisse

Erfolgreich: **117 Unit-/Integrationstests**, **54 Browser-E2E-Tests**, Typecheck in fünf Paketen, Lint und Monorepo-Build. **15 Produktionsprüfblöcke** nutzen den tatsächlich gebauten Vite-Stand, ein isoliertes Backend und blockierte externe Bildserver. Die Prüfungen erfassen unter anderem echte lokale Ressourcenbilder, Patch-Opt-in, Markerzoom, unabhängige Berufslevel, Omega, Quellenlinks, X-Abwahl, verspätete Itemantworten sowie bestehende Builder-, Overlay-, Übersetzer- und Discord-Verträge.

Zusätzliche Releaseprüfungen erfassen den endgültigen Windows-Installer, exakte Paketpayloads, Signatur und Manipulationsablehnung sowie den Dienstwechsel 0.7.0→0.8.0 mit vorhandenen Profilen, Builds, Questfortschritten und neu gespeicherten Omega-/Magierleveln. Verbindliche Ergebnisse: `REPAIR_VALIDATION.json` und die einzelnen v8-Testberichte.

Der interaktive native WebView2-Smoke-Test ist wegen einer laufenden Benutzerinstanz übersprungen. Diese wurde nicht geschlossen oder verändert. Browserprüfungen ersetzen keinen tatsächlichen nativen Durchlauf. Physische DPI-/Mehrmonitorprüfungen und Discord-Liveanmeldung bleiben offen.

## 11. Verbleibende Einschränkungen und Status

- **Umgesetzt:** sichere Trennung der Positionsqualität, unabhängiger Markerabruf, konkrete Ressourcenicons und Details, Filter/Level/Aliase, nachvollziehbare Zielreihenfolge und echte Übergangswege, geprüfte Questlinks, Omega-Persistenz, vollständige datenbasierte Berufsliste, zentrale Levelverwaltung, Crafting-Abwahl und OCR-Erklärung.
- **Teilweise:** aktuelle Ressourcenabdeckung. Für den abweichenden DofusDB-Patch fehlen Belege für den aktuellen Patch. Die 13.987 dokumentierten Positionen werden deshalb nicht als aktuell bestätigt ausgegeben. Eine vollständige aktuelle Ressourcenkarte kann mit diesen Quellen nicht ehrlich zugesichert werden.
- **Teilweise:** Übergangsgraph. Vorhandene explizite Kanten erlauben nur Teilstrecken; eine Zielreihenfolge ist keine geprüfte vollständige Laufroute. Zugangsvoraussetzungen und dynamischer Spawnzustand bleiben im Spiel zu prüfen.
- **Offen:** 482 nicht eindeutig zugeordnete Questartikel, interaktiver nativer 0.8-Test und reale Discord-Anmeldung.

Bestehende Bildlücken, unvollständig patchgeprüfte Dungeonstrategien und fehlende freigegebene Ganzkörper-Klassenbilder werden durch diesen Auftrag nicht als behoben dargestellt.
