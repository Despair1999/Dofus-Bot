# CODEX MASTERPROMPT — DOFUS COMPANION

## ROLLE UND ARBEITSAUFTRAG

Du bist ein autonom arbeitendes Senior-Softwareentwicklungsteam, bestehend aus:

- Lead Software Architect
- Senior TypeScript/Node.js Developer
- Senior Rust/Tauri Developer
- Senior React/Frontend Developer
- Discord-Bot-Spezialist
- API-Integration Engineer
- Database Engineer
- Computer-Vision/OCR Engineer
- UI/UX Designer
- Quality Assurance Engineer
- DevOps/Release Engineer
- Security Engineer

Deine Aufgabe besteht darin, eine vollständige, professionelle und möglichst umfangreiche DOFUS-3-Companion-Plattform zu entwickeln.

**Projektname (Arbeitstitel): DOFUS Companion**

Das Projekt besteht aus:

1. Einer vollständig funktionsfähigen Windows-Desktop-Anwendung (.exe) mit grafischer Benutzeroberfläche, Overlay, OCR-Erkennung, Hotkeys und zahlreichen DOFUS-Hilfsfunktionen.
2. Einem umfangreichen, modernen Discord-Bot mit interaktiven Embeds, Buttons, Auswahlmenüs, Modals, Charakterverwaltung und automatischen Benachrichtigungen.
3. Einem zentralen Backend, das alle Spielinformationen und Funktionen bereitstellt.
4. Einer Datenbank für Benutzer, Charaktere, Quests, Fortschritte, Gilden und weitere Funktionen.
5. Einer Verbindung zwischen Desktop-Anwendung und Discord-Bot, sodass Daten und Einstellungen synchronisiert werden.
6. Einer professionellen Update-, Test-, Diagnose- und Installationsinfrastruktur.

**WICHTIG: Ich erwarte eine tatsächliche Implementierung.**

Erstelle nicht nur ein Konzept, Design oder einige Beispieldateien. Entwickle das Projekt vollständig im vorhandenen Workspace.

Arbeite weitestgehend autonom. Triff sinnvolle technische Entscheidungen ohne unnötige Rückfragen. Führe nach Möglichkeit alle Installationen, Implementierungen, Tests und Fehlerbehebungen selbst aus.

Unterbrich die Entwicklung nur, wenn zwingend Benutzerberechtigungen, nicht vorhandene Zugangsdaten, rechtliche Genehmigungen oder nicht zugängliche externe Infrastruktur benötigt werden.

Wenn ein bestimmtes Feature nicht vollständig umsetzbar ist, verwende einen funktionierenden alternativen Ansatz. Täusche niemals vorhandene Integrationen, erfolgreiche Tests oder nicht verfügbare Live-Spieldaten vor.

Setze höchste Priorität auf:

- Funktionalität und Verlässlichkeit
- Einen professionellen, modernen UI/UX-Standard
- Umfangreiche und tatsächlich hilfreiche Spielerfunktionen
- Hohe Performance und niedrigen Ressourcenverbrauch
- Gute Fehlerbehandlung
- Sichere, nachvollziehbare Automatisierung
- Hohe Codequalität
- Erweiterbarkeit und Wartbarkeit
- Deutsche Lokalisierung
- Automatische, sichere Datenaktualisierung
- Möglichst wenig manuelle Konfiguration

---

# 1. TECHNISCHE GRUNDARCHITEKTUR

Verwende vorzugsweise folgende Technologien, sofern deine technische Prüfung keine bessere Lösung ergibt.

## Desktop-Anwendung

- Tauri 2
- Rust für native Windows-Integrationen
- React
- TypeScript
- Vite
- Tailwind CSS
- Eine moderne, barrierearme Komponentenbibliothek wie shadcn/ui
- Lucide Icons
- TanStack Query
- Zustand oder vergleichbare State-Verwaltung
- SQLite für lokalen Cache, Einstellungen und Offline-Daten
- Windows Graphics Capture für freigegebene Bildschirmbereiche
- Windows OCR oder eine geeignete lokale OCR-Engine
- Sichere native Windows-Hotkey-Registrierung
- WebSocket oder vergleichbare Echtzeitkommunikation

Zielplattform: Windows 10 und Windows 11, x64.

Die Anwendung soll als installierbare EXE sowie möglichst als portable Version ausgeliefert werden.

## Discord-Bot

- Node.js in einer aktuellen unterstützten LTS-Version
- TypeScript
- discord.js in einer aktuellen stabilen Version
- Slash-Commands
- Buttons und Select-Menüs
- Modal-Dialoge
- Autocomplete
- Rich Embeds
- Persistente Komponenten
- Scheduled Jobs
- Rollenbasierte Berechtigungen

## Backend

- TypeScript
- Fastify oder eine vergleichbare performante Backend-Lösung
- REST-API
- WebSocket für Echtzeit-Synchronisierung
- PostgreSQL
- Prisma oder Drizzle ORM
- Redis optional für Cache, Queue und Rate-Limiting
- Zod für Validierung
- OpenAPI für die eigene API-Dokumentation
- Strukturierte Logs
- Health-Checks
- API-Adapter und Fallbacks

## Monorepo

Verwende pnpm Workspaces mit sauber geteilten Modulen.

Beispielstruktur:

    dofus-companion/
      apps/
        desktop/
        discord-bot/
        backend/
        web-dashboard/
      packages/
        shared/
        ui/
        database/
        game-data/
        api-clients/
        quest-engine/
        ocr-engine/
        integrations/
        calculators/
        localization/
      infrastructure/
        docker/
        scripts/
        ci/
      tests/
        integration/
        e2e/
        fixtures/
      docs/
      README.md

Passe die Struktur an, wenn dies technisch sinnvoller ist.

**Architekturvorgabe:** Keine doppelte Implementierung von Spiellogik. Discord und Desktop verwenden dieselben Backend-Services, Datenmodelle und Rechenfunktionen.

---

# 2. EXTERNE DOFUS-DATENQUELLEN

Integriere möglichst viele stabile und sinnvoll nutzbare Datenquellen.

## 2.1 Dofusdude API

Dokumentation:

https://docs.dofusdu.de/dofus3/v1/

API:

https://api.dofusdu.de/

OpenAPI:

https://raw.githubusercontent.com/dofusdude/api-docs/main/openapi-3.0.yaml

Verwende diese API als primäre Quelle für:

- Gegenstände
- Ausrüstung
- Ressourcen
- Verbrauchsgegenstände
- Questgegenstände
- Sets
- Setboni
- Gegenstandseffekte
- Gegenstandsanforderungen
- Item-Bilder
- Crafting-Rezepte
- Reittiere
- Almanax
- Spielversionsinformationen
- Gegenstandssuche
- Filter und Metadaten

Verwende nach Möglichkeit das dokumentierte TypeScript-SDK oder generiere einen typisierten Client aus der aktuellen OpenAPI-Spezifikation.

Prüfe jede verwendete Route anhand der tatsächlich verfügbaren Dokumentation.

## 2.2 DofusDB

https://api.dofusdb.fr/

Nutze DofusDB ergänzend für verfügbare Datensätze, insbesondere:

- Monster
- Bosse
- Monster-Eigenschaften
- Monsterbilder
- Zauber
- Karten
- Dungeons
- Ressourcen
- Drops
- NPCs
- Spielobjekte

Untersuche die tatsächlich vorhandenen Routen, Rückgabeformate und die Kompatibilität mit der aktuellen DOFUS-Version.

Erstelle keinen Code auf Basis ungeprüfter Endpunkte.

## 2.3 dofus-sqlite

https://github.com/ledouxm/dofus-sqlite

Diese Datenbank ist besonders wichtig.

Integriere die aktuell geeigneten Releases und unterstütze:

- Quests
- Questschritte
- Questziele
- Questvoraussetzungen
- Questbelohnungen
- Erfolge
- Erfolgsziele
- Monster
- Items
- Zauber
- NPCs
- Kartenpositionen
- Gebiete
- Mehrsprachige Textdaten
- Zusammenhänge zwischen Spielobjekten

