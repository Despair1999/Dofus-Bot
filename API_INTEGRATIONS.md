# Datenquellen und Integrationen

| Quelle | Verwendung und Grenzen |
|---|---|
| [dofus-sqlite](https://github.com/ledouxm/dofus-sqlite/releases) | Originaltabellen, deutsche/französische/englische Namen, Items, Rezepte, Klassen, Quests und Kategorien. Release und Digest werden überprüft. |
| [Dofusdude API](https://docs.dofusdu.de/dofus3/v1/) | Tatsächlich abgerufene fünf `/de/items/{category}/all`-Kataloge, formatierte Effekte, Bildadressen, Almanax. Backendcache, Zeitlimits, Fehlerbehandlung und begrenzte Upstream-Abfragen. |
| [DOFUS Pour les Noobs](https://www.dofuspourlesnoobs.com/) | Externe Originalguide-Links und gezielte Seitensuche. Zwei Artikel anhand ihres französischen Questnamens verifiziert: Destination Astrub und Réponses à tout. Kein Volltext-, Bild-, Übersetzungs- oder Scrapingimport. Weitergehende Integration benötigt eine ausdrückliche Lizenz und einen eigenen Adapter. |
| [Offizielle Klassenübersicht](https://www.dofus.com/en/mmorpg/encyclopedia/classes) | Die Seite war durch ihre dynamische Zugriffskontrolle nicht zuverlässig maschinell auswertbar. Verwendet wird BreedData; keine erfundenen Klassen und keine übernommenen Porträts. |
| Discord | Bestehende Owner-geschützte Commands nutzen weiterhin dieselben kompatiblen Backend-Routen. Offline-/Loopback-Tests vorhanden; kein echter Discord-Login ohne Botzugang. |
| [Tauri Updater](https://tauri.app/plugin/updater/) | GitHub-Release-Metadaten, Minisign-Prüfung, Download und NSIS-Installation. Anwendungs-ID und Schlüssel von v0.1 bleiben erhalten. |

DBI, DofusDB und Frigost sind keine produktiven Fallbacks dieser Version. Es werden weder unbekannte Endpunkte noch erfundene Schatzsuchenziele verwendet. Karten-/Mehrmonitorpositionen und Questkoordinaten sind unterschiedliche Datenflüsse.

OCR verarbeitet nur ausdrücklich ausgewählte Aufnahmen lokal mit Tesseract. Erkannten **Text** gleicht das konfigurierte eigene Backend mit dem vollständigen Katalog ab; Bildbytes werden dabei nicht übertragen. Quest- und eindeutige Schrittkandidaten bleiben Vorschläge. Eine Auswahl allein schreibt keinen Questfortschritt.

Die mitgelieferten Markenassets stammen aus dem vom Auftraggeber bereitgestellten Archiv. DOFUS und seine Spieldaten bleiben den jeweiligen Rechteinhabern zugeordnet. Das Projekt ist unabhängig von Ankama; Datenzugang ist keine pauschale Weiterlizenzierung sämtlicher redaktioneller Texte oder Grafiken.
