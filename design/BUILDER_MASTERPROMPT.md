# DOFUS COMPANION – BUILDER & CHARACTER UPDATE
## Professioneller Ausrüstungs-Builder, Schadenssimulator, Itemfilter und Charakter-Synchronisierung

### DEINE AUFGABE

Du bist ein autonom arbeitendes Senior-Entwicklungsteam aus Softwarearchitekten, React-/TypeScript-Entwicklern, Rust-/Tauri-Spezialisten, UI/UX-Designern, Datenbankentwicklern, API-Ingenieuren, Game-Data-Spezialisten und QA-Engineers.

Dein Auftrag besteht darin, die bereits vorhandene Anwendung **DOFUS Companion** erheblich zu erweitern.

Das wichtigste neue Modul ist ein umfassender, professioneller und vollständig interaktiver **DOFUS Set-Builder**, der sich funktional an Dofus Creator orientiert.

Referenzwebsite:

https://dofuscreator.com/

Der Builder soll möglichst alle sinnvollen Funktionen dieser Plattform besitzen, zusätzlich vollständig mit unserer bestehenden Charakterverwaltung, Itemdatenbank und dem Discord-Bot verknüpft sein.

**WICHTIG: Es handelt sich um die Weiterentwicklung des bestehenden DOFUS-Companion-Projekts. Erstelle kein neues unabhängiges Projekt.**

Erhalte alle bereits funktionierenden Module, Benutzerprofile, Charaktere, Einstellungen, Favoriten, Questfortschritte, Update-Funktionen und Discord-Integrationen.

Implementiere die Funktionen tatsächlich, anstatt lediglich ein Design oder technische Platzhalter zu erstellen.

Arbeite möglichst autonom. Untersuche zuerst das bestehende Repository und entwickle anschließend sämtliche Komponenten, Services, Datenbankmigrationen, Tests und Release-Artefakte.

Frage nur nach wirklich fehlenden Zugangsdaten, Dateien oder Berechtigungen.

---

# 1. DOFUS CREATOR UMFASSEND ANALYSIEREN

Untersuche die Website:

https://dofuscreator.com/

Die mitgelieferten Screenshots zeigen die gewünschten Hauptbereiche:

1. Hauptansicht mit Charakter, Ausrüstungsslots und Charakterwerten.
2. Gegenstandsauswahl mit Suchfunktion und umfangreichen Attributfiltern.
3. Zauber- und Schadensvorschau mit normalen und kritischen Schadenswerten.

Die Screenshots sind ausdrücklich als funktionale und visuelle Referenzen zu verwenden.

Prüfe die öffentlich zugänglichen Funktionen der Website, soweit technisch und rechtlich zulässig.

Analysiere insbesondere:

- Aufbau des Builders
- Charakterauswahl
- Charakterlevel
- Eigenschaftspunkte
- Scroll-Werte
- Ausrüstungsslots
- Gegenstandsauswahl
- Such- und Filterfunktionen
- Setboni
- Charakterstatistiken
- Exomagie
- Item-Maging
- Buffs
- Trophäen
- Dofus-Slots
- Reittiere und Begleiter
- Schadensberechnung
- Waffenberechnung
- Zauberberechnung
- Gegner-Simulator
- Set-Speicherung
- Set-Vergleiche
- Projektverwaltung
- Automatische Build-Optimierung
- Tastenkürzel
- Export und Teilen von Builds

Analysiere die Funktionen mit dem Ziel, einen eigenständigen technisch hochwertigen Builder zu erstellen.

**Urheberrechtliche Vorgabe:** Kopiere keinen proprietären Quellcode, keine unveröffentlichten APIs, keine fremde Datenbank durch unautorisiertes Scraping und keine geschützten Designelemente. Die Referenz dient dem Funktionsvergleich. Implementiere Design, Komponenten und Berechnungslogik eigenständig.

Erstelle intern eine Funktionsvergleichsmatrix zwischen Dofus Creator und unserem DOFUS Companion.

---

# 2. NEUEN SIDEBAR-REITER „BUILDER“ ERSTELLEN

Erweitere die vorhandene Sidebar um:

**Builder**

Verwende ein passendes Icon, beispielsweise einen Schild, Helm oder eine gekreuzte Ausrüstungssymbolik.

Die Navigation soll mindestens ermöglichen:

- Builder öffnen
- Neuen Build erstellen
- Gespeicherten Build laden
- Build bearbeiten
- Build vergleichen
- Build duplizieren
- Build einem Charakter zuweisen
- Schadenssimulator öffnen

Der Builder soll unter einer nachvollziehbaren internen Route erreichbar sein, beispielsweise:

`/builder`

Einzelne Builds:

`/builder/:buildId`

Nutze die bereits vorhandene Routing-Architektur.

Erhalte die vorhandenen dunklen Farben und lindgrünen Akzente des DOFUS Companion.

---

# 3. PROFESSIONELLE BUILDER-OBERFLÄCHE

Entwickle eine moderne dreispaltige Benutzeroberfläche.

## 3.1 Linke Spalte – Charakterwerte

Zeige oben:

- Aktive Charakterklasse
- Klassenbild
- Charaktername
- Charakterlevel
- Zugeordneten Charakter
- Ausgewählten Build
- Unterstützte DOFUS-Datenversion

Darunter sämtliche relevanten Werte.

### Grundwerte

- Aktionspunkte
- Bewegungspunkte
- Vitalität
- Weisheit
- Stärke
- Intelligenz
- Chance
- Beweglichkeit

### Weitere Charakterwerte

- Power
- Initiative
- Kritische Treffer
- Reichweite
- Beschwörungen
- Prospecting
- Heilung
- Flucht
- Tackle
- AP-Entzug
- MP-Entzug
- AP-Resistenz
- MP-Resistenz

### Schaden

- Allgemeiner Schaden
- Neutraler Schaden
- Erdschaden
- Feuerschaden
- Wasserschaden
- Luftschaden
- Kritischer Schaden
- Pushback-Schaden
- Zauberschaden
- Waffenschaden
- Distanzschaden
- Nahkampfschaden
- Weitere tatsächlich unterstützte Schadensmodifikatoren

