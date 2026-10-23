const sections: Record<string, { title: string; items: string[] }> = {
  "/datenschutz": {
    title: "Datenschutzerklärung · Entwurf",
    items: [
      "Verantwortliche Stelle und erreichbare Kontaktadresse eintragen.",
      "Zwecke und Rechtsgrundlagen für Account, Cloud-Synchronisierung, Gilde und Marktplatz prüfen und ausfüllen.",
      "Firebase Authentication, Cloud Firestore, Cloud Storage und Hosting: Empfänger, Auftragsverarbeitung, Verarbeitungsorte und mögliche Drittlandübermittlungen prüfen.",
      "Speicherfristen, Löschung, Backups, Betroffenenrechte und zuständige Aufsichtsbehörde ausfüllen.",
      "Technisch vorgesehen: Datenexport und Kontolöschung im Accountbereich. Kontakt für Datenschutzanfragen fehlt noch.",
      "Firebase Analytics und optionale Trackingdienste sind deaktiviert.",
    ],
  },
  "/nutzungsbedingungen": {
    title: "Nutzungsbedingungen · Entwurf",
    items: [
      "Betreiber, Geltungsbereich und Kontakt vervollständigen.",
      "Registrierung, Accountpflichten und Voraussetzungen für die Gildenmitgliedschaft festlegen.",
      "Regeln für nutzergenerierte Inhalte, Moderation, Meldungen und Sperrungen prüfen.",
      "Marktplatzbedingungen für selbst organisierte DOFUS-Spielgegenstände und Kama-Preisangaben rechtlich prüfen.",
      "Verfügbarkeit, Haftung, Beendigung, Änderungen und anwendbare Bestimmungen prüfen.",
      "Die Registrierung dokumentiert Zustimmungsversion und Zeitpunkt erst nach Betreiberfreigabe.",
    ],
  },
  "/impressum": {
    title: "Impressum · Entwurf",
    items: [
      "Vollständigen Namen beziehungsweise Anbieterbezeichnung eintragen.",
      "Ladungsfähige Anschrift und Kontaktangaben vervollständigen.",
      "Je nach Anbieter weitere erforderliche Angaben prüfen und ergänzen.",
      "Kontakt für Datenschutzanfragen festlegen.",
    ],
  },
};
export function LegalPage({ path }: { path: string }) {
  const s = sections[path];
  return (
    <section className="page-hero container">
      <div className="eyebrow">
        NOCH NICHT FÜR DEN PRODUKTIVEN BETRIEB FREIGEGEBEN
      </div>
      <h1>{s.title}</h1>
      <p>
        Diese Seite ist eine technische Struktur und enthält keinen fertig
        geprüften Rechtstext. Die öffentliche Registrierung bleibt gesperrt, bis
        der Betreiber vollständige, geprüfte Angaben hinterlegt hat.
      </p>
      <ul>
        {s.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>
        Es liegen noch keine vollständigen Betreiber- und Kontaktdaten vor. Die
        endgültige Veröffentlichung dieser Seiten ist deshalb nicht freigegeben.
      </p>
    </section>
  );
}
