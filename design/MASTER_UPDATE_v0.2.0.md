# DOFUS COMPANION – MASTER-UPDATE v0.2.0

## DEINE ROLLE

Du bist ein autonom arbeitendes Team aus Senior-Softwarearchitekten, Full-Stack-Entwicklern, UI/UX-Designern, Datenbankentwicklern, API-Spezialisten, Tauri/Rust-Entwicklern und QA-Ingenieuren.

Dein Auftrag ist die vollständige Überarbeitung und Erweiterung meines bereits bestehenden Projekts **DOFUS Companion**.

Es handelt sich ausdrücklich um ein Update der vorhandenen Anwendung, NICHT um eine Neuentwicklung.

Die bestehende Anwendung verfügt bereits über:

- Windows-Desktop-Anwendung auf Basis von Tauri
- React/TypeScript-Frontend
- Sidebar-Navigation
- Gegenstandssuche
- Quest-Assistent
- OCR-Bildschirmerkennung
- Crafting- und Kamas-Rechner
- Charakterverwaltung
- Almanax
- Favoriten
- Einstellungen
- Fenster- und Overlay-Modi
- Backend-Anbindung
- Synchronisierung
- Eine angelegte Update-Funktion

Außerdem gehört ein Discord-Bot zum Gesamtprojekt. Bestehende Funktionen und Schnittstellen müssen kompatibel bleiben.

Die aktuelle sichtbare Version ist v0.1.0.

**Ziel: Eine vollständig überarbeitete, funktionsfähige Version v0.2.0 mit professionellem Design, vollständigerer DOFUS-Datenbasis, besserer Bedienbarkeit und funktionierendem Update-Prozess.**

### GRUNDSÄTZLICHE ARBEITSANWEISUNG

1. Untersuche zuerst den gesamten vorhandenen Workspace.
2. Ermittle die tatsächliche Architektur und Datenflüsse.
3. Analysiere vorhandene Fehler und Limitierungen.
4. Behalte bestehende funktionsfähige Komponenten bei.
5. Implementiere alle nachfolgenden Änderungen direkt im Projekt.
6. Erstelle oder überarbeite die erforderlichen Backend-Endpunkte.
7. Erweitere das Datenbankschema mit Migrationen, wenn notwendig.
8. Führe Tests durch.
9. Behebe festgestellte Fehler.
10. Erstelle einen installierbaren Windows-Release-Build.
11. Bereite ein signiertes Update vor, das über die bestehenden Einstellungen installiert werden kann, soweit die installierte Version technisch dazu befähigt ist.
12. Veröffentliche das Update über die bereits vorhandene Release-Infrastruktur, sofern notwendige Berechtigungen und Signaturschlüssel vorhanden sind.

Frage nur nach Zugangsdaten, Berechtigungen oder Entscheidungen, die du nicht selbstständig treffen kannst.

**Ich möchte nach Abschluss idealerweise nur noch in der vorhandenen Anwendung auf „Nach Updates suchen“ und anschließend „Installieren“ klicken müssen.**

Das ist ein verbindliches Ziel für die Release-Pipeline.

Wenn die installierte v0.1.0 noch keinen korrekt konfigurierten, signaturprüfenden Updater besitzt, erläutere die technische Einschränkung und stelle einen einmalig zu installierenden Übergangsinstaller bereit. Behaupte in diesem Fall nicht, ein direktes Update sei möglich.

---

# 1. VORHANDENES PROJEKT UND REFERENZEN

Untersuche das vorhandene Projekt vollständig.

Suche nach:

- Tauri-Konfiguration
- Windows-Installer-Konfiguration
- React-Routing
- UI-Komponenten
- Gegenstandssuche
- API-Adaptern
- Suchendpunkten
- Questdatenimport
- Crafting-Berechnung
- Charakterverwaltung
- Almanax-Komponenten
- Overlay-Verwaltung
- Hotkey-Verwaltung
- Discord-Bot
- Backend
- Datenbankmigrationen
- Synchronisierung
- Updater
- GitHub Actions
- Release-Prozess

Überprüfe, warum bestehende Komponenten teilweise nur einen eingeschränkten Funktionsumfang besitzen.

**Visuelle Referenzen:**

Im mitgelieferten Assetpaket liegen sieben Screenshots.

- `references/00-original-app-icon.png`
- `references/01-charaktere.png`
- `references/02-gegenstaende.png`
- `references/03-quest-erfolge-kategorien.png`
- `references/04-crafting.png`
- `references/05-almanax.png`
- `references/06-einstellungen-overlay.png`

Falls die Dateien nicht unter diesem Pfad liegen, suche sie im übergebenen Assetpaket und übernehme sie in `design/references/`.

Analysiere alle Screenshots genau.

Die Screenshots zeigen den aktuellen Zustand der Anwendung beziehungsweise die gewünschte Darstellung aus dem Spiel.

Verwende sie als visuelle und funktionale Referenzen für die folgenden Änderungen.

---

# 2. NEUES LOGO UND BRANDING

Ersetze das bisherige einfache D-Symbol durch das neue DOFUS-Companion-Logo.

Das Assetpaket enthält:

- `dofus-companion-icon-1024.png`
- `dofus-companion-wordmark.png`
- `dofus-companion.ico`
- Weitere PNG-Auflösungen
- Die ursprüngliche Logo-Grafik

Verwende diese Assets als verbindliche neue Branding-Grundlage.

## 2.1 Windows-Anwendung

Ersetze das bisherige Icon an sämtlichen relevanten Stellen:

- Windows-Titelleiste
- Windows-Taskleiste
- Windows-Startmenü
- Desktop-Verknüpfung
- Tauri-App-Icon
- Installer
- Deinstallationsdialog, soweit konfigurierbar
- Optionaler System-Tray
- Update-Dialog

Generiere alle von der vorhandenen Tauri-Konfiguration benötigten Icon-Dateien.

Achte auf eine saubere Darstellung bei 16, 24, 32, 48, 64, 128 und 256 Pixeln.

## 2.2 Innerhalb der Anwendung

Verwende das horizontale Logo in der linken Sidebar.

Überarbeite den bisherigen Logo-Bereich, damit:

- Das Logo richtig skaliert ist.
- Die Typografie scharf bleibt.
- Das Bild nicht verzerrt wird.
- Abstände professionell wirken.
- Das Logo optisch zur dunklen UI passt.

Die bisherige grundsätzliche Farbpalette soll erhalten bleiben.

## 2.3 Visuelle Konsistenz

Nutze ein gemeinsames Designsystem:

- Dunkler anthrazitgrüner Hintergrund
- Lindgrüne Akzentfarbe
- Einheitliche Border-Radien
- Konsistente Abstände
- Konsistente Schriftgrößen
- Ruhige Hover-Effekte
- Klare aktive Zustände
- Einheitliche Statusmeldungen
- Professionelle Ladezustände
- Gute Kontraste
- Saubere Scrollbereiche

Verbessere offensichtliche Layoutprobleme aus den Screenshots.

Die Kennzeichnung als unabhängiges, nicht offizielles Community-Projekt muss erhalten bleiben.

---

