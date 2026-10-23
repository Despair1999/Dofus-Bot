# DOFUS Companion – Website-Vorschau

**Aktueller Stand 23.10.2026:** Der Betreiber hat ausdrücklich eine Website-Vorschau ohne die unfertigen Rechtsseiten beauftragt. Dafür gibt es `pnpm --filter @dofus/website build:preview` (Vite-Modus `guild-preview`). Dieser Build enthält keine Community-Module, keine Registrierung und keine Links oder Entwurfsseiten für Impressum, Datenschutz und Nutzungsbedingungen. Direkte Community-URLs zeigen einen Hinweis auf die ausstehende Sicherheitsabnahme. Die Funktionen im Entwicklungsbranch bleiben erhalten. Es wird ausschließlich Hosting bereitgestellt; Firestore, Storage, IAM und Windows-Updates werden dadurch nicht veröffentlicht.

Der Vorschau-Build übernimmt den **bereits öffentlich lesbaren** Passwort-Verifier ausschließlich von `https://dofus-companion.web.app/access-config.json`, validiert Format/Stärke und bricht bei Fehlern ab. Das vorhandene Passwort bleibt erhalten, ohne ein GitHub-Secret auszulesen oder ein neues Passwort zu wählen. `WEBSITE_PASSWORD` und Wiederverwendung sind absichtlich nicht kombinierbar. Der normale Community-Build und seine Veröffentlichungsprüfung bleiben davon getrennt. Nach dem Build: Vorschau mit `pnpm --filter @dofus/website exec vite preview --host 127.0.0.1 --port 4187 --strictPort`, Browserprüfung mit `pnpm --filter @dofus/website test:preview`; der gleiche Test akzeptiert die tatsächliche Hosting-URL als Argument. Berichte liegen unter `.data/` im Repository-Stamm (ignoriert).

**Keine rechtliche Freigabe:** Der Browser-Passwortschutz ist umgehbar; Dateien bleiben öffentlich abrufbar. Das Weglassen eines Impressums ist eine ausdrückliche Betreiberentscheidung, kein Nachweis einer Ausnahme von § 18 MStV oder datenschutzrechtlichen Pflichten. `legalReviewed` bleibt `false`. Projekt läuft inzwischen auf Blaze; Aussagen zum Spark-Tarif und zum früheren Freigabeablauf in den folgenden historischen Einrichtungsnotizen sind überholt. Aktuell gilt [die dokumentierte Vorschau-Bereitstellung](../../docs/WEBSITE_PREVIEW_PUBLICATION.md).

## Historische Einrichtungsnotizen

Diese eigenständige statische React-Website liegt **nur im bestehenden DOFUS-Companion-Monorepo** unter `apps/website/`. Desktop-App, lokale SQLite-/Fastify-Daten, Discord-Bot, Windows-Installer und GitHub Releases bleiben eigenständig. Klassisches Firebase Hosting im Spark-Tarif hostet lediglich statische Website-Dateien, keine Functions, keine Datenbank, keine Installer und kein SSR.

## Aktueller Stand: Vorschau-Zugang statt öffentlicher Launch

Die Startseite zeigt zuerst eine individuell gestaltete DOFUS-inspirierte Passwortmaske. Die React-App wird über `React.lazy` **erst nach erfolgreicher Eingabe geladen und gerendert**. Jede Route verwendet dieselbe Vorschaltseite, auch direkte Deep Links. Nach erfolgreichem Login wird die Freigabe ausschließlich bis zum Schließen der Browser-Session in `sessionStorage` gespeichert. Fehlende oder ungültige Zugangs-Konfiguration blockiert den Login (fail closed). Formular mit Sichtbarkeitsschalter, Tastaturbedienung, Fehlertexten und Responsive-Design.

