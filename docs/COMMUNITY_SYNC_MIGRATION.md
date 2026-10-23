# Migration und Wiederherstellung

Gastbetrieb bleibt erhalten. Vor erster Synchronisierung erstellt der Adapter eine lokale Sicherung erlaubter Gastdaten. Nutzer entscheiden ausdrücklich zwischen Übernahme und Cloud-Bestand. Keine automatische Zuordnung fremder UID-Konten.

UID-Speicher enthält Queue, Revisionen, Acknowledgements, Fortschrittsuhr und Konflikte. Bekannte Geräte nehmen offene Änderungen nach Neustart wieder auf. Abmelden beendet Listener und wechselt den lokalen Namensraum, entfernt aber nicht automatisch Backups oder andere Browsergeräte.

Desktopkonten besitzen separate SQLite-Dateien. Cloud-Import erstellt Tabellenbackups. Vor manueller Reparatur Backend stoppen und eine konsistente Kopie der betroffenen Datenbank einschließlich erforderlicher WAL-Daten sichern. Nicht unkontrolliert Tabellen oder Gastdateien löschen. Reparaturen zuerst auf einer Kopie und ohne aktive Synchronisierung prüfen.

Konfliktliste zeigt beide Fassungen. Vor bewusster Entscheidung wird ein lokales Backup gespeichert. Weiteres Offline-Arbeiten kann spätere Konflikte erzeugen. Export ist ergänzend verfügbar, kein automatisches Fernbackup.

Nicht migriert: Tokens, API-Konfiguration, OCR-/Karten-/Spieldaten und gerätebezogene Darstellung. Handelsdaten behalten stabile IDs; Lager verwendet dieselben Berechnungen wie der Desktop.