# 3. GEGENSTANDSSUCHE VOLLSTÄNDIG ÜBERARBEITEN

Die Gegenstandssuche soll sich wie eine moderne Suchmaschine verhalten.

## 3.1 Live-Suchvorschau / Autocomplete

Sobald der Benutzer einen Namen eingibt, sollen passende Gegenstände automatisch unter dem Suchfeld erscheinen.

Beispiel:

Benutzer tippt:

`gela`

Die Vorschau zeigt passende Gegenstände wie:

- Gelano
- Ankarton-Gelano
- Weitere tatsächlich passende Gegenstände

Jedes Ergebnis zeigt:

- Kleines Itembild
- Vollständigen Namen
- Gegenstandsstufe
- Gegenstandstyp

Implementiere:

- Debounce von ungefähr 200–300 ms
- Suchstart nach sinnvoller Mindestzeichenzahl
- Abbruch veralteter Requests
- Fehlertolerante Suche
- Deutsche Bezeichnungen
- Suche ohne Beachtung der Groß-/Kleinschreibung
- Akzent- und Umlautnormalisierung
- Fuzzy Matching
- Tastaturnavigation mit Pfeiltasten
- Enter zur Auswahl
- Escape zum Schließen
- Mausklick zur Auswahl
- Hervorhebung übereinstimmender Textstellen
- Ladezustände
- Fehlermeldungen bei API-Problemen

Die Vorschau darf die Oberfläche nicht verdecken oder über den Fensterbereich hinauslaufen.

## 3.2 Verhalten beim Anklicken

Wenn der Benutzer in der Vorschau auf ein Item klickt:

**Sofort die Detailansicht genau dieses Gegenstands öffnen.**

Nicht erst eine allgemeine Ergebnisliste öffnen.

Wenn der Benutzer auf „Suchen“ klickt oder Enter verwendet, ohne ein bestimmtes Vorschauergebnis ausgewählt zu haben:

**Eine vollständige Suchergebnisseite öffnen.**

Diese Seite zeigt:

- Suchbegriff
- Gesamtzahl passender Ergebnisse
- Itembilder
- Namen
- Level
- Kategorie
- Sortiermöglichkeiten
- Filter
- Pagination oder Virtualisierung

Beim Anklicken eines Suchergebnisses öffnet sich die Itemdetailseite.

## 3.3 Navigation

Implementiere nachvollziehbare Routen, beispielsweise:

`/items/search?q=gelano`

`/items/12345`

Die tatsächliche ID muss aus dem Datenbestand stammen.

Vorwärts- und Zurücknavigation müssen funktionieren.

Der Suchbegriff soll nach Rückkehr erhalten bleiben.

Eine Itemdetailseite muss über interne Links auch aus Crafting, Favoriten und anderen Modulen geöffnet werden können.

## 3.4 Einheitliche Suche

Erstelle eine zentrale wiederverwendbare Suchkomponente.

Setze sie nur an den Stellen ein, an denen sie inhaltlich sinnvoll ist.

Auf der Charakterseite darf eine Gegenstandssuche nicht den eigentlichen Charakterbereich dominieren.

Verhindere außerdem, dass Titel, Breadcrumbs oder Suchbegriffe eines vorherigen Reiters auf einer anderen Seite stehen bleiben.

---

# 4. GEGENSTANDSKATEGORIEN REPARIEREN

Aktuell funktionieren die Kategorien nicht korrekt.

Beispielsweise liefert eine Suche mit ausgewählter Kategorie „Questgegenstände“ auch gewöhnliche Ausrüstung wie Gelano.

Das muss behoben werden.

## 4.1 Gewünschte Hauptstruktur

Verwende zwei zentrale Hauptbereiche:

**AUSRÜSTUNG**

Unterkategorien sollen sich möglichst am DOFUS-Verkaufsstand für Ausrüstung orientieren.

Beispiele:

- Hüte
- Umhänge
- Amulette
- Ringe
- Gürtel
- Stiefel
- Schilde
- Waffen
- Schwerter
- Dolche
- Hämmer
- Bögen
- Stäbe
- Zauberstäbe
- Äxte
- Schaufeln
- Weitere tatsächlich vorhandene Waffentypen
- Dofus
- Trophäen
- Sonstige ausrüstbare Gegenstandstypen

Bei Waffen darf eine zusätzliche Untergliederung nach Waffentyp verwendet werden.

**RESSOURCEN**

Alle Gegenstände, die nicht zur gewünschten Ausrüstungsstruktur gehören, sollen hier auffindbar sein.

Erstelle sinnvolle Untergruppen für:

- Normale Ressourcen
- Monsterressourcen
- Handwerksmaterialien
- Questgegenstände
- Verbrauchsgegenstände
- Nahrung
- Tränke
- Schlüssel
- Kosmetik und sonstige nicht als Ausrüstung klassifizierte Gegenstände

Wenn eine Kategorie spieltechnisch anders einzuordnen ist, verwende die korrekten Metadaten der DOFUS-Version.

Die Gruppierung in Ausrüstung und Ressourcen ist die gewünschte Hauptnavigation; die ursprüngliche Itemklassifikation muss dennoch in der Datenbank erhalten bleiben.

## 4.2 Datenbasierte Kategorien

Ermittle die tatsächlichen Typen anhand der API-Metadaten und der DOFUS-Datenbank.

Verwende insbesondere:

`GET /dofus3/v1/meta/items/types`

Erstelle eine Mapping-Tabelle zwischen den Originaltypen und unseren UI-Kategorien.

Keine ausschließlich hartcodierten deutschen Stringvergleiche.

Verwende stabile Typ-IDs.

Unbekannte Typen müssen sichtbar und korrekt unter einer passenden Auffangkategorie erscheinen.

## 4.3 Funktionierende Filter

Stelle sicher:

- Die Kategorie wird tatsächlich an das Backend übergeben oder serverseitig berücksichtigt.
- Die Suchvorschau respektiert die ausgewählte Kategorie.
- Die Suchergebnisseite respektiert die ausgewählte Kategorie.
- Die Anzahl der Treffer entspricht dem Filter.
- Ein Kategorienwechsel aktualisiert die Ergebnisse.
- Zurücksetzen der Filter funktioniert.
- Die Kategorie bleibt bei Seitenwechseln erhalten.

Implementiere hierfür Integrationstests.

---

# 5. SÄMTLICHE DOFUS-ITEMS IMPORTIEREN

Dies ist eine sehr wichtige Priorität.

Der gegenwärtige Eindruck ist, dass nur etwa 30 Gegenstände verfügbar sind.

Untersuche, ob tatsächlich nur 30 Datensätze importiert sind oder die Zahl lediglich durch ein Abfrage- beziehungsweise Darstellungs-Limit entsteht.

Behebe die eigentliche Ursache.

**Ziel: Vollständiger Katalog aller Gegenstände der unterstützten DOFUS-3-Version – inklusive Bildern, Metadaten, Rezepten und Effekten, soweit die Datenquelle diese bereitstellt.**

## 5.1 Primäre Datenquellen

Dofusdude:

https://docs.dofusdu.de/dofus3/v1/

API:

https://api.dofusdu.de/

OpenAPI:

https://raw.githubusercontent.com/dofusdude/api-docs/main/openapi-3.0.yaml

Verwende die tatsächlich dokumentierten Endpunkte, unter anderem:

`/dofus3/v1/de/items/equipment/all`

`/dofus3/v1/de/items/resources/all`

`/dofus3/v1/de/items/consumables/all`

`/dofus3/v1/de/items/quest/all`

`/dofus3/v1/de/items/cosmetics/all`

Prüfe die aktuellen Spezifikationen und Abfrageparameter vor Verwendung.

Achtung: Die `/all`-Antworten können sehr groß werden.

Verwende sie nicht unkontrolliert im Browser.

Nutze serverseitige Imports, Streaming beziehungsweise geeignete Pagination, Komprimierung und Zwischenspeicherung.

Zusätzliche Datenquelle:

https://github.com/ledouxm/dofus-sqlite

Releases:

https://github.com/ledouxm/dofus-sqlite/releases

Diese Quelle stellt unter anderem bereit:

- `dofus.sqlite`
- JSON-Spieldaten
- Mehrsprachige Übersetzungen
- Itemdaten
- `images-item.zip`

## 5.2 Bildimport

Importiere zulässig nutzbare Itembilder.

Bei dofus-sqlite sind Bilder über `ItemData.iconId` zuordenbar.

Entwickle eine zentrale Assetauflösung.

Anforderungen:

- Item-ID korrekt auf Bild-ID abbilden
- Bilder verlustfrei und effizient anzeigen
- Mehrere Auflösungen berücksichtigen
- Fehlende Bilder erkennen
- Geeignete Platzhalter bei fehlenden Assets
- Asynchrones Laden
- Lazy Loading
- Bildcache
- Kein unnötiger mehrfacher Download
- Keine falsch zugeordneten Bilder

Überprüfe bei der Nutzung von Ankama-Grafiken die geltenden Rechte und Bedingungen.

## 5.3 Vollständige Itemdaten

Speichere soweit verfügbar:

- Eindeutige ID
- Name Deutsch
- Name Französisch
- Name Englisch
- Beschreibung
- Level
- Itemtyp
- Kategorie
- Unterkategorie
- Bildreferenz
- Gewicht
- Effekte
- Setzugehörigkeit
- Anforderungen
- Crafting-Rezept
- Materialreferenzen
- Quellenversion

Verwende richtige Fremdschlüsselbeziehungen.

## 5.4 Importqualität

Entwickle einen robusten Importprozess mit:

- Fortschrittsanzeige
- Anzahl importierter Items
- Anzahl fehlender Bilder
- Anzahl fehlerhafter Datensätze
- Anzahl der Items je Kategorie
- Deduplizierung
- Datenversion
- Fortsetzung nach unterbrochenem Download
- Integritätsprüfung
- Transaktionalem Datenbankwechsel
- Rollback bei fehlgeschlagenem Import

Der vorhandene stabile Datenbestand darf bei einem Fehler nicht gelöscht werden.

**Wichtig:** Die Zahl aller Datensätze muss mit der tatsächlich verfügbaren Quelle abgeglichen werden. Verwende keine frei erfundene feste Sollzahl.

## 5.5 Performance

Die Itemsuche muss trotz vollständiger Datenbank schnell bleiben.

Implementiere:

- Datenbankindizes
- Geeignete Volltextsuche
- Serverseitige Filter
- Serverseitige Pagination
- Abfrage-Caching
- Virtuelle Ergebnislisten bei großen Datenmengen

Alle Itemdaten müssen auch im Crafting-Rechner und in anderen Modulen verfügbar sein.

---

# 6. QUEST-ASSISTENT UND QUESTKATEGORIEN

Die aktuelle Quest-Datenbank ist unvollständig und die Navigation soll wesentlich besser werden.

## 6.1 Questkategorien wie im Spiel

Verwende den mitgelieferten Screenshot:

`references/03-quest-erfolge-kategorien.png`

Dort ist die DOFUS-Erfolgsoberfläche dargestellt.

Die gewünschte Questnavigation soll sich daran orientieren.

Erstelle eine dreispaltige Darstellung.

**Linke Spalte: Kategorien**

Beispielsweise:

- Allgemeines
- Weltweite Questen
- Gesinnung
- Almanax
- Kopfgeldgesuche
- Eliokalypse
- Ritter der Gerechtigkeit
- Turm der Geschwister
- Göttliche Dimensionen
- Archipel der Schuppen
- Valonia-Archipel
- Astrub
- Atoll der Besessenen
- Bonta und Brâkmar
- Cania
- Schattenwall
- Insel Frigost
- Moon-Insel
- Weitere tatsächlich vorhandene Kategorien

Die korrekte vollständige Kategorienstruktur muss aus den aktuellen DOFUS-Daten und deren Erfolgs-/Questbeziehungen ermittelt werden.

Die obigen Namen sind Beispiele aus dem Screenshot, keine ausreichende vollständige Datenbank.

**Mittlere Spalte: Quests beziehungsweise Questreihen**

Zeige:

- Questname
- Kleines Icon, sofern verfügbar
- Beschreibung
- Stufe
- Fortschrittsstatus
- Zugehörige Questreihe

**Rechte Spalte: Details**

Zeige:

- Vollständigen Questnamen
- Beschreibung
- Voraussetzungen
- Ziele
- Belohnungen
- Materialien
- Koordinaten
- Nächsten Schritt
- Quellen und Guides

## 6.2 Kategorien und Fortschritt

Ermittle die tatsächliche Hierarchie aus den Quest- und Erfolgsdaten.

Erstelle eine Zuordnung zwischen:

- Erfolgskategorie
- Erfolg
- Questreihe
- Quest
- Questschritt

Übernimm nur Beziehungen, die aus den Daten nachweisbar oder sorgfältig zugeordnet sind.

Unterstütze:

- Aufklappbare Kategorien
- Suchfunktion
- Filter nach Level
- Filter nach Queststatus
- Favoriten
- Angeheftete Quests
- Verlauf
- Fortschrittsleisten
- Erledigte und offene Quests

Fortschrittsprozente dürfen nur aus tatsächlich hinterlegten oder bestätigten Benutzerdaten berechnet werden.

Die Prozentwerte aus dem Spiel-Screenshot sind Designreferenzen und dürfen nicht als tatsächlicher Live-Accountfortschritt übernommen werden.

---

# 7. VOLLSTÄNDIGERE QUESTDATENBANK

Importiere so vollständig wie möglich sämtliche verfügbaren Questdaten der aktuellen DOFUS-3-Version.

Primäre Quelle:

https://github.com/ledouxm/dofus-sqlite

Ermittle das reale Schema für:

- Quests
- Questschritte
- Questziele
- Voraussetzungen
- NPCs
- Erfolgsbeziehungen
- Belohnungen
- Übersetzungen
- Positionsdaten

Normalisiere diese Datensätze in der vorhandenen Backend-Datenbank.

Verknüpfe Questdaten mit Gegenstands- und Monsterdaten.

Ziel:

Wenn eine Quest beispielsweise bestimmte Ressourcen erfordert, soll der Benutzer die Ressource direkt öffnen und gegebenenfalls ein Rezept oder eine Materialliste erstellen können.

