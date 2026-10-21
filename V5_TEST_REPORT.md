DOFUS Companion 0.5.0 — UI, Atlas und Bilder
===========================================

Implementiert
------------

- Persistente aufklappbare Tools-Navigation; fünf persönliche Bereiche bleiben außerhalb. Die innere Navigation scrollt bei wenig Fensterhöhe.
- Vier persistente Farbschemata mit gemeinsamen Oberflächen-/Akzentvariablen und Synchronisierung zwischen nativen Fenstern. AP/BP/LP bleiben blau/grün/rot, zusätzlich mit Symbolen beschriftet.
- 40 Originalkarten, nach Quelldaten zusammengesetzt und kalibriert. Gemeinsamer Canvas für Weltkarte und Farmrouten; Ansicht passend zur gewählten Welt, optionales Raster, kontrastreiche Zielmarkierung.
- Questkoordinaten als Schaltflächen; Koordinatenlinks wählen eine tatsächliche Karte aus. Innenkarten erhalten die explizit belegte übergeordnete Ansicht, behalten jedoch ihre Map-ID und Originalebene. Ein Kartenklick lädt alle exakten Treffer unabhängig vom zuvor begrenzten Ausschnitt.
- Lokale Abdeckung aller 137 expliziten Bosse, 896 Monster, 124 Sammelaktionen, sechs Berufsquest-Gegenstände, Schlüssel und Bossdrops. 12.279 Itemicons und 543 zusätzliche Monsterzaubericons. Doppelte Eisenkarten in der Berufsauswahl entfernt.
- Trennung klassischer Dungeons und Expeditionen. 20 quellenbasierte Kurzleitfäden, versionsbezogene Grade/Zauber/Resistenzen und daraus angezeigte individuelle Kampfpläne. Historische Bildillustrationen und Expeditionsbilder sind gekennzeichnet.
- Backendversionsangabe stammt aus package.json; damit können Update-/Dienstprüfungen nicht auf einer veralteten festgeschriebenen Versionsnummer bleiben.

Validierung
-----------

- `pnpm typecheck`: alle fünf Workspaceprojekte erfolgreich.
- `pnpm lint`: erfolgreich.
- `pnpm test`: 105 unterschiedliche Tests, keine Fehler (Core 29, Game Data 8, Desktop 13, Backend 36, Discord 19). Backend nach der Versionskorrektur zusätzlich erneut vollständig geprüft.
- Gesamter Playwrightlauf: 37 bestanden, keine übersprungenen oder instabilen Tests. Umfasst bestehende Item-/Quest-/OCR-/Builder-/Offline-/Translatorfunktionen und neue Navigation, Farbschemata, Ressourcenbilder, Innenkarten- sowie Koordinatenlinks. Ein alter Test wurde an die aufklappbare Navigation angepasst. Ein durch den laufenden Bildimport überlasteter Vite-Prozess wurde vor dem erfolgreichen Gesamtlauf neu gestartet.
- Bildprüfung: 13.645 tatsächlich vorhandene WebP-Dateien, 60.021.676 Bytes. Alle 40 Welten, alle expliziten Bosse und sämtliche Sammel-/Berufsquest-Gegenstände abgedeckt. Archivhashes, Dateipfade, WebP-Header und endliche Weltgeometrien kontrolliert; Bericht: `docs/artwork-v5-test.json`.
- Isolierter Upgrade-Test mit echten alten/neuen gebündelten Windows-Node-Diensten von 0.4.0 auf 0.5.0 bestanden. Charakter, Questfortschritt, Build und Berechnung bleiben erhalten; persönliche Marker/Berufsfortschritte überstehen einen Dienstneustart. Produktive Datenbanken werden nicht verändert. Bericht: `docs/service-upgrade-v5-test.json`.
- Browserbilder wurden visuell geprüft; dabei eine zunächst zu schmale Ressourcenspalte korrigiert und durch eine Höhenprüfung abgesichert. Screenshots liegen in `artifacts/v5-*.png`.
- Zusätzlich wurde das exakt gebaute Vite-Frontend mit einem transparenten Proxy zum echten isolierten Backend und blockierten externen Hosts geprüft. Fünf Produktionsprüfungen für Atlas/Innenkarte, Bossbild/Kampfplan, alle sechs Berufsquestbilder, Farbpersistenz und AP/BP/LP bestanden ohne fehlende Dateien oder Browserfehler. Dies ist ein Chromium-Test, kein als nativ ausgegebener WebView-Test; Bericht: `docs/production-ui-v5-test.json`.
- Setup- und Portable-ZIP werden vollständig auf CRC-Fehler geprüft. Der enthaltene Installer und seine Signatur sowie EXE, Backend, Welt- und Dungeonpaket werden bytegenau mit den freigegebenen Dateien verglichen. Ein zunächst während des Tauri-Paketierungsschritts kopierter Portable-Build wurde nach Abschluss der Tauri-Metadatenänderung neu verpackt; nur das anschließend erfolgreich geprüfte Paket ist freigegeben.
- Signatur-, Build- und Paketfreigabe werden maschinell in `docs/release-v5-acceptance.json` dokumentiert. `verify-v5-signature.mjs` prüft auch einen manipulierten Installer gegen den bestehenden Updaterschlüssel.

Praktische Grenzen
------------------

Der zusätzliche native WebView-/Overlaytest wird bei bereits laufender Anwendung ausdrücklich übersprungen, um diese Instanz nicht zu schließen oder ihr Profil umzuschalten; siehe `docs/native-v5-test.json`. Es fand keine automatische Installation über die laufende Benutzerinstallation statt. `run-native-v5-smoke.mjs` enthält die reproduzierbare Prüfung für einen freien Testlauf einschließlich Originalkarten, Farbpersistenz und AP/BP/LP sowie der bisherigen echten Übersetzungs-/Overlayprüfungen.

20 Kurzleitfäden sind keine vollständige redaktionelle Patchprüfung aller 187 Katalogpositionen. Vollständige fremde Guideartikel werden verlinkt. Der Arachnas-Katalogeintrag enthält keine eindeutige Bossreferenz und behält einen Platzhalter. Bilder stammen aus 3.7.12.12, historische Werte bleiben ausdrücklich getrennt. Exakte Ressourcenfundorte, Raumgruppen und unbekannte Graphkanten werden weiterhin nicht erfunden; Farmwege bleiben vom belegten Übergangsgraph und bestätigten persönlichen Fundorten abhängig.

Veröffentlichung
----------------

[Version 0.5.0](https://github.com/Despair1999/Dofus-Bot/releases/tag/v0.5.0) ist veröffentlicht und als neueste Version gesetzt. Der tatsächlich konfigurierte öffentliche Update-Endpunkt liefert 0.5.0; seine Signatur stimmt mit dem unabhängig geprüften Installer überein. Der Installer ist öffentlich erreichbar. Bericht: `docs/public-updater-v5-test.json`.

Installer: 134.838.908 Bytes, SHA-256 `f4bde0e90b569dde348a056dda4ff8c09f8f16b5759a87c70654babda0704ca9`. Die vollständigen Paketprüfsummen stehen in `docs/BUILD_v0.5.0_SHA256.json`. Setup- und Portable-ZIP haben ihre vollständige CRC- und Payloadprüfung bestanden. Die produktive Anwendung wurde nicht automatisch aktualisiert.