Untersuche das reale Datenbankschema.

Entwickle einen Importprozess, der Datensätze in ein normalisiertes eigenes Datenmodell überführt.

Baue einen Versionsvergleich, damit Änderungen an Quests, Zaubern oder Gegenständen nach Spielupdates erkannt werden.

## 2.4 Dofus Batteries Included

https://github.com/Dofus-Batteries-Included/DBI.Api

https://api.dofusbatteriesincluded.fr/

Integriere die dokumentierten Funktionen für:

- Kartenpositionen
- Map-IDs
- Navigationsknoten
- Wege zwischen Karten
- Weltzonen
- Schatzsuchen
- Schatzsuche-Hinweise
- Bestimmung des nächsten Schatzsuche-Ziels

Entwickle darauf aufbauend eine eigene Navigation mit grafischer Darstellung.

## 2.5 DOFUS Pour les Noobs

https://www.dofuspourlesnoobs.com/

Diese Website ist eine wichtige Quelle für Questguides und Lösungswege.

Ziel ist eine benutzerfreundliche deutschsprachige Quest-Hilfe, die verfügbare strukturierte Spieldaten mit passenden Quellenlinks und, soweit rechtlich zulässig, externen Guide-Inhalten verbindet.

**Rechtliche Voraussetzung:**

Die Website untersagt die unerlaubte Reproduktion, Bearbeitung und Weiterverbreitung ihrer Inhalte.

Deshalb gilt:

1. Prüfe veröffentlichte Nutzungsbedingungen und eventuell vorhandene offizielle Schnittstellen.
2. Implementiere ohne Lizenz zunächst eine Quest-Guide-Suche mit Verlinkung auf die Originalartikel.
3. Erstelle eigene deutschsprachige Questanweisungen auf Grundlage geeigneter, zulässig verwendbarer strukturierter Spieldaten.
4. Implementiere einen optionalen Guide-Import- und Übersetzungsadapter, der nur nach dokumentierter Erlaubnis aktiviert werden kann.
5. Speichere und veröffentliche keine unautorisierten vollständigen Artikel, Übersetzungen oder Bilder.
6. Verwende kein aggressives Scraping und umgehe keine Zugangsbeschränkungen.
7. Stelle im Guide immer die Originalquelle bereit.
8. Wenn eine erlaubte Übersetzungsintegration aktiviert wird, übersetze Quests zuverlässig vom Französischen ins Deutsche und erhalte Koordinaten, NPC-Namen, Mengen und die Reihenfolge der Schritte.
9. Ermögliche das Öffnen des Originalartikels im Standardbrowser.

Der Guide-Adapter muss so entworfen werden, dass eine später erteilte Lizenz keine Neuentwicklung der Quest-Engine erfordert.

## 2.6 Weitere Quellen

Untersuche ergänzend:

https://www.frigost.dev/API/Dofus%203.0/Data/

https://dofusfashionista.gg/

https://github.com/dofusdude/ankama-discord-hooks

Weitere öffentliche Datenquellen dürfen ergänzt werden, sofern sie technisch brauchbar und rechtlich zulässig sind.

Für jede Quelle dokumentiere:

- Name
- URL
- Verwendungszweck
- API-Version
- Unterstützte DOFUS-Version
- Unterstützte Sprachen
- Authentifizierungsbedarf
- Rate-Limits
- Lizenzbedingungen
- Zuletzt erfolgreich getesteter Zugriff
- Datenqualität
- Fallback-Strategie

## 2.7 Einheitliche Datenverarbeitung

Alle APIs müssen über ein Adapter-System angesprochen werden.

Implementiere:

- Einheitliche Datenmodelle
- Zentrale ID-Zuordnung
- Französische und deutsche Namens-Aliase
- Fuzzy Search
- Deduplizierung
- Cache
- Retry mit Exponential Backoff
- Rate-Limit-Beachtung
- Timeouts
- Circuit Breaker
- Fehlerprotokollierung
- Monitoring
- Versionsprüfung
- Fallback bei API-Ausfällen

Unterschiedliche Quellen können widersprüchliche Informationen enthalten.

Deshalb müssen wichtige Datensätze Quelle, Datenversion und Aktualisierungszeitpunkt speichern.

---

# 3. WINDOWS-DESKTOP-ANWENDUNG

Die Desktop-App ist das Herzstück des Projekts.

Sie soll sich wie ein moderner DOFUS-Spielassistent anfühlen und neben dem Spiel laufen.

Die Bedienidee soll an klassische Keybinder und AutoHotkey-Hilfsprogramme erinnern, aber mit einem erheblich moderneren Interface.

## 3.1 Design

Erstelle ein eigenständiges hochwertiges UI.

Designanforderungen:

- Dark Mode als Standard
- Helle Variante optional
- Dunkles Anthrazit als Hintergrund
- Dezente DOFUS-inspirierte Akzentfarben
- Abgerundete Panels
- Modernes Sidebar-Menü
- Große, klar erkennbare Suchfunktion
- Kartenansichten
- Fortschrittsanzeigen
- Tabs
- Interaktive Tooltips
- Kontextmenüs
- Virtuelle Listen
- Tastaturnavigation
- Flüssige, zurückhaltende Animationen
- Skeleton Loading States
- Individuell konfigurierbare Hotkeys
- Responsives Layout
- Unterstützung mehrerer Monitore und unterschiedlicher DPI-Skalierungen

Die App muss auf großen Ultrawide-Monitoren genauso gut funktionieren wie auf kleinen Notebook-Bildschirmen.

Entwickle mindestens vier Ansichtsmodi:

### A. Dashboard

Das Hauptfenster zeigt:

- Aktiven Charakter
- Level
- Klasse
- Server
- Aktuelle Quest
- Nächstes Questziel
- Aktuelle Kartenkoordinaten, sofern erfasst
- Almanax
- Persönliche Aufgaben
- Letzte Suchanfragen
- Angeheftete Guides
- Schnellzugriffe
- Letzte Synchronisierung
- API-Status

### B. Compact Mode

Kleine Seitenleiste mit:

- Aktueller Quest
- Nächstem Schritt
- Zielkoordinaten
- Benötigten Materialien
- Quick-Search
- Nützlichen Buttons

### C. Overlay Mode

Transparenter, optional immer im Vordergrund befindlicher Bereich.

Funktionen:

- Einstellbare Transparenz
- Frei verschiebbar
- Skalierbar
- Fixierbare Position
- Ein- und ausblendbar
- Optionales Click-through
- Kein Eingriff in den Spielprozess
- Kein In-Game-Rendering-Hook
- Keine DLL-Injektion

### D. Mini-Hotbar

Eine kleine Symbolleiste mit frei definierbaren Aktionen wie:

- Quest erkennen
- Item erkennen
- Schatzsuche öffnen
- Koordinaten kopieren
- Gegenstand suchen
- Rechner öffnen
- Letzten Guide anzeigen

---

# 4. INTELLIGENTE QUEST-ERKENNUNG

Dies ist eines der wichtigsten Features.

Das System soll dem Spieler möglichst zuverlässig bei der aktuellen Quest helfen.

## 4.1 Quest-Datenmodell

Erstelle eine vollständige eigene Quest-Engine.

Datenfelder:

- Quest-ID
- Questname Deutsch
- Questname Französisch
- Weitere Aliase
- Questlevel
- Voraussetzungen
- Questkette
- Questschritte
- Questziele
- NPCs
- Koordinaten
- Materialien
- Monster
- Dungeon-Voraussetzungen
- Belohnungen
- Zugehörige Erfolge
- Zugehörige Dofus-Questreihe
- Guide-Links
- Datenquelle
- Spielversion

Jeder Schritt soll möglichst strukturiert sein.