## 7.1 DOFUS Pour les Noobs

Zusätzliche Guide-Quelle:

https://www.dofuspourlesnoobs.com/

Diese Website soll möglichst sinnvoll mit dem Quest-Assistenten verbunden werden.

Allerdings sind ihre Texte, Bilder und Guides urheberrechtlich geschützt. Ohne vorherige Erlaubnis ist die Übernahme, Übersetzung und Weiterverbreitung nicht gestattet.

Deshalb:

1. Untersuche öffentliche Seitenstrukturen und zulässige Verlinkungsmöglichkeiten.
2. Ermittle passende Originalartikel zu den Quests, soweit rechtlich zulässig.
3. Erstelle eine Zuordnung zwischen Quest-ID, deutschem Namen, französischem Namen und Original-Guide-URL.
4. Zeige auf der Questdetailseite einen Button „Guide auf DOFUS Pour les Noobs öffnen“.
5. Erstelle eigene deutschsprachige Hilfstexte aus den zulässig verwendbaren strukturierten DOFUS-Spieldaten.
6. Entwickle einen vollständigen optionalen Guide-Import- und Übersetzungsadapter, der erst nach vorliegender Berechtigung aktiviert werden darf.
7. Unterstütze in diesem freigeschalteten Modus Bilder, Schritte, Textabschnitte, Voraussetzungen, Koordinaten und Quellenhinweise.
8. Erhalte bei Übersetzungen NPC-Namen, Itemnamen, Mengen und Koordinaten.
9. Speichere Herkunft, Übersetzungsstatus und Aktualisierungsdatum.
10. Lade ohne Berechtigung keine fremden vollständigen Guides oder geschützten Bilder zur Weiterverwendung in unsere Datenbank.

Wenn eine Vollübernahme mangels Genehmigung nicht möglich ist, stelle die maximal nutzbare, eigenständige Quest-Hilfe aus den Spieltabellen fertig.

Dieser Bereich soll nicht einfach übersprungen werden.

## 7.2 Questdetails

Jede Quest soll möglichst folgende Informationen haben:

- Name
- Level
- Beschreibung
- Questreihe
- Erfolgskategorie
- Voraussetzungen
- NPCs
- Positionen
- Ziele
- Schritte
- Erforderliche Gegenstände
- Monster
- Dungeons
- Belohnungen
- Guide-Links
- Persönlicher Fortschritt

Fehlende Informationen müssen korrekt gekennzeichnet werden.

## 7.3 Quest-Assistent und OCR

Erhalte die bereits vorhandene OCR-Funktion und verbessere ihre Verbindung zur Questdatenbank.

Ablauf:

1. Benutzer öffnet in DOFUS das Questjournal.
2. Benutzer löst die OCR aus oder aktiviert eine ausdrücklich freigegebene Erkennung.
3. Die App liest den sichtbaren Questnamen und die Zieltexte.
4. Die Texte werden mit dem vollständigen Questkatalog verglichen.
5. Die App schlägt die erkannte Quest vor.
6. Sie bestimmt anhand sichtbarer Ziele den wahrscheinlich aktuellen Schritt.
7. Sie zeigt eine passende deutschsprachige Hilfestellung.
8. Bei Unsicherheit wird der Spieler zur Bestätigung aufgefordert.

Es darf keine öffentliche Live-Quest-API vorgetäuscht werden.

Die Erkennung erfolgt über die erlaubte Bildschirmaufnahme und bekannte Spieldaten.

---

# 8. CRAFTING & KAMAS VOLLSTÄNDIG VERBESSERN

Analysiere:

`references/04-crafting.png`

Derzeit werden Materialien teilweise nur über IDs angezeigt.

Das ist für Benutzer ungeeignet.

## 8.1 Vollständige Materialdarstellung

Jede Materialzeile muss enthalten:

- Kleines Ressourcenbild
- Vollständiger deutscher Ressourcenname
- Optional Ressourcenlevel
- Erforderliche Menge
- Vorhandene Menge
- Fehlende Menge
- Preis pro Stück
- Gesamtpreis
- Anklickbaren Ressourcenlink

Beispielhafte Struktur:

`[Bild] Ressourcenname | Bedarf 350 | Bestand 0 | Fehlend 350 | Preis ...`

**Material-IDs dürfen niemals die primäre sichtbare Bezeichnung sein.**

Zeige IDs höchstens in technischen Zusatzinformationen.

## 8.2 Materialauflösung

Verknüpfe die Rezeptmaterialien über ihre stabilen Item-IDs mit dem vollständigen Itemkatalog.

Verwende:

- Gemeinsame Itemdatenbank
- Zentrale Itemauflösung
- Bildauflösung
- Deutsche Lokalisierung

Falls ein Material in der Datenbank fehlt:

- Lade es aus einer zulässigen verfügbaren Quelle nach.
- Speichere es korrekt.
- Dokumentiere Datenlücken.
- Zeige bis dahin einen verständlichen fehlenden Datensatz.

## 8.3 Gegenstand über dem Crafting-Rechner

Wenn der Benutzer Gelano auswählt, muss oben ein richtiges Item-Kopfmodul erscheinen.

Dieses enthält:

- Großes Gelano-Bild
- Vollständigen Gegenstandsnamen
- Typ
- Level
- Beschreibung
- Sämtliche verfügbaren Itemeffekte
- Anforderungen
- Setzugehörigkeit
- Optional vorhandenen Marktpreis

Unterhalb erscheint der vollständige Materialrechner.

Das muss für **jeden beliebigen Gegenstand mit Rezept** funktionieren.

Erstelle dafür eine wiederverwendbare Komponente `ItemSummaryCard` oder ein gleichwertiges Modul.

## 8.4 Korrekte Berechnung

Bei Mengenänderungen sollen automatisch aktualisiert werden:

- Gesamter Materialbedarf
- Vorhandene Materialien
- Fehlende Materialien
- Geschätzte Materialkosten
- Verkaufserlös
- Gebühren
- Gewinn
- Marge

Achte auf korrekte Rundung und Ganzzahlmengen.

Fehlende Preise dürfen nicht stillschweigend als echte Nullpreise interpretiert werden.

Unbekannte Preise werden als unbekannt angezeigt.

Die Berechnung muss für sämtliche Rezepttypen funktionieren.

## 8.5 Weitere Verbesserungen

- Materialliste kopieren
- Materialliste als CSV exportieren
- Einkaufslisten speichern
- Material anklicken und Detailseite öffnen
- Materialien nach Wert sortieren
- Fehlende Materialien filtern
- Favoriten
- Crafting-Projekte speichern

---

# 9. CHARAKTERVERWALTUNG MIT KLASSEN-DROPDOWN

Analysiere:

`references/01-charaktere.png`

Die Klasse wird derzeit über ein freies Textfeld eingegeben.

Ersetze dieses Feld durch ein professionelles Dropdown.

## 9.1 Klassenquelle

Offizielle DOFUS-Klassenübersicht:

https://www.dofus.com/en/mmorpg/encyclopedia/classes

Nutze zusätzlich die tatsächlich vorhandenen Klassendaten in der DOFUS-Spieldatenbank.

