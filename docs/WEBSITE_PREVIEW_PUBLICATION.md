# Website-Vorschau auf ausdrücklichen Betreiberauftrag

Stand 23.10.2026. Der Betreiber hat die vorherige Sperre wegen fehlender Rechtstexte für die Website ausdrücklich aufgehoben und die Bereitstellung ohne Impressum und Rechtstexte beauftragt. Das stellt keine juristische Prüfung dar; `legalReviewed` bleibt falsch. Es werden keine persönlichen Betreiberangaben aus Betriebssystem, Firebase-Owner-Adresse oder anderen Quellen als öffentliche Kontaktangaben übernommen.

## Begrenzter Umfang

`apps/website` bietet einen separaten Vite-Modus `guild-preview`. Er entfernt die Community-Module vollständig aus dem Website-Paket, einschließlich Firebase-SDK und Builder-Katalog. Direkte Community-Routen zeigen einen Hinweis auf die ausstehende technische Abnahme. Rechtsseiten und deren Links sind in diesem Modus entfernt; entsprechende URLs zeigen die normale Nicht-gefunden-Seite. Die Entwicklung der vollständigen Community bleibt in PR #11 erhalten.

Nur `firebase deploy --only hosting --project dofus-companion --non-interactive` ist für diese Bereitstellung vorgesehen. Keine Firestore-/Storage-Rules, Indizes, IAM-Berechtigungen, Registrierungsfreigabe, Windows-Installer oder Update-Manifeste werden dabei geändert. Die komplette Community-Produktion durchläuft weiterhin den separaten Sicherheits- und Freigabeprozess. PR #11 wird dafür nicht vorzeitig gemergt.

Der Betreiber muss sein bestehendes Passwort nicht erneut mitteilen: `build:preview` übernimmt den öffentlichen PBKDF2-Verifier vom festen Live-Host ohne Redirects und prüft ihn. Fehler, ungültige Daten, schwache Iterationszahlen und gleichzeitige Passwortrotation brechen den Build ab. Das bewahrt den vorhandenen Zugang; der Verifier selbst ist kein Geheimnis.

## Technische Prüfung

- Website-Unit-Tests einschließlich korrektem/falschem Passwort und fehlerhafter Verifier-Wiederverwendung.
- TypeScript, gezieltes ESLint und Produktionsbuild für die Vorschau.
- Browserprüfung: falsches Passwort, verzögertes Laden der App, fehlende Rechtsseiten und Navigationslinks, gesperrte Community-Deep-Links, Startseite/Downloads und keine Firebase-/Analytics-Anfragen.
- Das echte Live-Passwort wird nicht ausgelesen. Der Browser-Nachtest hinter der Maske nutzt den bekannten Session-Mechanismus; das ist gerade ein Beleg für die Grenze dieser clientseitigen Zugangshürde.
- Direkt vor Bereitstellung: tatsächliche Firestore- und Storage-Rules unabhängig eingelesen, Kommentare entfernt und jeweils ausschließlich `allow read, write: if false;` festgestellt; Registrierung deaktiviert. Quellen privat unter `.data/website-preview-before/` gesichert.
- Nach Bereitstellung: ausgeliefertes HTML und Verifier mit dem getesteten lokalen Build vergleichen; `noindex` und `no-store` prüfen; Browserprüfung gegen den Live-Host wiederholen. CLI-Erfolg allein ersetzt diesen Nachtest nicht.

## Rechtlicher Status bleibt offen

## Tatsächlicher Bereitstellungsnachweis

Am 23.10.2026 erfolgreich ausschließlich Hosting veröffentlicht, Ziel `https://dofus-companion.web.app`. Live-Browserprüfung um 14:28 UTC bestanden: ausgeliefertes HTML entspricht bytegenau dem geprüften Vorschau-Build, Verifier unverändert, Deep-Links wie erwartet begrenzt, keine Firebase-Daten-/Analytics-Anfragen, `noindex` und `no-store` wirksam. Neun Website-Unit-Tests, TypeScript und gezieltes ESLint bestanden. Auch der vollständige Community-Website-Build kompiliert weiterhin separat; dessen Module sind im veröffentlichten Vorschau-Build nicht enthalten. Private Prüfberichte und CLI-Protokoll liegen unter `.data/website-preview-*.json` beziehungsweise `.data/website-preview-deploy.txt` und werden nicht eingecheckt. Keine Aussage über einen veröffentlichten oder fertig abgenommenen Community-Produktivbetrieb.

## Offene rechtliche Einordnung

Der ausschließlich private oder familiäre Zweck ist für § 18 Absatz 1 Medienstaatsvertrag entscheidend; kostenlose Nutzung, eine Gilde, ein schwer auffindbarer Link oder ein Passwort begründen für sich keine bestätigte Ausnahme. Für das konkrete Projekt liegt weiterhin keine abschließende Einordnung vor. [Amtlicher Gesetzestext § 18 MStV](https://www.gesetze-bayern.de/Content/Document/MStV-18)

§ 5 DDG betrifft geschäftsmäßige, in der Regel gegen Entgelt angebotene digitale Dienste. Aus einer möglichen Nichtanwendbarkeit dieser Vorschrift folgt nicht automatisch die Befreiung von anderen Informationspflichten. [Amtlicher Gesetzestext § 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html)

Die Vorschau ist keine technisch private Website: Firebase Hosting liefert statische Dateien öffentlich aus, die Passwortprüfung läuft im Browser. Die Betreiberentscheidung wird dokumentiert, aber nicht als rechtliche Unbedenklichkeit dargestellt. Weitergehende Accounts und Verarbeitung von Mitgliederdaten werden mit diesem Deployment nicht freigeschaltet.