**Wesentliche Einschränkung:** Ein clientseitiger Passwortschutz auf Firebase Hosting ist **keine echte Zugangskontrolle**. Die Website-Dateien und Bilder sind über ihre öffentlichen Hosting-URLs abrufbar; ein erfahrener Nutzer kann die browserseitige Sperre umgehen. Auch ein gesalzener PBKDF2-Verifier ist öffentlich und unterliegt Offline-Wörterbuchangriffen. Das Passwort bleibt zwar aus dem Quellcode und JavaScript-Klartext heraus, dennoch ist dies nur eine UX-Hürde, **keine Garantie für Privatheit oder rechtliche Befreiung**. Keine geheimen Inhalte, API-Zugänge oder persönliche Daten in den Web-Build einbinden. Wer echte Zugangskontrolle und Zugriffsschutz auf **alle** Assets benötigt, braucht eine andere Architektur mit serverseitiger Zugangskontrolle; die reine Spark-Hosting-Konfiguration leistet das nicht.

Auf Wunsch sind die Impressums- und Datenschutz-Platzhalter der öffentlichen Produktseite im Vorschau-Modus **aus der Navigation und dem Routing entfernt**; beide URLs führen auf die normale 404-Ansicht (nach Passwortfreigabe). **Dies ersetzt keine Rechtsprüfung**: Auch eine per JavaScript passwortgeschützte Webseite kann öffentlich verfügbar sein und Impressums-/Datenschutzpflichten auslösen. Veröffentlichung bleibt deshalb technisch durch `LEGAL_READY == 'true'` gesperrt, bis der Betreiber die Situation geprüft und entschieden hat. Die rechtlichen Angaben für einen künftigen öffentlichen Launch sind separat zu erstellen.

Indexierung ist eingeschränkt durch `robots.txt` (Disallow: /), `noindex`-Meta-Tag sowie `X-Robots-Tag`. Dies ist ein Hinweis an Suchmaschinen, **keine Zugangsbeschränkung**. Es wird bewusst keine Sitemap erstellt.

## Passwort-Konfiguration – kein Klartext im Repository

Das Passwort wurde von dir bereits als **GitHub Repository Secret** `WEBSITE_PASSWORD` gesetzt. Es wird nur für den *Live-Build* in einem abgesicherten GitHub-Actions-Job an `scripts/prepare-access.mjs` übergeben. Der Build erzeugt mit einem zufälligen 128-bit Salt und 310.000 PBKDF2-SHA256-Iterationen ausschließlich `public/access-config.json` (Salt/Verifier) und kopiert die Datei als öffentlich lesbare Vorschau-Konfiguration nach `dist/`. Keine Passwort-Zeichenfolge wird im Quellcode als Default verwendet, kein `VITE_WEBSITE_PASSWORD` in clientseitig gebündeltem JavaScript und kein Passwort in Log-Ausgaben.

**Die Vorschau-Konfiguration ist kein Geheimnis.** Sie ist ein öffentlich abrufbarer Passwort-Verifier, der prinzipbedingt offline angreifbar bleibt.

Bei Pull Requests und CI-Prüfungen wird **niemals** das echte Secret ausgelesen. Der Workflow generiert ein einmaliges zufälliges CI-Passwort nur für den Buildtest. Erst der `publish`-Job auf `main` baut **erneut** mit dem richtigen GitHub-Secret und veröffentlicht danach die Website. Ein fehlendes Secret führt zu einem Abbruch. Die CI-ZIP-Vorschau mit Zufallspasswort wird niemals auf Firebase deployed.

Das generierte `apps/website/public/access-config.json` ist per `.gitignore` ausgeschlossen und darf nicht committet werden.

## Lokale Vorschau

Node.js >= 22.15 und pnpm 11.25.0 vorausgesetzt. Passwort lokal ausschließlich als Umgebungsvariable setzen:

PowerShell:
```powershell
$env:WEBSITE_PASSWORD = Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText
pnpm --filter @dofus/website dev
```

Buildtests:
```sh
pnpm install --frozen-lockfile
pnpm --filter @dofus/website typecheck
pnpm --filter @dofus/website test
# WEBSITE_PASSWORD muss gesetzt sein:
pnpm --filter @dofus/website build
pnpm --filter @dofus/website preview
```

Ein Build ohne Passwort oder mit einem Passwort kürzer als 12 Zeichen wird verweigert. Keine harte Vorgabe oder Fallback-Passwort.

