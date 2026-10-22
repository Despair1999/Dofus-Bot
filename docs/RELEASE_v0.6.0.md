## DOFUS Companion 0.6.0 — Modern Dark Fantasy

Die Oberfläche erhält ein gemeinsames Design mit Anthrazit/Navy, Gold und Türkis. Die vier bisherigen Farbschemata bleiben verfügbar. Die neue gruppierte Seitenleiste lässt sich einklappen; Icon-Modus, Gruppen, letzte Ansicht und Kartenpanelbreiten werden gespeichert.

Mit **Strg+K** lassen sich Gegenstände, Sets, Monster, Dungeons, Quests, Ressourcen, Berufe, Builds und Koordinaten direkt öffnen. Das Dashboard zeigt zuletzt verwendete Bereiche sowie vorhandene Builds und Farmrouten. Einstellungen sind in neun Kategorien gegliedert; Textgröße, Informationsdichte und reduzierte Bewegung lassen sich anpassen.

Neue Set- und Monsterverzeichnisse verwenden die vorhandenen Originaldaten und Bilder. Die Itemsuche bietet eine gespeicherte Listenansicht. Karten- und Farmansichten erhalten veränderbare Seitenpanels und 834 Original-Kartenhinweise einschließlich 45 Zaaps und 130 Dungeonhinweisen. Direkte Links auf Untergebiete und gespeicherte Routen funktionieren; Karten-IDs und tatsächliche gerichtete Wege bleiben maßgeblich.

Vorhandene Karten-, Boss-, Ressourcen-, Klassen- und Zauberbilder bleiben erhalten. Bei Bildladefehlern werden weitere vorhandene Referenzen versucht und Fehler in einer sitzungsbezogenen Diagnose sichtbar. Es wurden keine neuen ungeklärt nutzbaren Spielbilder heruntergeladen. Discord Activity verwendet den gemeinsamen Stil; der Bot kann vorhandene Dungeonbilder direkt anhängen. Zwei lokale Übersetzer und das native Overlay bleiben erhalten.

Prüfungen: 108 Modul-/Integrationstests, 44 Browserprüfungen, Produktionsoberfläche mit gesperrten externen Bildservern, versionierter Dienstwechsel 0.5.0 → 0.6.0, Signatur-/Manipulations- und ZIP-Payload-Prüfungen. Die native Prüfung verwendet dieselben Quellen mit einer separaten QA-Anwendungskennung, damit das produktive Profil unverändert bleibt.

Grenzen: Nicht alle Dungeonstrategien sind patchgeprüft. Historische Bildreferenzen und ein Dungeoneintrag ohne belegten Boss bleiben teilweise unvollständig. Genaue Ressourcen-Spawns werden weiterhin nur aus eigenen bestätigten Funden verwendet. Echte Discord-Anmeldung sowie sämtliche DOFUS-/Monitor-/DPI-Kombinationen benötigen eine reale Zielumgebung. Ausführliche Einordnung: `docs/REDESIGN_REPORT.md` und `docs/REDESIGN_VALIDATION.json`.