Ermittle die vollständige aktuelle Klassenliste.

Keine fehlenden oder erfundenen Klassen.

## 9.2 Dropdown

Jeder Dropdown-Eintrag enthält:

- Klassenicon beziehungsweise Klassenbild
- Deutschen Klassennamen
- Optional Originalbezeichnung

Unterstütze:

- Suche im Dropdown
- Tastaturnavigation
- Auswahl per Maus
- Deutliche Hervorhebung
- Korrekte Anzeige des gewählten Wertes

Speichere die Klasse über eine stabile Klassen-ID.

## 9.3 Klassenbilder

Verwende zulässig nutzbare Klassenbilder aus den genannten Quellen.

Prüfe die Verwendungsrechte und Asset-Zuordnung.

Lege einen zentralen Klassenkatalog an:

- classId
- nameDe
- nameEn
- aliases
- icon
- portrait
- source

Wenn bestimmte Bilder nicht verwendet werden dürfen, nutze eigenständige neutrale Platzhalter bis zur Freigabe.

## 9.4 Charakterdarstellung

Nach Registrierung soll der Charakter mit Klassenbild dargestellt werden.

Beispiel:

**Despairs**

- Sacrieur
- Stufe 200
- Draconiros
- Klassenportrait

Erstelle ansprechende Charakterkarten.

Unterstütze außerdem:

- Bearbeiten
- Löschen
- Aktiven Charakter auswählen
- Mehrere Charaktere
- Sortierung
- Discord-Synchronisierung
- Ausgewähltes Profil in der Sidebar anzeigen

Bisher frei eingegebene Klassenwerte müssen bei der Migration möglichst zuverlässig ihren richtigen Klassen-IDs zugeordnet werden.

Unklare Werte erfordern eine einmalige Auswahl, nicht das Löschen des Charakters.

---

# 10. ALMANAX ALS INTERAKTIVER ZEITSTRAHL

Analysiere:

`references/05-almanax.png`

Der bisherige Almanax soll sich deutlich stärker am DOFUS-Kalender orientieren.

## 10.1 Darstellung

Erstelle einen horizontalen Zeitstrahl.

Zeige beispielsweise sieben Tage gleichzeitig.

Jeder Tag erhält eine eigene kompakte Kalenderkarte mit:

- Wochentag
- Datum
- Almanax-Name
- Opfergabe
- Anzahl
- Ressourcenbild
- Tagesbonus
- Optionaler Belohnung

Die Ansicht soll dem Spiel ähneln, aber zum dunklen Design des DOFUS Companion passen.

## 10.2 Navigation

Implementiere:

- Vorherige Woche
- Nächste Woche
- Heute
- Kalender öffnen
- Datum direkt wählen
- Tagesdetails anzeigen
- Kompakte Monatsübersicht
- Zurück zur aktuellen Woche

Der aktuelle Tag wird optisch hervorgehoben.

## 10.3 Datenquelle

Verwende Dofusdude.

Dokumentation:

https://docs.dofusdu.de/dofus3/v1/

Nutze die dokumentierten Almanax-Endpunkte.

Lade die erforderlichen Daten für die ausgewählte Zeitspanne.

Verknüpfe Opfergaben mit der Itemdatenbank.

Zeige echte Ressourcenbilder.

Bei Klick auf eine Opfergabe:

- Ressourcendetails öffnen
- Menge anzeigen
- Optional zur Einkaufsliste hinzufügen
- Optional Preis anzeigen, wenn vorhanden

## 10.4 Zusätzliche Funktionen

- Tagesbonus-Filter
- Bevorstehende interessante Boni
- Persönliche Erinnerungen
- Favorisierte Bonustypen
- Opfergaben-Einkaufsliste
- Export der nächsten Woche
- Discord-Almanax-Benachrichtigungen

Achte auf korrektes Datum, Zeitzonen und Tageswechsel.

Die Darstellung darf keine erfundenen Opfergaben oder Boni enthalten.

---

# 11. VOLLSTÄNDIG KONFIGURIERBARES OVERLAY

Analysiere:

`references/06-einstellungen-overlay.png`

Die vorhandene Overlay-Funktion soll grundlegend verbessert werden.

Ziel ist ein frei konfigurierbares, modernes Hilfs-Overlay, das sichtbar über einem im Fenstermodus beziehungsweise Borderless-Modus laufenden DOFUS-Fenster liegen kann.

## 11.1 Overlay-Editor

Erstelle in den Einstellungen einen eigenen Bereich:

**Overlay konfigurieren**

Darin muss der Benutzer bestimmen können, welche Module sichtbar sind.

Verfügbare Module:

- Aktuelle Quest
- Nächster Questschritt
- Zielkoordinaten
- Materialbedarf
- Item-Schnellsuche
- Quest-Schnellsuche
- Schatzsuche
- Almanax
- Persönliche Notizen
- Charakterinformation
- Favorisierte Schnellaktionen
- Eigene Aufgabenliste

Diese Elemente sollen einzeln aktivierbar und deaktivierbar sein.

## 11.2 Overlay-Layout

Unterstütze:

- Frei verschiebbare Module
- Veränderbare Größe
- Einstellbare Breite
- Einstellbare Höhe
- Einstellbare Transparenz
- Hintergrundfarbe im vorhandenen Designsystem
- Schriftgröße
- Modulreihenfolge
- Kompaktmodus
- Fixieren der Position
- Einrasten an Bildschirmrändern
- Speichern des Layouts
- Layout zurücksetzen
- Mehrere Layoutprofile

Erstelle eine echte Overlay-Vorschau.

Der Benutzer soll sein Layout möglichst direkt konfigurieren können.

## 11.3 Technische Umsetzung

Untersuche die vorhandene Tauri-Implementierung.

Verwende geeignete native Windows-/Tauri-Funktionen.

Das Overlay soll:

- Ein separates Fenster besitzen.
- Optional immer im Vordergrund bleiben.
- Transparent sein können.
- Ohne Standardfensterrahmen dargestellt werden können.
- Per Hotkey sichtbar oder unsichtbar sein.
- Den Spielclient nicht manipulieren.
- Unterschiedliche Bildschirmauflösungen berücksichtigen.
- Auf mehreren Monitoren funktionieren.

Unterstütze Click-through als ausdrücklich auswählbare Option.

Sorge dafür, dass der Benutzer die Einstellungen jederzeit wieder erreichen kann, auch wenn Click-through aktiviert ist.

Verwende keine DLL-Injektion, Prozessmanipulation oder In-Game-Hooks.

Bei exklusivem Vollbildmodus darf die Overlay-Funktion nicht als garantiert kompatibel dargestellt werden.

Empfiehl bei Bedarf Borderless Windowed.

## 11.4 Hotkey-Aufzeichnung

Der aktuelle Ansatz mit einem frei beschreibbaren Hotkey-Textfeld ist nicht ausreichend.

Implementiere einen echten **Hotkey Recorder**.

Gewünschter Ablauf:

