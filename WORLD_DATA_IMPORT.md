# Weltkarte und Farming: Import- und Prüfbericht

Stand: 21.10.2026. Der Datenbestand ist ausdrücklich **DOFUS 3.7.12.12**, keine Behauptung über eine später erschienene Spielversion.

Quelle: [dofus-sqlite, Release v6.0_3.7.12.12](https://github.com/ledouxm/dofus-sqlite/releases/tag/v6.0_3.7.12.12). Die vorhandene `dofus.sqlite` und die tatsächlich heruntergeladene `maps.sqlite` wurden mit den SHA-256-Digests und Dateigrößen aus den GitHub-Release-Metadaten verglichen. SQLite `quick_check` wurde ausgeführt. Export: `packages/game-data/assets/world-data.json`; reproduzierbarer Import: `python infrastructure/scripts/import-world-data.py`.

| Gegenstand | Tatsächlich importiert |
|---|---:|
| Weltkarten | 40 |
| Karten-IDs | 15.409 |
| Gebiete | 69 |
| Untergebiete | 567 |
| Sammelfertigkeiten mit aufgelöstem Item | 124 |
| Explizite gerichtete Kartenwechsel | 3.461 |
| Knoten im Teilgraph | 2.463 |
| Interaktionsobjekte mit vorhandener Kartenreferenz | 31.416 |
| Noch nicht einer Ressource zuordenbare Objekte | 31.416 |
| Vom Import bestätigte exakte Ressourcenvorkommen | 0 |
| Wegen fehlender Kartenreferenz verworfene Interaktionsobjekte | 291 |
| Wegen fehlender Kartenreferenz verworfene Übergänge | 1 |

124 sind Fertigkeiten, nicht 124 verschiedene marktfähige Rohstoffe. Auch besondere Sammelaktionen ohne Berufsanforderung stehen in `SkillData`; mehrere Fertigkeiten können dasselbe Item liefern.

`dofus.sqlite` SHA-256: `556567d880ca3bd3e33cad956cacefef99dcb36cb789f53827159d50e3763553`.

`maps.sqlite` SHA-256: `10f0e6f54ec1bd49f3458a55768096813d4f1be3d08afbe91c9d6be479d1cf0b`.

## Tatsächliche Zuordnungen und Grenzen

`MapInformationData` liefert Position, Weltkarte und Untergebiet. `SubAreaData` liefert Gebiete und regionale `harvestables`. Die Beziehung `SkillData.gatheredRessourceItem → ItemData.id` ordnet Sammelfertigkeit, Berufs-ID und `levelMin` zu. Namen werden über `translations.id`, bevorzugt Deutsch, aufgelöst.

`maps.sqlite` enthält `map_interactions(mapId,worldId,gfxId,cellId,interactionId)`. Es enthält keine `skillId` oder `itemId`. Weder die grafische ID noch die Instanz-ID ist ohne zusätzliche belegte Beziehung eine sichere Referenz auf die Ressource. Diese Objekte bleiben ausdrücklich ungeklärt; regionale Vorkommen werden nicht auf jede Karte verteilt. Eigene Ressourcenbeobachtungen sind separat in `personal.sqlite` gespeichert und nicht als aktuelle Spawns gekennzeichnet.

Die Graphkanten stammen ausschließlich aus `MapScrollActionData` und vorhandenen Karten-IDs. Dijkstra berechnet gerichtete kürzeste Wege; eine Mehrzielroute wählt jeweils das nächste erreichbare Ziel nach tatsächlichem Graphabstand. Rundwege und Ausschlusskarten werden berücksichtigt. Fehlende Rückwege/Ziele bleiben unerreichbar. Der Graph ist unvollständig und enthält keine vollständigen Zell-, Zonen-, Quest- oder Zugangsvoraussetzungen. Ein Ergebnis ist deshalb eine Kartenwechselhilfe, keine garantierte vollständig begehbare In-Game-Route.

Der [DBI-Quellcode und die dokumentierten Schemata](https://github.com/Dofus-Batteries-Included/DBI.Api) wurden geprüft. Der direkte Live-Aufruf von `https://api.dofusbatteriesincluded.fr/data-center/game-versions` scheiterte in dieser Umgebung an DNS-Auflösung; auch der Browserabruf war nicht erreichbar. Es wurde kein erfolgreicher DBI-Livetest behauptet und kein älterer DBI-Graph in 3.7-Daten gemischt. Für eine spätere Integration müssen Version und Zonenidentität zusätzlich geprüft werden.

Die DofusDB-API wird nicht benutzt. Es werden keine DofusDB-Kacheln oder fremden Guidebilder übernommen. Der Kartenhintergrund bleibt eigenständig schematisch; eine Freigabe der Spielgrafiken zur Weiterverteilung wird nicht aus einer Downloadmöglichkeit abgeleitet.

## Ausgeführte Prüfungen

`pnpm exec tsx --test packages/core/tests/world.test.ts apps/backend/tests/world.test.ts`: **7/7 erfolgreich**. Enthalten: gewichtete gerichtete Wegsuche, Rundweg, unerreichbare Ziele, Ausschlusskarten, Wertannahmen und unbekannte Preise; echter importierter Weltbestand mit Referenzprüfung; räumliche Abfrage; persönliche Beobachtungen und Löschen; keine erfundenen Farmknoten vor einer Beobachtung.

Backend und Core TypeScript-Prüfung waren erfolgreich. Das Windows-Node-SQLite enthält kein RTree-Modul; der tatsächlich geprüfte Ersatz verwendet SQLite-Koordinatenindizes (`positions_xy` und `positions_yx`) für Ausschnittsabfragen. Die Tests sind lokale Daten-/Integrationsprüfungen, keine DOFUS-Client- oder DBI-Liveprüfung.

Zusätzlich: `apps/backend/tests/map-preview.test.ts` **2/2 erfolgreich**. Ein unabhängiger PNG-Prüfer validiert Chunk-Grenzen und CRCs, dekomprimiert die Bilddaten und prüft die Pixelgeometrie von Start, Ziel und ausdrücklich belegten Verbindungen. Ohne Graphkante erscheint keine Verbindungslinie. Endpunktgrenzen, gemischte Welten und die Unabhängigkeit der öffentlichen Vorschau von privaten Markern wurden geprüft.

`tests/e2e/world-intelligence.spec.ts`: die drei Welt-/Farm-/Berufs-/Dungeonprüfungen waren erfolgreich; zusätzlich war die Prüfung des außerhalb von Discord geöffneten Activity-Einstiegs erfolgreich. Reale lokale Backenddaten wurden auf isoliertem Port 4311 benutzt, ohne den installierten Dienst auf 4310 zu verändern. Geprüft wurden unter anderem Karten mit gleichen Koordinaten, unterschiedliche Map-IDs, fehlende Graphwege, Ressourcenfilter, Quest-945-Verknüpfung, unbekannte Preise und horizontale Begrenzung bei 1366 und 600 Pixeln. Die dabei erzeugten Screenshots liegen unter `artifacts/v4-world.png`, `artifacts/v4-professions.png` und `artifacts/v4-dungeons.png`; weitere UI-Änderungen können einen erneuten Lauf erfordern.

Discord: `apps/discord-bot/test/intelligence.test.ts` **4/4 erfolgreich**: tatsächliche Command-JSON-Strukturen mit Optionsgrenzen, Dungeon-Embeds mit Pagination und fehlenden/unverifizierten Inhalten, Buttonvalidierung sowie private Farmrouten-/Projektpfade mit Owner-Gate. Das sind lokale Komponententests und keine erfolgreich registrierten Discord-Livecommands.

## Schnittstellen

Öffentlich lesbar: `/api/world/status`, `/worlds`, `/maps`, `/maps/:id`, `/resources`, `/resources/:id` (jeweils mit `/api/world` davor). Ausschnittsfilter sind `worldId`, `areaId`, `subAreaId`, `minX`, `maxX`, `minY`, `maxY`, `q`, `limit`. Ressourcenfilter sind `q`, `jobId`, `maxLevel`.

Authentifizierte lokale Aktionen: `POST /api/world/route`, `/farm-route`, `/farm-estimate`; private GET/POST/DELETE unter `/api/world/personal/markers` und `/api/world/personal/routes`. Farmrouten benutzen ausschließlich persönliche Ressourcenbeobachtungen. Ein unbekannter Marktpreis bleibt `null`; Ausbeute, Verfügbarkeit und Lauf-/Sammelzeit bleiben explizite Benutzerannahmen.

Persönliche Marker und gespeicherte Routen tragen die Datenversion. Sie werden niemals in das öffentliche Datenpaket geschrieben. Zum Einbinden des Snapshots im Release dient `COMPANION_WORLD_DATA`; alternativ wird die neben dem Backend liegende `world-data.json` geladen.