Beispiel:

    Quest
      Schritt 1
        Ziel: Mit NPC sprechen
        NPC: ...
        Position: ...
        Erforderliche Items: ...
        Hinweise: ...

      Schritt 2
        Ziel: Gegenstand beschaffen
        Gegenstand-ID: ...
        Menge: ...
        Fundort: ...

      Schritt 3
        Ziel: Kampf abschließen
        Gegner: ...
        Schwierigkeit: ...

Verwende ausschließlich tatsächlich verfügbare Daten. Fehlende Angaben dürfen nicht erfunden werden.

## 4.2 Automatische Erkennung des Questjournals

Entwickle eine optionale, ausdrücklich freizugebende Bildschirmanalyse.

Vorgehensweise:

1. Nutzer gibt das DOFUS-Fenster beziehungsweise den relevanten Bereich frei.
2. Die App erfasst den sichtbaren Bildschirmbereich.
3. OCR erkennt den Text des Questjournals.
4. Der Text wird normalisiert.
5. Das System sucht passende Quests.
6. Die Quest wird mit ihrer stabilen ID verknüpft.
7. Sichtbare Questziele werden mit bekannten Schritten abgeglichen.
8. Der wahrscheinlich aktuelle Schritt wird ermittelt.
9. Bei eindeutiger Zuordnung werden passende Hilfen angeboten.
10. Unsichere oder widersprüchliche Ergebnisse verlangen Bestätigung.

Unterstütze Deutsch und Französisch.

Erkenne nach Möglichkeit:

- Questname
- Aktive Ziele
- Erledigte Ziele
- Noch offene Ziele
- Sichtbare Zielkoordinaten
- NPC-Namen
- Gegenstandsnamen
- Mengenangaben

Setze eine nachvollziehbare Konfidenzbewertung ein.

Automatischer Vorschlag nur bei ausreichend hoher Sicherheit.

Die App muss klar unterscheiden zwischen:

- Aus dem Screenshot erkannt
- Vom Nutzer bestätigt
- Manuell erfasst
- Aus Spieldaten abgeleitet

Eine öffentliche API, die den Live-Queststatus des Spielers liefert, darf nicht vorausgesetzt oder simuliert werden.

Wenn eine offiziell autorisierte Schnittstelle für diesen Status verfügbar wird, kann sie später ergänzt werden.

## 4.3 Quest-Assistent

Sobald eine Quest identifiziert wurde, soll die App anzeigen:

**Aktuelle Quest**

Name und Questkette.

**Dein aktueller Schritt**

Eine verständliche deutsche Handlungsanweisung.

**Was musst du tun?**

Kompakte Schritt-für-Schritt-Hilfe.

**Wohin musst du?**

Koordinaten und Kartennavigation.

**Was brauchst du?**

Gegenstände und Mengen.

**Tipps**

Eigene hilfreiche Hinweise aus verifizierten Daten.

**Guide**

Link zum passenden Originalartikel.

**Navigation**

Button zum Routenplaner.

**Fortschritt**

Schritt als erledigt markieren oder neue Bildschirmaufnahme durchführen.

Implementiere außerdem:

- Vorheriger Schritt
- Nächster Schritt
- Gesamte Quest anzeigen
- Quest pausieren
- Quest wieder aufnehmen
- Quest als abgeschlossen markieren
- Questreihe anzeigen
- Materialien sammeln
- Weg berechnen
- Hilfe bei schwierigen Zielen
- Questgruppe suchen
- Fortschritt mit Discord synchronisieren

## 4.4 Erkennung von Questabschluss

Wenn die OCR einen veränderten Queststatus erkennt:

- Vergleiche den alten und neuen Zustand.
- Erkenne möglicherweise abgeschlossene Ziele.
- Aktualisiere nicht blind den Fortschritt.
- Fordere bei uneindeutigen Änderungen eine Bestätigung an.
- Zeige die nächste passende Hilfestellung.

Eine automatische Hintergrundanalyse darf nur bei aktivierter Freigabe laufen.

Sie soll möglichst ressourcenschonend und lokal erfolgen.

---

# 5. ITEM-SCANNER UND MARKTPLATZ-ASSISTENT

Das zweite Hauptfeature ist die schnelle Gegenstandsinteraktion.

## 5.1 Gegenstände erkennen

Implementiere mehrere Methoden:

1. Item über die Suchleiste finden.
2. Itemname aus der Zwischenablage lesen, wenn vom Nutzer angefordert.
3. Item über eine manuell ausgelöste Bildschirmaufnahme erkennen.
4. Sichtbaren Item-Tooltip per OCR analysieren.
5. Item anhand von Namen, Level, Typ und Werten identifizieren.
6. Nach visueller Erkennung passende Ergebnisse vorschlagen.

Erkenne, soweit möglich:

- Gegenstandsname
- Item-Level
- Typ
- Seltenheit
- Werte
- Effekte
- Anforderungen
- Rezept
- Bestandteile eines Sets

## 5.2 Item-Detailfenster

Zeige:

- Itembild
- Deutscher Name
- Originalname
- Level
- Typ
- Werte
- Effekte
- Ausrüstungsanforderungen
- Setboni
- Crafting-Rezept
- Verwendungszweck
- Vergleichbare Gegenstände
- Mögliche Bezugsquellen
- Gespeicherte Marktpreise
- Preis-Historie
- Weitere Informationen

Buttons:

- Suchen
- Vergleichen
- Rezept anzeigen
- Materialliste erstellen
- Zum Build hinzufügen
- Zu Favoriten hinzufügen
- Preis eintragen
- Marktplatzsuche vorbereiten
- Namen kopieren

## 5.3 Marktplatz-Hilfe

Das gewünschte Prinzip ist:

**Item auswählen → sofort eine passende Suchaktion vorbereiten.**

Implementiere dafür:

- Exakte Itemnamen kopieren
- Suchbegriff für den In-Game-Marktplatz vorbereiten
- Passende externe Marktplatzseiten öffnen, sofern technisch verfügbar
- Preisvergleich mit vorhandenen Community-Daten
- Preis-Historie speichern
- Kaufpreis gegen Crafting-Kosten vergleichen

Die Desktop-App darf dabei keine automatisierten Klicks, Tastatureingaben oder Transaktionen im Spielclient durchführen.

Die finale Suche, ein Kauf oder ein Verkauf im Spiel bleibt beim Spieler.

Falls später ein offiziell autorisierter Marktplatz-Endpunkt existiert, soll er über den Adapter integriert werden können.

## 5.4 Erweiterte Funktionen

- Itemvergleich
- Setvergleich
- Itemfilter
- Build-Kompatibilität
- Materialien berechnen
- Mengenrechner
- Wunschliste
- Gespeicherte Gegenstände
- Preisalarme auf Grundlage tatsächlich aktualisierter Preisdaten
- Gewinnrechner
- Crafting-Alternativen

---

# 6. SCHATZSUCHE-ASSISTENT

Entwickle einen umfangreichen Schatzsuche-Solver.

Nutze die DBI-Schnittstellen.

Funktionen:

- Ausgangsposition eingeben
- Ausgangsposition optional aus freigegebenem Screenshot erkennen
- Richtung auswählen
- Hinweis erkennen
- Hinweis über Suchfeld auswählen
- Nächste Kartenposition berechnen
- Zielkoordinaten anzeigen
- Weg zum Ziel anzeigen
- Schritte auf einer Karte visualisieren
- Verlauf der aktuellen Schatzsuche speichern
- Zwischen mehreren Schatzsuchen wechseln
- Falsche Hinweise korrigieren
- Alternative Kartenpositionen anzeigen
- Fehler der Datenquelle melden

Die App soll nicht selbst durch Karten navigieren oder auf Spielobjekte klicken.

Die Berechnung erfolgt extern. Die eigentlichen Bewegungen übernimmt der Spieler.

---

# 7. KARTEN- UND NAVIGATIONSSYSTEM

Implementiere:

- Weltkarte
- Kartenkoordinaten
- Orts- und Gebietssuche
- Navigationsziele
- Routenplanung
- Mehrere Wegpunkte
- Favorisierte Positionen
- Questziele auf der Karte
- Dungeon-Eingänge
- NPC-Positionen
- Bekannte Ressourcenstandorte
- Schatzsuche-Ziele
- Routing-Historie

Besonders wichtig:

**Questnavigation**

Wenn ein Questziel eine bekannte Position besitzt, soll ein Klick auf „Navigation“ direkt die Route dorthin vorbereiten.

Berücksichtige verschiedene Weltbereiche, Ebenen und Karten-IDs mit identischen Koordinaten.

Wenn Kartendaten fehlen, darf keine erfundene Route angezeigt werden.

---

# 8. QUESTKETTEN- UND DOFUS-PLANER

Erstelle einen Questplaner für lange Questserien.

Funktionen:

- Alle bekannten Questketten durchsuchen
- Dofus-Questreihen anzeigen
- Voraussetzungen berechnen
- Noch fehlende Vorquests bestimmen
- Persönlichen Fortschritt speichern
- Schritte abhaken
- Materialbedarf sammeln
- Zugehörige Dungeons anzeigen
- Nächsten freigeschalteten Questschritt finden
- Questfortschritt als visuelle Fortschrittsleiste darstellen
- Questziele priorisieren
- Gemeinsame Schritte mehrerer Questketten erkennen
- Questfortschritt mit Discord synchronisieren

Bei Questabhängigkeiten verwende einen gerichteten Graphen mit Zyklenerkennung und nachvollziehbaren Abhängigkeiten.

---

# 9. CRAFTING-, BERUFS- UND KAMAS-WERKZEUGE

Erstelle einen umfassenden Wirtschaftsassistenten.

## Crafting

- Rezeptsuche
- Materialauflistung
- Mengenberechnung
- Mehrere Rezepte kombinieren
- Gemeinsame Materialien zusammenfassen
- Materialbestand hinterlegen
- Fehlende Materialien berechnen
- Einkaufsliste
- Crafting-Kosten
- Verkaufserlös
- Geschätzter Gewinn
- Gewinnmarge
- Vergleich Crafting/Kaufen
- Favorisierte Rezepte
- Crafting-Projekte speichern

## Berufe

- Alle verfügbaren Berufe
- Berufsstufen
- Rezepte nach Level
- Rezepte nach Beruf
- Geplante Crafting-Projekte
- Berufs-Levelziele
- Materialbedarfsplanung
- Mitglieder mit passenden Berufen finden

## Wirtschaft

- Kamas-Rechner
- Gewinnkalkulation
- Preisverwaltung pro Server
- Import und Export von Preisdaten
- Preis-Historie
- Materialwert-Rechner
- Farmwert-Schätzungen
- Optionale Community-Preisdatenbank

Wichtig:

Ohne echte aktuelle Marktpreise darf das System keine angeblich aktuellen Marktwerte erfinden.

Zeige immer:

- Server
- Datenquelle
- Zeitstempel
- Datenalter
- Schätzungsstatus

---

# 10. BUILDS, AUSRÜSTUNG UND KAMPFRECHNER

Implementiere einen professionellen Ausrüstungsassistenten.

## Build-Manager

- Charakterklasse auswählen
- Charakterlevel auswählen
- PvM/PvP auswählen
- Element auswählen
- Gewünschte AP/MP/Reichweite einstellen
- Items nach Kategorie auswählen
- Setboni berechnen
- Gesamtwerte berechnen
- Anforderungen prüfen
- Konflikte erkennen
- Builds speichern
- Builds vergleichen
- Builds exportieren
- Builds in Discord teilen

## Build-Suche

- Öffentliche Builds durchsuchen, soweit die Quelle dies erlaubt
- Buildvorschläge nach Kriterien
- Alternative Items finden
- Unterschiede darstellen
- Preisabhängige Alternativen vorschlagen
- Verfügbare Datensätze sinnvoll gewichten

## Kampf- und Schadensrechner

Berechne, soweit die tatsächlichen DOFUS-Mechaniken korrekt modelliert werden können:

- Grundschaden
- Elementare Boni
- Kritische Treffer
- Resistenz
- Feste Schadensreduktion
- Erwarteten Schaden
- Verschiedene Ausrüstungsvarianten

Berücksichtige Spielversionen und dokumentiere die verwendeten Formeln.

Erfinde keine mathematischen Spielmechaniken.

---

# 11. MONSTER-, BOSS- UND DUNGEON-ASSISTENT

Implementiere:

- Monstersuche
- Monsterlevel
- Lebenspunkte
- Resistenzübersicht
- Monsterzauber
- Drop-Informationen
- Bekannte Fundorte
- Bossinformationen
- Dungeondaten
- Dungeon-Voraussetzungen
- Dungeon-Schlüssel
- Zugehörige Erfolge
- Dungeon-Routen
- Gruppenanforderungen
- Boss-Guide-Links
- Eigene Strategienotizen

Die Desktop-App soll für schwierige Kämpfe einen kompakten Boss-Assistenten besitzen.

Er soll verfügbare und verifizierte Mechaniken erklären.

Wenn keine verifizierte Strategie vorliegt, zeige die verfügbaren Monsterinformationen und verlinke auf externe Guides.

---

# 12. ALMANAX UND BENACHRICHTIGUNGEN

Implementiere:

- Almanax heute
- Almanax morgen
- Wochenübersicht
- Monatsübersicht
- Bonusfilter
- Suche nach zukünftigen Boni
- Opfergaben anzeigen
- Materialplanung
- Persönliche Erinnerungen
- Discord-Benachrichtigungen
- Desktop-Benachrichtigungen

Benachrichtigungen sollen individuell konfigurierbar sein.

Verhindere doppelte Nachrichten.

---

# 13. PERSÖNLICHE CHARAKTERPROFILE

Jeder Benutzer kann mehrere Charaktere verwalten.

Datenmodell:

- Benutzer-ID
- Discord-ID
- Charakter-ID innerhalb unserer Anwendung
- Charaktername
- Server
- Klasse
- Level
- Elemente
- Berufe
- Berufslevel
- Favorisierter Build
- Aktive Quest
- Questfortschritt
- Erfolge
- Ziele
- Persönliche Notizen
- Favoriten
- Einstellungen

Ermögliche:

- Charakter erstellen
- Charakter bearbeiten
- Charakter löschen
- Mehrere Charaktere verwalten
- Aktiven Charakter festlegen
- Charaktere mit Discord verknüpfen
- Lokalen Fortschritt synchronisieren
- Private und öffentliche Profilfelder festlegen

Niemals Ankama-Passwörter abfragen.

Ohne offizielle Schnittstelle ist eine eigenständige Charakterregistrierung erforderlich.

---

# 14. DISCORD-BOT – PROFESSIONELLES INTERFACE

Der Discord-Bot soll eine der hochwertigsten Komponenten der Plattform sein.

Erstelle kein simples Textbot-System.

Nutze moderne Discord-Interaktionen und hochwertige Embeds.

## 14.1 Designsystem

Definiere:

- Einheitliche Farben
- Einheitliche Embed-Strukturen
- Wiedererkennbare Icons
- Konsistente Footer
- Klare Abschnittsüberschriften
- Bilder und Thumbnails bei zulässiger Verfügbarkeit
- Fortschrittsanzeigen
- Statusindikatoren
- Seitennavigation
- Interaktive Buttons
- Select-Menüs
- Modals
- Autocomplete
- Ephemeral Responses für private Daten
- Aussagekräftige Fehlermeldungen

Der Bot soll professionell, aufgeräumt und einfach bedienbar wirken.

## 14.2 Interaktives Hauptmenü

Implementiere `/dofus` als zentrales Hauptmenü.

Dieses Menü soll eine Übersicht bieten mit:

- Charakter
- Quests
- Items
- Builds
- Crafting
- Dungeon
- Schatzsuche
- Almanax
- Gilde
- Einstellungen

Jeder Bereich soll über Buttons oder Auswahlmenüs erreichbar sein.

Private Benutzeraktionen sollen nach Möglichkeit als Ephemeral Responses erscheinen.

Serverweite Panels sollen persistent funktionieren.

## 14.3 Slash-Commands

Implementiere mindestens folgende Command-Gruppen.

### Charaktere

- `/charakter registrieren`
- `/charakter profil`
- `/charakter bearbeiten`
- `/charakter wechseln`
- `/charakter löschen`
- `/charakter fortschritt`
- `/charakter build`

### Quest

- `/quest suchen`
- `/quest info`
- `/quest starten`
- `/quest fortschritt`
- `/quest schritt`
- `/quest voraussetzungen`
- `/quest materialien`
- `/quest navigation`
- `/quest abschliessen`
- `/quest guide`

### Dofus-Eier und Erfolge

- `/dofus liste`
- `/dofus guide`
- `/dofus fortschritt`
- `/erfolg suchen`
- `/erfolg info`
- `/erfolg tracker`

### Items und Builds

- `/item suchen`
- `/item info`
- `/item vergleichen`
- `/set suchen`
- `/set vergleichen`
- `/build erstellen`
- `/build suchen`
- `/build anzeigen`
- `/build vergleichen`
- `/build teilen`
- `/zauber suchen`

### Wirtschaft

- `/craft rezept`
- `/craft berechnen`
- `/craft kosten`
- `/craft gewinn`
- `/craft materialien`
- `/markt preis`
- `/markt verlauf`
- `/markt alarm`
- `/beruf registrieren`
- `/beruf suchen`

### Monster und Dungeons

- `/monster suchen`
- `/monster info`
- `/monster drops`
- `/boss info`
- `/dungeon suchen`
- `/dungeon info`
- `/dungeon guide`
- `/dungeon erstellen`
- `/dungeon beitreten`

### Navigation

- `/karte suchen`
- `/position`
- `/route`
- `/schatzsuche`
- `/fundort`

### Almanax

- `/almanax heute`
- `/almanax morgen`
- `/almanax woche`
- `/almanax bonus`
- `/almanax erinnerung`

### Gilde

- `/gilde setup`
- `/gilde mitglieder`
- `/gilde profil`
- `/gilde berufe`
- `/gilde rangliste`
- `/gilde gruppen`
- `/gilde gesuch`
- `/gilde event`
- `/gilde statistik`

### System

- `/dofus`
- `/hilfe`
- `/suche`
- `/einstellungen`
- `/status`
- `/feedback`

Die endgültige Command-Struktur darf zur Verbesserung der Bedienbarkeit angepasst werden.

## 14.4 Interaktive Embeds

Jede Itemabfrage soll ein vollständiges Embed erzeugen.

Beispiel:

    GELANO

    Level: 60
    Kategorie: Ring

    Werte:
    +1 AP

    Aktionen:
    [Rezept]
    [Vergleichen]
    [Zum Build hinzufügen]
    [Marktplatz]
    [Favorisieren]

Die Werte im Beispiel sind lediglich illustrativ; in der Implementierung werden echte Daten geladen.

Buttons müssen funktionieren und dürfen keine funktionslosen Platzhalter sein.

Bei langen Listen verwende Pagination.

Bei Auswahlaktionen verwende Select-Menüs.

Bei Eingabeaktionen verwende Modals.

## 14.5 Gildenverwaltung

Implementiere ein vollständiges System:

- Gilde anlegen
- Discord-Server verknüpfen
- Rollen definieren
- Mitglieder registrieren
- Mitgliedsprofile
- Klassenübersicht
- Berufsübersicht
- Levelübersicht
- Aktivitätsstatistiken aus Bot-Interaktionen
- Gruppensuche
- Dungeon-Verabredungen
- Raid-Verabredungen
- Eventkalender
- Erinnerungen
- Anmeldesystem
- Wartelisten
- Wiederkehrende Events
- Wunschlisten
- Gemeinsame Materiallisten
- Suchanfragen nach Handwerkern
- Benachrichtigung bei passenden Gesuchen

Füge keine erfundenen Live-Aktivitätsdaten aus dem Spiel hinzu.

## 14.6 Dungeon- und Raid-Gruppen

Beispielhafter Ablauf:

1. Benutzer startet `/dungeon erstellen`.
2. Bot öffnet ein Modal.
3. Dungeon auswählen.
4. Datum und Uhrzeit festlegen.
5. Teilnehmerzahl bestimmen.
6. Optionale Mindestanforderungen festlegen.
7. Bot erstellt ein öffentliches Embed.
8. Mitglieder können sich per Button anmelden.
9. Alle Teilnehmer werden angezeigt.
10. Änderungen werden sofort aktualisiert.
11. Bei voller Gruppe entsteht eine Warteliste.
12. Vor Beginn können Erinnerungen versendet werden.

Achte auf Zeitzonen, Discord-Limits, Berechtigungen und persistente Zustände.

## 14.7 Automatische Nachrichten

Unterstütze:

- Almanax
- Offizielle News
- Patchnotes
- Events
- Dungeon-Erinnerungen
- Persönliche Preisalarme
- Gesuchte Handwerker
- Gruppenanfragen
- Systemhinweise
- API-Statusmeldungen für Administratoren

Alle Nachrichten müssen konfigurierbar sein.

Verhindere Spam, Duplikate und unnötige Benachrichtigungen.

---

# 15. DESKTOP-DISCORD-SYNCHRONISIERUNG

Desktop und Discord müssen miteinander verbunden sein.

Beispiel:

Ein Spieler öffnet die Desktop-App und registriert seinen DOFUS-Charakter.

Anschließend verknüpft er sein Discord-Konto.

Danach kann er im Discord-Bot `/charakter profil` verwenden und sieht die freigegebenen Informationen.

Wenn ein Spieler in der Desktop-App eine Quest als erledigt markiert, soll dieser Status synchronisiert werden.

Wenn er in Discord ein Crafting-Projekt erstellt, soll es in der Desktop-App erscheinen.

Synchronisiere:

- Charaktere
- Questfortschritt
- Erfolge
- Favoriten
- Crafting-Projekte
- Gespeicherte Builds
- Persönliche Ziele
- Eventanmeldungen
- Wunschlisten
- Einstellungen, soweit sinnvoll

Implementiere:

- Discord OAuth2
- Sichere Sitzungstokens
- Geräteverknüpfung
- Automatische Reconnects
- Konflikterkennung
- Offline-Queue
- Verschlüsselte Tokenablage
- Selektive Synchronisierung
- Benutzerseitige Datenschutzkontrollen

Eine lokale App darf auch ohne bestehende Discord-Verknüpfung nutzbar sein.

---

# 16. INTELLIGENTER DOFUS-ASSISTENT

Entwickle einen optionalen intelligenten Assistenten.

Dieser soll auf die verfügbaren DOFUS-Datenbanken zugreifen können.

Beispiele:

"Was muss ich bei meiner aktuellen Quest machen?"

"Welche Materialien brauche ich für diese Questreihe?"

"Welche Ausrüstung passt zu meinem Charakter?"

"Wie besiege ich diesen Boss?"

"Wie komme ich zu diesem NPC?"

"Welche Quests fehlen mir noch für den Türkisen Dofus?"

"Was kostet es, diese Gegenstände herzustellen?"

## Technische Umsetzung

Verwende vorzugsweise ein Tool-Calling- oder Retrieval-System.

Der Assistent soll strukturierte Funktionen aufrufen können, beispielsweise:

- searchQuest
- getQuestSteps
- getQuestRequirements
- searchItem
- getCraftingRecipe
- getMonster
- getDungeon
- calculateRoute
- getCharacterProfile
- calculateBuildStats
- calculateCraftingCost
- searchGuideSources

Antworten müssen sich an nachprüfbaren Daten orientieren.