1. Benutzer öffnet Einstellungen.
2. Benutzer klickt auf das Hotkey-Feld.
3. Das Feld wechselt in den Zustand „Tastenkombination drücken“.
4. Benutzer drückt eine beliebige unterstützte Tastenkombination.
5. Die Tastenkombination wird erfasst.
6. Die Kombination wird lesbar angezeigt.
7. Benutzer kann speichern oder abbrechen.

Beispiele:

- F6
- F7
- F8
- Strg + Shift + D
- Alt + Q
- Strg + Alt + O

Die Kombinationen sind Beispiele, keine fest vorgegebenen Werte.

Implementiere:

- keydown/keyup-Erfassung
- Modifier-Erkennung
- Korrekte Windows-Tastenbezeichnungen
- Sondertastenbehandlung
- Prüfung reservierter Kombinationen
- Prüfung doppelter Belegungen
- Konfliktmeldung bei belegtem globalem Hotkey
- Hotkey entfernen
- Hotkey zurücksetzen
- Persistente Speicherung
- Erneute Registrierung beim Start

Keine Anzeige von technischen Framework-Namen wie `CommandOrControl`, wenn eine benutzerfreundliche Windows-Bezeichnung möglich ist.

## 11.5 Weitere Hotkeys

Ermögliche separate Hotkeys für:

- Overlay ein-/ausblenden
- Hauptfenster öffnen
- Quest-Scanner starten
- Item-Scanner starten
- Schatzsuche öffnen
- Schnellsuche aktivieren
- Compact Mode aktivieren

Jede Kombination muss individuell konfigurierbar sein.

Globale Hotkeys dürfen nur Companion-Funktionen auslösen, keine automatisierten Spielaktionen.

---

# 12. VERBESSERUNG DER GESAMTEN OBERFLÄCHE

Die Anwendung hat bereits eine geeignete visuelle Grundlage.

Baue sie gezielt weiter aus.

## 12.1 Übersichtlichkeit

Überprüfe:

- Überschriften
- Breadcrumbs
- Sidebar
- Suchfelder
- Tabellen
- Buttons
- Dropdowns
- Scrollleisten
- Formulare
- Modals
- Ladezustände
- Hinweise
- Fehlermeldungen
- Statusmeldungen

Entferne unnötige Elemente und Dopplungen.

## 12.2 Wiederverwendbare Komponenten

Erstelle beziehungsweise verbessere:

- SearchAutocomplete
- ItemCard
- ItemSummaryCard
- ItemDetailView
- ItemCategorySelector
- ResourceRow
- CharacterCard
- ClassSelector
- QuestCategoryTree
- QuestDetailPanel
- AlmanaxTimeline
- AlmanaxDayCard
- OverlayEditor
- HotkeyRecorder
- UpdatePanel

Vermeide mehrfach duplizierte Implementierungen.

## 12.3 Responsivität

Teste:

- 1366 × 768
- 1920 × 1080
- 2560 × 1440
- Ultrawide-Monitore
- Windows-DPI-Skalierung
- Maximiertes Fenster
- Verkleinertes Fenster

Das Interface darf bei kleinen Fenstern nicht unbenutzbar werden.

---

# 13. DISCORD-BOT KOMPATIBEL HALTEN

Der Discord-Bot ist Teil derselben Plattform.

Er darf durch die Änderungen nicht beschädigt werden.

Prüfe insbesondere:

- Gemeinsame Item-IDs
- Kategorien
- Suchendpunkte
- Charakter-IDs
- Klassen-IDs
- Quest-IDs
- Materialreferenzen
- Lokalisierung
- API-Schemas
- Synchronisierung

Stelle sicher, dass Discord dieselben vollständigen Daten nutzen kann.

Verbessere nach Möglichkeit auch die Discord-Embeds für:

- Items
- Rezepte
- Charaktere
- Questinformationen
- Almanax

Dabei sollen Itembilder, deutsche Namen und Kategorien korrekt angezeigt werden.

Wenn sich Backend-Verträge ändern, aktualisiere die Discord-Clients und führe Regressionstests aus.

---

# 14. UPDATE-SYSTEM – ABSOLUTE PRIORITÄT

Nach Fertigstellung möchte ich das Update über die bereits vorhandenen Einstellungen installieren.

Analysiere zuerst das bestehende Update-System.

Untersuche:

- Ist der Tauri-Updater bereits integriert?
- Existiert ein gültiger öffentlicher Signaturschlüssel?
- Sind Update-Endpunkte hinterlegt?
- Ist ein Release-Repository eingerichtet?
- Sind alte und neue App-Identifier kompatibel?
- Ist die Update-Signaturkette vorhanden?
- Ist GitHub Releases bereits angebunden?
- Gibt es einen funktionierenden Windows-Release-Workflow?

## 14.1 Tauri-Updater

Verwende die offizielle Dokumentation:

https://tauri.app/plugin/updater/

Implementiere beziehungsweise repariere:

- Updateprüfung
- Versionsvergleich
- Anzeige verfügbarer Updates
- Changelog
- Download
- Fortschrittsanzeige
- Signaturprüfung
- Installation
- Neustart beziehungsweise Windows-Installer-Übergabe
- Fehlerbehandlung

Updates müssen kryptografisch überprüft werden.

Deaktiviere keine Signaturkontrollen.

Private Signaturschlüssel dürfen nicht im Repository oder in den Release-Dateien enthalten sein.

## 14.2 GitHub Releases

Erstelle einen geeigneten Release-Workflow.

Ziel:

Bei einem neuen freigegebenen Release wird:

1. Das Projekt gebaut.
2. Ein Windows-Build erzeugt.
3. Das Update-Artefakt erzeugt.
4. Das Artefakt signiert.
5. Eine korrekte Release-Metadatei erzeugt.
6. Der Release veröffentlicht.
7. Die Anwendung kann das Update erkennen und herunterladen.

Verwende SemVer.

Plane dieses Update als v0.2.0, sofern keine bereits vorhandenen Versionsregeln dagegen sprechen.

## 14.3 Datenbank- und Spieldatenupdates

Trenne möglichst:

- Updates der Desktop-Anwendung
- Updates des Backends
- Updates der DOFUS-Spieldaten

Große Item- und Questdaten müssen nicht bei jeder Programmaktualisierung vollständig neu heruntergeladen werden.

Implementiere separate Datenpakete, Versionierung und Aktualisierung.

## 14.4 Datenmigration

Ein Update darf bestehende Daten nicht löschen.

Erhalte:

- Registrierte Charaktere
- Favoriten
- Questfortschritt
- Einstellungen
- Hotkeys
- Overlay-Layouts
- Persönliche Notizen
- Crafting-Projekte

Erstelle migrationssichere Änderungen.

Teste den Upgrade-Pfad mit einer Kopie der vorhandenen Datenbank.

## 14.5 Veröffentlichung

Wenn GitHub-Release-Zugriff, Signaturschlüssel und Windows-Build-Umgebung verfügbar sind:

**Erstelle und veröffentliche das tatsächlich installierbare Update.**

Prüfe vor der Freigabe den Updatepfad von der vorhandenen Version.

Wenn die installierte v0.1.0 nicht über den erforderlichen Updater verfügt oder der private Signaturschlüssel nicht verfügbar ist:

