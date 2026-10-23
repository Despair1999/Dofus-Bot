# Companion Community – Architektur und Stand

Stand: 23.10.2026. Branch `codex/companion-community-platform`, Basis main 0.9.2. Keine Produktionsbereitstellung.

`packages/community` enthält gemeinsame Firebase-Konfiguration, Auth, Modelle, Sync-Engine, IndexedDB-Speicher und React-Oberflächen. Website und Desktop verwenden dasselbe Projekt `dofus-companion`. Analytics wird nicht initialisiert. Der optionale Discord-Bot verwendet das Admin SDK ausschließlich auf einem vertrauenswürdigen Host.

Der Desktop behält seinen lokalen Backend-Dienst und alle bisherigen Spielmodule. Gast und UID-Konten sind getrennt. SQLite-Konten liegen unter `accounts/UID.sqlite`; Website und Desktop besitzen getrennte lokale UID-Speicher. Der lokale API-Bearer bleibt erforderlich. `X-Companion-Account` wählt nur einen lokalen Bereich und beweist keine Cloud-Identität. Overlay und Aktivitätsfenster starten keine zusätzlichen Sync-Engines.

## Datenmodell

| Pfad | Zweck |
|---|---|
| profiles/UID | Für registrierte Nutzer sichtbare DOFUS-/Discord-Namen, Server, Hauptcharakter |
| users/UID/account/consent | Private Zustimmungsversion und Serverzeit |
| users/UID/records/KEY | Private fragmentierte Sync-Daten |
| users/UID/notifications/ID | Private transaktionsgebundene Hinweise |
| roles/UID | Technische Rolle; nur vertrauenswürdiger Betreiber schreibt |
| memberships/UID | Antrag, Freigabe, Ingame-Rang ohne technische Rechte |
| guildCharacters/UID | Explizit freigegebene Charakterkopien |
| platform/config | Genau eine Gilde, Name/Server/Wappen/Regeln/Aufnahme/Archivierung |
| platform/legal | Öffentliche Registrierungssperre, Rechtstext-URLs und Version |
| listings/ID | Gildeninterne oder globale Angebote |
| reservations/ID | Mengenbindung und atomare Zustandsübergänge |
| listings/ID/comments/ID | Kommentare und Moderation |
| activities/ID | Events/Gruppen, Kapazität, Teilnehmer, Warteliste |
| audit/ID | Unveränderlicher administrativer Vorher-/Nachher-Nachweis |
| guildAnnouncements / activityAnnouncements | Gemeinsame Hinweise an berechtigte Empfänger |
| accountDeletions/UID | Sperrmarker gegen alte Clients nach Kontolöschung |
| discordLinks / discordIdentities / operatorAudit | Betreiberbestätigte Zuordnung und Protokoll |

Wappen liegen als WebP in `guild-emblems/default/UUID.webp` im konfigurierten Bucket. Austausch erzeugt ein neues Objekt und ändert den auditierten Verweis. Aktuell referenzierte Bilder dürfen nicht gelöscht werden.

## Umgesetzter Umfang

Account-Onboarding, Verifikation, Reset, Profil, Export/Löschung, lokaler Betrieb, dauerhafte Sync-Queue, Konfliktentscheidung, Charaktere/Hauptcharakter, explizite Gildenfreigabe, Mitgliederanträge, Gildenprofil/Wappen, Angebote/Reservierungen/Kommentare, Events/Gruppen/Wartelisten, Hinweise, Admin-Reauth und Audit, optionale Discord-Befehle und markierte Rechtstextentwürfe.

Die Web-Bibliothek bearbeitet gespeicherte Builds mit Itemauswahl, individuellen Rolls, Exomagie, Eigenschaften, Schriftrollen, Original-Setboni, Aktivstatus, Charakterzuordnung und Varianten. Originaldaten werden erst beim Bearbeiten als eigener statischer Chunk geladen. Berechnung/Validierung aus `@dofus/core`, Lager/Handel aus `@dofus/core/market` werden wiederverwendet. Quests und Routen bleiben in der Bibliothek lesbar.

## Offene Grenzen des Masterprompts

- Echte Wochen-/Monatsraster mit Navigation und Teilnahme-Details sind umgesetzt. Anzeige ist zeitzonenbeschriftet, Termineingabe berücksichtigt Sommerzeit. Kalender lädt gezielt 25 bis 100 Termine im Zeitraum; darüber Liste verwenden. Kein Drag-and-drop.
- Mitgliederfilter und sortierbare Spalten sowie Marktfilter arbeiten auf bewusst geladenen Seiten. Keine unbeschränkten Echtzeit-Vollscans. Mitgliedschaften lassen sich gesammelt (maximal 20, je eigener Audit-Transaktion) ändern; Teilausfälle werden angezeigt.
- Reservierungsübersicht pro Gildenangebot mit Statusfilter und Auswahl zur Korrektur; bis 100 Anfragen je Angebot, weitere über ID. Globale Fremdreservierungen bleiben geschützt.
- Meldeprozess mit privatem Reporterzugriff, einer Meldung pro Minute und auditiertem Adminabschluss ist umgesetzt. Kein automatisches Urteil über Inhalte.
- Technische Rollen über Betreiberwerkzeug, kein normaler Client-Rolleneditor. Genau eine Gilde, keine Mandantenplattform.
- Discord-Verknüpfung ist operatorbestätigt, kein fertiger OAuth-Dialog. Bot nicht live registriert/getestet.
- Web-Editor deckt gespeicherte Ausrüstung und Kernwerte ab. Vollständiger Desktop-Zaubersimulator, Optimierer und sämtliche erweiterten Buff-Editoren bleiben Desktopfunktionen; deren gespeicherte Daten werden erhalten.
- Kontolöschung entfernt private Daten und Gildencharakterfreigaben. Gemeinsame Handels-/Kommentar-/Eventhistorie und Audits benötigen Betreiberregeln für Aufbewahrung/Anonymisierung. Gerätekopien und Exporte werden nicht ferngewischt.
- Kein Installer-Release, nativer Tauri-End-to-End-Test oder Produktionsdeploy.

Weitere Dokumente: [Einrichtung](COMMUNITY_FIREBASE_SETUP.md), [Sync](COMMUNITY_SYNC_ARCHITECTURE.md), [Tests](COMMUNITY_TEST_REPORT.md), [Benutzung](COMMUNITY_USER_GUIDE.md).

## Produktionsvorbereitung

Blaze und bestehender Bucket bleiben verbindlich. Owner-Auth-Identität und technische Rolle sind im echten Projekt geprüft/eingerichtet; Registrierung bleibt aus. Rules/Indizes/Storage-IAM noch nicht produktiv bereitgestellt. `.github/community-release-gate.json` sperrt Veröffentlichung bis Sicherheitsprüfung, Owner-Einrichtung, Rechtstextfreigabe und Live-Regelprüfung dokumentiert sind. Zusätzlich muss der Betreiber `COMMUNITY_PUBLICATION_APPROVED=true` freigeben. Build/Tests bleiben ohne diese Freigabe ausführbar. Signierter Kandidatenbuild ist separat vorbereitet; er erstellt weder Tag, Release noch Update-Manifest.
