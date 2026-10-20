# Spieldaten-Importer

`GameDataStore` trennt importierte Daten von Benutzerdaten. Importiert werden aktuell Quests, Schritte und Ziel-Untertypen aus dem tatsächlich untersuchten `dofus-sqlite`-Schema. Deutsche und französische Namen werden übernommen. Fehlende deutsche Texte erhalten französischen Fallback. Questbedingungen bleiben unveränderte Kriterien; deren vollständige Interpretation ist noch nicht implementiert. Rohparameter bleiben erhalten, weil Bedeutungen zwischen Ziel-Untertypen abweichen.

```powershell
pnpm --filter @dofus/game-data import
# vorhandene lokale Datenbank:
pnpm --filter @dofus/game-data import C:/Pfad/dofus.sqlite v6.0_3.7.12.12
```

`GAME_DATA_PATH` bestimmt die Zieldatenbank. Relative Pfade beziehen sich auf das Prozess-Arbeitsverzeichnis. Für gemeinsame Nutzung durch Backend und CLI einen absoluten Pfad konfigurieren.

Automatische Downloads verwenden ausschließlich stabile GitHub-Releases des festgelegten Quellrepositories. Dateigröße, SHA-256 aus Release-Metadaten und SQLite-Integrität werden geprüft. Releases ohne Digest werden abgelehnt. Erst nach vollständiger Normalisierung ersetzt eine SQLite-Transaktion den bisherigen Bestand. Version, Zeit und Änderungen bleiben nachvollziehbar. Der Import bewahrt bei Fehlern den bisherigen Bestand. Der Download benötigt aktuell etwa 385 MB und entsprechende Schreibrechte/Plattenplatz. Es wird keine Datenbank im Git-Repository veröffentlicht.

Grenzen: Datenbank-Schemaänderungen werden abgelehnt statt geraten. Questziel-Reihenfolge folgt Quell-IDs, weil Junction-Tabellen keine explizite Reihenfolge enthalten. Daher keine Aussage über automatisch erkannte aktive Ziele. Schatzsuche/Live-Navigation sind wegen nicht erreichbarer DBI-API nicht implementiert. Die Datennutzung bleibt von Rechten des Spieleherstellers abhängig; kein Lizenzrecht an Spielinhalten wird behauptet.
