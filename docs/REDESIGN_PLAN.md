DOFUS Companion — Modern Dark Fantasy
====================================

Ausgangsbasis: v0.5.0, sauberer Checkout `a26fc26`, Entwicklungsbranch `codex/modern-dark-fantasy-ui`. Bestehende APIs, Datenbanken, Berechnungen, Offline-Übersetzung und Bilder bleiben erhalten.

Bestandsaufnahme
----------------

React 19/Vite 6, TypeScript, Lucide, Tauri 2/WebView2 und SQLite. Der vorhandene Fastify-Dienst liefert Katalog, Builder, Weltatlas und Dungeoninformationen. Discord Activity nutzt dieselbe Weltkartenkomponente mit eigener, instanzgebundener Anmeldung; Discord.js-Bot verwendet gemeinsame Backenddaten und eine Owner-Berechtigungsprüfung.

Die bisherigen Styles verteilen sich auf globale, v2-, v3- und v4-Dateien. Probleme: uneinheitliche Abstände und Überschriften, lange Einstellungsseite, fehlende modulübergreifende Suche, keine reine Icon-Sidebar, kein selbstständiges Monster-/Setverzeichnis, fehlende Bilddiagnostik und bisher nur Teilabdeckung im Asset-Audit. Weltkarte/Overlay unterstützen bereits mehrere der gewünschten Interaktionen; diese werden erweitert statt ersetzt.

Umsetzung
---------

1. Asset-Audit: vorhandene Manifeste, Katalogbilder, Klassen, Zauber, Regionen und Versionen vollständig prüfen; bestehende Zuordnungen sichern und Rechteprüfung getrennt von technischer Erreichbarkeit dokumentieren. Keine neuen ungeklärt lizenzierten Bilder herunterladen.
2. Designsystem: zentrale Rollen/Typografie/Abstände/Radien/Bewegung, hochwertiges Gold-/Türkisschema als zusätzlicher Standard, bestehende Farbschemata erhalten; gemeinsame Komponenten für Suche, Dialoge, Status, Karten und Leer-/Ladezustände.
3. AppShell: gruppierte Navigation, gespeicherter Icon-Modus, aktive Ansicht, verständliche Breadcrumbs/Zurückfunktion, zuletzt verwendeter Arbeitsbereich und globale tastaturbedienbare Command Palette.
4. Module: gemeinsamer visueller Rahmen für alle bestehenden Seiten, gezielte Verbesserungen an Karte, Items/Builder, Farming/Berufen, Dungeons/Monstern, Quests, Crafting/Almanax und Charakteren. Echte Monster- und Setverzeichnisse auf bestehenden Datensätzen; minimale zusätzliche GET-Endpunkte.
5. Arbeitsbereiche/Einstellungen: größenveränderbare Kartenpanels mit gespeicherten Breiten, kontextbezogene Kartenobjekte auf belegten Daten, kategorisierte Einstellungen, UI-Skalierung, Dichte und reduzierte Bewegung. Bestehende Konfigurationsmechanismen nutzen.
6. Overlay/Activity/Bot: gemeinsame Tokens, vorhandene Overlaygesten/Hotkeys und zwei lokale Übersetzer erhalten; Discord-Ausgaben vereinheitlichen, Bilddarstellung nur über gültige öffentliche URLs oder tatsächlich vorhandene Anhänge.
7. Qualität: sinnvolle Regressionstests für Suche, Tastatur/Dialogfokus, Route/Wiederherstellung, Bildfallbacks, Workspace, Module, Activity und Bot. Vollständiger Typecheck/Lint/Tests, Produktionsfrontend und Windows-Build. Laufende Benutzerinstanzen und produktive Datenbanken nicht verändern.
8. Abschluss: nachvollziehbare Commits, Bericht mit vollständigen/teilweisen/offenen Anforderungen und Grenzen; bestehender signierter Updateprozess bleibt erhalten.
