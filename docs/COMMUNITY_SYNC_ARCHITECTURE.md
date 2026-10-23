# Private Synchronisierung

Auth bestimmt den lokalen UID-Namensraum. Accountwechsel beendet Listener/Engine; alte asynchrone Antworten werden verworfen. Bei der ersten Verbindung entscheidet der Nutzer ausdrücklich über lokale Übernahme oder Cloud-Bestand. Gastdaten werden vorher gesichert.

Kanonische Daten werden nach stabilen Zeilen-IDs fragmentiert: Charaktere, Builds, Questfortschritt, Berufe/Dungeonvorbereitung, Marker/Routen und Handelsjournal. Keine Ganzkonto-Überschreibung. Jede Änderung erhält mutationId/baseRevision und eine dauerhafte UID-Queue. Firestore-Transaktionen prüfen Revisionen; identische Wiederholungen sind idempotent. Löschungen verwenden Tombstones.

Ein kleiner Timestamp-Listener löst paginierte Delta-Abfragen aus. Zeitpräzision umfasst Sekunden/Nanosekunden; Bestände werden nicht nach 500 Dokumenten abgeschnitten. Bestätigung entfernt nur die konkrete Mutation. Neuere lokale Änderungen während des Uploads bleiben erhalten und werden auf die bestätigte Revision aufgesetzt. Netzwerk blockiert nicht die lokale Serialisierung.

Konflikte bewahren beide Fassungen. Nutzer wählen lokal oder Cloud; vorher wird eine lokale Sicherung beider Varianten gespeichert. Keine stille automatische Zusammenführung widersprüchlicher Feldänderungen.

## Desktop

Bestehende SQLite-Tabellen bleiben die fachliche Quelle. Die authentifizierte Replikations-API erlaubt nur eine feste Tabellen-/Spaltenliste und skalare Werte. Vor atomarem Import wird eine lokale Wiederherstellungskopie erzeugt. Aktive Builder-Projekte bleiben eindeutig.

Erfolgreiche lokale Mutationen erhöhen vor API-Antwort eine dauerhafte dirty_revision. Der Spiegel bestätigt nur exakt dieselbe Revision per Compare-and-set. Nach Absturz zwischen SQLite-Schreiben und Browser-Spiegel erkennt der nächste Start offene Änderungen. Vor Cloud-Eingang werden sie zuerst in die Queue aufgenommen. Cloud-Import und Acknowledgement erzeugen keine weiteren Fachänderungszähler.

Remote-Echos werden unterdrückt. Bestehende Ansichten aktualisieren sich; ungespeicherte Builder-Entwürfe werden nicht ersetzt. Website verwendet dieselben kanonischen Modelle in IndexedDB. Zugangsdaten, Spieldaten-/Bilder-/OCR-Caches und Gerätepräferenzen sind ausgeschlossen. Datensätze über 750 KB werden abgelehnt. Gemeinsame Gildenaktionen brauchen eine Verbindung.

## Kontingentplanung: Annahmen, keine Lastmessung

Kostenloses Firestore-Kontingent: 50.000 Reads, 20.000 Writes, 20.000 Deletes täglich, 1 GiB gespeichert und 10 GiB ausgehende Daten monatlich, eine kostenlose Datenbank pro Projekt. Rules können zusätzliche Reads erzeugen. [Kontingente](https://firebase.google.com/docs/firestore/quotas), [Abrechnung](https://firebase.google.com/docs/firestore/pricing).

Beispiel pro täglich aktivem Konto: 50 initial geladene Dokumente + 25 Listeneränderungen + 25 Berechtigungs-/Folgereads = 100 Reads. Zehn private Änderungen + vier gemeinsame Aktionen mit je zwei Writes + zwei Audit-/Hinweisdokumente = 20 Writes. Initialmigration, zusätzliche Geräte und umfangreiche Listen kommen hinzu.

| täglich aktive Konten | Reads/Tag | Writes/Tag | Einschätzung im Beispiel |
|---|---:|---:|---|
| 50 | 5.000 | 1.000 | unter Tageskontingenten |
| 200 | 20.000 | 4.000 | Reserven und Lastspitzen beobachten |
| 1.000 | 100.000 | 20.000 | Reads überschritten, Writes ohne Reserve |

Pagination und gezielte Listener ersetzen kein Monitoring. Storage separat abrechnen. Keine verpflichtenden eigenen Cloud Functions.
