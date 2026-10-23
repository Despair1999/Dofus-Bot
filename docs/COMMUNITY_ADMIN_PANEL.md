# Administration

Adminzugang erscheint nur für bestätigte Owner/Admins. Sirenensymbol öffnet persönliche Firebase-Reauthentifizierung; kein gemeinsames Administratorpasswort. Dialog mit eingeschlossenem Tastaturfokus, Escape/Schließen. UI-Freigabe endet nach 14 Minuten, fünf Minuten Inaktivität oder Accountwechsel.

Bereiche: Übersicht; Gildenname/Server/Beschreibung/Discord/Regeln/Aufnahme/Wappen; Rechts- und Registrierungseinstellungen; Mitgliederanträge/Ränge; geteilte Charaktere; Gildenangebote/Reservierungen; Events/Gruppen mit Teilnehmern/Wartelisten; Kommentare und Audit. Listen sind paginiert, Zahlen keine unbegrenzten Gesamtscans.

Wappenupload normalisiert WebP und prüft Größe. Speichern ändert den auditierten Verweis. Altes Bild kann anschließend entfernt werden; aktuelle Referenz sperrt Löschen. Scheitert Konfiguration nach Upload, bleibt ein unreferenziertes Objekt zur berechtigten Bereinigung bestehen.

Archivierung ist logische Entfernung: normale Gildenlesezugriffe gesperrt, Daten zur Wiederherstellung erhalten. Owner/Admin können wiederherstellen. Keine zweite Gilde. Alle vorgesehenen Gildenwerte sind administrativ änderbar.

Technische Rollen: `node infrastructure/community/operator.mjs role UID ROLE` ist Dry run, `--apply` verlangt vertrauenswürdige ADC. Ingame-Ränge verleihen keine technischen Rechte. Korrekturen geteilter Gildencharaktere ändern keine privaten Originaldaten.

[Admin-Sicherheit](COMMUNITY_ADMIN_SECURITY.md), [Einrichtung](COMMUNITY_FIREBASE_SETUP.md), [Umfangsgrenzen](COMMUNITY_ARCHITECTURE.md).