### Resistenzen

- Neutral %
- Erde %
- Feuer %
- Wasser %
- Luft %
- Feste Neutralresistenz
- Feste Erdresistenz
- Feste Feuerresistenz
- Feste Wasserresistenz
- Feste Luftresistenz
- Kritische Resistenz
- Pushback-Resistenz
- Distanzresistenz
- Nahkampfresistenz

Die Werte sollen grafisch übersichtlich gruppiert sein.

Jeder Wert wird unmittelbar aktualisiert, sobald Ausrüstung, Eigenschaftspunkte oder Buffs geändert werden.

## 3.2 Mittlere Spalte – Ausrüstung

Zeige ein visuelles Ausrüstungsraster ähnlich der funktionalen Struktur von Dofus Creator.

Benötigte Slots, soweit für die gewählte DOFUS-Version gültig:

- Hut
- Umhang
- Amulett
- Ring 1
- Ring 2
- Gürtel
- Stiefel
- Waffe
- Schild
- Reittier beziehungsweise kompatibler Begleiterslot
- Sechs Dofus-/Trophäenplätze
- Weitere versionsabhängige Slots, soweit vorhanden

Prüfe die tatsächliche Slotstruktur der gewählten DOFUS-Version.

Verwende keine erfundenen Ausrüstungsslots.

Jeder Slot zeigt:

- Slot-Icon bei leerem Slot
- Itembild bei ausgerüstetem Gegenstand
- Tooltip
- Gegenstandsname
- Level
- Relevante Werte
- Entfernen-Button

Beim Anklicken eines Slots öffnet sich die passende Gegenstandsauswahl.

Beispiele:

Klick auf Helm → ausschließlich kompatible Helme.

Klick auf Ring → ausschließlich kompatible Ringe.

Klick auf Waffe → geeignete Waffentypen.

Klick auf Dofus-/Trophäenplatz → kompatible Gegenstände.

Alle Gegenstände müssen aus der vorhandenen DOFUS-Itemdatenbank geladen werden.

Keine Demo-Items verwenden.

## 3.3 Rechte Spalte – Gesamtwerte und Aktionen

Zeige kompakte Werte und Funktionen:

- AP/MP
- Wichtigste Attribute
- Elementarschäden
- Kritische Treffer
- Resistenzen
- Setboni
- Aktive Buffs
- Ausrüstungsanforderungen
- Aktuelle Build-Gesamtkosten, sofern echte Preise vorhanden

Buttons:

- Speichern
- Duplizieren
- Vergleichen
- Schaden berechnen
- Zauber anzeigen
- Buffs bearbeiten
- Build zurücksetzen
- Build exportieren
- An Discord senden

Bei kleineren Fenstern dürfen die Spalten in Tabs umgewandelt werden.

---

# 4. VOLLSTÄNDIGE GEGENSTANDSSUCHE IM BUILDER

Entwickle einen erweiterten Item-Picker.

Das Item-Picker-Fenster soll über jedem Ausrüstungsslot geöffnet werden können.

## 4.1 Darstellung

Zeige Gegenstände als moderne Karten.

Jede Karte enthält:

- Itembild
- Deutschen Gegenstandsnamen
- Gegenstandslevel
- Itemtyp
- Zugehöriges Set
- Vollständige verfügbare Effekte
- Positive Werte in passender Farbe
- Negative Werte deutlich gekennzeichnet
- Anforderungen
- Passenden Ausrüsten-Button

Unterstütze Grid- und Listenansicht.

## 4.2 Suche

Implementiere:

- Namenssuche
- Live-Autocomplete
- Levelbereich
- Kategorie
- Unterkategorie
- Gegenstandstyp
- Setname
- Zugehöriges Element
- Effektfilter
- Sortierung
- Filter zurücksetzen

Die Suche muss sämtliche verfügbaren DOFUS-Gegenstände berücksichtigen.

Verwende serverseitige Suche, Filter und Pagination.

---

# 5. NEUE ATTRIBUTFILTER AUCH BEI „GEGENSTÄNDE“

Dies ist eine ausdrückliche zusätzliche Änderung.

Erweitere nicht nur den Builder, sondern auch den bereits vorhandenen Reiter **Gegenstände** um dieselben Attributfilter.

Die Filter sollen sich funktional am Ausrüstungs-Verkaufsstand im Spiel orientieren.

## 5.1 Checkboxen

Erstelle eine übersichtliche Filterleiste mit Checkboxen.

### Hauptattribute

- AP
- MP
- Vitalität
- Weisheit
- Stärke
- Intelligenz
- Chance
- Beweglichkeit
- Power

### Sekundärwerte

- Reichweite
- Kritische Treffer
- Initiative
- Beschwörungen
- Prospecting
- Heilung
- Tackle
- Flucht
- AP-Entzug
- MP-Entzug
- AP-Resistenz
- MP-Resistenz

### Schaden

- Allgemeiner Schaden
- Neutral
- Erde
- Feuer
- Wasser
- Luft
- Kritischer Schaden
- Pushback-Schaden
- Zauberschaden
- Nahkampfschaden
- Distanzschaden
- Waffenschaden

### Resistenzen

- Prozentuale Elementarresistenzen
- Feste Elementarresistenzen
- Kritische Resistenz
- Pushback-Resistenz
- Nahkampfresistenz
- Distanzresistenz

Berücksichtige weitere tatsächlich vorhandene und sinnvoll filterbare Effekte.

## 5.2 Filterlogik

Checkboxen sollen standardmäßig bedeuten:

**Gegenstand besitzt diesen Effekt.**

Zusätzlich implementiere optional Mindest- und Höchstwerte.

Beispiele:

- Mindestens 300 Vitalität
- Mindestens 60 Stärke
- Mindestens 10 kritischer Schaden
- Mindestens 1 Reichweite
- Mindestens 10 % Feuerresistenz

