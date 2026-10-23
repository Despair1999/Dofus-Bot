# DOFUS Companion 0.11.0

Die Gildenübersicht bündelt Gildeninformationen, Regeln und Mitgliederprofile. Der Community-Marktplatz enthält die beiden Handelsbereiche; vorhandene Daten und der bisherige Updater bleiben erhalten.

- Gemeinsamer Gilden-Hub mit Wappen und integrierter Mitgliederliste; frühere Mitglieder-Links öffnen die Übersicht. Keine zweite Mitgliederimplementierung und kein eingebetteter doppelter Marktplatz.
- Anklickbare Profile mit Hauptcharakter, Charakterkarten, Rang und Discord-Kontakt. Mitglieder können ihren eigenen Status und ihre Biografie bearbeiten und löschen. Keine erfundenen Onlineanzeigen; keine privaten Authentifizierungsdaten in Gildenprofilen.
- Feldgenaue Security Rules trennen Profiltexte von Mitgliedschaft, Rang und Systemrollen. Administrative Moderation bleibt auditiert.
- Sofort aktualisierte Charakterauswahl mit stabilen IDs; accountbezogene Berufsabfragen und Schutz beim Accountwechsel. Berufslevel und Sammelquestfortschritt bleiben nach Neustart und auf einem zweiten Client erhalten.
- Wappen werden ohne Data-URL-Fetch transparent nach WebP konvertiert. Fehlgeschlagene Speichervorgänge erhalten das vorherige Wappen; nicht verwendete Uploads werden kontrolliert bereinigt. Bucket-CORS für Website und Windows-App ergänzt.
- Gildeneinstellungen mit verständlicher Eingabe- und Sitzungsprüfung. Der Discord-Einladungslink bleibt optional. Rechtstextfreigaben werden nur bei tatsächlichen Änderungen mitgeschrieben.
- Verkäufername prominent, einheitliche Discord-Kontaktbuttons mit Kopierbestätigung, vorhandenes Meldesystem erhalten. Die Administration zeigt globale und interne Angebote; fremde globale Angebote bleiben vor unberechtigter Bearbeitung geschützt.
- 17.233 laut Gegenstandsvorlage handelbare Katalogeinträge, darunter Ausrüstung, Ressourcen, Verbrauchsgüter und Kosmetik. Alle 21.554 unterstützten Original-IDs mit DOFUSDB-Handelsmetadaten abgeglichen; 4.321 nicht handelbare Vorlagen ausgeschlossen. Suche nach IDs und deutschen, englischen oder französischen Namen, Akzenttoleranz, Kategorien, Level und blätterbare Ergebnisse.

Individuelle Accountbindungen und zeitliche Handelssperren eines konkreten Gegenstands müssen im Spiel geprüft werden. Mitglieder-/Angebotsfilter beziehen sich auf geladene Seiten; weitere Datensätze können nachgeladen werden. Die Discord-Bot-Einrichtung erfolgt weiterhin später durch den Betreiber.

Windows-Updates verwenden die vorhandene Tauri-Updater-Signatur. Ein Windows-Authenticode-Zertifikat wird nicht behauptet. Bestehende Releases werden nicht ersetzt.
