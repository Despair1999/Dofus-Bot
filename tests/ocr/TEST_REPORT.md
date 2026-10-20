# Lokale OCR: ausgeführter Prüfbericht

Ausgeführt am **20.10.2026 um 16:44 Europe/Berlin** auf Windows mit Node 22.15.0 und Tesseract.js 6.0.1/WASM.

Die Fixtures wurden selbst mit Python/Pillow und der lokal installierten Schrift Arial erzeugt. Es handelt sich ausdrücklich **nicht um DOFUS-Screenshots**. Die Texte sind synthetische Testdaten. Die Bilder wurden lokal verarbeitet; keine Screenshots wurden an einen Dienst übertragen. Beim ersten Lauf wurden Sprachmodelle von Tesseracts voreingestelltem jsDelivr-CDN heruntergeladen und unter `.data/ocr-models` zwischengespeichert: `deu.traineddata` (2070514 Bytes), `fra.traineddata` (1248107 Bytes).

| Prüfung | Ergebnis |
|---|---|
| Deutsches Bild `fixtures/de.png` | Titel „Prüfung des Schülers“ exakt erkannt, OCR-Konfidenz 95, gemeinsamer Textmatcher 1.0, Kandidat 1 korrekt |
| Französisches Bild `fixtures/fr.png` | Titel „Épreuve de l’élève“ exakt erkannt, OCR-Konfidenz 94, gemeinsamer Textmatcher 1.0, Kandidat 1 korrekt |
| Leeres weißes Bild, deutsche Engine | Leerer Text, kein Kandidat |
| Leeres weißes Bild, französische Engine | Leerer Text, kein Kandidat |
| Desktop-Matching-Tests | 5/5 bestanden: DE/FR-Normalisierung, exakter Titel, Leertext, französischer Alias, schwache Übereinstimmung |
| Desktop-Typecheck nach gemeinsamer Typ-/Matcher-Nutzung | Bestanden |

Die Rohresultate stehen in `last-result.json`. OCR-Konfidenz und Textähnlichkeit sind verschiedene Messwerte und werden getrennt ausgegeben. Keine automatische Questfortschrittsänderung erfolgt anhand dieses Tests.

## Wiederholen

```powershell
# Fixtures liegen schon im Repository. Optional neu erzeugen:
python -m pip install pillow
python tests/ocr/generate.py
# Vom Repository-Stamm:
pnpm exec tsx tests/ocr/smoke.ts
```

Ein zweiter Lauf mit `pnpm exec tsx tests/ocr/smoke.ts --offline` bestand ebenfalls. Dabei wird die Downloadadresse absichtlich auf einen unerreichbaren lokalen Port gesetzt; somit muss die Engine die vorhandenen Modelle aus dem Cache verwenden. Die OCR-Prüfung ist wegen erstmaligem Download/Runtimekosten bewusst separat von den schnellen Unit-Tests.

## Grenzen

Nicht geprüft: echte Spieloberflächen, Screenshotfreigabe im Windows-WebView, abgeschnittene Tooltips, dunkler Hintergrund, Spielskalierung, mehrere Monitore/DPI, Overlay und globale Hotkeys. Aus dem Erfolg sauberer synthetischer Texte folgt keine Aussage über diese Fälle. Für eine belastbare Erkennungsqualität werden vom Nutzer freigegebene echte Screenshots benötigt.