Unterstütze:

- UND-Verknüpfung
- ODER-Verknüpfung
- Positive Werte
- Negative Werte
- Exakte Werte, soweit sinnvoll
- Wertebereiche
- Effekt vorhanden
- Effekt nicht vorhanden

Alle Filter müssen auf normalisierten Effekt-IDs beruhen.

Verwende keine fehleranfälligen Stringvergleiche.

Die vorhandene Dofusdude- und Spieldatenbank muss hierfür korrekt genutzt werden.

## 5.3 Wiederverwendbarkeit

Entwickle eine gemeinsame Filter-Engine.

Diese wird verwendet von:

- Gegenstandssuche
- Builder-Itemsuche
- Build-Optimierung
- Item-Vergleich
- Optionalen Discord-Itemabfragen

So vermeiden wir unterschiedliche Ergebnisse zwischen den Modulen.

---

# 6. VOLLSTÄNDIGE AUSRÜSTUNGS- UND SETBERECHNUNG

Implementiere eine eigene zentrale Build-Berechnungs-Engine.

Sie muss die tatsächlich dokumentierten DOFUS-Regeln berücksichtigen.

## 6.1 Werteberechnung

Berechne Gesamtwerte anhand von:

- Charakterlevel
- Klassenbasiswerten
- Verteilten Eigenschaftspunkten
- Scroll-Werten
- Ausgerüsteten Gegenständen
- Tatsächlichen Item-Roll-Werten
- Setboni
- Aktiven Buffs
- Exomagie
- Dofus-/Trophäeneffekten
- Reittier- beziehungsweise Begleitereffekten
- Sonstigen situationsabhängigen Effekten

Trenne Basiswerte, Itemwerte, Setboni und temporäre Effekte.

Zeige bei Bedarf die Herkunft jedes Wertes.

## 6.2 Setboni

Wenn mehrere Teile eines Sets ausgerüstet werden:

- Zugehörigkeit erkennen
- Anzahl der Setbestandteile zählen
- Korrekten Setbonus aktivieren
- Gesamtwerte neu berechnen
- Bonus beim Entfernen neu berechnen

Berücksichtige versionsabhängige Regeln und Bedingungen.

Ein Setbonus darf nicht doppelt angewendet werden.

## 6.3 Voraussetzungen und Einschränkungen

Prüfe:

- Mindestlevel
- Itemanforderungen
- AP-/MP-/Reichweitenbeschränkungen
- Ausrüstungsbeschränkungen
- Gegenstandskombinationen
- Dofus-/Trophäenregeln
- Exomagie-Grenzen
- Sonstige tatsächliche Spielbedingungen

Ungültige Kombinationen müssen klar gekennzeichnet werden.

Verhindere das Ausrüsten von Gegenständen in inkompatiblen Slots.

## 6.4 Exomagie und veränderte Itemwerte

Ermögliche die Bearbeitung von Ausrüstungswerten.

Optionen:

- Tatsächlichen Itemwert eingeben
- Exomagie hinzufügen
- Overmaging abbilden
- Bonuswerte anpassen
- Ursprüngliche Werte wiederherstellen

Markiere bearbeitete Items.

Verwende eine eigene Instanz des ausgerüsteten Gegenstands.

Ändere niemals den globalen Originaldatensatz der Itemdatenbank.

---

# 7. KLASSENBILDER AUS MEINER ZIP-DATEI

Ich habe Klassenbilder in einer ZIP-Datei bereitgestellt.

Die Bilder sind nach den jeweiligen DOFUS-Klassen benannt.

**Verwende diese Bilder für die Charakterverwaltung und den neuen Builder.**

## 7.1 ZIP-Datei untersuchen

Suche im Workspace nach der bereitgestellten Klassenbilder-ZIP.

Falls sie unter einem anderen Verzeichnis liegt, ermittle ihren tatsächlichen Pfad.

Wenn sie tatsächlich nicht vorhanden ist, fordere ausschließlich diese Datei an und entwickle die anderen Funktionen weiter.

Nicht einfach diesen Arbeitsschritt überspringen.

## 7.2 Verarbeitung

Erstelle eine sichere Importfunktion.

Anforderungen:

- ZIP entpacken
- Dateiformate prüfen
- Bilddateien erkennen
- Klassennamen aus Dateinamen lesen
- Deutsche und internationale Klassennamen abgleichen
- Klassenzuordnung prüfen
- Doppelte Dateien erkennen
- Bilder optimieren
- Vorschaubilder erstellen
- Originale erhalten
- Fehlende Zuordnungen melden

Verwende ein zentrales Mapping zwischen Klassen-ID und Asset.

Beispiele:

- Sacrieur
- Cra
- Iop
- Eniripsa
- Ecaflip
- Xelor
- Pandawa
- Sram
- Eliotrope
- Huppermage
- Forgelance

Ermittle den vollständigen gültigen Klassenkatalog aus den Spieldaten.

## 7.3 Verwendung der Bilder

Verwende die Bilder an folgenden Stellen:

- Charakterkarten
- Charakterdetailseite
- Klassen-Dropdown
- Builder
- Charakterauswahl
- Set-Verwaltung
- Schadenssimulator
- Discord-Charakter-Embeds, soweit passend

Achte auf:

- Seitenverhältnisse
- Bildschärfe
- Einheitliche Darstellung
- Keine Verzerrung
- Responsive Skalierung
- Passende Hintergründe

---

# 8. CHARAKTERVERWALTUNG MIT SETS VERKNÜPFEN

Erweitere den vorhandenen Reiter **Charaktere**.

## 8.1 Neuer Button „Sets“

Jeder registrierte Charakter erhält einen Button:

**Sets**

Beim Anklicken öffnet sich die Setverwaltung des ausgewählten Charakters.

Zeige:

- Gespeicherte Sets
- Aktuell ausgewählten Build
- Ausrüstungsbilder
- Wichtigste Werte
- Name des Builds
- Zugeordnetes Element
- Erstellungsdatum
- Letzte Änderung
- Spielversion

