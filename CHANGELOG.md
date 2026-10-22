# Änderungen

## 0.9.0 — 22.10.2026

- Vereinigt veröffentlichte Verbesserungen aus v0.8.0 mit allen Änderungen in main, insbesondere der neuen Website und dem Marktjournal.
- Neues offline nutzbares Marktjournal & Kamas: manuelle Preisbeobachtungen, Losgrößenvergleich, Preisverlauf und Notizbuch.
- Handelsbuch mit Gebühren, FIFO-Bestand, Einkaufs-/Verkaufslimits, Verkaufsplanung und regelbasierten Hinweisen.
- Freiwilliger lokaler OCR-Import, JSON-Backup und CSV-Export; keine automatischen Handelsaktionen im Spiel.
- Signierter Windows-Updatekanal mit unverändertem öffentlichen Schlüssel.

## 0.4.0 — 21.10.2026

- Weltkarte mit echten Kartenpositionen, Ressourcenregionen, privaten Wegpunkten, Berufsfiltern und gespeicherten Filterauswahlen. Schematische Darstellung ohne fremde Kartenkacheln.
- Gerichteter lokaler Routing-Teilgraph, Tourenheuristik, persönliche Farmbeobachtungen, transparente Ertragsannahmen, gespeicherte Routen und kompakte Overlaynavigation. Piocher-Routen erzwingen Bronze in Amakna.
- Versionierte Dungeon-/Bossdaten für 3.6 und 3.7, Monstergrade, Resistenzen, Zauber, Drops, Erfolge, persönliche Vorbereitung und redaktioneller Ergänzungsworkflow. Fehlende Raumbelegungen und unbestätigte Mechaniken bleiben gekennzeichnet.
- Alle sechs Berufsquests und pro Charakter gespeicherte Berufslevel/Fortschritte. Direkte Verknüpfungen aus Quest- und Crafting-Ansichten.
- Zwei unabhängige lokale Übersetzerkarten mit DE/EN/FR, Clipboard, automatischer Übersetzung, Modellinstallation und mitgelieferter Windows-Inferenzruntime. Kein externer Übersetzungsdienst.
- Discord-Karten-/Farm-/Dungeonbefehle, begrenzte PNG-Vorschauen und vorbereitete Discord Activity mit OAuth, serverseitiger Instanzprüfung und explizitem Sitzungsteilen. Hosting/Developer-Portal-Einrichtung bleiben erforderlich.
- Bestehende Speicherdaten und Update-Verifikationsschlüssel bleiben erhalten. Umfang, echte Prüfungen und Datenlücken: V4_IMPLEMENTATION_STATUS.md und V4_TEST_REPORT.md.

## 0.3.0 — 21.10.2026

- Neuer Builder mit 16 kompatiblen Ausrüstungsslots, eigener Gegenstandsauswahl, gemeinsamen numerischen Effektfiltern, dynamischen Werten und Setboni.
- Individuelle Rolls und Exomagie ohne Änderung des Originalkatalogs, Eigenschaftspunkte, Scrolls, manuelle Buffs und gespeicherte Gegnerbedingungen.
- Gelieferte Bilder für alle 19 Klassen in Charakterverwaltung und Builder. Mehrere Sets pro Charakter, aktive Companion-Auswahl, Duplikate, Vergleiche und versioniertes JSON-Austauschformat.
- Getrennte DOFUS-Datenstände 3.6.12.16 und 3.7.12.12: je 836 Klassensprüche, 1.729 Zauberstufen, lokale Icons; historische Item-/Seteffekte aus exakten JSON-Referenzen aufgelöst.
- Schadensvorschau für verifiziert modellierte direkte Wirkungen; komplexe Kampfmechaniken werden ausdrücklich als nicht vollständig unterstützt markiert.
- Deterministischer Build-Optimierer im Worker mit Fortschritt/Abbruch, Zielwerten, Ausschlüssen, fixierten Slots und Preis-/Schadensbedingungen. Keine Behauptung globaler Optimalität.
- Offline-Entwürfe und Synchronisierung mit Konflikterkennung. Private Discord-Builder-Kommandos und dauerhafte Freigabewarteschlange für das konfigurierte Companion-Konto.
- Signierter Windows-Updatekanal und Schutz veröffentlichter Dateien bleiben erhalten. Prüfungen und Grenzen: BUILDER_TEST_REPORT.md.