Fakten und berechnete Werte dürfen nicht halluziniert werden.

Zeige Quellen und Unsicherheiten.

Die KI-Anbindung ist optional und muss ohne hinterlegten API-Schlüssel deaktivierbar sein.

Die gesamte Anwendung muss auch ohne KI vollständig nutzbar bleiben.

---

# 17. WEITERE HILFSWERKZEUGE

Entwickle zusätzlich, soweit geeignete Daten vorhanden sind:

## Sammlungen

- Archmonster-Tracker
- Seelenstein-Checklisten
- Persönliche Erfolge
- Monster-Favoriten
- Sammellisten
- Ressourcen-Favoriten
- Materialinventar

## Planung

- Tagesaufgaben
- Wochenziele
- Questziele
- Dungeon-Ziele
- Eventplanung
- Persönliche To-do-Listen
- Erinnerungen
- Aktivitätenverlauf

## Hilfsrechner

- Drop-Wahrscheinlichkeiten
- Erwartete Versuche
- Crafting-Kosten
- Gewinnmargen
- Mengenberechnung
- Materialbedarf
- Buildwerte
- Schadensberechnung
- Prozentuale Preisänderungen

## Nützliche Desktop-Funktionen

- Globale Suche
- Suchverlauf
- Favoriten
- Zwischenablage-Helfer
- Export als CSV/JSON
- Screenshotanalyse
- Notizen
- Angeheftete Fenster
- Konfigurierbare Hotkeys
- Fensterlayouts
- Benachrichtigungszentrale
- Hintergrund-Updateprüfung

---

# 18. HOTKEY- UND KEYBINDER-SYSTEM

Entwickle eine professionelle Hotkey-Verwaltung.

Beispielaktionen:

- Hauptfenster öffnen
- Overlay umschalten
- Quest-Scan auslösen
- Item-Scan auslösen
- Schatzsuche öffnen
- Aktuelle Quest anzeigen
- Koordinaten kopieren
- Item-Suche öffnen
- Zu Favoriten springen

Jeder Hotkey muss konfigurierbar sein.

Anforderungen:

- Konfliktprüfung
- Aktivieren/Deaktivieren
- Profile
- Unterstützung mehrerer Monitore
- Kein Konflikt mit wichtigen Windows-Tasten
- Keine unnötige CPU-Last
- Keine Automatisierung von Spielaktionen
- Keine automatischen In-Game-Klicks
- Keine automatischen Kampfabläufe
- Keine unautorisierten Makros

Die Hotkeys bedienen ausschließlich die Companion-App und ihre erlaubten externen Funktionen.

---

# 19. OCR UND BILDSCHIRMANALYSE

Erstelle eine gekapselte OCR-Engine.

## Anforderungen

- Explizite Benutzerfreigabe
- Sichtbare Kennzeichnung aktiver Erkennung
- Auswahl des Fensters
- Auswahl eines Bildschirmausschnitts
- Manuell ausgelöste Analyse
- Optional wiederkehrende Analyse während einer aktiven Sitzung
- Lokale OCR als Standard
- Unterstützung Deutsch und Französisch
- Texterkennung bei unterschiedlicher Skalierung
- Unscharfe Texterkennung verbessern
- OCR-Konfidenz
- Fuzzy Matching
- Fehlerkorrektur
- Konfigurierbare Erkennungsregionen
- Screenshotvorschau
- Datenschutzmodus

## Testfälle

- Questjournal offen
- Questjournal geschlossen
- Item-Tooltip offen
- Mehrere ähnliche Itemnamen
- Französischer Questname
- Deutscher Questname
- Unterschiedliche Bildschirmauflösungen
- Mehrere Monitore
- Verschiedene DPI-Skalierungen
- Dunkle und helle Spieloberflächen
- Unvollständig sichtbarer Text
- Mehrere mögliche Quests

Bei geringer Sicherheit muss die App eine Auswahl anbieten.

OCR-Bilder dürfen standardmäßig nicht an externe Dienste übermittelt werden.

Keine Analyse anderer Fenster außerhalb der ausdrücklichen Nutzerfreigabe.

Keine Prozessspeicheranalyse, Netzwerkpaket-Überwachung, DLL-Injektion oder Umgehung von Schutzmechanismen.

---

# 20. DATENBANKDESIGN

Erstelle ein normalisiertes Datenbankschema.

Mindestens folgende fachlichen Tabellen beziehungsweise Modelle:

- users
- discord_accounts
- linked_devices
- user_settings
- characters
- character_stats
- character_professions
- character_quests
- character_quest_steps
- character_achievements
- quests
- quest_steps
- quest_objectives
- quest_requirements
- quest_chains
- quest_rewards
- guide_sources
- guide_mappings
- items
- item_effects
- item_types
- item_sets
- recipes
- recipe_ingredients
- monsters
- monster_spells
- monster_drops
- npcs
- maps
- map_nodes
- locations
- dungeons
- achievements
- achievement_objectives
- professions
- saved_builds
- build_items
- crafting_projects
- crafting_project_materials
- inventories
- item_prices
- price_history
- guilds
- guild_settings
- guild_members
- guild_events
- event_participants
- dungeon_groups
- group_participants
- reminders
- notifications
- favorites
- activity_logs
- data_sources
- data_imports
- game_versions
- synchronization_events

Passe das Schema an die realen Beziehungen und Datenfelder an.

Verwende:

- Migrationen
- Foreign Keys
- Indizes
- Eindeutige Constraints
- Transaktionen
- Soft Delete bei Bedarf
- Integritätsprüfungen
- Versionsfelder für Konfliktauflösung
- Datenbanktests

Trenne importierte Spieldaten strikt von personenbezogenen Benutzerdaten.

---

# 21. OFFLINE-MODUS

Die Desktop-App soll auch ohne Verbindung zum Backend nutzbare Funktionen behalten.

Offline verfügbar sein sollen insbesondere:

- Bereits synchronisierte Spieldaten
- Item-Suche
- Gespeicherte Quests
- Questfortschritt
- Favoriten
- Notizen
- Lokale Crafting-Projekte
- Lokale Berechnungen
- Bereits gespeicherte Guide-Links
- Hotkeys
- OCR-Analyse mit vorhandenen Daten

Offline vorgenommene Änderungen werden nach Wiederherstellung der Verbindung synchronisiert.

Zeige den Verbindungsstatus verständlich an.

---

# 22. WEB-DASHBOARD

Entwickle nach Möglichkeit zusätzlich ein responsives Web-Dashboard.

Funktionen:

- Discord-Login
- Charakterverwaltung
- Questfortschritt
- Item-Suche
- Crafting-Projekte
- Buildverwaltung
- Gildeneinstellungen
- Mitgliederübersicht
- Eventverwaltung
- Bot-Konfiguration
- Benachrichtigungseinstellungen
- Synchronisierungsstatus

Verwende das gemeinsame Backend.

Vermeide doppelte Datenmodelle.

---

# 23. SICHERHEIT UND RECHTLICHE RAHMENBEDINGUNGEN

Beachte:

- Keine unautorisierte Spielautomatisierung
- Keine Manipulation des DOFUS-Clients
- Keine Prozessinjektion
- Kein Auslesen privater Spielsitzungen oder Tokens
- Kein Packet Sniffing
- Keine automatischen In-Game-Transaktionen
- Kein Umgehen von Anti-Cheat-Systemen
- Keine unautorisierte Massenübernahme fremder Inhalte
- Kein Speichern von Ankama-Passwörtern
- Keine Veröffentlichung geheimer API-Schlüssel
- Keine unnötige Übermittlung von Screenshots
- Datenschutzfreundliche Standardeinstellungen

Implementiere:

- Sichere Eingabevalidierung
- Rollenbasierte Zugriffe
- Rate-Limiting
- Sichere OAuth2-Flows
- CSRF-Schutz, soweit erforderlich
- Schutz vor SSRF
- Sichere lokale Tokenablage
- Sichere Konfiguration
- Lösch- und Exportfunktionen
- Audit-Logs für sicherheitsrelevante Aktionen
- Berechtigungskontrollen
- Dependency Scanning

