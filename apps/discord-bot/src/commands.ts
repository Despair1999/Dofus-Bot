import {
  SlashCommandBuilder,
  type SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { intelligenceCommands, extendDungeonCommand } from "./intelligence.js";
export const commands = [
  ...intelligenceCommands,
  new SlashCommandBuilder()
    .setName("builder")
    .setDescription("Persönliche Builds und Charakter-Sets")
    .addSubcommand((s) =>
      s
        .setName("profil")
        .setDescription("Charaktere und gespeicherte Sets anzeigen"),
    )
    .addSubcommand((s) =>
      s
        .setName("sets")
        .setDescription("Sets eines Charakters anzeigen")
        .addStringOption((o) =>
          o
            .setName("charakter")
            .setDescription("Charakter")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("anzeigen")
        .setDescription("Build und Ausrüstung anzeigen")
        .addStringOption((o) =>
          o
            .setName("build")
            .setDescription("Gespeicherter Build")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("vergleichen")
        .setDescription("Gespeicherte Builds vergleichen")
        .addStringOption((o) =>
          o
            .setName("build")
            .setDescription("Erster Build")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName("anderer")
            .setDescription("Zweiter Build")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("teilen")
        .setDescription("Build mit vollständiger JSON-Datei ausgeben")
        .addStringOption((o) =>
          o
            .setName("build")
            .setDescription("Gespeicherter Build")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    ),
  new SlashCommandBuilder()
    .setName("hilfe")
    .setDescription("Verfügbare Companion-Funktionen anzeigen"),
  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Backend-Erreichbarkeit prüfen"),
  new SlashCommandBuilder()
    .setName("charakter")
    .setDescription("Persönliche Charakterverwaltung")
    .addSubcommand((x) =>
      x
        .setName("registrieren")
        .setDescription("Charakter über ein Formular anlegen"),
    )
    .addSubcommand((x) =>
      x.setName("profil").setDescription("Gespeicherte Charaktere anzeigen"),
    )
    .addSubcommand((x) =>
      x
        .setName("fortschritt")
        .setDescription("Gespeicherten Questfortschritt anzeigen")
        .addStringOption((o) =>
          o
            .setName("charakter")
            .setDescription("Charakter-ID")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    ),
  new SlashCommandBuilder()
    .setName("item")
    .setDescription("Gegenstände aus verifizierter Datenquelle")
    .addSubcommand((x) =>
      x
        .setName("suchen")
        .setDescription("Gegenstand suchen")
        .addStringOption((o) =>
          o
            .setName("name")
            .setDescription("Suchbegriff")
            .setMinLength(2)
            .setMaxLength(100)
            .setRequired(true),
        ),
    )
    .addSubcommand((x) =>
      x
        .setName("info")
        .setDescription("Gegenstandsdetails und Rezept anzeigen")
        .addIntegerOption((o) =>
          o
            .setName("id")
            .setDescription("Item-ID")
            .setMinValue(1)
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("kategorie")
            .setDescription("Kategorie")
            .setRequired(true)
            .addChoices(
              ...[
                "equipment",
                "resources",
                "consumables",
                "quest",
                "cosmetics",
              ].map((x) => ({ name: x, value: x })),
            ),
        ),
    ),
  new SlashCommandBuilder()
    .setName("quest")
    .setDescription("Persönlichen Questfortschritt synchronisieren")
    .addSubcommand((x) =>
      x
        .setName("suchen")
        .setDescription("Importierte Quests durchsuchen")
        .addStringOption((o) =>
          o
            .setName("name")
            .setDescription("Questname deutsch oder französisch")
            .setMinLength(2)
            .setMaxLength(100)
            .setRequired(true),
        ),
    )
    .addSubcommand((x) =>
      x
        .setName("info")
        .setDescription("Bekannte Questschritte anzeigen")
        .addIntegerOption((o) =>
          o
            .setName("id")
            .setDescription("Quest-ID")
            .setRequired(true)
            .setMinValue(1),
        ),
    )
    .addSubcommand((x) =>
      x
        .setName("schritt")
        .setDescription("Bestätigten Questschritt speichern")
        .addStringOption((o) =>
          o
            .setName("charakter")
            .setDescription("Charakter-ID")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addIntegerOption((o) =>
          o
            .setName("id")
            .setDescription("Verifizierte Quest-ID")
            .setRequired(true)
            .setMinValue(1),
        )
        .addIntegerOption((o) =>
          o
            .setName("schritt")
            .setDescription("Schrittindex")
            .setRequired(true)
            .setMinValue(0),
        )
        .addStringOption((o) =>
          o
            .setName("status")
            .setDescription("Status")
            .setRequired(true)
            .addChoices(
              { name: "Aktiv", value: "active" },
              { name: "Pausiert", value: "paused" },
              { name: "Abgeschlossen", value: "completed" },
            ),
        ),
    ),
  new SlashCommandBuilder()
    .setName("craft")
    .setDescription("Rezept- und Gewinnrechner")
    .addSubcommand((x) =>
      x
        .setName("berechnen")
        .setDescription("Materialbedarf für ein Rezept berechnen")
        .addIntegerOption((o) =>
          o
            .setName("id")
            .setDescription("Item-ID")
            .setRequired(true)
            .setMinValue(1),
        )
        .addIntegerOption((o) =>
          o
            .setName("menge")
            .setDescription("Herstellungsmenge")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1000000),
        )
        .addStringOption((o) =>
          o
            .setName("kategorie")
            .setDescription("Kategorie")
            .setRequired(true)
            .addChoices(
              ...[
                "equipment",
                "resources",
                "consumables",
                "quest",
                "cosmetics",
              ].map((x) => ({ name: x, value: x })),
            ),
        ),
    )
    .addSubcommand((x) =>
      x
        .setName("gewinn")
        .setDescription("Gewinn aus eigenen Preisen berechnen")
        .addNumberOption((o) =>
          o
            .setName("kosten")
            .setDescription("Eigene Gesamtkosten in Kamas")
            .setRequired(true)
            .setMinValue(0),
        )
        .addNumberOption((o) =>
          o
            .setName("erloes")
            .setDescription("Eigener Verkaufspreis in Kamas")
            .setRequired(true)
            .setMinValue(0),
        )
        .addNumberOption((o) =>
          o
            .setName("gebuehr")
            .setDescription("Eigener Gebührenprozentsatz, Standard 2")
            .setMinValue(0)
            .setMaxValue(100),
        ),
    ),
  new SlashCommandBuilder()
    .setName("almanax")
    .setDescription("Almanax von der Spieldatenquelle abrufen")
    .addStringOption((o) =>
      o
        .setName("datum")
        .setDescription("YYYY-MM-DD, Standard heute (Europa/Berlin)"),
    ),
  new SlashCommandBuilder()
    .setName("dungeon")
    .setDescription("Persistente Dungeon-Gruppen")
    .setDMPermission(false)
    .addSubcommand((x) =>
      x
        .setName("erstellen")
        .setDescription("Gruppe mit Anmeldung und Warteliste erstellen")
        .addStringOption((o) =>
          o
            .setName("titel")
            .setDescription("Dungeon / Gruppenziel")
            .setMaxLength(100)
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("start")
            .setDescription(
              "ISO-Zeit mit Zeitzone, z. B. 2026-10-25T20:00:00+01:00",
            )
            .setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName("plaetze")
            .setDescription("Maximale Gruppengröße")
            .setMinValue(1)
            .setMaxValue(16)
            .setRequired(true),
        ),
    ),
].map((x) =>
  (x.name === "dungeon"
    ? extendDungeonCommand(x as SlashCommandSubcommandsOnlyBuilder)
    : x
  ).toJSON(),
);
