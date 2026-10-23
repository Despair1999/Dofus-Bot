export type PatchGroup = { label: string; entries: string[] };
export type PatchRelease = {
  version: string;
  date: string;
  title: string;
  subtitle: string;
  groups: PatchGroup[];
  caveat?: string;
};

const preparedPatchNotes: PatchRelease[] = [
  {
    version: "v0.10.0",
    date: "23.10.2026",
    title: "Companion Accounts & Community",
    subtitle:
      "Gemeinsame Accounts, private Cloud-Daten und ein integrierter Gildenbereich.",
    groups: [
      {
        label: "Account & Cloud",
        entries: [
          "E-Mail-Accounts, Profile, Verifikation, Export und Kontolöschung.",
          "Private geräteübergreifende Synchronisierung mit Offline-Warteschlange, Konfliktentscheidung und ausdrücklich bestätigter Datenmigration.",
        ],
      },
      {
        label: "Gilde & Community",
        entries: [
          "Gildenverwaltung mit sicheren Wappen-Uploads, gestaltbaren Ingame-Rängen und Mitgliederliste.",
          "Interne und globale Angebote, Teilreservierungen, Kommentare sowie Events, Kalender und Dungeon-Gruppen.",
          "Web-Builder für gespeicherte Ausrüstung, Eigenschaften und Varianten.",
        ],
      },
      {
        label: "Administration & Sicherheit",
        entries: [
          "Persönliche Admin-Reauthentifizierung, Auditverlauf, Moderation und revisionsgeprüfte Änderungen.",
          "Produktive Firestore-/Storage-Regeln und Indizes geprüft; bestehender Windows-Updater-Schlüssel erhalten.",
        ],
      },
    ],
    caveat:
      "Die Discord-Cloud-Anbindung benötigt einen separat eingerichteten, vertrauenswürdigen Bot-Host und bleibt ohne diese Konfiguration deaktiviert. Erweiterte Builder-Simulationen bleiben Desktopfunktionen.",
  },
];
// Prepared notes become visible only after GitHub confirms a non-draft release.
export function visiblePatchNotes(publishedVersions: readonly string[]) {
  return [
    ...preparedPatchNotes.filter((p) => publishedVersions.includes(p.version)),
    ...patchNotes,
  ];
}

/**
 * Redaktionell gepflegte Zusammenfassungen der veröffentlichten DOFUS-Companion-Release-Notes.
 * Weder externe Links noch dynamisch geladene Markdown-Dateien.
 * Neue Versionen nur nach Prüfung des offiziellen Releases ergänzen.
 * Draft-Releases sind ausdrücklich ausgeschlossen.
 */
