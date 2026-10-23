# Warenlager und Marktpreise – v0.9.1

## Neue Funktionen
- Marktpreisbeobachtungen für Bündel ×1, ×10, ×100 und ×1000; historische Beobachtungen können korrigiert und in CSV exportiert werden.
- **Bestand hinzufügen**: vorhandene Items ohne Kaufbuchung erfassen. Eingabe von Anzahl Bündeln, Stück je Bündel, optionalem geschätztem Stückpreis, optionalem Markt-Durchschnitt und historischen Einstandskosten.
- Live-Kalkulation von Gesamtstückzahl, Preis pro Bündel und geschätztem Gesamtwert.
- **Bestand entfernen**: Mengen korrigieren oder verbrauchen, ohne einen Verkauf oder fiktiven Gewinn zu buchen.
- Korrekturen werden als nachvollziehbare Lagerbewegungen dokumentiert. Fehlerhafte Buchungen können entfernt werden, wenn dadurch keine späteren Transaktionen ungedeckt bleiben.
- Warenlager-Sortierung nach Stückpreis, Bündelpreis, Menge und Lagerwert, jeweils mit Richtung; Filter nach Server und Itemnamen.
- Übersicht bewertet vorhandene Items anhand eigener Marktbeobachtungen beziehungsweise manuell hinterlegter Bewertungsdaten. Unbewertete Positionen werden gekennzeichnet.
- Unbekannte historische Einkaufskosten sind nicht mit null Anschaffungskosten gleichzusetzen. Gewinn- und Break-even-Werte werden entsprechend als unbekannt angezeigt.
- Vollständige Kompatibilität mit bestehenden `market:journal-v1`-Speicherständen und JSON-Backups.

## Bedienung
1. Öffne **Planen → Marktjournal & Kamas** und wähle ein Item über die Suche.
2. Wechsle zu **Warenlager → Bestand hinzufügen**.
3. Trage zum Beispiel **5 Bündel ×1000** ein. Die Gesamtmenge wird als **5000 Stück** angezeigt.
4. Trage optional den aktuellen beobachteten Stückpreis ein. Die Anwendung zeigt den Wert für ein Bündel und deinen gesamten Bestand.
5. Falls du den historischen Einstandspreis kennst, ergänze ihn separat. Andernfalls bleibt die Kostenbasis unbekannt.
6. Über **Korrigieren**, **Bestand entfernen** oder **Bestandsbewegungen → Löschen** kannst du Fehleingaben ohne Verkauf berichtigen.

## Daten und Sicherheit
- Bestehende Daten werden nicht gelöscht oder migriert. Neue `stock-in`- und `stock-out`-Buchungen sind Erweiterungen des bisherigen Journalformats.
- Kein Zugriff auf den DOFUS-Client, keine automatisierten Käufe/Verkäufe oder Marktpreisbehauptungen.
- Die Werte sind eigene Beobachtungen, keine Live-Marktkurse.
- Vor größeren Korrekturen ein **JSON-Backup** erstellen.