## 0.2.3 — 20.10.2026

- Behebt den Offline-Start des lokalen Dienstes bei erweiterten Windows-Pfaden. Der Dienst startet aus seinem eigenen Verzeichnis mit relativem Einstiegspunkt.
- Verwendet die geprüfte Node-Laufzeit 22.15.0 für Windows-Pakete. Veröffentlichte Versionen werden vor nachträglichem Überschreiben durch den Release-Workflow geschützt.
- Signiertes Update für vorhandene Installationen über „Nach Updates suchen“.

## 0.2.2 — 20.10.2026

- Der NSIS-Installer übernimmt den geprüften alten Companion-Dienst bereits vor dem Dateiaustausch. Dadurch bleiben laufende alte Node-Dateien beim Upgrade von v0.1 nicht gesperrt.
- Kleines eingebettetes Übergabeprogramm verwendet dieselbe eng begrenzte Prozessprüfung wie die Anwendung. Fremde Prozesse werden weiterhin nicht beendet.
- v0.2.0 und v0.2.1 wurden während der vollständigen Upgrade-Abnahme zurückgezogen. v0.2.2 ist die abschließend geprüfte Veröffentlichung.

## 0.2.1 — 20.10.2026

- Stabilisierung des tatsächlichen Upgrades von v0.1: Ein verwaister Companion-Dienst wird nur anhand seines Listener-PIDs und des exakt passenden gebündelten Programmpfads übernommen. Fremde Prozesse werden nicht beendet.
- Windows-Jobobjekt beendet den eigenen Dienst auch dann, wenn der Updater den Desktopprozess direkt beendet.
- Zwei zusätzliche native Prozesstests prüfen Eigentumsgrenzen und Beenden ohne Shutdown-Callback.
- v0.2.0 wurde während der Upgrade-Abnahme zurückgezogen; v0.2.1 enthält den vollständigen Funktionsumfang mit der korrigierten Dienstübergabe.

## 0.2.0 — 20.10.2026

- Neues geliefertes Logo, Wortmarke und Windows-Icon.
- Vollständiger verfügbarer lokaler Itembestand mit stabilen IDs, mehrsprachiger Token-/Teilwortsuche und Tippfehlervorschlägen. Sofortvorschau mit Tastaturbedienung, echter Ergebnisliste, strikt kombinierten Filtern, Seitenzahlen und Verlauf.
- Öffentlicher Katalog als Startbestand im Windows-Paket; separater Datenimport mit SHA-256, HTTP-Range-Fortsetzung und transaktionaler Aktivierung.
- Questnavigation aus Originalkategorien und Erfolgsbeziehungen, Statusfilter, Schritte, Materialien und Koordinaten. Originalguide-Verlinkung ohne kopierte Artikel.
- OCR-Abgleich mit dem gesamten Katalog sowie eindeutige Schrittkandidaten; Fortschritt bleibt manuell bestätigt.
- Gemeinsame Itemübersicht und Materialbilder/-namen im Crafting, Mengenberechnung, eigene Serverpreisprofile, CSV und Projekte.
- Suchbares Klassen-Dropdown aus BreedData; additive Klassen-ID-Migration und eigene neutrale Klassensymbole.
- Almanax-Zeitstrahl mit Wochen-/Monatsnavigation, Tagesdetails, Ressourcenlinks, Bonusfavoriten, Einkaufslisten, CSV und ICS.
- Separates Overlayfenster mit Layouteditor, Profilen, Transparenz, Fixierung, Rand-Einrasten, Click-through und Wiederherstellung. Hotkey-Recorder inklusive Konfliktprüfung und persistenter nativer Registrierung.
- Updatebereich mit Versionshinweisen, Downloadfortschritt und getrennten Download-/Installationsschritten. Anwendungs-ID, Updateschlüssel und persönliche Speicherorte bleiben erhalten.
- Kompatible Discord-Schnittstellen und zusätzliche Katalog-, Download-, Datums- und Integrationstests.

## 0.1.0

Erste Windows-Desktopversion mit lokalem Backend, Questimport, OCR, Charakterfortschritt, Materialrechner und optionalem privatem Discord-Bot. Historischer Bericht: [docs/TEST_REPORT.md](docs/TEST_REPORT.md).
