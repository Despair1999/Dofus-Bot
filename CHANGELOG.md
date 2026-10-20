# Änderungen

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
