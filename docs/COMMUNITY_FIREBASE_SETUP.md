# Firebase – Einrichtung und Übergabe

## Tatsächlicher Status

Projekt `dofus-companion`, Bucket `dofus-companion.firebasestorage.app`. Der Nutzer hat Storage eingerichtet. Die Implementierung ist gegen Auth-/Firestore-/Storage-Emulatoren geprüft; das bestätigt keine live ausgerollten Rules oder produktiven Uploads.

Firebase CLI 14.16.0 erkennt `sunbired@gmail.com`; Google weist gespeicherte Berechtigungen mit HTTP 401 ab. `firebase projects:list` scheiterte ebenfalls. Interaktive Neuanmeldung wurde vorbereitet, noch nicht abgeschlossen. Keine Sicherheitsmechanismen umgangen, keine Produktion verändert.

## Betreiberaktionen

1. `firebase login --reauth` ausführen und Google-Anmeldung im Browser abschließen.
2. `firebase projects:list` und `firebase firestore:databases:list --project dofus-companion` prüfen. Bei weiterem Fehler Projektrolle und Google-Konto prüfen.
3. Firebase Auth E-Mail/Passwort, autorisierte Domains, E-Mail-Vorlagen und Weiterleitungsziele konfigurieren. Firestore-Datenbank/Region prüfen, vorhandene Daten erhalten.
4. Vorgesehenen Besitzer als tatsächlichen aktiven Firebase-Auth-Benutzer mit bestätigter E-Mail einrichten. Google-Projektbesitz ist keine Firebase-Auth-UID.
5. Separate vertrauenswürdige Application Default Credentials für das Admin SDK bereitstellen. CLI-Login allein ersetzt ADC nicht. Keine privaten Schlüssel in Repository oder Clients.
6. `pnpm community:bootstrap` zeigt Dry run; `pnpm community:bootstrap --apply` löst mit ADC die echte Besitzer-UID auf. Vorhandene Gildendaten bleiben erhalten. Registrierung bleibt gesperrt. Besitzer kann Gildenwerte konfigurieren.
7. Website-Rechtstextentwürfe vollständig und geprüft ersetzen: Betreiber, Kontakt, Firebase/Storage, Aufbewahrung, gemeinsame Historie. Erst danach endgültige Veröffentlichung freigeben.
8. Nach Freigabe gezielt deployen: `firebase deploy --only firestore:rules,firestore:indexes,storage --project dofus-companion`. Storage-Rules mit Firestore-Abfragen benötigen gegebenenfalls Cross-Service-IAM-Freigabe. Keine offenen Test-Rules verwenden.
9. Website über den vorhandenen Preview-/Deployment-Prozess freigeben. `WEBSITE_PASSWORD` bleibt Deployment-Secret. Im Adminbereich gültige Rechts-URLs/Version setzen und erst nach Prüfung Registrierung aktivieren.
10. Live-Abnahme mit zwei Testkonten: Verifikation, Freigabe, Sync, Wappenwechsel, verweigerter Fremdzugriff, Reauth, Handel und Export. Keine echten Nutzerinhalte als Testdaten.

## Storage und Kosten

Neue Wappen: höchstens 200 KB WebP, frische Admin-Authentifizierung, neue Objektpfade. Berechtigtes Laden über Storage mit lokaler Blob-URL statt öffentlicher Download-Tokens.

Cloud Storage erfordert nach Googles Umstellung 2026 Blaze. Der Nutzer hat den Bucket eingerichtet; diese Änderung ändert keinen Tarif. Auth/Firestore benötigen keine eigenen kostenpflichtigen Functions. Das Datenmodell akzeptiert vorhandene kompakte Inline-Wappen; neue Uploads verwenden Storage. Keine automatische kostenlose Storage-Zusage.

Offiziell: [Storage-Umstellung](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [Firestore-Kontingente](https://firebase.google.com/docs/firestore/quotas), [Storage-Rules](https://firebase.google.com/docs/reference/security/storage).

## Lokal prüfen

`pnpm install --frozen-lockfile`, `pnpm exec playwright install chromium`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:community`. Ausschließlich Emulatorprojekt `demo-dofus-community`. Windows-Wrapper setzt nur für Java-Unterprozesse einen TCP-Fallback für interne Pipes; keine globalen Systemeinstellungen.