## Firebase-Einrichtung (einmalig)

Bereits eingerichtet:
- Firebase-Projekt `dofus-companion` mit klassischem Hosting im kostenlosen Spark-Tarif.
- GitHub-Repository-Variablen `FIREBASE_PROJECT_ID=dofus-companion` und `WEBSITE_URL=https://dofus-companion.web.app`.
- Dediziertes Dienstkonto mit Rollen für Firebase Hosting und ein verschlüsseltes Repository Secret `FIREBASE_SERVICE_ACCOUNT`.
- Repository Secret `WEBSITE_PASSWORD`.

Es werden **keine neuen Repositories** benötigt.

Optional: `DISCORD_PUBLIC_CLIENT_ID` als Repository Variable mit einer gültigen öffentlichen Discord-Application-ID setzen, sonst zeigt die Website keinen Einladungsbutton.

**Vorschau-Veröffentlichung nach Nutzerauftrag aktivierbar:** Nach dem Merge auf `main` veröffentlicht die GitHub Action automatisch, wenn die tatsächliche Firebase-Projekt-ID `dofus-companion` ist. `LEGAL_READY` wird nicht als rechtliche Unbedenklichkeit fingiert. Der User hat ausdrücklich die Veröffentlichung der passwortgeschützten Vorschau angeordnet. **Rechtlicher Hinweis:** Das Entfernen der Pflichtangaben und ein clientseitiges Passwort können weiterhin rechtliche Pflichten auslösen. Öffentliches Hosting kann nur mit korrekt geprüften Rechts- und Bildnutzungsfragen zuverlässig betrieben werden. Die publizierten statischen Assets sind technisch öffentlich erreichbar.

Nach Review der gestapelten Pull Requests in richtiger Reihenfolge in `main` übernehmen (nicht während der Bearbeitung). Die Action `.github/workflows/firebase-hosting.yml` baut die Website isoliert. Sie deployed nach einem Merge auf `main` beim Projekt `dofus-companion`. Das ist eine technische Bereitstellung, keine Aussage zur rechtlichen Zulässigkeit. Das Deployment verwendet `FirebaseExtended/action-hosting-deploy@v0` und den JSON-Schlüssel aus GitHub Secrets. Keine Firebase Cloud Functions oder kostenpflichtige Dienste.

## Funktionsbereiche

Die öffentliche Website enthält Startseite, Feature-Tabs, interaktive vereinfachte Kartenvorschau, Windows-/Overlay-Bereich, Discord-Bot-Demo, Downloads, Changelog und FAQ. Das Passwort-Gate ist vorgeschaltet. Bestehende Branding-, Klassen- und Kartenbilder werden beim Vite-Build wiederverwendet; zusätzliche große Desktop-Archive und private Daten werden **nicht** nach Firebase kopiert.

- **Downloads**: API-Abfrage öffentlicher GitHub Releases, gültige NSIS-Installer und portable ZIPs, klare Fehlerzustände, kein Fake-Downloadbutton
- **Sicherheit**: bestehende statische HTTP-Sicherheitsheader, CSP, robots Disallow/noindex, kein Analytics-Tracking
- **Verfügbarkeit**: Firebase-Spark-Kontingente beachten; Installationsdateien bleiben stets bei GitHub
- **Grenzen**: Die native Desktop-App braucht ihren lokalen Dienst; die Website stellt ihn nicht öffentlich bereit.

## Prüfungen

Vor dem Merge: Website-Workflow grün (TypeScript, Unit Tests, Produktionsbuild). Zusätzliche manuelle Browserabnahme: Zugang falsch/richtig, Reload in Session, neuer Browser-Sitzungstoken, Deep Links, Sichtbarkeit auf Handy/Desktop, fehlender Verifier, 404 auf deaktivierten rechtlichen URLs. Nach optionalem autorisiertem Deployment echte Firebase-URLs und Response-Header prüfen. Ein erfolgreicher CI-Build allein belegt keinen erfolgreichen Live-Deploy und keine gerichtsfeste rechtliche Einordnung.