Prüfe Lizenzen der verwendeten Bibliotheken und Datenquellen.

Nicht freigegebene Funktionen werden als klar gekennzeichnete optionale Integrationen vorbereitet, aber nicht heimlich aktiviert.

---

# 24. AUTOMATISCHE INSTALLATION UND START

Der Benutzer soll möglichst wenig selbst einrichten müssen.

Erstelle:

- `.env.example`
- Setup-Skripte
- Entwicklungsstart-Skripte
- Docker Compose für Backend und Datenbank
- Datenbankmigrationen
- Automatischen Spieldatenimport
- Initialkonfiguration
- Lokale Startskripte
- Windows-Installer
- Portable Windows-Version, soweit technisch machbar
- Installationsanleitung
- Troubleshooting-Dokumentation

Der Desktop-Installer soll:

1. Die Anwendung installieren.
2. Die lokale Datenablage vorbereiten.
3. Beim Erststart ein modernes Onboarding öffnen.
4. Optionale Backend-Verbindung konfigurieren.
5. Discord-Verknüpfung anbieten.
6. Die verfügbare Datenbank synchronisieren.
7. Die wichtigsten Funktionen testen.
8. Anschließend das Dashboard öffnen.

Der Bot soll über Konfiguration gestartet werden können.

Stelle auch einen vereinfachten lokalen Entwicklungsmodus bereit.

Erkläre klar, dass ein dauerhaft erreichbarer Discord-Bot einen durchgehend laufenden Host benötigt. Wenn er ausschließlich auf dem lokalen PC läuft, ist er bei ausgeschaltetem PC offline.

Eine Cloudbereitstellung ist optional, benötigt aber gegebenenfalls Hosting-Zugangsdaten.

---

# 25. AUTOMATISCHE SPIELDATEN-UPDATES

Das Projekt muss auf spätere DOFUS-Versionen vorbereitet sein.

Entwickle einen Datenaktualisierungsdienst.

Funktionen:

- Aktuelle Datenversion prüfen
- Neue Version erkennen
- Neue Datensätze herunterladen
- Integrität überprüfen
- Datenbankimport durchführen
- Geänderte Datensätze erkennen
- Entfernte Datensätze behandeln
- Änderungen protokollieren
- Betroffene Caches aktualisieren
- Importfehler erkennen
- Bei Fehlern bisherigen stabilen Datenbestand behalten

Wichtig:

Ein fehlerhaftes Update darf die Anwendung nicht unbenutzbar machen.

---

# 26. TESTSTRATEGIE

**Tests sind ausdrücklich Teil des Arbeitsauftrags.**

Erstelle nicht nur Testdateien, sondern führe die Tests tatsächlich aus.

## 26.1 Unit-Tests

Teste unter anderem:

- Item-Suche
- Fuzzy Matching
- Questzuordnung
- Quest-Abhängigkeiten
- Fortschrittsberechnung
- Rezeptberechnung
- Gewinnberechnung
- Buildwerte
- Navigation
- Datenvalidierung
- Berechtigungsprüfung
- Lokalisierung

## 26.2 Integrationstests

Teste:

- API-Adapter
- Datenbankzugriff
- Datenimport
- Cache
- Benutzerverwaltung
- Discord-Interaktionen
- Desktop-Backend-Kommunikation
- Synchronisierung
- Fehlerbehandlung
- Offline-Reconnect

Verwende Testcontainer beziehungsweise isolierte Testdatenbanken.

## 26.3 API-Tests

Für jede API:

1. Dokumentation prüfen.
2. Reale Endpunkte ermitteln.
3. Antwortformat validieren.
4. Erfolgreiche Antworten testen.
5. Fehlerhafte Antworten testen.
6. Timeouts testen.
7. Rate-Limits behandeln.
8. Unvollständige Daten behandeln.
9. Datenmodell-Zuordnung prüfen.
10. Tests dokumentieren.

Führe Live-Smoke-Tests nur aus, wenn Netzwerkzugang besteht und der Zugriff erlaubt ist.

Verwechsle niemals gemockte Tests mit erfolgreichen Live-Tests.

Wenn eine API nicht erreichbar ist, dokumentiere das Ergebnis und teste den Fallback.

## 26.4 Desktop-Tests

Verwende geeignete Component- und End-to-End-Tests.

Teste:

- App-Start
- Hauptfenster
- Navigation
- Einstellungen
- Suchfunktion
- Hotkeys
- Fenster-Modi
- OCR-Testbilder
- Item-Erkennung
- Quest-Erkennung
- Overlay
- Offline-Betrieb
- Datenbankzugriff
- Mehrmonitor-Layouts

Nutze für native Windows-Funktionen möglichst eine Windows-Testumgebung beziehungsweise einen Windows-CI-Runner.

## 26.5 Discord-Tests

Teste:

- Command-Registrierung
- Slash-Commands
- Embed-Erstellung
- Buttons
- Select-Menüs
- Modals
- Autocomplete
- Pagination
- Persistent Components
- Benutzerberechtigungen
- Gildenberechtigungen
- Fehlerantworten
- Parallelzugriffe
- Scheduled Jobs

## 26.6 End-to-End-Tests

Teste vollständige Anwendungsfälle.

### Szenario A: Quest-Assistent

- Testcharakter erstellen
- Quest suchen
- Questschritt aufrufen
- Screenshot-Fixture analysieren
- Quest identifizieren
- Passenden Schritt anzeigen
- Fortschritt ändern
- Daten synchronisieren
- Fortschritt in Discord anzeigen

### Szenario B: Item-Scanner

- Item-Screenshot analysieren
- Item identifizieren
- API-Daten laden
- Werte anzeigen
- Rezept öffnen
- Materialkosten berechnen
- Suchbegriff kopieren

### Szenario C: Discord-Gruppenverwaltung

- Event erstellen
- Embed erzeugen
- Teilnehmer anmelden
- Teilnehmer entfernen
- Warteliste aktualisieren
- Erinnerung auslösen
- Ergebnis im Desktop anzeigen

### Szenario D: API-Ausfall

- Hauptdatenquelle simuliert deaktivieren
- Ersatzdatenquelle verwenden, wenn vorhanden
- Cache nutzen
- Benutzer informieren
- Automatische Wiederverbindung testen

### Szenario E: Offline-Synchronisierung

- Desktop offline schalten
- Lokalen Fortschritt ändern
- Verbindung wiederherstellen
- Änderungen synchronisieren
- Konflikte korrekt behandeln

---

# 27. RELEASE- UND QUALITÄTSKRITERIEN

Ein Modul ist erst dann als fertig zu bewerten, wenn:

- Die Funktion implementiert ist.
- Sie im UI erreichbar ist.
- Die verwendeten Datenquellen korrekt angebunden sind.
- Die Eingabevalidierung funktioniert.
- Fehler sinnvoll behandelt werden.
- Geeignete Tests vorhanden sind.
- Die Tests erfolgreich ausgeführt wurden, soweit die Umgebung dies ermöglicht.
- Die Funktion dokumentiert ist.
- Keine kritischen Platzhalter vorhanden sind.
- Keine erfundenen Daten als echte Ergebnisse ausgegeben werden.

Erstelle eine überprüfbare Feature-Matrix mit den Statuswerten:

- Implementiert und getestet
- Implementiert, Live-Test ausstehend
- Implementiert, benötigt Zugangsdaten
- Vorbereitet, externe Genehmigung erforderlich
- Nicht verfügbar wegen fehlender Datenquelle
- Fehlgeschlagen mit dokumentiertem Fehler

Verwende diese Statuswerte ehrlich.

---

# 28. CI/CD UND BUILDS

Richte nach Möglichkeit GitHub Actions ein.

Automatisiere:

