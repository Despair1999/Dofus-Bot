# Prüfbericht

Stand 23.10.2026. Basis main 0.9.2. Kein Produktionsdeploy.

## Prüfung

- `pnpm typecheck`: alle Workspace-Projekte erfolgreich.
- `pnpm lint`: erfolgreich.
- `pnpm test`: 164 erfolgreich, keine Fehler: Core 30, Community 22, Game Data 8, Website 7, Desktop 32, Backend 46, Discord 19.
- `pnpm test:community`: 34 erfolgreich, keine Fehler: 21 Rules-, zehn SDK-Integrations- und drei Chromium-Browsertests.
- Desktop- und Website-Produktionsbuild erfolgreich. Vite meldet große JS-Chunks; Codeaufteilung bleibt eine mögliche Optimierung.

Nachgewiesen: echte Emulator-Registrierung, private Zustimmung, Verifikation, Reset, Login/Logout, zwei unabhängige Sync-Clients, Offline-Queue, idempotente Wiederholung, konkurrierende Revisionen, lokale Änderung während Upload, Konfliktentscheidung und dauerhafter Backend-Mutationszähler mit exakter Bestätigung.

Rules prüfen anonyme/unbestätigte Nutzer, deaktiviertes Onboarding, gefälschte Rollen/Profile, private Zustimmung gegenüber Admins, Mitgliedschaftsentzug, Auditfälschung, fremde/gemeinsame Daten, Mengenarithmetik und Zustandsübergänge, Kapazität und Teilnahme. Integration prüft Storage-Upload/Lesen/Austausch/Löschen unbenutzter Bilder, Archivierung/Wiederherstellung, verschachtelte Moderation und Kontolöschung mit Sperrmarker gegen alte Clients.

Drei echte Chromium-Browsertests: regulärer Nutzer ohne Adminzugang; Website-Charakter erreicht Desktop/SQLite ohne Reload; falsches persönliches Adminpasswort verweigert, richtige Reauth erlaubt auditierte gemeinsame Konfigurationsänderung. Isolierte gebaute Website-/Desktop-Testbundles; Screenshots lokal in `test-results/community-ui/`, nicht eingecheckt.

## Grenzen

CLI HTTP 401 bleibt bis interaktiver Neuanmeldung offen. Keine produktiven Rules/Indizes/Rollen geändert. Keine echte E-Mail-Zustellung, produktiver Bucket, laufender Discord-Bot oder native Tauri-Installation end-to-end geprüft. Updater erhalten, kein Release veröffentlicht. Rechtstexte sind markierte Entwürfe; Registrierung standardmäßig gesperrt.

CI installiert Chromium und nutzt ausschließlich `demo-dofus-community`. Erwartetes PERMISSION_DENIED der Negativtests ist kein Fehler. Windows-Wrapper setzt Java-TCP-Fallback nur für seinen Prozess. [Bekannte Funktionsgrenzen](COMMUNITY_ARCHITECTURE.md).
