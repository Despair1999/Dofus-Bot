# Freigabe und Release-Kandidat 0.10.0

Stand 23.10.2026. Blaze ist durch den Nutzer aktiviert. Firebase-Zugang wieder funktionsfähig; bestätigter Owner sicher über echte Auth-UID eingerichtet. Öffentliche Registrierung aus. Der Betreiber hat inzwischen ausdrücklich die reine Website-Vorschau ohne unfertige Rechtsseiten beauftragt; diese wurde separat über Hosting bereitgestellt. Sie enthält keine Community-Module. Details und rechtlich offener Status in [WEBSITE_PREVIEW_PUBLICATION.md](WEBSITE_PREVIEW_PUBLICATION.md). Keine neuen Rules, IAM-Freigaben oder Update-Dateien veröffentlicht. Vorhandene Regeln entsprechen noch nicht diesem Entwicklungsstand und sperren alle Datenzugriffe.

## Reihenfolge zur sicheren Produktivfreigabe

1. PR #11: Security-, Community- und Website-CI vollständig grün. Bekannte Grenzen aus COMMUNITY_ARCHITECTURE.md bewusst prüfen. Eigene Daten sichern.
2. Vollständige Betreiber-/Kontaktangaben sowie geprüfte Datenschutz-, Nutzungs- und Impressumtexte hinterlegen. Speicherfristen, Export/Löschung, gemeinsame Historie und Datenübertragung zwischen Firestore `eur3` und Bucket `US-EAST1` berücksichtigen. Registrierung bleibt bis dahin aus.
3. `node infrastructure/community/preflight.mjs`: Owner verifiziert/aktiv, Rolle owner, korrektes Projekt/Bucket prüfen. Ergebnisse werden ohne Tokens in `.data/community-preflight.json` gespeichert.
4. Erst nach Freigabe Rules-Quellen/Indizes mit aktuellem Projektstand vergleichen und bestehende Regeln sichern. `firebase deploy --only firestore:rules,firestore:indexes,storage --project dofus-companion`. Keine fremden Produktionsdaten überschreiben. Offizielle Cross-Service-Abfrage für die Storage-Serviceidentität bestätigen; ausschließlich `roles/firebaserules.firestoreServiceAgent` für das zugehörige Servicekonto, keine pauschalen Benutzerrechte.
5. Indexaufbau abwarten. Preflight erneut ausführen; lokale Fingerprints, Cross-Service-IAM und echte positive/negative Zugriffe mit Testkonten prüfen. Wappen hochladen/wechseln/löschen, fremde Aktionen verweigern, Admin-Reauth, Sync/Offline/Accountwechsel und Löschprozess abnehmen.
6. `.github/community-release-gate.json`: Sicherheitsprüfung, Owner, Rechtstexte und produktive Regelprüfung erst nach tatsächlicher Erledigung bestätigen. Zusätzliche Betreiberfreigabe `COMMUNITY_PUBLICATION_APPROVED=true` ist erforderlich. Nicht als automatischen Nachweis juristischer Richtigkeit interpretieren.
7. Website-Build und signierten Windows-Kandidaten prüfen, dann getrennt die Veröffentlichung genehmigen. Keine automatische Veröffentlichung durch diese Entwicklungsarbeit.

## Signierter Windows-Kandidat

`.github/workflows/community-candidate.yml` ist bewusst manuell. Er baut mit vorhandenen Signier-Secrets und dem bestehenden öffentlichen Updater-Schlüssel, ohne Tag, GitHub-Release oder `latest.json` anzulegen. Version 0.10.0 wird nur im isolierten Build-Checkout gesetzt. Root-/Desktop-/Tauri-/Cargo-Versionen bleiben im Arbeitsbranch bis zur tatsächlichen Releasevorbereitung unverändert.

Der Workflow prüft TypeScript, Lint, Tests, Audit, Rust sowie den öffentlichen Kataloghash, baut den Installer und verifiziert Minisign/Ed25519 einschließlich Manipulationsprobe. Nur EXE, SIG und Prüfbericht werden als zeitlich begrenztes Actions-Artefakt abgelegt. Private Schlüssel werden nicht exportiert. Signatur ist die Tauri-Updater-Signatur, kein Authenticode-Zertifikat. Der Kandidatenworkflow wurde noch nicht ausgelöst; kein fertiges signiertes 0.10.0-Artefakt behaupten.

Vor Veröffentlichung: Installation über den vorherigen Stand auf einem Windows-Testprofil mit Datenbackup abnehmen; App-Daten erhalten; Update-Signatur mit dem Schlüssel der installierten App vergleichen. Erst danach neue Versionsdateien/Changelog/Downloads und Update-Manifest gemeinsam veröffentlichen. Bestehende veröffentlichte Release-Dateien nie ersetzen. Der bisherige auf v0.9.2 zugeschnittene Publisher muss für das neue Release gesondert angepasst/überprüft werden.

## Kosten und Betrieb

Nur berechtigte Admins schreiben Wappen. Eingabe bis 5 MB/16 Megapixel; Ausgabe 192 × 192 WebP, Storage-Limit 200 KB. Keine Bucket-Auflistung im Client, keine Überschreibung vorhandener Bilder, keine Löschung des referenzierten Wappens. Gleichzeitige Bildabrufe werden zusammengeführt; HTTP-Cache ist privat. App erzeugt keine öffentlichen Downloadlinks, kann aber eine Weitergabe bereits geladener Bilder durch Berechtigte nicht verhindern. Inhaltsdekodierung und Magic-Byte-Prüfung liegen im Client; Rules prüfen Metadaten/Größe, kein Malware-Scanning.

Firestore: begrenzte Seiten/Zeiträume, nur aktive Ansichtslistener, zusammengefasste Sync-Wecksignale, präzise Delta-Uhr und stabile Fragment-IDs. Rules-Reads und Storage-Egress kosten auf Blaze weiterhin Geld. Im Billing Budgetwarnungen und Monitoring konfigurieren; Budgetwarnungen sind keine harte Ausgabensperre. Keine automatische Löschregel für alle Wappen einführen: sie könnte das aktuelle Bild entfernen. Verwaiste Objekte nur nach Referenzprüfung bereinigen.
