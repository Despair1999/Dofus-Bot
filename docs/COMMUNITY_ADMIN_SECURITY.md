# Administration – Durchsetzung

E-Mail-Eingaben und Gildenränge verleihen keine technischen Rechte. Client-Schreiben auf `roles` ist gesperrt. Admin SDK/ADC nur auf vertrauenswürdigen Betreiberhosts. Operatorwerkzeug schützt den letzten Owner.

Sensible Adminaktionen erfordern in Rules eine verifizierte Owner-/Admin-Identität und auth_time jünger als 900 Sekunden. UI verwendet echte `reauthenticateWithCredential`, prüft die UID erneut und verweigert falsche persönliche Passwörter. Logout, UID-Wechsel, Ablauf und Inaktivität schließen den Dialog. Kein lokaler Rollen-Cache als Berechtigungsquelle.

Administrative Fachänderungen schreiben atomar ein unveränderliches Audit mit Zielpfad, Begründung, Actor, Revision und exakten Vorher-/Nachher-Werten. Rules vergleichen Änderung und Audit im selben Commit. Operatoränderungen besitzen operatorAudit. Hinweise sind an berechtigte Empfänger und echte Transaktionen gebunden.

Die UI-Inaktivitätssperre widerruft keine bereits gültigen Firebase-Tokens. Bei kompromittiertem Konto muss der Betreiber Tokens widerrufen, Konto sperren und Vorfall prüfen.

Geprüft: falsches Adminpasswort, normale Nutzer ohne Zugang, Rollenfälschung, unauditierte Änderungen/manipulierte Audits, Fremddatenzugriff, reservierte Mengen, volle Gruppen, verschachtelte Kommentaränderung und entfernte Mitgliedschaft. Keine produktive Penetrations-/IAM-Abnahme.