## 8.2 Mehrere Builds pro Charakter

Ein Charakter darf beliebig viele gespeicherte Builds besitzen.

Beispiele:

- PvM – Stärke
- PvM – Intelligenz
- PvP – Resistenzen
- Kritischer Schaden
- Farming
- Prospektion

Ermögliche:

- Neuen Build erstellen
- Vorhandenen Build auswählen
- Build bearbeiten
- Build löschen
- Build duplizieren
- Build umbenennen
- Build vergleichen
- Build als aktiv markieren
- Build in Discord teilen

## 8.3 Vollständige Verknüpfung

Wenn ein Build aus der Charakterverwaltung geöffnet wird:

- Richtigen Charakter laden
- Klasse übernehmen
- Level übernehmen
- Ausrüstung laden
- Eigenschaftspunkte laden
- Setboni berechnen
- Schadensvorschau ermöglichen

Wenn der Build gespeichert wird, aktualisiert sich die Charakteransicht.

Wenn ein Charakter gelöscht wird, frage nach dem Umgang mit gespeicherten Builds.

Versehentliches Löschen gespeicherter Ausrüstungen muss verhindert werden.

## 8.4 Tatsächlich getragen versus geplant

Unterscheide deutlich:

- Gespeicherter Build
- Aktiver Build innerhalb des Companions
- Tatsächlich im Spiel getragene Ausrüstung

Ohne eine autorisierte Live-Schnittstelle darf der Companion nicht behaupten, die tatsächliche Ausrüstung im Spiel zu kennen.

---

# 9. VOLLSTÄNDIGE DOFUS-ZAUBERDATENBANK

Dies ist eine der wichtigsten technischen Aufgaben.

Erstelle eine vollständige, versionierte Zauberdatenbank für alle unterstützten DOFUS-Klassen.

**Gewünscht ist insbesondere DOFUS 3.6.**

Da bereits DOFUS 3.7 erschienen ist, unterstütze zusätzlich die aktuelle Version.

Die Daten verschiedener Versionen dürfen niemals unbemerkt vermischt werden.

## 9.1 Hauptquelle

https://github.com/ledouxm/dofus-sqlite

Releases:

https://github.com/ledouxm/dofus-sqlite/releases

Nutze vorhandene versionierte Spieldaten und JSON-Dateien.

Untersuche insbesondere:

- SpellData
- SpellLevelsData beziehungsweise tatsächlich entsprechende Tabellen
- Spell-Effekte
- Effektdefinitionen
- Klassenzuordnungen
- Freischaltlevel
- Zaubervarianten
- Kritische Effekte
- Spell-Icons

Prüfe das tatsächliche Schema und die Beziehungen.

## 9.2 Bildquelle

Verwende das verfügbare Bildarchiv:

`images-spell.zip`

Gemäß der Datenbeschreibung können Zauberbilder anhand von `SpellData.iconId` aufgelöst werden.

Typische Struktur:

`1x/sort_<iconId>.png`

`2x/sort_<iconId>.png`

Validiere die tatsächlichen Dateinamen.

Jeder Zauber soll sein korrektes Bild besitzen.

## 9.3 Ergänzende Quellen

https://api.dofusdb.fr/

https://www.frigost.dev/API/Dofus%203.0/Data/

https://www.dofus.com/

Versionenvergleich:

https://backfromafk.com/en/updates/3-6/

https://backfromafk.com/en/updates/3-7/

Verwende diese Quellen nur entsprechend ihrer Verfügbarkeit und Nutzungsbedingungen.

## 9.4 Zauberdaten

Speichere:

- Eindeutige Spell-ID
- Klassen-ID
- Name Deutsch
- Name Französisch
- Name Englisch, soweit vorhanden
- Zaubericon
- Freischaltlevel
- Zauberstufen
- AP-Kosten
- Minimale Reichweite
- Maximale Reichweite
- Kritische Trefferwahrscheinlichkeit
- Wirkungsbereich
- Element
- Grundschaden normal
- Grundschaden kritisch
- Schaden pro Wirkungslinie
- Heilung
- Lebensraub
- Buffs
- Debuffs
- Zustände
- Einschränkungen
- Zaubervariante
- Spielversion
- Datenquelle

Berücksichtige die Tatsache, dass viele Zauber mehrere Effekte besitzen.

Ein Zauber darf nicht auf nur einen Schadenstyp reduziert werden.

## 9.5 Klassenabdeckung

Importiere alle aktuell verfügbaren Klassensprüche der unterstützten Version.

Nicht nur die Zauber aus meinen Screenshots.

Die Datenbank muss für jede Klasse geprüft werden.

Implementiere eine automatische Datenvollständigkeitsprüfung:

- Klasse vorhanden?
- Zauberliste vorhanden?
- Zauberlevel vorhanden?
- Icons vorhanden?
- Effekte vorhanden?
- Normale Schadenswerte vorhanden, falls relevant?
- Kritische Schadenswerte vorhanden, falls relevant?
- Spielversion korrekt?

Nicht alle Zauber verursachen Schaden. Unterstützungs-, Beschwörungs- und Bewegungszauber müssen entsprechend behandelt werden.

---

# 10. SCHADENSSIMULATOR WIE BEI DOFUS CREATOR

Entwickle einen umfangreichen Schadenssimulator.

Er soll direkt über den Builder erreichbar sein.

Buttons:

- Schaden berechnen
- Zauber anzeigen
- Waffen anzeigen
- Buffs
- Gegner konfigurieren

## 10.1 Schadensvorschau

Zeige alle Zauber der ausgewählten Klasse.

Jeder Zauber erhält eine eigene Karte.

Die Karte enthält:

- Zauberbild
- Deutschen Namen
- Erforderliches Level
- Zauberrang
- AP-Kosten
- Reichweite
- Kritische Wahrscheinlichkeit
- Element
- Normalen Schaden
- Kritischen Schaden
- Ggf. Heilung oder Lebensraub
- Weitere Effekte
- Besondere Bedingungen

