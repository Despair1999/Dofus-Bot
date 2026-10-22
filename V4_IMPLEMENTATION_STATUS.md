# DOFUS Companion v0.4.0

Die drei Aufträge sind als Erweiterungen des vorhandenen Tauri/React/Fastify-Monorepos implementiert. Bestehende Charaktere, Builds, Quests, Einstellungen und der Update-Verifikationsschlüssel bleiben erhalten. Die Datenbankänderungen sind additiv. Die unterstützten Datenstände sind ausdrücklich **3.7.12.12** und bei Dungeons/Monstern zusätzlich **3.6.12.16**; daraus folgt keine Behauptung, diese seien am Abrufdatum der neueste verfügbare Live-Patch.

## Nutzbare Funktionen

- **Weltkarte:** gemeinsame Canvas-Komponente für Desktop/Web/Activity, Weltwechsel, Verschieben, Zoomen, Koordinaten-/Map-ID-/Gebietssuche, Auswahl mehrerer Karten an gleichen Koordinaten, Ressourcenregionen, persönliche Beobachtungen/Wegpunkte, Berufs-/Levelfilter, Charakterberufslevel, lokale Filterauswahlen, Kartenkopie und Vollbild. Kartenpositionen werden viewportbezogen geladen; bei Antwortbegrenzung weist die Oberfläche darauf hin. Kein fremder Kartenhintergrund wird ohne belegte Freigabe verteilt.
- **Routing/Farming:** Dijkstra über gerichtete, explizite Übergänge; mehrere Ziele, Rückweg, ausgeschlossene Karten im API, erreichbare Teilrouten, gespeicherte Routen, manuelle Schrittbestätigung und Overlaynavigation. Die Tour ist eine Heuristik und kein behauptetes globales Optimum. Farmrouten verwenden persönliche Ressourcenbeobachtungen; Mengen, Verfügbarkeit, Lauf-/Sammelzeit und Preise sind eigene Annahmen. Unbekannte Preise bleiben unbekannt. Crafting und Quests verlinken passende Ziele.
- **Berufe:** sechs originale Sammelquests, pro Charakter gespeicherte Berufslevel, Ressourcenfreischaltungen und manuell bestätigte Mengen/Abschlüsse. Piocher benötigt die spezielle Questressource; serverseitige Routenbeschränkung auf Bronze in Amakna. Vergleichbare Questgebiete werden ohne verifizierte Einschränkungen nicht zu angeblich korrekten Farmrouten erklärt.
- **Dungeons:** versionierter Katalog, Suche/Level/Pagination, Bosswerte, Originalgrade/Resistenzen, Zauber, Drops/Rezeptbezüge, Erfolge, zugeordnete Karten, Quellen, persönliche Vorbereitung/Favoriten und Buildvergleich. Raumbelegungen und Gruppenskalierung werden nur gezeigt, wenn sie redaktionell belegt wurden. JSON-Redaktion prüft Quellen, Version, Raum-/Monsterreferenzen und Verifizierungsstatus.
- **Übersetzer:** zwei unabhängige Overlaymodule und eine Desktopseite, Sprachtausch, Zwischenablage, Strg+Enter, manuelle/automatische Übersetzung mit Debounce, Verwerfung veralteter Ergebnisse, Minimierung/Position/Größe und persistente Spracheinstellungen. Alle sechs Richtungen funktionieren lokal; DE↔FR verwendet Englisch als Zwischenstufe. Vier Modelle benötigen einmalig etwa 413 MiB Download bzw. 472 MiB installiert; die mitgelieferte Runtime benötigt etwa 176 MiB. Keine Chattexte werden dauerhaft gespeichert.
- **Discord-Bot:** Karten-/Ressourcen-/Berufs-/Dungeonbefehle, Details, persistente Dungeonbuttons und Pagination, Karten-PNG aus eigenen Daten und private Farmprojekte/-routen mit Owner-Gate. Ein Dungeonbutton bzw. `/dungeon gruppe` öffnet ein Formular und übernimmt Dungeon/Version in die vorhandene Gruppenverwaltung; die bestehende Serverberechtigung „Events verwalten“ bleibt erforderlich. Die Command-Registrierung erhält den offiziellen Activity-Entry-Point.
- **Discord Activity:** offizielles Embedded App SDK, serverseitiger OAuth-Austausch, App-/Instanzteilnahmeprüfung, scoped Sitzungen, gemeinsame ausdrücklich geteilte Kartenziele, Konfliktprüfung und Wiederverbindung. Dieselbe Karte und dieselben Graphberechnungen. Externes HTTPS-Hosting und Developer-Portal-Einrichtung müssen separat vorgenommen werden; ohne diese wird keine laufende Live-Activity behauptet.

## Datenumfang und Quellenlücken

| Bereich | Tatsächlich importiert / Grenze |
|---|---|
| Weltkarten | 40 Welten, 15.409 Kartenpositionen, 69 Gebiete, 567 Untergebiete |
| Ressourcen | 124 Skillaktionen, 118 unterschiedliche Items; überwiegend belegte Regionen statt exakter Knoten |
| Interaktionsobjekte | 31.416 ungelöste Interaktionen mit Kartenbezug; keine erfundene Ressourcenzuordnung |
| Graph | 3.461 explizite gerichtete Übergänge, 2.463 Knoten; unvollständiger Teilgraph, keine vollständige Zell-/Zonen- und Zugangsprüfung |
| Dungeons | Je Datenstand 187 Katalogeinträge, 137 eindeutige Bossreferenzen und 896 verbundene Monster |
| Monster 3.7 | 4.669 Grade, 2.562 verschiedene Zauber und 7.774 Dropdatensätze |
| Guides | Zwei Verzeichnisse live geprüft; 121 eindeutig passende Dungeonlinks. Ein Guideeintrag beweist keinen aktuellen Aktivitätsstatus. |
| Räume | 763 Kartenmitgliedschaften; keine daraus abgeleiteten erfundenen Monsterzusammenstellungen |

DBI war während dieser Arbeit nicht per DNS erreichbar; der lokale explizite Kartenwechselgraph bleibt verfügbar. DofusDB wurde nicht als Daten-API verwendet. Weltkarten-/Monsterarchive wurden ohne passende Nutzungsfreigabe nicht als lizenzierte Grafiken verteilt. Itembilder verwenden die bereits integrierte Dofusdude-Quelle mit neutralem Fallback.

Vollständige bossgenaue Strategien für den gesamten Katalog, autoritative Raumbelegungen je Gruppengröße, verifizierte Aktiv-/Historischzuordnung aller Dungeons, ein vollständiges mehrsprachiges Entitätsglossar und Live-Discord-Abnahme sind noch nicht vollständig vorhanden. Diese Einschränkungen sind im Produkt und den Importberichten sichtbar. Die vorhandenen Quellen-/Redaktionswerkzeuge erlauben Ergänzungen ohne Vermischen der Versionen.

Prüfergebnisse und Windows-Artefakte stehen in [V4_TEST_REPORT.md](V4_TEST_REPORT.md). Ausführliche Herleitung: [Welt](WORLD_DATA_IMPORT.md), [Dungeons](DUNGEON_DATA_IMPORT.md), [Übersetzer](docs/OFFLINE_TRANSLATOR.md), [Activity-Einrichtung](ACTIVITY_SETUP.md).
