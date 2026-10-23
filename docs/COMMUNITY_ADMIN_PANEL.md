# Administration

Adminzugang erscheint nur für bestätigte Owner/Admins. Sirenensymbol öffnet persönliche Firebase-Reauthentifizierung; kein gemeinsames Administratorpasswort. Dialog mit eingeschlossenem Tastaturfokus, Escape/Schließen. UI-Freigabe endet nach 14 Minuten, fünf Minuten Inaktivität oder Accountwechsel.

Bereiche: Übersicht; Gildenname/Server/Beschreibung/Discord/Regeln/Aufnahme/Wappen; Rechts- und Registrierungseinstellungen; Mitgliederanträge/Ränge; geteilte Charaktere; Gildenangebote/Reservierungen; Events/Gruppen mit Teilnehmern/Wartelisten; Kommentare und Audit. Listen sind paginiert, Zahlen keine unbegrenzten Gesamtscans.

Wappenupload normalisiert WebP und prüft Größe. Speichern ändert den auditierten Verweis. Altes Bild kann anschließend entfernt werden; aktuelle Referenz sperrt Löschen. Scheitert Konfiguration nach Upload, bleibt ein unreferenziertes Objekt zur berechtigten Bereinigung bestehen.

Archivierung ist logische Entfernung: normale Gildenlesezugriffe gesperrt, Daten zur Wiederherstellung erhalten. Owner/Admin können wiederherstellen. Keine zweite Gilde. Alle vorgesehenen Gildenwerte sind administrativ änderbar.

Technische Rollen: `node infrastructure/community/operator.mjs role UID ROLE` ist Dry run, `--apply` verlangt vertrauenswürdige ADC. Ingame-Ränge verleihen keine technischen Rechte. Korrekturen geteilter Gildencharaktere ändern keine privaten Originaldaten.

[Admin-Sicherheit](COMMUNITY_ADMIN_SECURITY.md), [Einrichtung](COMMUNITY_FIREBASE_SETUP.md), [Umfangsgrenzen](COMMUNITY_ARCHITECTURE.md).

## Ergänzungen in PR #11

Mitgliedschaften lassen sich mit Auswahl und begründeter Sammelaktion ändern, maximal 20 pro Durchlauf. Jede Änderung erhält eine eigene Revision/Audittransaktion; Teilausfälle bleiben ausdrücklich zur Prüfung ausgewählt. Reservierungsübersicht lädt Anfragen pro Gildenangebot und Status und übernimmt eine Auswahl in die atomare Korrektur. Meldequeue erlaubt `open`, `reviewing`, `resolved`, `dismissed` mit Resolution und exaktem Audit.

Auditansicht bietet Rücknahme sicherer Fachwerte an, solange seit der betreffenden Revision keine weitere Änderung erfolgte. Gekoppelte Reservierungs-/Teilnehmeränderungen bleiben in ihren Fachdialogen. Kommentarwiederherstellung ist auf die nachweisbare Fassung vor der Moderation begrenzt. Globale Fremdangebote werden durch diesen Melde-/Auditprozess nicht administrativ freigegeben.