Das Layout soll sich an meinem dritten Screenshot orientieren, aber unser eigenes dunkles Design verwenden.

Zeige bei Schadenswerten möglichst:

- Minimum
- Maximum
- Durchschnitt
- Kritisches Minimum
- Kritisches Maximum
- Kritischen Durchschnitt
- Erwartungswert unter Berücksichtigung der kritischen Trefferchance

Bei mehrzeiligen Zaubern:

- Einzelne Schadenslinien anzeigen
- Gesamtwerte berechnen
- Elemente getrennt behandeln

## 10.2 Versionsabhängige Zauber

Wenn ein Zauber sich zwischen 3.6 und 3.7 verändert hat:

- Werte der ausgewählten Version verwenden
- Keine Mischung verschiedener Datenstände
- Optional Unterschiede anzeigen
- Spielversion klar kennzeichnen

Wenn eine Version unvollständige Daten enthält, zeige den fehlenden Umfang.

## 10.3 Schadensberechnung

Entwickle eine zentrale und testbare Damage Engine.

Berücksichtige, soweit exakt modellierbar:

- Basiszauberschaden
- Charakterelement
- Power
- Allgemeinen Schaden
- Elementarschaden
- Kritischen Schaden
- Kritische Trefferchance
- Prozentuale Schadensmodifikatoren
- Nahkampfschaden
- Distanzschaden
- Zauberschaden
- Waffenschaden
- Zielresistenzen
- Feste Resistenzen
- Mehrere Schadenslinien
- Heilungen
- Lebensraub
- Zustände
- Buffs
- Zusätzliche Effekte

Die Rundungsregeln und die Reihenfolge der Berechnungen müssen anhand verifizierter DOFUS-Mechaniken implementiert werden.

Verwende keine frei erfundene allgemeine Formel, um komplexe Spezialmechaniken vermeintlich vollständig abzubilden.

## 10.4 Spezielle Zaubereffekte

Einige Zauber besitzen bedingte Effekte.

Beispiele:

- Schaden steigt durch einen Zustand
- Schaden verändert sich abhängig von Entfernung
- Schaden verändert sich abhängig von HP
- Mehrere Treffer
- Verstärkung nach vorherigen Aktionen
- Portale
- Bomben
- Beschwörungen
- Glyphen
- Gift
- Verzögerte Effekte

Entwickle dafür eine modulare Effekt-Engine.

Jeder Effekt sollte eine eigene Berechnungsstrategie besitzen.

Wenn eine Mechanik noch nicht verifiziert unterstützt wird, kennzeichne sie ausdrücklich.

Keine falschen exakten Zahlen ausgeben.

## 10.5 Dynamische Berechnung

Wenn der Spieler im Builder einen Gegenstand austauscht:

1. Charakterwerte neu berechnen.
2. Setboni neu berechnen.
3. Buffs erneut anwenden.
4. Zauberberechnung aktualisieren.
5. Normale und kritische Schadenswerte aktualisieren.

Alles möglichst ohne vollständigen Seitenreload.

---

# 11. WAFFENSCHADEN

Der Simulator soll zusätzlich den Schaden ausgerüsteter Waffen berechnen.

Funktionen:

- Waffe erkennen
- AP-Kosten
- Reichweite
- Kritische Treffer
- Normale Schadenslinien
- Kritische Schadenslinien
- Lebensraub
- Elementarschaden
- Gesamtschaden
- Resistenzberechnung
- Aktive Waffenbuffs

Wenn keine Waffe ausgerüstet ist, zeige eine verständliche leere Ansicht.

Berücksichtige die tatsächlichen Waffeneffekte und Versionen.

---

# 12. BUFF-SYSTEM

Entwickle ein umfangreiches Buff-System.

## 12.1 Klassenbuffs

Zeige die tatsächlich verfügbaren Buffs der gewählten Klasse.

Beispiele möglicher Kategorien:

- Elementverstärkung
- Power
- Kritische Treffer
- Allgemeiner Schaden
- Zauberschaden
- Waffenschaden
- Zustandsabhängige Boni

Verwende reale Spell- und Effect-IDs.

## 12.2 Allgemeine Buffs

Ermögliche konfigurierbare Vergleichsbedingungen.

Zum Beispiel:

- Zusätzliche Power
- Zusätzlicher Schaden
- Kritische Trefferchance
- Widerstandsänderung des Gegners
- Abstand zum Gegner

Solche Simulationen müssen als manuelle Annahmen erkennbar sein.

## 12.3 Buff-Verwaltung

- Buff aktivieren
- Buff deaktivieren
- Werte verändern, soweit zulässig
- Buffs zurücksetzen
- Buffprofile speichern
- Buffprofile einem Build zuweisen

---

# 13. GEGNER- UND RESISTENZSIMULATOR

Entwickle einen Simulator für Zielcharaktere und Trainingsgegner.

## 13.1 Gegnerwerte

Konfigurierbar:

- Lebenspunkte
- Elementarresistenzen
- Feste Elementarresistenzen
- Kritische Resistenz
- Pushback-Resistenz
- Nahkampf-/Distanzbedingungen
- Weitere relevante Zustände

## 13.2 Vordefinierte Ziele

Biete mindestens:

- Keine Resistenzen
- Benutzerdefiniertes Ziel
- Gespeicherte Testgegner

Wenn echte Monsterdaten geeignet sind, können Monsterprofile aus der Monsterdatenbank übernommen werden.

Die Schadensberechnung muss dann die tatsächlichen verfügbaren Werte verwenden.

## 13.3 Schadensvergleich

Zeige:

- Schaden ohne Gegnerresistenz
- Schaden nach Resistenz
- Kritischen Schaden
- Unterschied zum vorherigen Build
- Prozentuale Veränderung

Ermögliche den direkten Vergleich mehrerer Builds gegen denselben Gegner.

---

# 14. BUILD-VERGLEICH

Entwickle eine umfangreiche Vergleichsansicht.

