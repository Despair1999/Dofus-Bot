# Firebase – Einrichtung und Übergabe

Aktueller Abnahmestand: [COMMUNITY_ACCEPTANCE_0.10.0.md](COMMUNITY_ACCEPTANCE_0.10.0.md). Owner, additive Indizes, Cross-Service-IAM, Rules und produktive Clientprüfungen sind inzwischen durchgeführt. Frühere offene Punkte weiter unten sind historische Einrichtungsnotizen. Regelbereitstellung ohne Indexlöschungen: `node infrastructure/community/deploy-rules.mjs --apply`; additive Indizes: `node infrastructure/community/deploy-indexes.mjs --apply`. Beide sichern den vorherigen Stand privat unter `.data/community-production-before/`.

## Tatsächlicher Status

Projekt `dofus-companion`, Bucket `dofus-companion.firebasestorage.app`. Der Nutzer hat Storage eingerichtet. Die Implementierung ist gegen Auth-/Firestore-/Storage-Emulatoren geprüft; das bestätigt keine live ausgerollten Rules oder produktiven Uploads.

Firebase CLI 14.16.0 funktioniert nach erneuter Anmeldung: Projekt und Standard-Firestore-Datenbank sind erreichbar. Der vorgesehene Auth-Benutzer wurde über den lokal freigegebenen Einrichtungsweg angelegt und die E-Mail direkt bei Firebase als bestätigt geprüft. Der vertrauenswürdige Bootstrap hat die echte UID als Owner eingerichtet. Öffentliche Registrierung bleibt deaktiviert. Keine produktiven Rules oder Website veröffentlicht.

## Betreiberaktionen

1. Erledigt: erneute Google-Anmeldung und erfolgreicher `firebase projects:list`. Bei abgelaufener Sitzung erneut `firebase login --reauth`.
2. `firebase projects:list` und `firebase firestore:databases:list --project dofus-companion` prüfen. Bei weiterem Fehler Projektrolle und Google-Konto prüfen.
3. Firebase Auth E-Mail/Passwort, autorisierte Domains, E-Mail-Vorlagen und Weiterleitungsziele konfigurieren. Firestore-Datenbank/Region prüfen, vorhandene Daten erhalten.
4. Erledigt: bestätigte Firebase-Auth-Identität und Owner-Rolle. Google-Projektbesitz allein verleiht keine Anwendungsrolle.
5. Separate vertrauenswürdige Application Default Credentials für das Admin SDK bereitstellen. CLI-Login allein ersetzt ADC nicht. Keine privaten Schlüssel in Repository oder Clients.
6. `pnpm community:bootstrap` zeigt Dry run; `pnpm community:bootstrap --apply` löst mit ADC die echte Besitzer-UID auf. Vorhandene Gildendaten bleiben erhalten. Registrierung bleibt gesperrt. Besitzer kann Gildenwerte konfigurieren.
7. Website-Rechtstextentwürfe vollständig und geprüft ersetzen: Betreiber, Kontakt, Firebase/Storage, Aufbewahrung, gemeinsame Historie. Erst danach endgültige Veröffentlichung freigeben.
8. Nach Freigabe gezielt deployen: `firebase deploy --only firestore:rules,firestore:indexes,storage --project dofus-companion`. Storage-Rules mit Firestore-Abfragen benötigen gegebenenfalls Cross-Service-IAM-Freigabe. Keine offenen Test-Rules verwenden.
9. Website über den vorhandenen Preview-/Deployment-Prozess freigeben. `WEBSITE_PASSWORD` bleibt Deployment-Secret. Im Adminbereich gültige Rechts-URLs/Version setzen und erst nach Prüfung Registrierung aktivieren.
10. Live-Abnahme mit zwei Testkonten: Verifikation, Freigabe, Sync, Wappenwechsel, verweigerter Fremdzugriff, Reauth, Handel und Export. Keine echten Nutzerinhalte als Testdaten.

## Storage und Kosten

Neue Wappen: höchstens 200 KB WebP, frische Admin-Authentifizierung, neue Objektpfade. Berechtigtes Laden über Storage mit lokaler Blob-URL statt öffentlicher Download-Tokens.

Der Nutzer hat Blaze ausdrücklich aktiviert. Storage bleibt vollständig erhalten; ein kostenloser Ersatz wird nicht entwickelt. Neue Wappen verwenden ausschließlich den vorhandenen Bucket. Bereits vorhandene Inline-Werte werden nur unverändert toleriert, neue Inline-Wappen nicht gespeichert. Keine eigenen Functions erforderlich. Wappen: WebP bis 200 KB, Originaldatei bis 5 MB, höchstens 16 Megapixel/8192 Pixel pro Seite; Zielbild 192 × 192. Die App ruft keine öffentlichen Download-URLs ab. Rules können Bildinhalt nicht dekodieren; die Inhaltsprüfung liegt zusätzlich im Client und ersetzt kein serverseitiges Bildscanning.

Offiziell: [Storage-Umstellung](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [Firestore-Kontingente](https://firebase.google.com/docs/firestore/quotas), [Storage-Rules](https://firebase.google.com/docs/reference/security/storage).

## Lokal prüfen

`pnpm install --frozen-lockfile`, `pnpm exec playwright install chromium`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:community`. Ausschließlich Emulatorprojekt `demo-dofus-community`. Windows-Wrapper setzt nur für Java-Unterprozesse einen TCP-Fallback für interne Pipes; keine globalen Systemeinstellungen.

## Live-Preflight vom 23.10.2026

`node infrastructure/community/preflight.mjs` prüft mit vertrauenswürdigen ADC ausschließlich lesend. Ergebnis: Projekt aktiv, Owner bestätigt/aktiv/zugeordnet; Registrierung aus; Firestore `(default)` in `eur3`; Storage-Bucket in `US-EAST1`. Regionen bleiben unverändert. Aktuell veröffentlichte Firestore-/Storage-Rules weichen vom lokalen Stand ab. Cross-Service-IAM ist noch nicht freigeschaltet. Lokaler Bericht: `.data/community-preflight.json` (nicht eingecheckt).

Erforderliche Zuordnung beim später genehmigten Storage-Deploy: Storage-Servicekonto `service-71206717810@gcp-sa-firebasestorage.iam.gserviceaccount.com`, Rolle `roles/firebaserules.firestoreServiceAgent` (Firebase Rules Firestore Service Agent). In der Konsole gegebenenfalls Google-bereitgestellte Rollen anzeigen. Der CLI-/Konsolen-Dialog bietet diese Freigabe beim Speichern der Cross-Service-Rules an. Keinem Benutzer pauschal Owner-/Editor-Rechte als Ersatz geben. Höchstens zwei Firestore-Dokumente pro Storage-Regelprüfung. Offizielle Grundlage: https://firebase.google.com/docs/rules/manage-deploy#manage_permissions_for_cross-service

Erledigte Owner-Einrichtung ist keine Bereitstellung der Fachregeln. Der lokale Einrichtungsdienst wurde anschließend beendet. Er speichert weder Passwort noch ID-Token auf Festplatte. Neue Einrichtung nur bewusst über `node infrastructure/community/owner-setup.mjs`; Loopback, kurzlebiger Zufallstoken, Origin-/Host-Prüfung und Ablauf nach 20 Minuten.
