export const LEGAL_VERSION = "2026-10-23";
export const operator = {
  project: "DOFUS Companion",
  name: "Niklas Peter",
  address: "Koblenzer Straße, 54411 Hermeskeil",
  email: "sunbired@gmail.com",
} as const;

export type LegalSection = { title: string; paragraphs: string[] };
export const privacy: LegalSection[] = [
  {
    title: "Verantwortlicher und Kontakt",
    paragraphs: [
      "Verantwortlich für dieses privat betriebene, kostenlose Hobbyprojekt ist die oben genannte Privatperson. Datenschutzanfragen und Anträge zur Ausübung deiner Rechte kannst du an die angegebene E-Mail-Adresse richten. Es gibt keine Werbung, kostenpflichtigen Abonnements oder Echtgeldgeschäfte.",
    ],
  },
  {
    title: "Website und technischer Zugang",
    paragraphs: [
      "Firebase Hosting liefert die Website über HTTPS aus. Dabei werden technisch notwendige Verbindungsdaten wie IP-Adresse, Browserangaben, Zeitpunkt und angefragte Adresse durch den Hostinganbieter verarbeitet. Dies dient der Auslieferung und Absicherung des Angebots (Art. 6 Abs. 1 Buchst. f DSGVO; berechtigtes Interesse an einem sicheren Betrieb).",
      "Das Vorschaupasswort ist nur eine browserseitige Zugangshürde. Statische Dateien sind technisch öffentlich abrufbar. Die Freigabe liegt im Session Storage bis zum Ende der Browsersitzung. Die Rechtsseiten sind ohne dieses Passwort zugänglich. Firebase Analytics, Werbetracker und Marketingcookies werden nicht eingesetzt.",
    ],
  },
  {
    title: "Account, Profil und lokale Speicherung",
    paragraphs: [
      "Für einen Companion-Account verarbeiten wir E-Mail-Adresse, Firebase-Benutzer-ID, Authentifizierungs- und Verifikationsdaten sowie den DOFUS-Ingame-Namen, Discord-Benutzernamen und Spielserver. Firebase Authentication verarbeitet auch Passwortdaten und technische Sicherheitsdaten; die Anwendung protokolliert dein Passwort nicht. Der Ingame-Name ist der Companion-Anzeigename. Manuell eingegebene Spiel- und Discordangaben sind nicht offiziell verifiziert.",
      "Accountverwaltung und die von dir angeforderten Funktionen beruhen auf Art. 6 Abs. 1 Buchst. b DSGVO. Die Annahme der Nutzungsbedingungen ist keine pauschale datenschutzrechtliche Einwilligung. Für die Vertragserfüllung erforderliche Angaben sind Pflichtfelder; ohne sie ist die Accountnutzung nicht möglich. Das bloße Lesen der Website erfordert keinen Account.",
      "Anmeldesitzungen werden gerätebezogen gespeichert. IndexedDB beziehungsweise die lokale SQLite-Datenbank halten persönliche Arbeitsdaten und eine Sync-Warteschlange vor, damit die Anwendung offline funktioniert. Technisch erforderliche Speicherzugriffe dienen dem ausdrücklich angeforderten Dienst (§ 25 Abs. 2 Nr. 2 TDDDG). Gerätespezifische Overlaypositionen, Backend-Zugangstokens und geheime Konfigurationen werden nicht in die Cloud synchronisiert.",
    ],
  },
  {
    title: "Cloud-Synchronisierung",
    paragraphs: [
      "Bei Nutzung der Cloud-Synchronisierung werden unterstützte Charakterdaten, Berufs- und Questfortschritte, Builds mit Ausrüstung und eigenen Werten, persönliche Marktjournal- und Lagerdaten, Favoriten, gespeicherte Routen und Ressourcenhinweise accountbezogen übertragen. Gerätekennungen, Revisionen, Mutationskennungen, Zeitstempel und Löschmarker verhindern Dubletten und behandeln Offlinekonflikte. Bestehende Gastdaten werden erst nach deiner Bestätigung übernommen.",
      "Diese persönlichen Arbeitsdaten sind für andere Mitglieder und Gildenadministratoren nicht pauschal zugänglich. Der technische Betreiber und sein Hostingdienstleister besitzen für Betrieb, Fehlerbehebung und die Bearbeitung von Datenschutzanfragen privilegierte Infrastrukturzugänge. Zugriff wird auf den erforderlichen Zweck begrenzt. Rechtsgrundlage ist die angeforderte Synchronisierung nach Art. 6 Abs. 1 Buchst. b DSGVO; Sicherheitsmaßnahmen beruhen ergänzend auf Art. 6 Abs. 1 Buchst. f DSGVO.",
    ],
  },
  {
    title: "Gilde, Angebote, Aktivitäten und Empfänger",
    paragraphs: [
      "Dein Companion-Profil mit Spielnamen, Discord-Namen, Server und Hauptcharakter ist für berechtigte registrierte Companion-Nutzer sichtbar. Gildenmitgliedschaft, Rang und ausdrücklich freigegebene Charakterdaten dienen der Mitgliederverwaltung. Private Gildenbereiche, interne Angebote, Events und Gruppen sind bestätigten Mitgliedern sowie berechtigten Administratoren zugänglich. Ein Mitgliedsantrag wird von der Gildenleitung geprüft.",
      "Als bestätigtes Gildenmitglied kannst du optional einen selbst festgelegten Status und eine Biografie hinterlegen. Diese Texte sind nur für berechtigte Gildenmitglieder und Administratoren sichtbar, auf anderen Geräten aktuell abrufbar und von dir wieder löschbar. Sie stellen keine automatisch ermittelte Online- oder Ingame-Aktivität dar. Berechtigte administrative Korrekturen werden protokolliert.",
      "Globale Angebote sind für berechtigte registrierte Companion-Nutzer sichtbar. Persönliche Marktanalysen oder Lagerbestände werden nicht automatisch veröffentlicht. Reservierungen, Kommentare und Kontaktangaben folgen den jeweiligen Zugriffsregeln; fremde private Reservierungsdetails werden nicht allgemein freigegeben. Aktivitäten verarbeiten Anmeldungen, Charaktername, Level, Rolle und Wartelistenstatus. Veröffentliche keine sensiblen Daten oder Kontaktdaten Dritter in Freitexten oder Wappen.",
      "Administrationsänderungen und Moderationsentscheidungen werden mit Akteur, Zeitpunkt, Grund und Vorher-/Nachher-Werten nachvollziehbar protokolliert. Meldungen sind nur für den Meldenden und berechtigte Administratoren zugänglich. Diese Verarbeitung dient der Bereitstellung der gewählten Community-Funktion (Art. 6 Abs. 1 Buchst. b DSGVO) und ihrem Schutz vor Missbrauch sowie der Klärung von Konflikten (Art. 6 Abs. 1 Buchst. f DSGVO).",
    ],
  },
  {
    title: "Firebase, Speicherorte und Übermittlungen",
    paragraphs: [
      "Wir verwenden Google Firebase Authentication, Cloud Firestore, Cloud Storage und Firebase Hosting im Projekt dofus-companion. Die Firestore-Datenbank ist in eur3 eingerichtet; Gildenwappen liegen im bestehenden Bucket dofus-companion.firebasestorage.app in US-EAST1. Firebase Authentication wird laut Google in US-Rechenzentren betrieben. Hosting und weitere technische Verarbeitung können global erfolgen. Es wird daher keine ausschließlich europäische Verarbeitung zugesichert.",
      "Google verarbeitet Kundendaten nach den anwendbaren Firebase-Datenverarbeitungsbedingungen beziehungsweise dem Cloud Data Processing Addendum. Internationale Übermittlungen richten sich nach den dort vorgesehenen Mechanismen, insbesondere Standardvertragsklauseln, soweit erforderlich. Angaben und Unterlagen zu den für dieses Projekt geltenden Garantien kannst du über den oben genannten Datenschutzkontakt anfordern. Die eingesetzten Dienste, Unterauftragnehmer und Bedingungen beschreibt Google unter https://firebase.google.com/support/privacy.",
    ],
  },
  {
    title: "Discord, Downloads und externe Inhalte",
    paragraphs: [
      "Ein Discord-Kontaktbutton öffnet auf deinen Wunsch Discord beziehungsweise kopiert einen Namen oder Nachrichtenentwurf. Es werden keine automatischen Direktnachrichten versendet. Für eine technische Bot-Verknüpfung wird die Discord-User-ID nach Betreiberprüfung der Companion-UID zugeordnet. Autorisierte Botaktionen verarbeiten dafür notwendige Account-, Gilden- oder Aktivitätsdaten. Discord verarbeitet Daten nach seinen eigenen Bedingungen; ein bloß eingetragener Discord-Name ist keine bestätigte Identität.",
      "Die Downloadseite lädt öffentliche Releaseinformationen von GitHub; beim direkten Download verarbeitet GitHub die dafür erforderlichen Verbindungsdaten. Ausgewählte Gegenstandsbilder können von api.dofusdu.de geladen werden, wobei Verbindungsdaten an diesen Bildanbieter übermittelt werden. Externe Links werden erst durch deinen Aufruf geöffnet. Diese Funktionen dienen der angeforderten Darstellung beziehungsweise dem Download (Art. 6 Abs. 1 Buchst. b oder f DSGVO).",
    ],
  },
  {
    title: "Speicherdauer, Export und Löschung",
    paragraphs: [
      "Accountdaten und synchronisierte Arbeitsdaten werden für die Dauer deiner Accountnutzung gespeichert. Im Accountbereich kannst du einen Export anfordern und dein Konto löschen. Offene Reservierungen oder privilegierte Rollen erfordern zunächst eine Klärung; alternativ kannst du dich unmittelbar an den Datenschutzkontakt wenden. Die Selbstlöschung entfernt private Cloud-Arbeitsdaten, das Profil, private Accountdaten und die Charakterfreigaben und löscht den Authentifizierungsaccount.",
      "Gemeinsame Handels-, Kommentar-, Aktivitäts- und Moderationshistorien können zunächst für die Abwicklung offener Vorgänge und die Klärung konkreter Konflikte bestehen bleiben. Der Betreiber prüft solche Zuordnungen bei Löschanfragen und entfernt beziehungsweise pseudonymisiert sie, soweit keine erforderlichen entgegenstehenden Gründe bestehen. Ein technischer Löschmarker verhindert die Wiederherstellung durch alte Offlineclients. Lokale Gerätekopien, selbst erstellte Exporte und bereits an andere berechtigte Nutzer übermittelte Inhalte werden nicht automatisch ferngewischt.",
      "Für technische Protokolle und Sicherungen gelten die tatsächlichen dienstspezifischen Aufbewahrungs- und Löschzyklen des Anbieters. Eine pauschale, sofortige Löschung sämtlicher Sicherungskopien wird nicht zugesichert. Es werden keine zusätzlichen unbegrenzten Profil- oder Marketingarchive angelegt. Löschanfragen werden innerhalb der gesetzlichen Fristen beantwortet.",
    ],
  },
  {
    title: "Deine Rechte und Sicherheit",
    paragraphs: [
      "Unter den gesetzlichen Voraussetzungen hast du Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit. Gegen Verarbeitungen nach Art. 6 Abs. 1 Buchst. f DSGVO kannst du aus Gründen deiner besonderen Situation Widerspruch einlegen. Eine tatsächlich erteilte Einwilligung kannst du jederzeit für die Zukunft widerrufen. Du kannst dich bei einer Datenschutzaufsichtsbehörde beschweren, insbesondere bei der Behörde an deinem Aufenthaltsort; für den Betreiber kommt der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz in Betracht (https://www.datenschutz.rlp.de).",
      "Es finden keine automatisierten Entscheidungen mit rechtlicher oder vergleichbar erheblicher Wirkung und kein Werbeprofiling statt. Rollen, Mitgliedschaften und Moderationsentscheidungen werden von berechtigten Personen vergeben beziehungsweise geprüft. HTTPS, accountbezogene Zugriffsregeln, begrenzte Uploads, erneute Admin-Authentifizierung und unveränderliche Auditprotokolle unterstützen den Schutz der Daten; sie garantieren keine absolute Sicherheit.",
    ],
  },
];