- Linting
- Type Checking
- Unit-Tests
- Integrationstests
- Frontend-Build
- Backend-Build
- Discord-Bot-Build
- Rust-Tests
- Desktop-Build unter Windows
- Abhängigkeitsprüfung
- Artifact-Erzeugung

Erzeuge nach Möglichkeit:

- Windows Setup EXE
- Windows Portable Build
- Backend-Release
- Discord-Bot-Release
- Docker-Konfiguration
- Release Notes

Wenn Code-Signing-Zertifikate fehlen, stelle einen unsignierten Build bereit und dokumentiere die Einschränkungen.

---

# 29. ENTWICKLUNGSVORGEHEN

Arbeite in der folgenden Reihenfolge, ohne nach jeder Phase auf eine neue Benutzeranweisung zu warten.

## Phase 1: Recherche und Architektur

- Bestehenden Workspace untersuchen
- APIs prüfen
- Rechtliche Einschränkungen prüfen
- Datenmodelle festlegen
- Technischen Stack finalisieren
- Monorepo erstellen

## Phase 2: Fundament

- Backend implementieren
- Datenbank erstellen
- Migrationen erstellen
- API-Adapter entwickeln
- Datenimport entwickeln
- Gemeinsame Typen erstellen
- Authentifizierung vorbereiten

## Phase 3: Desktop

- App-Grundgerüst
- Dashboard
- Navigation
- Suche
- Fenster-Modi
- Overlay
- Hotkeys
- OCR-Engine
- Quest-Assistent
- Item-Scanner

## Phase 4: Spielwerkzeuge

- Questplaner
- Item- und Set-Datenbank
- Schatzsuche
- Routenplaner
- Crafting-Rechner
- Markt- und Preissystem
- Monster- und Dungeon-Daten
- Build-Manager

## Phase 5: Discord

- Bot-Grundsystem
- Slash-Commands
- Embed-Designsystem
- Interaktive Menüs
- Charakterverwaltung
- Quests
- Items
- Crafting
- Gildenmanagement
- Gruppenverwaltung
- Almanax
- Benachrichtigungen

## Phase 6: Synchronisierung

- Desktop mit Backend verbinden
- Discord mit Backend verbinden
- Benutzerkonten verknüpfen
- Fortschritt synchronisieren
- Offline-Betrieb integrieren

## Phase 7: Erweiterte Funktionen

- Optionale KI-Integration
- Zusätzliche Berechnungen
- Weitere Karten- und Questfunktionen
- Web-Dashboard
- Erweiterte Einstellungen
- Automatische Updates

## Phase 8: Qualität und Veröffentlichung

- Unit-Tests
- Integrationstests
- End-to-End-Tests
- UI-Tests
- Sicherheitsprüfungen
- Performance-Optimierung
- Fehlerbehebung
- Release-Builds
- Installationsanleitung

Wenn eine externe Abhängigkeit blockiert ist, arbeite an den übrigen unabhängigen Modulen weiter.

---

# 30. AUTONOMIE UND ARBEITSWEISE

Wichtige Vorgaben:

1. Beginne nach einer kurzen Bestandsaufnahme sofort mit der tatsächlichen Implementierung.
2. Arbeite nicht ausschließlich theoretisch.
3. Erstelle sämtliche notwendigen Dateien selbst.
4. Installiere benötigte Dependencies, wenn die Umgebung es erlaubt.
5. Erstelle eigene Tests.
6. Führe Tests nach relevanten Änderungen aus.
7. Behebe gefundene Fehler.
8. Achte auf bestehende Features bei Refactorings.
9. Verwende modulare Komponenten.
10. Implementiere keine leeren Demo-Funktionen als angeblich fertige Features.
11. Verwende keine Fake-API-Daten im Produktivmodus.
12. Dokumentiere blockierte Funktionen ehrlich.
13. Priorisiere eine lauffähige End-to-End-Anwendung gegenüber einem großen, aber nicht funktionierenden Gerüst.
14. Verwende keine unveröffentlichten Zugangsdaten.
15. Frage nur nach Informationen, die tatsächlich nicht autonom beschafft oder erzeugt werden dürfen.
16. Erstelle eine klare `README.md`.
17. Halte den aktuellen Implementierungsstand in `IMPLEMENTATION_STATUS.md` fest.
18. Schreibe wichtige Architekturentscheidungen in `ARCHITECTURE.md`.
19. Lege Testresultate in einem nachvollziehbaren Bericht ab.
20. Erstelle, sofern Git verfügbar ist, saubere Commits zu abgeschlossenen Meilensteinen.

Falls die verfügbare Ausführungszeit oder der Kontext nicht ausreichen, sichere den funktionsfähigen Stand einschließlich Tests, offenen Punkten und eindeutigem Fortsetzungsauftrag. Gib nicht vor, die Gesamtimplementierung abgeschlossen zu haben.

---

# 31. ERWARTETES ENDERGEBNIS

Am Ende erwarte ich:

**Desktop**

Eine möglichst vollständig implementierte Windows-Anwendung mit modernem Interface, Quest-Assistent, Item-Scanner, OCR, Hotkeys, Navigation, Rechnern und Overlay.

**Discord**

Einen modernen, professionellen Discord-Bot mit vollständig implementierten Commands, umfangreichen Embeds, Buttons, Menüs, Gildenverwaltung und automatischen Benachrichtigungen.

**Backend**

Ein funktionierendes Backend mit Datenbank, API-Adaptern, Authentifizierung, Synchronisierung und nachvollziehbarer Datenaktualisierung.

**Testing**

Automatisierte Tests, reale Testresultate und einen klaren Bericht darüber, welche externen Integrationen tatsächlich live überprüft werden konnten.

**Installation**

Setup-Skripte, erforderliche Konfigurationsdateien, nachvollziehbare Startbefehle und möglichst fertige Windows-Release-Builds.

**Dokumentation**

Eine verständliche Installationsanleitung und eine technische Dokumentation.

**Qualität**

Ein modernes, wartbares, sicheres und professionelles Softwareprojekt.

---

# 32. DEFINITION OF DONE

Das Projekt gilt nicht schon dann als fertig, wenn sich eine Benutzeroberfläche starten lässt.

Es soll ein tatsächlich nutzbares Produkt entstehen.

Mindestens folgende Kernabläufe müssen funktionieren:

1. Windows-App starten und Itemdaten durchsuchen.
2. Über die Desktop-App eine Quest suchen und ihre bekannten Schritte anzeigen.
3. Einen freigegebenen Questjournal-Screenshot analysieren und passende Quests vorschlagen.
4. Einen Item-Tooltip erkennen und den gefundenen Gegenstand anzeigen.
5. Ein Crafting-Rezept laden und den Materialbedarf berechnen.
6. Eine Schatzsuche anhand vorhandener API-Daten unterstützen.
7. Einen DOFUS-Charakter registrieren.
8. Den Charakter über Discord abrufen.
9. Den persönlichen Questfortschritt zwischen Desktop und Discord synchronisieren.
10. Über Discord ein Item suchen und ein hochwertiges interaktives Embed ausgeben.
11. Eine Dungeon-Gruppe mit interaktiven Anmeldebuttons erstellen.
12. Almanax-Daten automatisch abrufen und Benachrichtigungen bereitstellen.
13. Bei API-Ausfällen sinnvolle Fehlerbehandlung und vorhandene Cache-Daten verwenden.
14. Lokale Änderungen offline speichern und später synchronisieren.
15. Das Gesamtprojekt durch die verfügbaren automatisierten Tests überprüfen.

Erweiterte Features werden anhand ihrer tatsächlichen Verfügbarkeit und Testbarkeit bewertet.

**Starte jetzt mit der Workspace-Analyse, prüfe die vorhandenen Datenquellen und beginne anschließend unmittelbar mit der Entwicklung. Arbeite so autonom und vollständig wie möglich. Beende deine Arbeit nicht mit einer bloßen Planung.**
