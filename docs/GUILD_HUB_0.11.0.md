# Gilden-Hub und Fehlerbehebung 0.11.0

## Ursachen und Korrekturen

- **Berufe / Charakter nicht gefunden:** Der zweite, abbrechbare GET-Client in `apps/desktop/src/v2/shared/request.ts` übermittelte im Gegensatz zum zentralen API-Client keinen `X-Companion-Account`. Der Backend-Proxy las deshalb die Gastdatenbank. Alle diese GETs verwenden jetzt denselben Namespace und verwerfen Antworten sowie Cache-Fallbacks nach einem Accountwechsel.
- **Sidebar:** Account-Charaktere wurden in der gemeinsamen CharacterManager-Quelle gespeichert, die Sidebar jedoch erst nach einer erfolgreichen Backend-Replikation informiert. Ein leerer gespeicherter aktiver Charakter wurde zudem nicht sinnvoll aufgelöst. Direkte Speicherereignisse, stabile IDs, eine persistente Auswahl und Hauptcharakterkennzeichnung verbinden beide Oberflächen. Die vorhandene SQLite-Replikation bleibt erhalten.
- **Wappen:** `fetch(data:image/...)` wurde durch die Connect-CSP blockiert. Lokale Canvas-Blob-Konvertierung ersetzt den Umweg; Transparenz und PNG/JPEG/WebP sind geprüft. Im produktiven Bucket fehlten außerdem CORS-Regeln für `getBytes()` im Browser. Gezielte Ursprünge für Website/Tauri wurden ergänzt; IAM und Storage Security Rules werden nicht aufgeweicht. Alte Wappen bleiben bei Fehlern bestehen; verwaiste Uploadpfade werden dauerhaft zur erneuten Bereinigung vorgemerkt.
- **Gildeneinstellungen:** Der Discord-Link bleibt optional. Ein leerer Link ist gültig und war laut Betreiber auch im fehlerhaften Formular leer. Die bisherige Fünf-Schreibvorgänge-Transaktion wurde im Produktivprojekt mit temporärer bestätigter Owner-Testidentität akzeptiert; der ursprüngliche Fehler ist damit **nicht eindeutig reproduziert**. Die Testidentität wurde entfernt, keine fachlichen Gilden-/Rechtstextwerte verändert. Der neue SDK-Pfad aktualisiert das Token, prüft Eingaben und frische Anmeldung vorab, prüft Revisionen und schreibt Rechtstextfreigaben nur bei echten Änderungen. Audit und Rules bleiben verpflichtend. Es wird keine unbelegte Ursache als sicher behoben ausgegeben.
- **Admin-Marktplatz:** Der fest codierte Gildenfilter blendete globale Angebote aus. Berechtigt sichtbare Angebote werden gemeinsam geladen; Filter für Sichtbarkeit, Zustand, Verkäufer, Server und Angebotsart arbeiten auf geladenen Seiten. Fremde globale Angebote bleiben nur lesbar, Systemrollen werden nicht erweitert.

## Datenmodelle und UI

Die bestehende Mitgliederprojektion `memberships/{uid}` erhält die optionalen Felder `personalStatus` (100 Zeichen) und `biography` (500 Zeichen). Die eigene Bearbeitung ist nur bei bestätigter Mitgliedschaft erlaubt und darf weder Rang, Status, UID, Audit noch technische Rollen ändern. Administrative Moderation verwendet weiterhin Revision und Audit. Keine E-Mail-/Auth-Daten werden in die Gildenprofile kopiert.

Die vorhandene `MemberDirectory` ist direkt im Gilden-Hub eingebettet. Ein zugängliches natives Dialogfenster zeigt Profile und Charakterkarten mit Fokus-Rückgabe und Escape-Schließen. Alte Mitglieder-Links öffnen den Hub. Der doppelte eingebettete Marktplatz und der separate Mitglieder-Navigationspunkt entfallen. Beide Marktplatzbereiche verwenden weiterhin dieselbe Implementierung. Verkäufer- und Discord-Darstellung verwenden eine gemeinsam abonnierte Profilquelle; Namensänderungen werden live übernommen. Das Meldesystem ist unverändert erhalten.

## Katalog

Alle 21.554 unterstützten Original-IDs wurden mit DOFUSDB-Attributen `exchangeable`, `m_flags`, Typ und Level abgeglichen. 17.233 verifizierte handelbare Vorlagen werden angeboten: 4.015 Ausrüstung, 3.509 Ressourcen, 3.100 Verbrauchsgüter, 6.609 Kosmetik. 4.321 nicht handelbare Vorlagen sind ausgeschlossen, keine ungeprüften IDs aufgenommen. `design/community-market-catalog.json` enthält Herkunft, Zeitpunkt und Ausgabehash. Individuelle Bindungen einzelner Spielgegenstände sind nicht aus Vorlagen beweisbar und werden deshalb ausdrücklich als im Spiel zu prüfen dargestellt.

Der gemeinsame Suchcode unterstützt IDs, deutsche/englische/französische Namen, Akzente und alle passenden Treffer. Die Oberfläche zeigt 30 Treffer je blätterbarer Seite und bietet Kategorie-/Levelfilter sowie Tastaturnavigation. Statische Daten werden erst bei Bedarf geladen; keine Firestore-Abfrage pro Suchzeichen.

## Bisherige Validierung

- 175 Workspace-Tests erfolgreich.
- 48 Emulator-/SDK-/Browserfälle erfolgreich, darunter reale Formularspeicherung ohne Discord-Link und bei freigegebener Registrierung.
- End-to-End: Account-Charakter in Sidebar, Bauer 200, Holzfäller 150, Sammelquestfortschritt, App-/Backend-Neustart und zweite isolierte Client-/SQLite-Instanz erfolgreich.
- Profile öffnen/schließen, eigene Bio geräteübergreifend ändern/löschen, fremde Bearbeitung verweigern und administrative Moderation erfolgreich.
- Wappen-Konvertierung für PNG/JPEG/WebP, Transparenz, Austausch, Anzeige in Website/Desktop und Entfernen erfolgreich.
- Acht Rust-Tests erfolgreich. Die isolierte QA-Anwendungskennung kann einen separaten Port verwenden; die produktive Kennung ignoriert Port-Overrides. Eine laufende Benutzeranwendung wird nicht beendet.

Weitere Regressionen, native Artefaktabnahme, neue Rules-Bereitstellung und Veröffentlichung werden erst nach ihrem tatsächlichen Abschluss ergänzt. Bestehende Veröffentlichungen, Accounts und Datensätze bleiben erhalten. Discord-Bot-Betrieb bleibt auf ausdrücklichen Betreiberwunsch für später zurückgestellt.

Quellen: [Firebase SDK-Downloads und CORS](https://firebase.google.com/docs/storage/web/download-files), [DOFUSDB-API, Beispielvorlage](https://api.dofusdb.fr/items/384), [DOFUS-Dude API](https://github.com/dofusdude/dofusdude-ts).