Der Benutzer soll zwei oder mehr gespeicherte Builds vergleichen können.

Zeige:

- Ausrüstung nebeneinander
- AP
- MP
- Vitalität
- Elemente
- Schaden
- Resistenzen
- Kritische Treffer
- Zauberschaden
- Geschätzte Kosten, sofern vorhanden

Positive Unterschiede grün markieren.

Negative Unterschiede rot markieren.

Bei Schaden:

- Gleiche Klasse
- Gleicher Zauber
- Gleiche Zauberversion
- Gleiche Gegnerbedingungen
- Gleiche Buffbedingungen

Die Ergebnisse müssen reproduzierbar sein.

---

# 15. AUTOMATISCHER BUILD-OPTIMIERER

Dofus Creator besitzt mit Fashionista eine automatische Ausrüstungssuche.

Entwickle ein eigenes entsprechendes Modul.

Name:

**Build-Optimierer**

## 15.1 Anforderungen

Benutzer kann festlegen:

- Klasse
- Level
- Element
- PvM/PvP
- Mindestens gewünschte AP
- Mindestens gewünschte MP
- Mindestens gewünschte Vitalität
- Gewünschte Reichweite
- Kritische Treffer
- Bestimmte Resistenzen
- Mindestschaden
- Bevorzugte Items
- Ausgeschlossene Items
- Verfügbare Dofus
- Verfügbare Trophäen
- Zugelassene Exomagie
- Budget, sofern verlässliche Preise vorhanden

## 15.2 Optimierungsziele

Ermögliche beispielsweise:

- Maximaler Stärke-Schaden
- Maximaler Feuerschaden
- Maximaler kritischer Schaden
- Ausgewogene Resistenzen
- Hohe Vitalität
- Maximale Heilung
- Maximale Reichweite
- Günstigste bekannte Build-Kombination
- Hybridelement-Build

## 15.3 Berechnung

Verwende einen geeigneten Constraint-Solver beziehungsweise Suchalgorithmus.

Berücksichtige:

- Itemslots
- Level
- Setboni
- Dofus-/Trophäenbedingungen
- Ausrüstungsvoraussetzungen
- Exomagie
- Zielwerte
- Ausschlussregeln

Der Optimierer muss ungültige Ausrüstungskombinationen erkennen.

Zeige mehrere mögliche Ergebnisse mit Bewertungswerten.

Wenn die gewählten Kriterien unmöglich sind, erkläre welche Bedingungen nicht erfüllt werden können.

Der Optimierer darf nicht einfach zufällige Items kombinieren.

## 15.4 Performance

Verhindere, dass umfangreiche Optimierungen die Desktop-Oberfläche blockieren.

Verwende Worker beziehungsweise Backend-Jobs.

Unterstütze:

- Fortschrittsanzeige
- Abbrechen
- Ergebnis speichern
- Ergebnis vergleichen

---

# 16. SETS SPEICHERN UND IMPORTIEREN

Implementiere eine professionelle Buildverwaltung.

## 16.1 Speichern

Jeder Build erhält:

- Build-ID
- Name
- Beschreibung
- Charakter-ID
- Klasse
- Level
- Spielversion
- Ausrüstung
- Individuelle Itemwerte
- Setboni
- Charakterwerte
- Eigenschaftspunkte
- Aktive Buffs
- Gespeicherte Gegnerbedingungen
- Erstellungsdatum
- Änderungsdatum

Die Berechnungsergebnisse sollen bei Bedarf neu generiert werden, nicht als dauerhaft alleinige Datenquelle dienen.

## 16.2 Build-Import und Export

Implementiere ein eigenes versioniertes JSON-Format.

Ermögliche:

- Exportieren
- Importieren
- Duplizieren
- Teilen
- Wiederherstellen

Prüfe bei Importen:

- Datenversion
- Gültige IDs
- Itemtypen
- Slotkompatibilität
- Schema
- Sicherheitsvalidierung

Ein direkter Import von Dofus-Creator-Projekten ist nur dann zu implementieren, wenn ein öffentlich dokumentiertes und zulässig nutzbares Austauschformat verfügbar ist.

Keine unautorisierten privaten Schnittstellen verwenden.

## 16.3 Discord-Verknüpfung

Ein Spieler kann einen Build aus der Desktop-App an Discord senden.

Der Discord-Bot erzeugt ein professionelles Embed mit:

- Charaktername
- Klasse
- Level
- Buildname
- Ausrüstungsübersicht
- Wichtigsten Attributen
- AP/MP
- Elementen
- Link oder Button zum vollständigen Build

Neue Slash-Commands:

`/builder profil`

`/builder sets`

`/builder anzeigen`

`/builder vergleichen`

`/builder teilen`

Verwende nach Möglichkeit die bereits vorhandene Backend-API.

---

# 17. SPIELDATENQUELLEN UND DATENVERSIONEN

Nutze vorrangig die vorhandenen Datenintegrationen.

## Dofusdude

https://docs.dofusdu.de/dofus3/v1/

https://api.dofusdu.de/

Zweck:

- Ausrüstung
- Gegenstandseffekte
- Setdaten
- Itembilder
- Itemanforderungen
- Lokalisierung

## dofus-sqlite

https://github.com/ledouxm/dofus-sqlite

https://github.com/ledouxm/dofus-sqlite/releases

Zweck:

- Spieldaten
- Zauber
- Zauberlevel
- Effekte
- Klassen
- Setdaten
- Gegenstände
- Bilder
- Übersetzungen

Insbesondere:

- `dofus.sqlite`
- `images-item.zip`
- `images-spell.zip`

Verwende für 3.6 einen tatsächlich passenden versionierten Datenstand und für 3.7 einen eigenen aktuellen Datenstand.

## DofusDB

https://api.dofusdb.fr/

Zweck:

Ergänzende Daten und Abgleich, soweit kompatibel.

## Offizielle Klassenübersicht

https://www.dofus.com/en/mmorpg/encyclopedia/classes

Zweck:

Klassendaten und Identitäten.

