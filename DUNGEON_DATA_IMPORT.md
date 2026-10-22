# Dungeon- und Berufsquestdaten — 21.10.2026

Die Daten werden tatsächlich aus zwei getrennten, bereits vorhandenen dofus-sqlite-Datenbanken importiert. Vor dem Lesen werden SHA-256 gegen das versionierte öffentliche Manifest und `PRAGMA quick_check` geprüft. Die öffentliche JSON-Datei wird erst nach erfolgreicher Validierung über eine temporäre Datei atomar ersetzt. Persönliche Daten werden beim Import nicht geöffnet.

| Importierter Bestand | 3.6.12.16 | 3.7.12.12 |
|---|---:|---:|
| DungeonData-Einträge | 187 | 187 |
| Explizite Bossreferenzen | 141 | 141 |
| Unterschiedliche Bossmonster | 137 | 137 |
| Zugeordnete Monster | 896 | 896 |
| Originalgrade | 4.582 | 4.669 |
| Unterschiedliche Monsterzauber | 2.561 | 2.562 |
| Dropdatensätze | 7.757 | 7.774 |
| Dungeon-Kartenzugehörigkeiten | 763 | 763 |
| Ungültige Bossreferenzen | 0 | 0 |
| Belegte Raumzusammenstellungen | 0 | 0 |
| Einzelne geprüfte Mechanikfakten | 0 | 4 |
| Vollständige geprüfte Strategien | 0 | 0 |
| Berufsquests | 6 | 6 |

187 Katalogeinträge sind ausdrücklich **keine Behauptung, dass 187 Dungeons aktuell zugänglich sind**. Die Quelle enthält auch Sonderinstanzen und historische Einträge. Deshalb ist der Aktivitätsstatus zunächst `catalog-present` und in der Oberfläche entsprechend eingeschränkt beschrieben.

Quellen:

- [dofus-sqlite 3.7.12.12](https://github.com/ledouxm/dofus-sqlite/releases/tag/v6.0_3.7.12.12), SHA-256 `556567d880ca3bd3e33cad956cacefef99dcb36cb789f53827159d50e3763553`.
- [dofus-sqlite 3.6.12.16](https://github.com/ledouxm/dofus-sqlite/releases/tag/v6.0_3.6.12.16), SHA-256 `af4a2deb3026aaa65584215f5b2f899d9a29493676832cfb5e01ebca7674961d`.
- [Quell-Schema und Bildzuordnung](https://github.com/ledouxm/dofus-sqlite): Monsterbilder würden über `gfxId` aufgelöst. Mangels separat belegter Weiterverteilungsfreigabe wurden keine Monsterbilder heruntergeladen oder in das Paket aufgenommen; die Oberfläche verwendet eigene Symbole. Der Bildstatus bleibt offen.

## Reproduzierbarer Import

Mit heruntergeladenen, zu den Prüfsummen passenden Quelldateien im Repository-Stamm:

```powershell
node infrastructure/scripts/import-dungeons.mjs
# Alternativ ausdrücklich versionierte Pfade:
node infrastructure/scripts/import-dungeons.mjs "3.6.12.16=C:\Daten\dofus-3.6.sqlite" "3.7.12.12=C:\Daten\dofus-3.7.sqlite"
node infrastructure/scripts/audit-dungeon-directories.mjs
```

Das Asset enthält deutsche, französische und englische Namen, Originalgrade mit Resistenzen, Zauberränge mit AP/RW/Intervall und Originaleffekten sowie Dropbedingungen/Basisraten und Rezeptverwendungen. Monsterzuordnung zu einem Untergebiet wird nicht als Raumzusammensetzung ausgegeben. `DungeonData_mapIds_junction` liefert weder eine belastbare Raumreihenfolge noch genaue Monsterzahlen oder Varianten nach Gruppengröße.

## Guide-Abgleich

Beide Verzeichnisse wurden am 21.10.2026 live per HTTPS mit Status 200 geprüft. Der wiederholbare Audit zählt ausschließlich Dungeon-Tabellenzeilen; Layouttabellen werden herausgefiltert.

| Verzeichnis | Dungeonzeilen | Als entfernt markierte Referenzen | Eindeutig zuordenbare Zeilen |
|---|---:|---:|---:|
| [Dofus pour les Noobs](https://www.dofuspourlesnoobs.com/donjons.html) | 151 | 9 | 124 |
| [Dofus Portals](https://dofus-portals.fr/donjons/) | 150 | 8 | 122 |

Zusammen sind direkte Guide-Links für **121 verschiedene importierte Dungeons** auflösbar. Die Zuordnung akzeptiert nur eindeutige Dungeon- oder Bossnamenbeziehungen. Mehrdeutige Einträge bleiben ungeklärt. Entfernt-Markierungen in Verzeichnissen ersetzen keine Prüfung der Aktivität im jeweiligen Patch. Die lokale Datei enthält ausschließlich Linkbeziehungen und Zählwerte; keine übernommenen Guidevolltexte oder Bilder.

## Mechaniken und redaktioneller Workflow

Einzelne Fakten der [ausdrücklich auf Version 3.7 bezogenen Änderungsübersicht](https://www.dofuspourlesnoobs.com/mise-a-jour-307.html) wurden eigenständig formuliert: zwei Änderungen für Vortex sowie je eine für Capitaine Meno und Koutoulou. Die zugehörigen Planungsnotizen sind als **teilweise** gekennzeichnet, keine vollständigen Bossguides. Die Quellenprüfung bezieht sich auf die Versionsfamilie 3.7; diese Einträge werden niemals in die 3.6-Ansicht übernommen.

Unter „Quellen → Redaktioneller Ergänzungsworkflow“ können Mechaniken, Strategieabsätze, Quellen mit Version/Prüfdatum und Räume für eine konkrete Gruppengröße ergänzt werden. Schreibzugriffe benötigen den lokalen Verbindungsschlüssel. Der Server lehnt unbekannte Map-/Monsterreferenzen ab. „Verifiziert“ oder `mechanicsVerified` benötigt HTTPS-Quellen mit genau der ausgewählten Datenversion. Das ist eine technische Plausibilitätsprüfung, keine automatische inhaltliche Begutachtung eines eingetragenen Links. Alle ungeprüften Daten bleiben sichtbar als unvollständig.

Vorbereitungsliste, Favorit, Gruppengröße, Berufslevel und Questfortschritt liegen additiv in der persönlichen SQLite-Datenbank. Vorhandene Charaktere, Builds und Quests werden nicht ersetzt. Der Buildvergleich nutzt den vorhandenen Builder-Rechenkern und zeigt Werte nur aus derselben Spielversion; ohne belegte Mechaniken gibt es keine automatische Sieg- oder Eignungsbehauptung.

## Berufsquests

Alle sechs Berufsquests stammen aus `QuestData` und `QuestObjectiveBringItemToNpcData`: IDs 943–948, fünf Sammelberufe plus Jäger. Voraussetzungen werden aus dem Originalkriterium gelesen; Ziel-Item und Menge aus dem jeweiligen Übergabeziel.

Für [Piocher, c'est votre métier](https://www.dofuspourlesnoobs.com/piocher-c-est-votre-metier.html) bestätigt der 3.7-Datensatz: Quest 945, Bergmann 40, Charakter mindestens 20, 10 × Questitem 13289, Vasca Degamo, Startkarte 91751943 bei [21,14]. Die veralteten Zielkoordinaten [22,19] bleiben als Datenkonflikt dokumentiert und überschreiben die Startkarte nicht. Der Guide aus 2020 nennt die tägliche Wiederholung und Bronze ausschließlich in Amakna; diese Bereichseinschränkung ist keine unbelegte aktuelle Spawninformation.

`POST /api/world/farm-route` prüft `questId:945` serverseitig: nur Ressourcenobjekte mit Item 442 (Bronze, Skill 26), nur beobachtete Fundorte auf Karten in Gebiet 0 (Amakna). Ein vom Client eingesandter anderer Gebietsfilter kann dies nicht umgehen. Ohne bekannte persönliche Fundorte entsteht keine erfundene Farmtour. Für die übrigen Berufsquests ist die exakte regionsbezogene Routenfreigabe noch offen; der Server lehnt deren Quest-Farmrouten ab, statt eine falsche Route vorzuschlagen. Fortschritt und Wiederholungsreset werden manuell bestätigt.

## Ausgeführte Prüfungen

Zusätzlich wurden sieben kurze, eigene Guide-Notizen für Königlicher Fresssack, Korriandre, Comte Harebourg, Missiz Frizz, Ilyzaelle, König Nidas und Kimbo aufgenommen. Diese Quellen haben keine eindeutig belegte aktuelle Patchversion. Ihre Einträge bleiben `partial`, `mechanicsVerified=false` und tragen eine sichtbare Versionswarnung. Sie erhöhen weder die Anzahl aktuell verifizierter Mechaniken noch die Anzahl vollständiger Strategien. Das Paket enthält damit zehn teilweise redigierte Einträge; vier Mechanikfakten sind für die 3.7-Versionsfamilie belegt.

- Reale SHA-256-Prüfung und SQLite-Integritätsprüfung beider Quelldatenbanken; tatsächlicher Import beider Snapshots.
- Sieben Backend-Integrationstests zu Datenreferenzen, versionierter Suche, privatem Zugriff, Piocher-Voraussetzungen, Fortschritt, redaktioneller Validierung und Checklistenpersistenz.
- Zusätzlicher serverseitiger Weltkarten-Test für Amakna-Einschränkung, fremde Gebietsfilter und falsche Ressourcentypen.
- TypeScript-Prüfung der Backend- und Desktop-Pakete; ESLint der hinzugefügten Module.

Weitere allgemeine E2E-/Windows-/Release-Prüfungen werden im übergeordneten Updatebericht geführt. Die hier beschriebenen API-Tests laufen gegen lokale Fastify-Instanzen und echte importierte Daten; sie sind keine Discord-Livetests oder manuelle In-Game-Prüfung sämtlicher Dungeons.
