import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
export function dungeonGroupModal(id: number, version: string) {
  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    !["3.7.12.12", "3.6.12.16"].includes(version)
  )
    throw Error("Ungültiges Dungeonziel.");
  return new ModalBuilder()
    .setCustomId(`intel-group:${id}:${version}`)
    .setTitle("Dungeongruppe erstellen")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("start")
          .setLabel("Start: ISO-Zeit mit Zeitzone")
          .setValue(new Date(Date.now() + 3600000).toISOString())
          .setRequired(true)
          .setMaxLength(50)
          .setStyle(TextInputStyle.Short),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("capacity")
          .setLabel("Spielerzahl (1–8)")
          .setValue("4")
          .setRequired(true)
          .setMaxLength(1)
          .setStyle(TextInputStyle.Short),
      ),
    );
}