Die Klassenbilder sollen allerdings vorrangig aus meiner bereitgestellten ZIP-Datei kommen.

## Dofus Creator

https://dofuscreator.com/

Zweck:

Funktionsanalyse und UX-Referenz.

Keine unautorisierte Datenübernahme.

## Back from AFK

https://backfromafk.com/en/updates/3-6/

https://backfromafk.com/en/updates/3-7/

Zweck:

Versionsvergleich und ergänzende Prüfung bekannter Spieländerungen.

---

# 18. DATENBANK ERWEITERN

Analysiere zuerst das vorhandene Schema.

Ergänze, soweit nicht bereits vorhanden, Modelle für:

- builder_projects
- character_builds
- build_equipment
- build_item_instances
- build_characteristics
- build_buffs
- build_target_profiles
- build_comparisons
- build_versions
- character_classes
- class_assets
- spells
- spell_levels
- spell_effects
- spell_variants
- spell_images
- item_effect_definitions
- item_effect_values
- set_bonus_tiers
- equipment_slots
- equipment_restrictions
- data_versions
- import_reports

Passe die Namen der bestehenden Architektur an.

Speichere stabile Identifikatoren und Fremdschlüssel.

Führe Migrationen aus.

**Bestehende Charaktere und Benutzerdaten müssen erhalten bleiben.**

Bestehende Builds dürfen bei zukünftigen Item- und Spell-Updates nicht unbemerkt mit falschen Daten neu berechnet werden.

Implementiere eine versionierte Zuordnung.

---

# 19. PERFORMANCE UND OFFLINE-MODUS

Der Builder muss schnell und flüssig reagieren.

Ziele:

- Schnelle Itemsuche
- Schneller Slotwechsel
- Unmittelbare Neuberechnung normaler Charakterwerte
- Keine überflüssigen API-Abfragen
- Kein kompletter Reload bei Itemwechsel
- Caching
- Virtuelle Listen
- Optimierte Bilder
- Worker für rechenintensive Funktionen

Der Builder soll mit bereits lokal gespeicherten Spieldaten auch offline benutzbar sein.

Lokale Änderungen müssen nach Wiederherstellung der Verbindung synchronisiert werden.

---

# 20. QUALITÄT UND TESTS

Tests sind verpflichtender Bestandteil des Auftrags.

Erstelle Unit-, Integrations- und End-to-End-Tests.

## Testgruppe A – Builder

1. Neuen Build erstellen.
2. Klasse auswählen.
3. Level festlegen.
4. Helm auswählen.
5. Ring hinzufügen.
6. Zweiten Ring hinzufügen.
7. Waffe hinzufügen.
8. Dofus/Trophäe hinzufügen.
9. Unzulässigen Slotwechsel verhindern.
10. Alle Gesamtwerte korrekt berechnen.

## Testgruppe B – Setboni

11. Ein Setteil ausrüsten.
12. Zweites Setteil ausrüsten.
13. Setbonus prüfen.
14. Weiteren Setgegenstand ausrüsten.
15. Setbonus aktualisieren.
16. Setteil entfernen.
17. Bonus korrekt zurückrechnen.

## Testgruppe C – Itemfilter

18. Nur Gegenstände mit AP anzeigen.
19. Nur Gegenstände mit MP anzeigen.
20. Gegenstände mit Stärke und Vitalität suchen.
21. Mindestwerte filtern.
22. Levelbereich filtern.
23. Filter zurücksetzen.
24. Vergleich zwischen Builder und Gegenstandssuche durchführen.

## Testgruppe D – Klassen

25. Klassenbilder-ZIP importieren.
26. Klassenzuordnungen prüfen.
27. Charakter öffnen.
28. Klassenbild prüfen.
29. Charakterklasse im Builder übernehmen.

## Testgruppe E – Sets und Charaktere

30. Build speichern.
31. Charakter zuweisen.
32. Charakter-Sets öffnen.
33. Gespeicherten Build laden.
34. Zweiten Build speichern.
35. Builds vergleichen.
36. Build bearbeiten.
37. Build duplizieren.
38. Persistenz nach Neustart prüfen.

## Testgruppe F – Zauber

39. Alle Klassen aus der Datenbank enumerieren.
40. Zauber jeder Klasse laden.
41. Spell-IDs prüfen.
42. Zauberbilder prüfen.
43. Zauberlevel prüfen.
44. Kritische Effekte prüfen.
45. DOFUS-3.6-Daten prüfen.
46. DOFUS-3.7-Daten prüfen.
47. Keine Vermischung von Versionen zulassen.

## Testgruppe G – Schaden

48. Einfache Elementarschadensberechnung.
49. Kritische Schadensberechnung.
50. Mehrere Schadenslinien.
51. Gegner mit Resistenzen.
52. Buffs aktivieren.
53. Buffs deaktivieren.
54. Item wechseln und Schaden neu berechnen.
55. Zwei Builds unter identischen Bedingungen vergleichen.
56. Komplexe nicht unterstützte Zaubereffekte korrekt kennzeichnen.

Für die Damage Engine müssen überprüfbare Referenzfälle verwendet werden.

Wenn verfügbar, nutze kontrollierte Messungen aus dem Spiel beziehungsweise verifizierte Community-Referenzen.

Tests mit selbst erzeugten Erwartungswerten ersetzen keine unabhängige Validierung der Spielmechanik.

## Testgruppe H – Synchronisierung

57. Build speichern und Discord-Profil öffnen.
58. Build teilen.
59. Build über Desktop laden.
60. Änderung synchronisieren.
61. Offline-Änderung durchführen.
62. Wiederverbindung testen.

## Testgruppe I – Windows-Update

63. Anwendung bauen.
64. Windows-Installer erstellen.
65. Existierende Charakterdaten erhalten.
66. Bestehende Setdaten erhalten.
67. Update über vorhandenen Updater prüfen.
68. Signaturprüfung testen.
69. Installer testen, während der alte Backend-Dienst noch vorhanden ist.
70. Bestehenden Dateisperrfehler beim Upgrade verhindern.

