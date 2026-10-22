# Marktjournal & Kamas Intelligence

## Zweck
Persönliches Handelsjournal in der DOFUS-Companion-Windows-App unter **Planen → Marktjournal & Kamas**. Es ist keine automatisierte Handelssoftware. Es werden keine Käufe, Verkäufe, Marktmanipulationen oder Preisänderungen im DOFUS-Client vorgenommen.

Alle Funktionen sind lokal und ohne Internetverbindung nutzbar, wenn der Benutzer Gegenstandsnamen selbst eingibt. Für die optionale Gegenstandssuche aus dem vollständigen Katalog muss der vorhandene Companion-Backendkatalog erreichbar sein.

## Nutzung
1. Item aus dem Katalog wählen oder einen Namen manuell eingeben und „Suchen“ drücken.
2. Server eintragen. Diese Angabe trennt Beobachtungen und Bestände.
3. Im Tab **Marktpreise** Paketpreise für 1, 10 und 100 Stück als jeweilige Gesamtpreise erfassen. Durchschnittspreis, Volumen, Zeitpunkt und Notizen sind optional.
4. Eine frühere Beobachtung kann über „Bearbeiten“ korrigiert werden.
5. Im Tab **Handelsbuch** Käufe und Verkäufe inklusive Gebühren eintragen. Verkäufe oberhalb des vorhandenen Bestands werden blockiert.
6. **Warenlager** zeigt Bestände, gebundenes Kapital und realisierte Gewinne nach FIFO.
7. Unter **Strategie-Assistent** eigene Einkaufs- und Verkaufsgrenzen definieren, Hinweise prüfen und hypothetische Verkäufe inklusive geschätzter Gebühren kalkulieren.
8. Unter **Notizbuch** Strategien, Hypothesen und Beobachtungen dokumentieren.

Die gezeigten Marktwerte sind ausschließlich selbst erfasst. Eine Preisbeobachtung ist kein garantierter Verkaufspreis. Der Verkaufsplaner verwendet eine Durchschnittskosten-Schätzung; der tatsächlich gebuchte Gewinn verwendet FIFO.

## OCR ist freiwillig
Im Tab Marktpreise lässt sich optional OCR einblenden. Ein Screenshot wird nur nach ausdrücklicher Auswahl bzw. Bildschirmfreigabe verarbeitet. Die lokale Tesseract-Bibliothek kann beim ersten Aufruf Sprachdaten herunterladen. Der erkannte Text und vorgeschlagene Preise können vor dem Speichern geprüft und korrigiert werden. OCR ist niemals Pflicht.

## Speicherung und Export
- Key: market:journal-v1; Datenformat Version 1.
- Tauri/Windows: vorhandene lokale SQLite-KV-Speicherung über src/storage.ts.
- Browser: vorhandene IndexedDB über src/storage.ts.
- Backup erstellt eine vollständige JSON-Datei.
- Import ersetzt den Stand nach Bestätigung durch ein validiertes JSON-Backup.
- CSV exportiert die Marktbeobachtungen für Tabellenkalkulation.
- Bestehende Crafting-Preise, Inventarbestände und Crafting-Projekte werden nicht verändert.

Bitte regelmäßig JSON-Backups erstellen. Ein CSV-Export enthält nicht sämtliche Transaktionen, Zielpreise oder Notizen.

## Grenzen
- Kein Live-Zugriff auf Ankama-Marktpreise, keine Garantie für aktuelle Kurse.
- Die genaue DOFUS-Marktkursberechnung und Behauptungen über Eigenkäufe oder Verkaufsbots sind nicht verifiziert.
- Regelbasierte Tipps sind keine Gewinngarantien.
- Keine automatisierten Handelsaktionen oder Unterbietungen im Spiel.
- Historische Marktbeobachtungen können rückdatiert erfasst werden. Transaktionen werden beim Buchen zeitgestempelt.
- Das Journal führt einen eigenen dokumentierten Bestand. Eine spätere Synchronisierung mit Crafting muss ausdrücklich entwickelt werden, damit vorhandene Daten nicht überschrieben werden.

## Entwicklung
- UI: apps/desktop/src/v4/market/MarketJournalPage.tsx
- Styles: apps/desktop/src/v4/market/market.css
- FIFO und Analyse: apps/desktop/src/v4/market/model.ts
- Tests: apps/desktop/test/market.test.ts
- Lokale Prüfung: pnpm --filter @dofus/desktop typecheck und pnpm --filter @dofus/desktop test
