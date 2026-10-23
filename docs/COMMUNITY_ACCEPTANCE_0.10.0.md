# Abnahme 0.10.0 – 23.10.2026

Diese Abnahme ersetzt ältere Zwischenstände in den Community-Dokumenten. Veröffentlichung wird separat bestätigt; ein erfolgreicher Build oder diese Datei beweist noch kein veröffentlichtes Update.

## Umgesetzte Funktionen

| Bereich | Tatsächlicher Umfang |
|---|---|
| Accounts | Firebase E-Mail/Passwort, Pflichtprofil, E-Mail-Bestätigung, Reset, Sitzung, Export, Kontolöschung |
| Synchronisierung | Gemeinsame Engine, persistente Offline-Warteschlange, UID-Trennung, stabile Datensatz-IDs, Revisionen, Konflikte, Löschmarker, ausdrücklich bestätigte Gastmigration, vorhandene Desktop-SQLite-Tabellen |
| Gilde | Bestehende Gilde zentral konfigurieren, WebP-Wappen, Beitrittsprüfung, Archivierung, Charakterfreigaben |
| Mitglieder | Accountzeilen, Haupt-/weitere Charaktere, Klassenbilder, Level/Omega, Rang, Server, Filter, Sortierung, Kontakt |
| Ränge | Name, Reihenfolge, Farbe, Symbol, Archivierung und Audit; unabhängig von technischen Systemrollen |
| Marktplätze | Gildenintern und global, Verkauf/Suche/Tausch, Kamas, Kommentare, Filter, Teilreservierungen, atomare Mengenbindung, eigene Anzeigen/Reservierungen, Meldungen |
| Aktivitäten | Events und Dungeon-Gruppen, Zeitzonen, Wochen-/Monatskalender, Anmeldung, Rollen, Kapazität, Warteliste und administrative Korrekturen |
| Builder | Gemeinsame gespeicherte Builds, Ausrüstung, Rolls, Exomagie, Attribute, Varianten; bestehender Desktop-Simulator und Optimierer erhalten |
| Administration | Persönliche Reauthentifizierung, Systemrolle in Rules, Mitglieds-/Charakter-/Angebots-/Eventverwaltung, Sammelaktionen, Moderation, Audit, geeignete revisionssichere Rücknahmen |
| Discord | Gemeinsame Cloud-Befehle, geprüfte ID-Zuordnung und erneute Berechtigungsprüfung; standardmäßig deaktiviert, bis ein realer Host mit Token eingerichtet ist |

## Erfolgreiche technische Prüfung

- 171 Workspace-Tests: Core 30, Community 24, Game Data 8, Website 12, Desktop 32, Backend 46, Discord 19. TypeScript und ESLint erfolgreich; Produktionsaudit ohne bekannte Schwachstellen.
- 41 Auth-/Firestore-/Storage-Emulator- und Browserfälle: 22 Rules, 13 SDK-Integrationen, lokaler Owner-Einrichtungsweg und fünf plattformübergreifende Chromium-Prüfungen.
- 54 bestehende Browser-Regressionsfälle erfolgreich. Zunächst 51 bestanden; drei Fälle nach behobener Kaltstart-Vorbereitung und aktualisierter Prüfung des lesenden Firebase-Transports gezielt wiederholt. OCR-Test schließt Bild-/OCR-Übertragung über diesen Kanal ausdrücklich weiter aus. `test-results/community-regression-summary.json` enthält das zusammengeführte Ergebnis, ohne doppelte Tests zu zählen.
- Sechs Rust-Tests erfolgreich; der als ignoriert markierte Listener ist eine vom Lifecycle-Test selbst gestartete Child-Fixture. Zusätzlich echter Minisign-Test des signierten Installers einschließlich Manipulationsablehnung erfolgreich.
- Native Windows-/WebView2-Abnahme unter eigenständiger QA-Anwendungskennung: Start, lokaler Backenddienst, API-Berechtigung, SQLite-Charakter, Overlay und gemeinsames Accountformular.
- Reale gebündelte Dienste 0.9.2 → 0.10.0 auf isolierter SQLite-Fixture: Charakter, Questfortschritt, Build, Berechnung, Berufe und Marker bleiben erhalten. Die installierte Benutzeranwendung und ihre Daten wurden nicht verändert.
- Signierter Installer und portable ZIP gebaut. NSIS-Setup wird nicht ungefragt über die produktive Benutzerinstallation installiert. Abnahme des gemeinsamen Quellstands erfolgt über die getrennte QA-Kennung; Installer separat kryptografisch geprüft. Kein Authenticode-Zertifikat behaupten.

## Produktives Firebase-Projekt

Projekt und Bucket bleiben unverändert: `dofus-companion`, `dofus-companion.firebasestorage.app`. Bestätigter, aktiver Owner und Owner-Rolle geprüft. Bestehende Owner-Daten und Gildenfelder erhalten.

