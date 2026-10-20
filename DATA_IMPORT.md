# Datenimport v0.2.2

Geprüfter Import am 20.10.2026, dofus-sqlite `v6.0_3.7.12.12`. Mengen stammen aus dem Importbericht [design/catalog-import-v2.json](design/catalog-import-v2.json), nicht aus fest programmierten Sollwerten.

| Bestand | Eindeutige Datensätze |
|---|---:|
| ItemData + WeaponData | 21.554 |
| Dofusdude-Ergänzungen | 17.377 |
| Ausrüstung | 4.095 |
| Ressourcen | 3.521 |
| Verbrauchsgegenstände | 3.366 |
| Questgegenstände | 3.907 |
| Kosmetik einschließlich zusätzlicher Originaldatensätze | 6.665 |
| Rezepte | 4.743 |
| Quests | 1.976 |
| Klassen | 19 |

Alle API-IDs wurden im Originalbestand aufgelöst; kein Rezeptmaterial verweist auf einen fehlenden importierten Gegenstand. Zusätzliche Originaleinträge können versteckt, historisch oder nicht regulär im Spiel erhältlich sein. Ihre Existenz ist keine Verfügbarkeitszusage.

3.086 Originaleinträge besitzen keine nutzbare Bildreferenz. 17.377 Einträge besitzen die zusätzlichen formatierten API-Effektdaten. Fehlende Texte und Bilder werden nicht erfunden. Bildreferenzen verwenden Original-Icon-IDs beziehungsweise die vom API gelieferten Bildadressen. Laufzeitfehler erzeugen eine neutrale Bilddarstellung. Die Zahl fehlender Referenzen zählt keine HTTP-Ausfälle. Originaltyp 264 hat im gewählten Release keinen Typ-Metadatensatz; seine echte ID bleibt erhalten und wird als unbekannter Typ markiert.

## Architektur und Aktualisierung

SQLite speichert normalisierte Items, Typen, Materialbeziehungen, Klassen, Questkategorien und Übersetzungen. Ein indizierter Tokenbestand ermöglicht mehrsprachige Präfixsuche; Teilwortsuche ergänzt ihn. Tippfehler werden bei ausbleibenden Treffern über Damerau-Levenshtein-Abstand vorgeschlagen, immer innerhalb der gesetzten Filter. SQL-Werte bleiben parametrisiert; Sortierausdrücke sind vorgegeben.

Die Hierarchie nutzt originale QuestCategoryData sowie echte Achievement-Zuordnungen über Questkriterien. Eltern zählen eindeutige Quests ihrer Unterkategorien. Mehrfachzuordnungen werden nicht doppelt gezählt. Voraussetzungen und Belohnungsformeln bleiben Originaldaten; es wird kein vollständiger interpretierter Questkettenplaner vorgetäuscht. Einige Original-Zieltexte enthalten Platzhalter, für die der Quellbestand keine vollständige Darstellung liefert.

Der Downloader akzeptiert ausschließlich den vorgesehenen GitHub-Upstream, begrenzt Größen und prüft den veröffentlichten SHA-256-Digest. Angefangene Dateien werden mit HTTP-Range fortgesetzt; ignoriert der Server Range, beginnt eine sichere vollständige Übertragung. Nur vollständig geprüfte Dateien werden aktiviert. Ein Import geschieht in einer Transaktion, inklusive Fremdschlüsselprüfung. Benutzerprofile und Fortschritte befinden sich in einer anderen Datenbank.

Der Release enthält einen öffentlichen Katalog-Snapshot ohne persönliche Tabellen. Dieser wird bei fehlendem Itemkatalog transaktional aktiviert. Bei vorhandenem Katalog bleibt die eigene Datenversion erhalten. Die optionalen API-Ergänzungen werden vor einem vollständigen Import geladen; bei deren Ausfall bleibt der bisherige aktive Stand unverändert.

Klassen stammen aus BreedData, einschließlich Sacrieur (ID 11). Profile speichern die stabile ID und einen kompatiblen Namen. Bilder sind eigene neutrale Symbole; offizielle Klassenporträts wurden ohne belegte Weiterverwendungsfreigabe nicht übernommen.

Zur lokalen Reproduktion: `pnpm exec tsx infrastructure/scripts/import-v2-local.ts`. Der Scriptcache liegt ausschließlich in `.data/`; er enthält öffentliche Quelldaten und gehört nicht in Git.
