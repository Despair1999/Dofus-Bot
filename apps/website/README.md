# DOFUS Companion – öffentliche Website

Die Produktwebsite ist Teil des **bestehenden** Repositories unter `apps/website/`. Sie ist eine statische React-19-/Vite-6-/TypeScript-Webanwendung mit eigenem CSS-Designsystem. Sie benötigt keine Functions, kein App Hosting, keine Firebase-Datenbank und kein SSR. Sämtliche Bilder werden aus bereits vorhandenen lokalen Monorepo-Assets beim Build eingebunden. Die lokale Desktop-API und persönliche Daten werden nicht öffentlich bereitgestellt.

## Start und Build

Voraussetzungen: Node.js >=22.15.0 und pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm --filter @dofus/website dev
pnpm --filter @dofus/website typecheck
pnpm --filter @dofus/website test
pnpm --filter @dofus/website build
pnpm --filter @dofus/website preview
```

Der produktive statische Build liegt unter `apps/website/dist/`. Deployment erfolgt über die `firebase.json` des Repository-Roots. Ein lokaler Website-Build baut weder Tauri noch Discord neu. Auch der dedizierte Hosting-Workflow installiert nur die Website-Workspace-Abhängigkeiten.

## Projektseiten

- `/`: Startseite, Produktvorschau, Kernmodule und echte Projektkennzahlen
- `/funktionen`: Feature-Tabs, zoombare/verschiebbare Kartendemonstration und Modulübersicht
- `/desktop`: Windows-Produktseite, umschaltbare Produktübersicht und Overlay
- `/discord`: Übersicht, nutzbare Slash-Command-Beispiele und Einladung nur mit gültiger Client-ID
- `/downloads`: dynamische Releases mit verifizierten Windows-Installer-Assets, Checksums/Portable-ZIP
- `/changelog`: veröffentlichte GitHub-Releases
- `/faq`, `/impressum`, `/datenschutz`; beliebige ungültige Seiten erhalten eine 404-Ansicht

**Designhinweis:** Die Desktop-Fenstervorschau ist ausdrücklich eine gestaltete Vorschau auf existierende Funktionsbereiche, **kein echter Anwendungsscreenshot**. Das Kartenbild und die Klassenbilder stammen aus dem vorhandenen Repository. Vor einer öffentlichen Veröffentlichung die rechtliche Freigabe der eingesetzten DOFUS-Grafiken prüfen.

**Live-Daten:** Die Website ruft ausschließlich öffentliche GitHub-Releases im Browser ab. Die API wird nicht für persönliche Profile verwendet. Die Listen werden anhand gültiger SemVer-Tags sortiert; Drafts und Pre-Releases werden ausgeschlossen. Ein Download erscheint nur bei vorhandenem, positiv großem `.exe`-Setup-Asset mit passender GitHub-Release-URL. Bei Rate-Limits oder Netzfehlern wird kein Downloadbutton angezeigt; die GitHub-Releases-Seite bleibt erreichbar. Der Firebase-Spark-Traffic enthält **keine Installer**.

## Firebase Spark: einmalige Einrichtung

1. In der [Firebase Console](https://console.firebase.google.com/) ein Firebase-Projekt im **Spark-Plan** einrichten. Das ist kein Auftrag, ein weiteres GitHub-Repository anzulegen. Unter **Hosting** die statische Hosting-Site aktivieren, NICHT **App Hosting** (App Hosting kann eine andere Abrechnung voraussetzen). Die tatsächliche Projekt-ID aus den Projekteinstellungen notieren.
2. Für das Hosting ausschließlich `firebase.json` und das bestehende Repository verwenden. `.firebaserc` enthält bewusst keine festgeschriebene Projekt-ID; jedes CLI-Deployment muss `--project <echte-projekt-id>` erhalten.
3. Eine OIDC-Verbindung von **diesem GitHub-Repository** zu Google Cloud einrichten. Empfohlen wird Workload Identity Federation mit einem eigens für Hosting angelegten Service Account:
   - Service Account mit dem erforderlichen Firebase Hosting Deploy-Recht ausstatten (z. B. `roles/firebasehosting.admin`, bei Bedarf zusätzliche API-Zugriffsrolle gemäß Google IAM).
   - Workload Identity Pool + GitHub OIDC Provider mit `https://token.actions.githubusercontent.com` als Issuer erstellen.
   - Attribute `google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref` zuordnen.
   - Die Provider-Bedingung **explizit** auf `assertion.repository=='Despair1999/Dofus-Bot' && assertion.ref=='refs/heads/main'` einschränken, damit nur die Hauptbranch deployen kann.
   - `roles/iam.workloadIdentityUser` für den Repository-Principal auf dem Service Account freigeben; keine Service-Account-JSON-Keys in Git speichern.
   - Details und Befehle: [Google: GitHub WIF](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines) und [GitHub Action Auth](https://github.com/google-github-actions/auth).
4. Unter **GitHub → Settings → Secrets and variables → Actions → Variables** im *vorhandenen* `Despair1999/Dofus-Bot` setzen:
   - `FIREBASE_PROJECT_ID`: deine echte Firebase-Projekt-ID
   - `FIREBASE_WIF_PROVIDER`: vollständige WIF-Provider-Ressource `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<POOL>/providers/<PROVIDER>`
   - `FIREBASE_SERVICE_ACCOUNT`: die wirkliche Service-Account-Mailadresse
   - `WEBSITE_URL`: tatsächliche HTTPS-URL der Hosting-Site (optional für Canonicals/Sitemap, aber empfohlen)
   - `DISCORD_PUBLIC_CLIENT_ID`: echte öffentliche Discord-Application-ID (optional)
   - `LEGAL_READY`: erst `true`, nachdem Impressum/Datenschutz und Asset-Rechte geprüft und richtig ergänzt sind.
5. Den Branch nach Review in `main` mergen. Bei Website-Änderungen (oder manueller Workflow-Auslösung auf `main`) testet und baut GitHub Actions **nur den Web-Workspace**. Ist die Authentifizierung eingerichtet und `LEGAL_READY=true`, veröffentlicht der `publish`-Job automatisch nach erfolgreichem `website`-Job.
6. Die Domain unter Firebase Hosting verbinden und HTTPS über Firebase konfigurieren. Die GitHub-Variable `WEBSITE_URL` auf die endgültige Domain setzen. Prüfe die Site in der Firebase-Konsole und ihre Hosting-Nutzung.

### Manuelles Hosting-Deployment

Nach einmaliger lokaler Authentifizierung mit Firebase CLI:

```sh
pnpm --filter @dofus/website build
npx firebase-tools@14.22.0 deploy --only hosting --project ECHTE_FIREBASE_PROJEKT_ID
```

**Achtung:** Der automatische Workflow führt absichtlich **kein** kostenpflichtiges Hosting-Backend, Cloud Functions, Firestore, Cloud Storage oder Installer-Upload aus. Firebase Spark besitzt Nutzungslimits (laut offizieller Dokumentation unter anderem 10 GB Hosting-Speicher und 10 GB Transfer pro Monat). Werden sie überschritten, kann die Website vorübergehend deaktiviert werden. Release-Dateien belasten den GitHub-Download, nicht Firebase.

### Veröffentlichungssperren

Eine öffentliche Veröffentlichung darf erst erfolgen, wenn alle tatsächlichen Pflichtangaben in `/impressum` und `/datenschutz` ergänzt und die Nutzungsrechte für sämtliche öffentlich verwendeten Spielbilder geprüft sind. Deshalb ist der Deployment-Job an `LEGAL_READY=true` geknüpft. Ohne WIF-Konfiguration, echte Firebase-Projekt-ID oder diese Freigabe wird **nicht deployed**. Fehlende Discord-Client-ID zeigt einen ehrlichen Konfigurationshinweis statt eines funktionslosen Buttons.

## Wartung und Tests

Der Website-Workflow reagiert auf Website-Dateien und explizit referenzierte Bild-/Konfigurationsänderungen; der Desktop-/Bot-Workflow wird für reine Website-Dateiänderungen durch `paths-ignore` nicht ausgelöst. Der signierte Windows-Release-Workflow bleibt unverändert und ist unabhängig von Firebase.

Vor Veröffentlichung: responsive Layouts im Browser visuell prüfen, `pnpm --filter @dofus/website typecheck`, `test` und `build` durchführen, Downloads nach Aktualisierung echter Releases testen und Firebase Hosting-Domain auf korrekte SPA-Routen und Header kontrollieren. Rechtstexte benötigen reale Betreiberinformationen und rechtliche Prüfung, die nicht automatisiert erfunden werden dürfen.