export const patchNotes: PatchRelease[] = [
  {
    version: "v0.8.0",
    date: "22.10.2026",
    title: "Farmdaten & Charakterwerte",
    subtitle:
      "Gezielte Korrekturen für Ressourcensuche, Profile und Bedienung.",
    groups: [
      {
        label: "Weltatlas & Farming",
        entries: [
          "Ressourcenmarker mit lokalen Bildern, Gruppierung und Detailinformationen. Fundorte werden nicht mehr durch die aktuelle Kartenausschnittsgrenze abgeschnitten.",
          "13.987 dokumentierte Karten-, Ressourcen- und Zellpositionen, darunter 3.527 Angelstellen, mit expliziter Versionskennzeichnung und optionaler Anzeige.",
          "Fundortplanung berücksichtigt Beruf, Stufe, Charakter, Welt und bekannte Questbeschränkungen. Wegschätzung und tatsächlich belegte Übergänge bleiben getrennt.",
        ],
      },
      {
        label: "Quests, Berufe & Profile",
        entries: [
          "1.494 bestätigte Direktverknüpfungen zu Quest-Anleitungen; fehlende Quellen bleiben bewusst ungelinkt.",
          "Separates Omega-Level ab Stufe 200 mit goldenem Badge und gemeinsame Verwaltung aller 22 datenbasierten Berufe.",
          "Crafting zeigt relevante Berufsvoraussetzungen.",
        ],
      },
      {
        label: "Bedienung",
        entries: [
          "Sicheres Zurücksetzen der Crafting-Auswahl, Schutz vor verspäteten Suchergebnissen und ein sichtbarer Kategorienpfeil in der Karte.",
          "Verständlichere OCR-Erklärungen.",
        ],
      },
    ],
    caveat:
      "Die importierten Ressourcenpositionen stammen aus einem älteren Datenstand (3.7.4.4) und sind für den aktuellen Patch nicht bestätigt. Sie sind standardmäßig ausgeblendet.",
  },
  {
    version: "v0.7.0",
    date: "22.10.2026",
    title: "Charakterprofile & Kartenbedienung",
    subtitle: "Einheitlichere Spielattribute und ein komfortablerer Workspace.",
    groups: [
      {
        label: "Charaktere & Ausrüstung",
        entries: [
          "Neue Charakterdetails mit Allgemein, Ausrüstung und Fortschritt sowie grafischer Klassenauswahl.",
          "Einheitliche Attributfarben, Symbole und Wertvergleiche in Items, Sets, Builder und Profilen.",
          "Passende Symbole für alle 16 Ausrüstungsslots und weiterhin echte Itembilder.",
        ],
      },
      {
        label: "Karten & Komfort",
        entries: [
          "Zoomen unter dem Mauszeiger, ohne dass die gesamte Webseite mitgescrollt wird.",
          "Eigene Kartensymbole, getrennte Kategorienfilter und besser lesbare Questkoordinaten.",
          "Gespeicherte Farmrouten öffnen zuverlässiger; kompakteres Dashboard und anheftbare Module.",
        ],
      },
    ],
    caveat:
      "Bestehende Charaktere, Sets, Fortschritte und Einstellungen werden übernommen.",
  },
  {
    version: "v0.6.0",
    date: "22.10.2026",
    title: "Modern Dark Fantasy",
    subtitle: "Große Überarbeitung von Design, Navigation und Suche.",
    groups: [
      {
        label: "Modernes Interface",
        entries: [
          "Gemeinsames Design mit dunklem Anthrazit/Navy, Gold und Türkis; vier vorhandene Farbschemata bleiben nutzbar.",
          "Gruppierte einklappbare Seitenleiste mit gespeichertem Icon-Modus, Navigation und Panelbreiten.",
          "Einstellungen in neun Kategorien mit Textgröße, Informationsdichte und reduzierter Bewegung.",
        ],
      },
      {
        label: "Suche & Werkzeuge",
        entries: [
          "Globale Suche über Strg+K für Gegenstände, Sets, Monster, Dungeons, Quests, Ressourcen, Berufe, Builds und Koordinaten.",
          "Neue Set- und Monsterverzeichnisse, gespeicherte Item-Listenansicht und anpassbare Karten-/Farm-Panels.",
          "834 Kartenhinweise mit 45 Zaaps und 130 Dungeonhinweisen.",
        ],
      },
      {
        label: "Qualität & Integration",
        entries: [
          "Erweiterte Bild-Fallbacks und sitzungsbezogene Fehlerdiagnose.",
          "Gemeinsamer Discord-Activity-Stil; der Bot kann Dungeonbilder anhängen.",
          "Zwei lokale Übersetzer und das native Overlay bleiben erhalten.",
        ],
      },
    ],
    caveat:
      "Nicht alle Dungeonstrategien und Ressourcenfundorte sind vollständig patchgeprüft.",
  },
  {
    version: "v0.5.0",
    date: "21.10.2026",
    title: "Originalkarten & Spielgrafiken",
    subtitle: "Mehr Übersicht und lokal verfügbare Inhalte.",
    groups: [
      {
        label: "Navigation & Atlas",
        entries: [
          "Neue ausklappbare Tools-Kategorie und vier speicherbare Farbschemata.",
          "40 lokal verfügbare Originalkarten mit Koordinaten, optionalem Raster und Zielmarkierungen.",
          "Anklickbare Questkoordinaten, verbesserte Innenkartenbehandlung und gemeinsame Kartenbasis für Farming.",
        ],
      },
      {
        label: "Monster & Dungeons",
        entries: [
          "896 Monsterbilder einschließlich 137 referenzierter Bosse, 12.279 Itemicons und 543 zusätzliche Monsterzaubericons.",
          "Dungeonfilter für klassische Einträge und Expeditionen sowie 20 quellenbasierte Kurzleitfäden.",
          "Verknüpfte Bilder für Ressourcen, Berufsquest-Items, Schlüssel und Bossdrops.",
        ],
      },
    ],
    caveat:
      "Kartenübergänge und Ressourcen-Spawns werden nicht erfunden; unbestätigte Bossdetails bleiben gekennzeichnet.",
  },
  {
    version: "v0.4.0",
    date: "21.10.2026",
    title: "Weltkarte, Dungeons & Übersetzer",
    subtitle: "Mehrere Companion-Systeme greifen erstmals ineinander.",
    groups: [
      {
        label: "Atlas & Dungeonplanung",
        entries: [
          "Lokaler Atlas mit 40 Welten, 15.409 Kartenpositionen und 118 Sammelitems.",
          "Berufsfilter, private Ressourcenfunde, Tourenplanung und Overlaynavigation.",
          "Dungeon- und Bossdaten für DOFUS 3.6.12.16 sowie 3.7.12.12 mit Resistenzen, Zaubern, Drops und Erfolgen.",
        ],
      },
      {
        label: "Offline-Kommunikation",
        entries: [
          "Zwei unabhängig einstellbare Overlay-Übersetzer für Deutsch, Englisch und Französisch.",
          "Alle sechs Sprachrichtungen laufen nach dem einmaligen Modelldownload lokal.",
          "Neue Karten-, Farming- und Dungeonbefehle für Discord sowie eine vorbereitete Discord Activity.",
        ],
      },
    ],
    caveat:
      "Der Übergangsgraph ist noch unvollständig. Ressourcenregionen sind keine garantierten exakten Spawnpunkte.",
  },
  {
    version: "v0.3.0",
    date: "20.10.2026",
    title: "Ausrüstungs-Builder",
    subtitle:
      "Charakter-Sets und Schadensvorschauen zum Planen und Vergleichen.",
    groups: [
      {
        label: "Buildplanung",
        entries: [
          "Ausrüstungs-Builder mit realen Gegenständen, gemeinsamen Attributfiltern, Setboni und individuellen Rolls.",
          "Exomagie, gespeicherte Charakter-Sets, Buildvergleich und Optimierung im Hintergrund.",
          "Versionsgetrennte Zauberkataloge für 3.6.12.16 und 3.7.12.12 mit lokalen Zaubericons.",
        ],
      },
      {
        label: "Daten & Zusammenarbeit",
        entries: [
          "Schadensvorschau für unterstützte direkte Effekte; komplexe Mechaniken werden gekennzeichnet.",
          "Offline-Entwürfe mit Synchronisierung, JSON-Austausch und privaten Discord-Builder-Funktionen.",
        ],
      },
    ],
  },
  {
    version: "v0.2.3",
    date: "20.10.2026",
    title: "Stabilitätsupdate für Windows",
    subtitle: "Fehlerbehebung beim lokalen Backendstart.",
    groups: [
      {
        label: "Behoben",
        entries: [
          "Offline-Start des lokalen Windows-Dienstes korrigiert.",
          "Startpfade angepasst und Node-Laufzeit 22.15.0 geprüft.",
          "Bestehende persönliche Daten bleiben erhalten; Update weiterhin innerhalb der App möglich.",
        ],
      },
    ],
  },
  {
    version: "v0.2.2",
    date: "20.10.2026",
    title: "Branding & Basiswerkzeuge",
    subtitle: "Ausbau der ersten lokalen Spielhilfe.",
    groups: [
      {
        label: "Neue Funktionen",
        entries: [
          "Neues Branding und vollständiger lokaler Itemkatalog mit Suchvorschau.",
          "Questkategorien, bebildertes Crafting, Klassenauswahl und Almanax.",
          "Eigenständiges, konfigurierbares Overlay.",
        ],
      },
    ],
    caveat:
      "Früher Datenstand mit dokumentierten Datenlücken und eingeschränkter Live-Validierung.",
  },
];
