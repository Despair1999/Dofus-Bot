# Community – Sicherheitsmodell

Firebase Auth bestimmt Identität; Firestore-/Storage-Rules erzwingen Rechte. UI-Sichtbarkeit ersetzt keine Autorisierung. Öffentliche Firebase-Konfiguration enthält keine Administratorzugänge. Analytics bleibt deaktiviert. Tokens, Backend-Schlüssel und Geräteeinstellungen werden nicht synchronisiert.

Private Records und Zustimmung sind UID-gebunden. Normale Cloud-Nutzung verlangt verifizierte E-Mail und abgeschlossenes Profil. Gildenmodule erfordern freigegebene Mitgliedschaft; Entfernung entzieht Firestore-Zugriff. Öffentliche Profilfelder enthalten bewusst DOFUS-/Discord-Namen und Server. Globale Angebote sind für registrierte Nutzer sichtbar. Eigene Angebote bleiben zur Verwaltung/Löschprüfung auch nach Austritt zugänglich.

Technische Rollen und Ingame-Ränge sind getrennt. Clients dürfen `roles` nicht schreiben. Bootstrap löst die echte bestätigte Auth-UID auf. Betreiberwerkzeug schützt den letzten Owner. ADC und Admin SDK gehören nur auf vertrauenswürdige Hosts.

Rules prüfen Feldlisten, Typen, Größen, Revisionen und Serverzeiten. Adminänderungen benötigen in derselben Transaktion ein unveränderliches exaktes Vorher-/Nachher-Audit. Reservierungsübergänge passen Mengen atomar an. Teilnahme prüft Kapazität und genau die geänderte Person. Hinweise sind an reale Transaktionen gebunden. Abfragen sind begrenzt und seitenweise; Rules filtern keine unzulässigen Abfrageergebnisse nachträglich heraus.

Storage erlaubt Mitgliedern/Admins Wappenlesen und nur frisch authentifizierten Owner/Admins Uploads: WebP, maximal 200 KB, uploader UID, neue Pfade. Aktuelles Wappen ist gegen Löschen geschützt. Cross-Service-Lookup-Limits und IAM-Freigabe beachten. Archivierung sperrt Firestore-Gildenmodule; bestätigte Mitglieder können einen bekannten Wappenpfad weiter lesen. Keine vertraulichen Dokumente als Wappen hochladen.

Kontolöschung verlangt persönliche Reauth, blockiert privilegierte Konten und offene Handelsverpflichtungen, setzt einen Sperrmarker und entfernt private Daten, Zustimmung, Mitgliedschaft und geteilte Charaktere. Unterbrochene Löschung kann bei noch bestehendem Auth-Konto wiederholt werden. Gemeinsame Historie und lokale Kopien brauchen eigene Betreiberregeln; keine vollständige gesetzliche Löschkonformität allein durch diesen Ablauf behaupten.

Lokaler Backend-Bearer erlaubt Zugriff auf die lokalen UID-Bereiche am eigenen Gerät. Kein Mehrbenutzerserver. SQLite/IndexedDB werden durch diese Änderung nicht verschlüsselt. Gastbestand wird vor Migration gesichert.

Nicht live geprüft: IAM, App Check, E-Mail-Zustellung, native WebView-Sitzung, echter Discord-Bot und produktive Rules. [Testbericht](COMMUNITY_TEST_REPORT.md).