export const terms: LegalSection[] = [
  {
    title: "Anbieter und Angebot",
    paragraphs: [
      "DOFUS Companion wird von der oben genannten Privatperson als kostenloses, nichtkommerzielles Hobbyprojekt angeboten. Es ist eine unabhängige Spielhilfe und kein Angebot von Ankama. Es gibt keine kostenpflichtigen Abonnements, Werbung oder Echtgeldhandel. Diese Bedingungen gelten für Companion-Accounts, Cloud-Synchronisierung und die bereitgestellten Community-Funktionen.",
    ],
  },
  {
    title: "Account und Zugang",
    paragraphs: [
      "Für einen Account sind eine erreichbare E-Mail-Adresse, ein eigenes sicheres Passwort, DOFUS-Ingame-Name, Discord-Benutzername und Spielserver erforderlich. Bestätige deine E-Mail und halte notwendige Angaben aktuell. Verwende keine fremden Identitäten oder Anmeldedaten. Teile dein persönliches Passwort nicht und melde vermuteten Missbrauch. Der zusätzliche Website-Vorschauzugang ersetzt weder deinen Account noch eine Zugriffsberechtigung.",
      "Gildenfunktionen stehen ausschließlich bestätigten Mitgliedern der konfigurierten bestehenden Ingame-Gilde und berechtigten Administratoren zur Verfügung. Ein Account begründet keinen Anspruch auf Gildenmitgliedschaft oder Administrationsrechte. Globale Angebote können berechtigte registrierte Companion-Nutzer verwenden, soweit der Bereich freigeschaltet ist. Minderjährige benötigen die nach ihrem Alter und den anwendbaren Vorschriften erforderliche Zustimmung ihrer gesetzlichen Vertretung.",
    ],
  },
  {
    title: "Eigene Daten, Synchronisierung und Angaben",
    paragraphs: [
      "Die Desktop-Werkzeuge bleiben grundsätzlich lokal nutzbar. Cloud-Synchronisierung setzt eine Verbindung und die gewählte Accountfunktion voraus. Bestätige Datenmigrationen bewusst und bewahre bei wichtigen Daten eigene Exporte auf. Offlineänderungen können Konflikte erzeugen, über die du entscheiden musst. Eigene Spielwerte, Preise, Ressourcenhinweise und Ränge sind keine offizielle Bestätigung durch DOFUS.",
    ],
  },
  {
    title: "Marktplätze und Reservierungen",
    paragraphs: [
      "Angebote beziehen sich nur auf zulässige Vorgänge innerhalb von DOFUS; angegebene Preise sind Spielwährung Kamas. Echtgeldgeschäfte, Accountverkauf, Betrug, rechtswidrige Angebote und Verstöße gegen einschlägige Spielregeln sind untersagt. DOFUS Companion nimmt keine Zahlungen entgegen, verwahrt keine Gegenstände und führt keinen automatischen Ingame-Handel aus.",
      "Verkäufer und Interessenten organisieren den Austausch selbst. Beschreibe Gegenstand, Menge, Preis, Server und Angebotstyp zutreffend und pflege Verfügbarkeit sowie Reservierungsstatus. Eine technische Reservierung dokumentiert die Absprache innerhalb des Tools; sie ist keine Liefer- oder Zahlungszusage des Betreibers. Kläre Änderungen und Absagen mit den Beteiligten. Private Marktjournal- und Lagerdaten werden nur durch deine ausdrückliche Veröffentlichung zu Angeboten.",
    ],
  },
  {
    title: "Events, Gruppen, Inhalte und Discord",
    paragraphs: [
      "Organisatoren legen Termin, Zeitzone, Voraussetzungen und Teilnehmerplätze fest. Wähle einen eigenen geeigneten Charakter, beachte Wartelisten und sage bei Verhinderung rechtzeitig ab. Es besteht keine Garantie, dass andere Teilnehmende erscheinen oder ein Spielziel erreicht wird.",
      "Veröffentliche nur Inhalte und Bilder, zu deren Nutzung du berechtigt bist. Untersagt sind rechtswidrige, beleidigende, diskriminierende, täuschende oder schädliche Inhalte, Spam sowie die unerlaubte Veröffentlichung personenbezogener Daten Dritter. Du räumst dem Betreiber die für Speicherung, technische Bearbeitung, Darstellung und Weitergabe an die von dir gewählten berechtigten Empfänger erforderlichen einfachen Nutzungsrechte für die Dauer der Nutzung ein. Ein Wappen kann für die Darstellung verkleinert und in WebP umgewandelt werden.",
      "Discord-Kontaktaktionen werden von dir ausgelöst. Die Anwendung verschickt keine automatischen Direktnachrichten. Ein manuell angegebener Discord-Name ist unbestätigt; technische Verknüpfungen werden gesondert geprüft. Für externe Dienste gelten deren eigene Bedingungen.",
    ],
  },
  {
    title: "Moderation und Administratoren",
    paragraphs: [
      "Berechtigte Administratoren können Mitgliedschaften, gemeinsame Gildendaten, Angebote und Aktivitäten im jeweiligen Berechtigungsumfang verwalten. Technische Systemrollen sind von Ingame-Rängen getrennt. Eine technische Administratorrolle berechtigt nicht pauschal zum Lesen fremder privater Sync-Daten oder zur beliebigen Bearbeitung fremder globaler Angebote.",
      "Bei konkreten Verstößen können Inhalte ausgeblendet, Vorgänge korrigiert und Zugänge beschränkt werden. Maßnahmen sollen verhältnismäßig sein und, soweit der Schutz anderer dies zulässt, begründet und zur Stellungnahme gestellt werden. Meldungen sind über die vorgesehene Funktion oder per E-Mail möglich; bei strittigen Maßnahmen kannst du eine Überprüfung anfordern. Administrative Änderungen werden zur Nachvollziehbarkeit protokolliert.",
    ],
  },
  {
    title: "Verfügbarkeit und Haftung",
    paragraphs: [
      "Das Hobbyprojekt bietet keine zugesagte Mindestverfügbarkeit oder bestimmte Updateintervalle. Wartung, technische Störungen und Änderungen von DOFUS oder Drittanbietern können Funktionen einschränken. Bekannte Datenlücken und Berechnungsgrenzen sind zu berücksichtigen. Gesetzliche Rechte bleiben unberührt.",
      "Der Betreiber haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie für Schäden aus der Verletzung von Leben, Körper oder Gesundheit und nach zwingenden gesetzlichen Vorschriften. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden beschränkt. Ein weitergehender pauschaler Ausschluss zwingender Haftung wird nicht vereinbart.",
    ],
  },
  {
    title: "Beendigung und Änderungen",
    paragraphs: [
      "Du kannst die Nutzung jederzeit beenden, deine Daten exportieren und die Kontolöschung anfordern. Offene gemeinsame Vorgänge sollen geordnet abgewickelt werden; datenschutzrechtliche Ansprüche bleiben davon unberührt. Falls eine Selbstlöschung wegen offener Vorgänge oder einer privilegierten Rolle nicht möglich ist, wende dich an den angegebenen Kontakt.",
      "Wesentliche Änderungen dieser Bedingungen werden mit Versionsstand bereitgestellt und bei Bedarf vor weiterer Nutzung der betroffenen Funktion zur Annahme vorgelegt. Es gibt keine pauschale Zustimmung zu beliebigen künftigen Änderungen. Es gilt deutsches Recht unter Wahrung zwingender Schutzvorschriften des anwendbaren Rechts. Es wird kein ausschließlicher Gerichtsstand zulasten von Verbrauchern vereinbart.",
    ],
  },
];
