# DOFUS Companion 0.10.0

Companion-Accounts verbinden Windows-App und Website mit derselben privaten Cloud-Synchronisierung. Die bisherigen lokalen Spielhilfen und der bestehende signierte Updatekanal bleiben erhalten.

- Accounts mit E-Mail-Bestätigung, eigenem Profil, Passwort-Reset, Datenexport und Kontolöschung.
- Lokaler Betrieb, dauerhafte Sync-Warteschlange, geräteübergreifende Revisionen, Konfliktentscheidungen, getrennte Accounts und ausdrücklich bestätigte Gastmigration.
- Bestehende Gilde zentral verwalten: Name, Server, Beschreibung, Regeln und Wappen; bestätigte Mitgliedschaften und gestaltbare Ingame-Ränge bleiben von technischen Rollen getrennt.
- Mitgliederliste mit Charakteren, Klassenbildern, Hauptcharakter, Level/Omega, Filtern und Discord-Kontakt.
- Interne und globale Angebote mit Kama-Preisen, Kommentaren, Teilreservierungen und atomaren Mengenänderungen. Persönliche Marktjournale und Warenlager bleiben privat.
- Events, Wochen-/Monatskalender und Dungeon-Gruppen mit Zeitzonen, Teilnehmerplätzen und Wartelisten.
- Gemeinsamer Web-Builder für gespeicherte Ausrüstung, Rolls, Exomagie, Attribute und Varianten. Erweiterter Schadenssimulator und Optimierer bleiben in der Windows-App.
- Admin-Control-Panel mit persönlicher erneuter Anmeldung, revisionsgeprüften Änderungen, Auditverlauf, Moderation und Rücknahmen geeigneter Änderungen.
- Firebase-Regeln und Indizes produktiv abgenommen; Wappen im bestehenden Blaze-Storage-Bucket mit Größen-, Rollen- und Zugriffsschutz.
- Betreiberangaben und funktionsbezogene Datenschutz-/Nutzungsinformationen vor der Website-Passwortmaske zugänglich.

Die Discord-Cloud-Anbindung ist vorbereitet und standardmäßig deaktiviert. Sie benötigt einen vertrauenswürdigen Bot-Host, einen Bot-Token und eine geprüfte Zuordnung von Discord-IDs. Diese Betriebskonfiguration wird nicht durch ein Windows-Update oder Firebase Hosting ersetzt. Es werden keine automatischen Direktnachrichten versendet.

Filter und Kalender verwenden begrenzte geladene Seiten beziehungsweise Zeiträume. Manuelle Spielangaben sind keine offiziell von DOFUS bestätigten Werte. Die Website-Passwortmaske ist eine browserseitige Zugangshürde; private Daten schützt Firebase Authentication mit Security Rules.

Der Windows-Installer verwendet die Tauri-Updater-Signatur des bisherigen Schlüssels. Dies ist kein Windows-Authenticode-Zertifikat. Bestehende Releases und deren Dateien werden nicht ersetzt.
