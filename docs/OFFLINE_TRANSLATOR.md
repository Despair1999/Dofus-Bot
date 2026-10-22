# Lokaler Übersetzer

Der Reiter **Übersetzer** und die beiden regulären Overlaymodule **Übersetzer · Nachrichten** sowie **Übersetzer · Antworten** nutzen denselben Python-Prozess. Nachrichten werden über JSON-Zeilen an dessen Standardeingabe übergeben. Der Prozess führt CTranslate2 4.8.0 auf der CPU mit INT8 und höchstens zwei Inferenzthreads aus. Weder Nachrichten noch Ergebnisse werden protokolliert oder dauerhaft gespeichert. Die Oberfläche verweigert für Übersetzungen ein entferntes Companion-Backend.

## Einrichtung und Bedienung

1. Unter Übersetzer **Sprachmodelle installieren** anklicken. Ausschließlich dieser ausdrückliche Installationsvorgang lädt Daten aus dem Internet.
2. Vier Originalpakete des [offiziellen Argos-Index](https://github.com/argosopentech/argospm-index) werden von `argos-net.com` geladen. Ein Fortschritt pro Paket wird angezeigt. Bereits vollständige, unveränderte Pakete bleiben erhalten.
3. Nach der Einrichtung funktionieren Deutsch ↔ Englisch, Französisch ↔ Englisch und Deutsch ↔ Französisch offline. Die beiden letzten Richtungen verwenden Englisch als Zwischenstufe, weil der untersuchte Argos-Index keine direkten DE/FR-Pakete anbietet. Dies wird im Ergebnis angezeigt.
4. Nachrichten einfügen oder schreiben, **Übersetzen** bzw. Strg+Enter drücken, Ergebnis mit **Kopieren** bzw. Strg+Umschalt+C übernehmen. Zwischenablagezugriff kann im Browser eine Freigabe benötigen; manuelles Einfügen mit Strg+V bleibt möglich.
5. Unter Einstellungen → Overlay die beiden Übersetzermodule aktivieren, verschieben und skalieren. Sie lassen sich einzeln minimieren und schließen. Im gesperrten Layout funktioniert weiterhin die Texteingabe; bei Click-through zunächst mit Strg+Alt+Umschalt+O die Bedienung wiederherstellen.

Das Layoutschema migriert bestehende Profile additiv und enthält höchstens diese zwei stabilen Modul-IDs. Position, Größe, Sprachen, Automatik und Minimierung werden gespeichert, die eingegebenen Chattexte dagegen nicht. Der Automatikmodus wartet 650 ms nach der letzten Eingabe. Veraltete Antworten werden nicht angezeigt. Beide Karten behalten getrennte Texte und Ergebnisse.

## Modelle, Speicher und Integrität

| Paket | Version | Downloadbytes | Installierte Bytes ohne Companion-Manifest |
|---|---|---:|---:|
| Englisch → Französisch | 1.9 | 65.472.327 | 82.504.162 |
| Französisch → Englisch | 1.9 | 66.585.033 | 82.556.925 |
| Englisch → Deutsch | 1.3 | 150.508.297 | 164.904.507 |
| Deutsch → Englisch | 1.3 | 150.512.831 | 164.937.694 |

Insgesamt 433.078.488 Downloadbytes (413 MiB), etwa 472 MiB installierte Modelle und 176 MiB Python-/Bibliotheksruntime im hier gebauten Paket. Während der Einrichtung wird zusätzlicher Platz für das jeweilige komprimierte Paket und dessen Entpackung benötigt; mindestens 1,5 GiB freien Speicher einplanen. Die Modelle liegen separat von persönlichen Datensätzen im AppData-Datenordner unter `translation-models`.

Es gibt im untersuchten Index keine veröffentlichten Modell-SHA256-Digests. Die Installation verwendet HTTPS, ZIP-CRC, sichere Archivpfade, Größenlimits und Strukturprüfung. Sie berechnet SHA256 für jedes installierte File und bewahrt den Archivdigest auf. Beim ersten Laden eines Modells im Prozess werden diese lokalen Digests geprüft. Das ist eine Prüfung gegen spätere lokale Beschädigung, keine unabhängige Signatur des Anbieters. Ein erneuter Installationsversuch erkennt beschädigte Modelle anhand dieser Digests.

Der Prozess hält maximal zwei Modellpaare im LRU-Cache. Bei einem Sprachwechsel kann ein anderes Paar neu geladen werden. Es gibt kein garantiertes RAM-Budget: der tatsächliche Bedarf hängt von Bibliothek und Text ab. Das CPU-Threadlimit verhindert unbegrenzte Inferenzparallelität; eine Warteschlange nimmt höchstens acht offene Anfragen auf. Beim Beenden des Backends wird der Worker beendet.

## Modellwahl und Qualität

[Argos Translate](https://github.com/argosopentech/argos-translate) bietet passende kleine CPU-Modelle und eine einfache offizielle Bezugsquelle. Für diese Integration werden die originalen Argos-Pakete direkt mit CTranslate2 und SentencePiece verwendet. Die umfangreichen Torch-/Stanza-/SpaCy-Abhängigkeiten der vollständigen Argos-Pythonbibliothek sind für kurze Chatnachrichten nicht nötig. Ein lokaler Satztrenner und die Bereinigung der in einigen Argos-Zielvokabularen enthaltenen SentencePiece-Leerzeichenmarker verhindern verlorene Sätze und sichtbare Tokenreste.

[OPUS-MT](https://github.com/Helsinki-NLP/Opus-MT) wurde als Alternative geprüft. Seine direkten Sprachpaare können bei DE/FR die Zwischenübersetzung vermeiden. Die üblichen Helsinki-NLP-Pakete benötigen jedoch zusätzlich eine Konvertierung in das hier genutzte CTranslate2-Format oder eine weitere Laufzeit. Es wurde kein vergleichender Qualitätsbenchmark derselben Texte mit OPUS-MT durchgeführt. Eine Überlegenheit von Argos gegenüber allen OPUS-Modellen wird daher nicht behauptet. Es gibt derzeit eine Standardstufe und keine vorgetäuschte Qualitätsstufe.

Ein kleines lokales Glossar erweitert französisches `dj`, übersetzt PA/PM bzw. AP/MP über die ausgeschriebenen Fachbegriffe und stabilisiert Cra. Die eigentliche Übersetzung aller Sätze bleibt neuronale Modellinferenz. Ein vollständiges mehrsprachiges Item-/Monsterglossar ist noch nicht implementiert. Bei Eigennamen und Umgangssprache können Fehler auftreten; insbesondere kann englisches „boss“ auf Französisch als „patron“ erscheinen. Kurze, vollständige Sätze liefern verlässlichere Ergebnisse als Slang. Höchstens 2.000 Zeichen pro Anfrage und 450 Modelltoken pro Satz; überschrittene Limits liefern eine Fehlermeldung und erhalten die Eingabe.

## Lizenzen

Python: PSF; CTranslate2: MIT; SentencePiece: Apache-2.0; NumPy: BSD-3-Clause; PyYAML und Setuptools: MIT. Ihre Paket-Lizenztexte bleiben in der mitgelieferten Runtime. Die französischen Argos-Modellpakete nennen Jörg Tiedemann und Santhosh Thottingal, OPUS-MT sowie CC-BY 4.0 im erhaltenen README. Die älteren deutschen 1.3-Pakete enthalten nur eine knappe Versionsangabe ohne gesonderten Lizenztext. Die Index-Lizenz allein beweist keine Modelllizenz. Deshalb werden Sprachmodelle nicht im Windows-Installer weiterverteilt; sie werden nach Benutzeraktion direkt von der offiziellen Quelle heruntergeladen. Eine spätere gebündelte Weiterverteilung der deutschen Pakete benötigt eine gesonderte belegte Modellfreigabe.

## Build und Prüfungen

Build-Voraussetzung ist [uv](https://docs.astral.sh/uv/), ausschließlich auf dem Entwickler-/CI-Rechner:

```powershell
.\infrastructure\scripts\setup-translator.ps1
pnpm bundle:backend
```

Das Setup lädt eine eigenständige Windows-Python-3.11-Runtime und die festgelegten Bibliotheksversionen. `bundle-backend.mjs` übernimmt die gesamte Runtime inklusive des Workers nach `resources/translator`. Tauri und das Portable-ZIP nehmen diesen Unterordner mit. Endnutzer installieren weder Python noch CUDA. Beide Windows-Workflows führen das Setup vor dem Build aus. Ein Build ohne Runtime bricht mit einer konkreten Setup-Anweisung ab.

Am 21.10.2026 ausgeführt:

- Sechs Unit-/API-Tests: gültige Richtungen, ungültige Eingaben, fehlende Runtime, 503 statt Fake-Ergebnis, Migration alter Overlayprofile, zwei unabhängige Karten, Duplikatsperre, Sprachvalidierung.
- Echte vier Modellarchive heruntergeladen und installiert. Der Worker selbst hat zusätzlich Englisch → Französisch direkt per HTTPS inklusive Fortschritt erfolgreich installiert. Dabei wurde eine unpassende Standard-User-Agent-Antwort und eine Windows-Dateisperre bei der Modellprüfung gefunden und korrigiert.
- `test-translator-offline.py` übersetzt alle sechs Richtungen mit blockierter Python-Socket-Erzeugung während der Inferenz. Alle Ergebnisse enthalten die vollständigen Testsätze ohne Tokenreste. Die Messungen lagen für die Testsätze bei etwa 0,09 bis 0,66 Sekunden auf diesem Rechner; das ist keine Hardware-unabhängige Garantie.
- Derselbe Test über Node→Python-JSON-Kommunikation mit gleichzeitig angefragten zwei Karten erfolgreich.
- Sechs echte REST-Aufrufe per Fastify-Injection mit der **kopierten, gebündelten** Python-/CTranslate2-Runtime erfolgreich. Ergebnisse in `.data/translator-bundled-test.log`, Offlinebericht in `.data/translator-offline-results.json`.
- Zwei Playwright-Oberflächentests erfolgreich: unabhängige Karten, manuelle und automatische Übersetzung, echte Browser-Zwischenablage, Sprachtausch, gespeicherte Präferenzen ohne Chattexte, ignorierte veraltete Anfrage und erhaltene Eingabe bei Modellfehler. Diese Tests verwenden ausdrücklich simulierte Übersetzungsantworten und ersetzen nicht die oben separat ausgeführte echte Modellprüfung.

Reproduzierbarer Offline-Integrationstest nach Modelleinrichtung:

```powershell
$env:PYTHONPATH = (Resolve-Path .data/translator-runtime/companion-deps).Path
$env:PYTHONUTF8 = '1'
& .data/translator-runtime/python.exe infrastructure/scripts/test-translator-offline.py
```

Ein vollständiger physischer Overlaytest über laufendem DOFUS, echte Zwischenablageberechtigungen im installierten WebView und mehrere Monitore/DPI-Stufen sind durch die Modell-/REST-Tests nicht nachgewiesen. Dafür: beide Karten im installierten Overlay aktivieren, Netzwerk extern blockieren, alle Sprachpaare wechseln, Nachrichten einfügen und kopieren, die Karten verschieben/minimieren, Companion neu starten und Konfiguration kontrollieren. Keine Nachricht wird automatisch in DOFUS eingefügt oder abgesendet.

Ergänzende native Abnahme: Die endgültige Windows-Portable-Ausgabe hat mit ihrer gebündelten Runtime beide Übersetzerkarten, alle sechs echten Sprachrichtungen und beide Overlaymodule bestanden. Nach dem Schließen bleiben weder Backend noch Pythonworker zurück. [Native Prüfungen](native-v4-test.json), [Prozessbeendigung](native-v4-lifecycle.json). Der separate Test bei blockierter Socket-Erzeugung belegt die lokale Inferenz; diese native UI-Prüfung beansprucht keinen physischen Test über einem laufenden DOFUS-Fenster.