---

# 21. UPDATE-SYSTEM UND RELEASE

Das bestehende Projekt verfügt bereits über eine Update-Funktion.

Diese soll weiterhin genutzt werden.

Untersuche den aktuellen Zustand der Update-Infrastruktur.

Berücksichtige insbesondere den früher aufgetretenen Fehler, bei dem ein laufender Node.js-Backendprozess den Austausch von `node.exe` blockiert hat.

Vor einem Update müssen zugehörige Dienste kontrolliert beendet werden.

Erhalte bestehende Benutzerdaten.

Erstelle einen neuen Release-Build.

Falls der Tauri-Updater korrekt konfiguriert ist und alle erforderlichen Signaturschlüssel und Veröffentlichungsrechte vorliegen, veröffentliche das neue Update über den bestehenden Release-Kanal.

Verwende keine ungesicherten oder unsignierten automatischen Updates.

Wenn eine einmalige manuelle Installation notwendig ist, dokumentiere dies.

---

# 22. DEFINITION OF DONE

Das Update ist erst fertig, wenn:

- Ein neuer Reiter „Builder“ vorhanden ist.
- Der Builder tatsächlich Gegenstände aus der Datenbank lädt.
- Sämtliche gültigen Ausrüstungsslots unterstützt werden.
- Items über Suche ausgewählt werden können.
- Die Itemfilter funktionieren.
- Dieselben Effektfilter auch unter „Gegenstände“ vorhanden sind.
- Alle verfügbaren Setboni korrekt verarbeitet werden.
- Charakterwerte dynamisch berechnet werden.
- Klassenbilder aus der ZIP-Datei eingebunden sind, sofern diese bereitliegt.
- Charaktere mehrere Builds speichern können.
- Der Button „Sets“ in der Charakterverwaltung funktioniert.
- Gespeicherte Sets nach Neustart erhalten bleiben.
- Der Zauberkatalog der unterstützten Klassen und Versionen importiert ist.
- Korrekte Spell-Icons angezeigt werden.
- Eine Schadensvorschau vorhanden ist.
- Normale und kritische Schadenswerte berechnet werden, soweit die Mechanik verifiziert unterstützt wird.
- Waffen und Gegnerbedingungen berücksichtigt werden.
- Builds verglichen werden können.
- Der Build-Optimierer tatsächlich gültige Ausrüstungskombinationen sucht.
- Der Discord-Bot die gespeicherten Sets anzeigen kann.
- Bestehende Funktionen nicht beschädigt werden.
- Alle relevanten Tests durchgeführt und dokumentiert wurden.
- Der Windows-Release-Build erfolgreich erstellt wurde.
- Das Update über die vorhandene Infrastruktur bereitgestellt werden kann, sofern die notwendigen technischen Voraussetzungen und Berechtigungen vorhanden sind.

Erstelle einen vollständigen Testbericht.

Dokumentiere klar, welche komplexen Schadensmechaniken noch nicht exakt unterstützt werden, anstatt unzutreffende Ergebnisse anzuzeigen.

---

# 23. AUTONOME IMPLEMENTIERUNG

Arbeite möglichst eigenständig.

Reihenfolge:

**Phase 1:** Vorhandenes Repository und Dofus Creator analysieren.

**Phase 2:** Datenmodelle und versionierte Spell-Datenbank entwickeln.

**Phase 3:** Alle relevanten Itemeffekte normalisieren und Filter implementieren.

**Phase 4:** Builder-Oberfläche erstellen.

**Phase 5:** Equipment Engine und Setbonusberechnung implementieren.

**Phase 6:** Klassenbilder integrieren und Charakterverwaltung erweitern.

**Phase 7:** Zauber und Schadenssimulator implementieren.

**Phase 8:** Builds, Vergleiche und Optimierer entwickeln.

**Phase 9:** Desktop und Discord synchronisieren.

**Phase 10:** Tests, Fehlerbehebung und Release durchführen.

Behalte den Implementierungsstand über mehrere Arbeitssitzungen nachvollziehbar bei.

Lege bei Bedarf folgende Dateien an:

- `BUILDER_ARCHITECTURE.md`
- `BUILDER_IMPLEMENTATION_STATUS.md`
- `SPELL_DATA_SOURCES.md`
- `DAMAGE_ENGINE_SPEC.md`
- `BUILDER_TEST_REPORT.md`
- `CHANGELOG.md`

Verlasse dich nicht auf bloße UI-Screenshots als Beweis für eine funktionierende Implementierung.

Verwende tatsächliche Datensätze, Datenbanktests, Rechnungsprüfungen und Integrationstests.

Bei längeren Aufgaben sichere Zwischenstände und arbeite an weiteren unabhängigen Modulen weiter, sofern die Umgebung das erlaubt.

---

# ABSCHLIESSENDE ANWEISUNG

**Beginne jetzt mit der Analyse des bestehenden Projekts und der Dofus-Creator-Referenz.**

Entwickle anschließend einen vollständigen eigenständigen DOFUS-Set-Builder innerhalb unserer bestehenden Anwendung.

Ziel ist nicht nur ein visuell ähnlicher Builder, sondern ein funktional umfangreicheres System mit zuverlässiger Datenbasis, dynamischer Berechnung, Charakter-Synchronisierung, Discord-Anbindung und professioneller Bedienung.

Setze alle technisch und rechtlich realisierbaren Funktionen so vollständig wie möglich um.

Achte besonders auf:

1. Vollständige Itemdaten
2. Korrekte Filter
3. Richtige Setboni
4. Echte Klassendaten
5. Versionierte Zauberdaten
6. Verifizierbare Schadensberechnungen
7. Speicherung mehrerer Builds pro Charakter
8. Professionelles UI
9. Funktionierende Tests
10. Sicheren Update-Prozess

**Erstelle keine reine Konzeptantwort. Implementiere den Code, teste die Funktionen, behebe Fehler und bereite die neue Version zum Installieren vor.**