- Erkläre die Blockierung.
- Baue einen neuen Installer.
- Bereite einen einmaligen manuellen Übergang vor.
- Sorge dafür, dass alle weiteren Updates über die Anwendung erfolgen können.

Das reine Erstellen einer GitHub Release ohne funktionsfähigen Updatepfad gilt nicht als Abschluss dieses Arbeitspakets.

---

# 15. DATENQUELLEN – VERBINDLICHE LINKS

Nutze und prüfe diese Quellen:

### Dofusdude

https://docs.dofusdu.de/dofus3/v1/

https://api.dofusdu.de/

https://raw.githubusercontent.com/dofusdude/api-docs/main/openapi-3.0.yaml

Zweck: Items, Rezepte, Bilder, Effekte, Sets, Almanax und Metadaten.

### DOFUS-Spieldaten

https://github.com/ledouxm/dofus-sqlite

https://github.com/ledouxm/dofus-sqlite/releases

Zweck: Vollständige Spieltabellen, Quests, Erfolge, Übersetzungen, Gegenstände, Karten und Bildarchive.

### DOFUS Pour les Noobs

https://www.dofuspourlesnoobs.com/

Zweck: Quest-Guide-Verknüpfung und optional genehmigter Guide-Import mit Übersetzung.

### Offizielle Klassenübersicht

https://www.dofus.com/en/mmorpg/encyclopedia/classes

Zweck: Klassenliste und Klassenbilder, soweit zulässig nutzbar.

### DofusDB

https://api.dofusdb.fr/

Zweck: Ergänzende Spieldaten.

### Karten und Schatzsuche

https://github.com/Dofus-Batteries-Included/DBI.Api

Zweck: Kartenpositionen und Routen.

### Zusätzliche Daten

https://www.frigost.dev/API/Dofus%203.0/Data/

Zweck: Ergänzende JSON-Daten.

### Updater

https://tauri.app/plugin/updater/

Zweck: Signierte Windows-Anwendungsupdates.

Prüfe bei jeder Datenquelle vor der produktiven Nutzung die aktuelle Erreichbarkeit, das Datenformat, die Lizenz und die tatsächlich nutzbaren Endpunkte.

Erfinde keine API-Routen.

---

# 16. VERBINDLICHE TESTFÄLLE

Implementiere und führe mindestens folgende Tests aus.

## Itemsuche

**Test 1:** Eingabe `gela`

Erwartung: Passende Vorschläge erscheinen automatisch.

**Test 2:** Klick auf Gelano in der Vorschau

Erwartung: Gelano-Detailansicht öffnet sich direkt.

**Test 3:** Eingabe Gelano und Klick auf Suchen

Erwartung: Ergebnisliste mit passenden Gegenständen.

**Test 4:** Kategorie Questgegenstände und Suche Gelano

Erwartung: Normale Ausrüstung erscheint nicht irrtümlich als Questgegenstand.

**Test 5:** Suchbegriff ändern

Erwartung: Veraltete Requests überschreiben keine neuen Ergebnisse.

**Test 6:** Alle Itemkategorien prüfen

Erwartung: Kategorien zeigen ausschließlich passende Gegenstände.

## Itemdatenbank

**Test 7:** Vollständigen Import durchführen

Erwartung: Alle aus den gewählten Quellen verfügbaren und unterstützten Itemdatensätze werden verarbeitet.

**Test 8:** Bilder kontrollieren

Erwartung: IDs werden korrekt mit Itembildern verknüpft; Fehler werden protokolliert.

**Test 9:** Datenbestand zählen

Erwartung: Datenbankzahlen werden mit der importierten Quelle abgeglichen und dokumentiert.

## Quest-Assistent

**Test 10:** Kategorien öffnen

Erwartung: Hierarchie wie aus den tatsächlichen DOFUS-Daten abgeleitet.

**Test 11:** Quest suchen

Erwartung: Passende Questdaten und bekannte Schritte werden angezeigt.

**Test 12:** Questreihen anzeigen

Erwartung: Beziehungen, Voraussetzungen und Status korrekt.

**Test 13:** Guide öffnen

Erwartung: Richtiger Originalartikel, soweit zugeordnet.

**Test 14:** Questdatenimport

Erwartung: Vollständige verfügbare Questtabellen werden eingelesen.

## Crafting

**Test 15:** Gelano auswählen

Erwartung: Gelano-Bild, Name und Werte erscheinen über dem Rezept.

**Test 16:** Rezept anzeigen

Erwartung: Jedes Material besitzt einen vollständigen deutschen Namen und ein richtig zugeordnetes Bild, soweit in den Quellen vorhanden.

**Test 17:** Menge von 1 auf 7 ändern

Erwartung: Alle Bedarfswerte werden korrekt multipliziert.

**Test 18:** Material anklicken

Erwartung: Passende Itemdetailseite öffnet sich.

**Test 19:** Unbekannten Preis verwenden

Erwartung: Keine erfundene Gewinnberechnung.

## Charaktere

**Test 20:** Klasse auswählen

Erwartung: Vollständiges Dropdown mit korrekten Namen und verfügbaren Bildern.

**Test 21:** Sacrieur auswählen und Charakter registrieren

Erwartung: Richtige Klasse mit richtigem Bild wird gespeichert.

**Test 22:** Bestehenden Charakter bearbeiten

Erwartung: Daten bleiben erhalten.

## Almanax

**Test 23:** Aktuelle Woche laden

Erwartung: Zeitstrahl mit Datum, Opfergabe, Mengen und Ressourcenbildern.

**Test 24:** Eine Woche vorblättern

Erwartung: Korrekte neue Daten.

**Test 25:** Auf Ressource klicken

Erwartung: Richtige Itemseite öffnet sich.

## Overlay und Hotkeys

**Test 26:** Hotkey-Feld anklicken

Erwartung: Aufnahmezustand erscheint.

**Test 27:** F8 drücken

Erwartung: F8 wird als Tastenkombination erkannt.

**Test 28:** Strg + Shift + D drücken

Erwartung: Vollständige Tastenkombination wird erkannt.

**Test 29:** Hotkey speichern und Anwendung neu starten

Erwartung: Belegung bleibt gespeichert.

**Test 30:** Overlay per Hotkey umschalten

Erwartung: Overlay erscheint und verschwindet.

**Test 31:** Overlay verschieben und Transparenz ändern

Erwartung: Änderungen werden gespeichert.

**Test 32:** Mehrere Monitore testen

Erwartung: Korrekte Positionierung.

## Update-System

**Test 33:** Prüfen, ob neue Version vorhanden ist

Erwartung: Korrekte Versionsinformation.

**Test 34:** Signiertes Testupdate herunterladen

Erwartung: Download, Signaturprüfung und Installationsablauf funktionieren.

**Test 35:** Ungültige Signatur simulieren

Erwartung: Installation wird abgebrochen.

**Test 36:** Upgrade mit bestehenden Benutzerdaten durchführen

Erwartung: Einstellungen, Charaktere und Fortschritt bleiben erhalten.

## Regression

**Test 37:** Vorhandene Discord-Funktionen prüfen

Erwartung: Keine inkompatiblen API- oder Datenbankänderungen.

