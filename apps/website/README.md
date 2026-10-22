# DOFUS Companion – geschützte Vorschau (Firebase Spark)

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