Firestore- und Storage-Rules bereitgestellt und aus dem Produktivdienst mit den lokalen Quellen verglichen. Cross-Service-IAM ausschließlich für den zugehörigen Storage-Serviceagenten mit `roles/firebaserules.firestoreServiceAgent` ergänzt; alle anderen Bindings erhalten. Kein Benutzer pauschal zum Editor/Owner gemacht. Keine öffentlichen Bucket-Bindings oder öffentlichen Standard-Objekt-ACLs gefunden. Standorte unverändert: Firestore `eur3`, Storage `US-EAST1`.

Indizes additiv über die Firestore-API bereitgestellt; alle erforderlichen Indizes sind `READY`. Der alte Firebase-CLI-Indexabgleich scheiterte an einer unnötigen Einzelfelddefinition beziehungsweise einer bestehenden Definition. Es wurde kein `--force` zum Löschen vorhandener Indizes verwendet. Regeln wurden anschließend getrennt veröffentlicht.

Live-Client-Abnahme mit zwei eindeutig abgegrenzten temporären Accounts: Registrierung und Zustimmungsnachweis, Verifikationsgrenze, Login auf getrennten Clients, private Sync-Daten, persistente Queue, Rolleneskalation verweigert, persönliche Admin-Reauth, Mitgliedsfreigabe, Angebote intern/global, Kommentare, Teilreservierung, Events/Gruppen/Kapazität/Warteliste, Storage-Upload/Lesen/Austausch/Löschschutz, Export und echte Auth-Kontolöschung. Owner und frühere Daten bleiben erhalten. Alle synthetischen Accounts, Angebote, Aktivitäten und Bilder entfernt; normale Konfigurationsänderungen nachvollziehbar auditiert. Die Registrierung wurde nach dem Test wieder geschlossen.

Die Verifikations-E-Mail-Anforderung wurde vom echten Auth-Dienst angenommen. Der Empfang und das Anklicken für die Test-Aliasse werden nicht behauptet; deren bestätigter Teststatus wurde bewusst durch das vertrauenswürdige Testwerkzeug gesetzt. Der tatsächliche Owner hatte seine E-Mail bereits selbst bestätigt. Zusätzliche Live-Probe bestätigt abgelehnte fremde/ähnlich aussehende Bildhosts und akzeptierte Katalogbilder; auch deren Fixture wurde entfernt.

## Betreiberangaben und Rechtstexte

Impressum exakt gemäß Auftrag. Betreiber hat die Anschrift ohne weitere Ergänzung bestätigt. Es wurden keine Firma, Hausnummer, Telefonnummer oder weiteren persönlichen Daten erfunden. Datenschutz und Nutzungsbedingungen beschreiben den tatsächlichen Datenumfang, private und gemeinsame Daten, technische Betreiberrechte, US-Verarbeitung, externe Bild-/Download-/Discorddienste, Export, Löschung und manuelle Bearbeitung gemeinsamer Historie. Texte stehen vor der Website-Passwortmaske zur Verfügung.

`legalReviewed` dokumentiert die interne Inhalts-/Funktionsprüfung und die bestätigten Betreiberangaben, keine externe anwaltliche Begutachtung oder zugesicherte rechtliche Unbedenklichkeit. Quellen: [Art. 6/13/28/44 ff. DSGVO](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX%3A32016R0679), [§ 18 MStV](https://www.gesetze-bayern.de/Content/Document/MStV-18), [§ 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html), [Firebase Datenschutz-/Verarbeitungsinformationen](https://firebase.google.com/support/privacy). Vollständige personenbezogene Daten werden ausschließlich in den beauftragten Rechtstexten veröffentlicht; private Testberichte bleiben ignoriert.

## Verbleibende konkrete Betriebsgrenze

In diesem Workspace sind kein Discord-Bot-Token, keine Application-/Server-ID und kein dauerhaft eingerichteter Bot-Host vorhanden. Deshalb keine Live-Bot-Anmeldung, Command-Registrierung oder Nachrichtenauslieferung behaupten oder automatisch starten. Der Nutzer wurde nach einer bereits vorhandenen Umgebung gefragt; Website und Windows-Freigabe bleiben davon unabhängig.

Der Owner kann tatsächlichen Gildennamen, Server, Wappen und Regeln selbst im Adminbereich setzen; es wird keine fiktive Gilde vorkonfiguriert. Eigene Daten sind weiterhin exportierbar. Filter arbeiten auf begrenzten Seiten, Kalender lädt maximal 100 Termine je Ausschnitt; erweiterte Desktop-Simulationen bleiben Desktopfunktionen. Bei Kontolöschung sind gemeinsame Historie/Audits nach ihrem konkreten Zweck zu prüfen und erforderlichenfalls durch den Betreiber zu pseudonymisieren; es wird keine pauschale sofortige Fernlöschung fremder Gerätekopien versprochen.