**Test 38:** Backend zeitweise deaktivieren

Erwartung: Anwendung zeigt verständliche Fehler und nutzt zulässige Cache-Daten.

**Test 39:** Windows-Release-Build installieren

Erwartung: Anwendung startet ohne Entwicklungsumgebung.

**Test 40:** Neue Anwendung über das bestehende Update-System installieren, falls die Voraussetzungen der Ausgangsversion gegeben sind.

Erwartung: Aktualisierung auf die neue Version und Erhaltung der Benutzerdaten.

Ergänze weitere Tests, wenn während der Entwicklung neue Fehler oder Risiken auftreten.

---

# 17. CODEQUALITÄT UND SICHERHEIT

Anforderungen:

- TypeScript Strict Mode
- Saubere Typisierung
- Keine unnötige Verwendung von `any`
- Wiederverwendbare Komponenten
- Kleine, testbare Funktionen
- Einheitliche Fehlermeldungen
- Sichere Datenbankabfragen
- Valide API-Schemas
- Saubere Migrationen
- Keine hartcodierten Zugangsdaten
- Sichere Update-Signaturen
- Gute Performance
- Niedriger RAM-Verbrauch
- Fehlerprotokollierung
- Nachvollziehbare Datenherkunft
- Kein unautorisiertes Scraping
- Keine unzulässige Spielautomatisierung

Vermeide Scheinimplementierungen, die nur eine fertige Oberfläche darstellen, aber keine echte Funktion besitzen.

---

# 18. AUTONOMER ABLAUF

Arbeite möglichst ohne meine Beteiligung.

Gehe wie folgt vor:

### Phase A – Analyse

Untersuche vorhandenen Code, Architektur, Bugs und Datenquellen.

Erstelle eine kurze interne Änderungsplanung.

### Phase B – Datenbank

Implementiere vollständigen Itemimport, Bildzuordnung, Questdatenimport und Kategorien.

### Phase C – Frontend

Implementiere Suche, Suchvorschau, Ergebnislisten, neue Itemansichten und alle weiteren UI-Verbesserungen.

### Phase D – Quest-Assistent

Implementiere Kategorien, vollständigen verfügbaren Questdatenbestand, Guide-Verknüpfungen und OCR-Zuordnung.

### Phase E – Crafting und Charaktere

Implementiere Materialbilder, Itemzusammenfassung und Klassen-Dropdown.

### Phase F – Almanax und Overlay

Implementiere Zeitstrahl, Overlay-Editor und Hotkey Recorder.

### Phase G – Branding

Integriere alle neuen Logo-Assets einschließlich Windows-Icon.

### Phase H – Synchronisierung

Prüfe Backend-Kompatibilität und Discord-Bot.

### Phase I – Tests

Führe sämtliche erforderlichen Tests aus und behebe Fehler.

### Phase J – Release

Erstelle den Windows-Build, teste den Installer, signiere das Update und veröffentliche es bei vorhandener Autorisierung.

**Beende die Arbeit nicht bereits nach der Planung.**

Implementiere den gesamten Auftrag innerhalb der verfügbaren Ausführungsumgebung.

Arbeite an unabhängigen Arbeitspaketen weiter, wenn eine externe Ressource blockiert ist.

Falls eine Sitzung nicht ausreicht, sichere den Stand und erstelle eine präzise Fortsetzungsdatei.

---

# 19. ERWARTETE DOKUMENTATION

Erstelle oder aktualisiere:

- `README.md`
- `CHANGELOG.md`
- `IMPLEMENTATION_STATUS.md`
- `API_INTEGRATIONS.md`
- `DATA_IMPORT.md`
- `UPDATE_GUIDE.md`
- `TEST_REPORT.md`

Der Testbericht muss unterscheiden zwischen:

- Unit-Tests erfolgreich
- Integrationstests erfolgreich
- Live-API-Test erfolgreich
- Nicht getesteten externen Diensten
- Fehlenden Berechtigungen
- Windows-Build erfolgreich
- Release erstellt
- Update tatsächlich installierbar
- Bekannten offenen Fehlern

Keine nicht ausgeführten Tests als erfolgreich kennzeichnen.

---

# 20. FINALE ABNAHME

Dieses Update gilt erst dann als abgeschlossen, wenn folgende Ergebnisse vorliegen:

1. Das neue Logo ist in der Anwendung und im Windows-Icon integriert.
2. Gegenstände werden während der Eingabe vorgeschlagen.
3. Die Auswahl eines Vorschauergebnisses öffnet direkt das richtige Item.
4. Die Suche öffnet eine vollständige passende Ergebnisliste.
5. Kategorien funktionieren zuverlässig.
6. Der vollständige verfügbare Itemkatalog wurde importiert und geprüft.
7. Itembilder werden korrekt zugeordnet.
8. Die Questübersicht besitzt eine strukturierte Kategoriennavigation.
9. Verfügbare Questdaten wurden vollständig importiert.
10. DOFUS Pour les Noobs ist rechtlich zulässig über Guide-Links und optionale genehmigte Integrationen berücksichtigt.
11. Der Crafting-Rechner zeigt Materialnamen und Materialbilder.
12. Der ausgewählte Gegenstand wird mit Bild und Effekten oberhalb des Rechners dargestellt.
13. Charakterklassen werden über ein Dropdown ausgewählt.
14. Klassenbilder erscheinen in Charakterprofilen.
15. Der Almanax wird als interaktiver Zeitstrahl angezeigt.
16. Das Overlay ist individuell konfigurierbar.
17. Hotkeys lassen sich durch tatsächliches Drücken aufnehmen.
18. Das Overlay lässt sich über die gewählte Kombination ein- und ausblenden.
19. Vorhandene Benutzerinformationen bleiben erhalten.
20. Der Discord-Bot bleibt kompatibel.
21. Die Tests wurden ausgeführt und dokumentiert.
22. Ein lauffähiger Windows-Release-Build wurde erzeugt.
23. Ein sicheres Update kann über den vorhandenen Updater installiert werden, sofern die installierte Version und die Signaturinfrastruktur das ermöglichen. Andernfalls liegt ein getesteter Übergangsinstaller bereit.

## ABSCHLIESSENDE ANWEISUNG

Ich möchte kein weiteres theoretisches Konzept.

Du sollst die bestehende Anwendung anhand dieses Auftrags **tatsächlich verbessern, erweitern, testen und für die Veröffentlichung vorbereiten**.

Alle bereitgestellten Screenshots und Logo-Assets sind zu berücksichtigen.

Implementiere sämtliche technisch und rechtlich möglichen Funktionen so vollständig und professionell wie möglich.

Verwende reale DOFUS-Daten, keine erfundenen Datensätze.

Korrigiere bestehende Fehler an ihrer Ursache.

Bewahre die bereits funktionierenden Komponenten.

Achte auf ein einheitliches, modernes Erscheinungsbild.

Erstelle den Release und stelle den Update-Prozess so bereit, dass der Endanwender möglichst nur noch die Update-Funktion in den Einstellungen verwenden muss.

**Beginne jetzt mit der Prüfung des bestehenden Repositorys und setze den Auftrag anschließend eigenständig im Code um.**
