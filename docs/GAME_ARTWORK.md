Originalbilder und Atlas
======================

Die Anwendung liefert Bilder aus der ausdrücklich fixierten Originaldatenversion `v6.0_3.7.12.12` des Projekts [dofus-sqlite](https://github.com/ledouxm/dofus-sqlite) lokal mit. Bilder und DOFUS gehören Ankama; Companion ist ein unabhängiges Community-Projekt. Es werden keine Zugangssperren umgangen und keine fremden vollständigen Guideartikel importiert.

`packages/game-data/assets/image-sources.json` fixiert URLs, Dateigrößen und SHA-256 für vier Archive. `apps/desktop/public/game-assets/manifest.json` dokumentiert die geprüften Archivhashes und die tatsächlich vorhandenen Bilder. Die Bilder sind Bestandteil des Vite-/Tauri-Pakets, ohne entfernte Bild-CDNs für diese Einträge.

Reproduzieren:

```powershell
node infrastructure/scripts/fetch-game-images.mjs
uv run --with pillow python infrastructure/scripts/import-game-images.py
node infrastructure/scripts/verify-game-artwork.mjs
```

Zusätzlich benötigt der Import die bereits hashgeprüfte `.data/upstream.sqlite` aus dem bestehenden Datenimport und `dungeon-data.json`. Der Import konvertiert Item- und Monsterbilder verlustfrei nach WebP; Atlasbilder werden aus den numerisch sortierten Originalkacheln zusammengesetzt und mit Qualität 88 gespeichert. Jede Welt verwendet eine Originalauflösung nahe 0,4. Gegenstandsdateinamen entsprechen `ItemData.iconId`, Monsterdateien `MonsterData.gfxId` und Zauberdateien `SpellData.iconId`.

Die Weltkalibrierung stammt aus `WorldMapData`: `origineX`, `origineY`, `mapWidth`, `mapHeight` und den Gesamtabmessungen. Koordinaten bezeichnen Kartenmittelpunkte; die linke obere Bildgrenze liegt bei `-origineX/mapWidth - 0,5` und entsprechend für Y. Der Renderer berücksichtigt das Verhältnis `mapHeight/mapWidth` auch beim Verschieben, Zoomen, Treffen und Ermitteln des sichtbaren Ausschnitts. Bilder ersetzen keine bestätigten Übergänge oder Spawnpositionen.

Innenkarten behalten `sourceWorldId` und ihre unveränderte Map-ID. Für die Ansicht wird die erste gültige Referenz aus Untergebiet, Gebiet und Obergebiet verwendet. Unbekannte Eltern bleiben unbekannt; geometrische Nähe erzeugt keine Graphkante.

Historische Dungeonwerte bleiben versioniert. Illustrationen stammen sichtbar aus dem Bildstand 3.7.12.12; sie belegen keine historischen Werte. Expeditionsbilder stammen vom eindeutig namensgleichen klassischen Dungeon und werden entsprechend gekennzeichnet. Der Arachnas-Katalogeintrag ohne Bossreferenz bleibt ohne geratenes Bossbild.

Der Prüfbericht `artwork-v5-test.json` kontrolliert alle referenzierten Dateipfade, WebP-Header, Weltgeometrien und die vollständige Bildabdeckung der expliziten Bosse, Sammelressourcen und Berufsquest-Gegenstände.