## Veröffentlichungsvorgang

Die erste passwortgeschützte Firebase-Hosting-Vorschau wird über den dedizierten GitHub-Actions-Workflow aus `main` veröffentlicht. Das Website-Build muss erfolgreich sein und der Deployment-Job muss anschließend als erfolgreich bestätigt werden; ein erfolgreicher Commit oder Merge allein beweist noch keine Bereitstellung. Bei fehlendem Workflow-Lauf kann der Workflow in GitHub Actions manuell über `Run workflow` auf Branch `main` gestartet werden.

## Troubleshooting: Firebase Hosting 403 bei GitHub Actions

Falls der Build erfolgreich ist, der Deploy-Job aber mit `HTTP 403` und `permission: serviceusage.services.get` fehlschlägt, sind die Hosting-Dateien **nicht** defekt. Der Service Account besitzt dann zwar `roles/firebasehosting.admin`, kann aber nicht den Aktivierungsstatus einer Google Cloud API abrufen.

**Einmalige IAM-Korrektur (Projekt `dofus-companion`):**

1. Öffne [Google Cloud IAM](https://console.cloud.google.com/iam-admin/iam?project=dofus-companion).
2. Bearbeite das bestehende Mitglied `firebase-hosting-github@dofus-companion.iam.gserviceaccount.com`.
3. Rolle hinzufügen: **Service Usage Viewer** (`roles/serviceusage.serviceUsageViewer`). Diese Rolle enthält `serviceusage.services.get`, aktiviert jedoch keine neuen APIs.
4. Bestehende Firebase Hosting Admin- und API Keys Viewer-Rollen beibehalten. **Keine** Projektinhaber-/Editor- oder Service Usage Admin-Rolle notwendig.
5. Nach Speichern und kurzer IAM-Propagation in GitHub Actions den fehlgeschlagenen Firebase-Hosting-Workflow unter dem neuesten Lauf via `Re-run failed jobs` erneut ausführen. Nicht noch einmal den Browser-CI-Job verändern.

Der Workflow verwendet eine bewusst festgelegte Firebase-CLI-Version `14.22.0`, damit ein unbeabsichtigtes Upgrade von `latest` keine überraschenden Deployment-Änderungen verursacht.

Beachte weiterhin, dass Firebase-Spark-Hosting öffentlich erreichbare statische Dateien ausliefert: Das Vorschau-Passwort ist nur eine browserseitige Zugangshürde.

## Website-Design & Patchnotes (Stand 22.10.2026)

- Website-Markenbild: einheitliches Companion-Logo aus `apps/desktop/public/branding/icon.png` statt eines Eniripsa-Porträts auf dem Passwort-Gate und hinter der Startseiten-Preview.
- Der Ausrüstungs-Builder verwendet ebenfalls ein einheitliches Builder-Symbol und keine Charakterporträts mehr; die Windows-App bleibt in ihren Originalbildern unverändert.
- Keine sichtbaren Quellcode-, Repository- oder externen Release-Notes-Verweise in Header, Desktop-Seite, Footer und Changelog. Downloads führen weiterhin **direkt zur GitHub-Release-Datei**, weil Hosting im kostenlosen Spark-Tarif keine Installer hostet. **Die Repository-Herkunft bleibt technisch am Downloadziel und über die Release-API ersichtlich; dieser Umbau kann ein öffentliches Repository nicht geheim halten.**
- `/changelog` enthält bewusst **redaktionell von Hand gepflegte** Versionseinträge aus den tatsächlichen Releasebeschreibungen, Stand v0.8.0 bis v0.2.2. Neuversionen müssen in `src/lib/changelog.ts` ergänzt werden; veröffentlichte Draft-Releases werden nicht angezeigt. Die Downloadliste bleibt dynamisch und bietet ausschließlich valide Installer an.
- Nach Website-Änderungen baut und veröffentlicht `.github/workflows/firebase-hosting.yml` unabhängig von Windows-Installer und Discord-Bot. Für spätere Changelog-Erweiterungen reicht ein Website-Commit auf `main`.
