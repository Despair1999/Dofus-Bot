# DOFUS Companion Website & Firebase (private Vorschau)

Vollständige Installations-, Sicherheits- und Deploymentanleitung: [apps/website/README.md](../apps/website/README.md).

## Unbedingt beachten

- Ein Browser-Passwortdialog schützt **nicht** vor direktem Zugriff auf statische Dateien. Die HTML-/JS-/Bilddateien bleiben öffentlich erreichbar, wenn auf Firebase Hosting deployed wird.
- Ohne rechtliche Prüfung und echte Zugriffskontrolle nicht behaupten, die Website sei rechtlich privat oder vom Impressum befreit.
- Der Website-Workflow benutzt `WEBSITE_PASSWORD` nur in einem Produktionsdeploy-Job; CI-PRs bauen mit zufälligem Passwort.
- Die Vorschau kann nach dem ausdrücklichen Veröffentlichungsauftrag auf `main` deployen. `LEGAL_READY` wird nicht als Rechtsfreigabe simuliert. Trotz Passwort werden die Website-Dateien öffentlich ausgeliefert.
- Pull Requests werden nicht automatisch gemerged.
