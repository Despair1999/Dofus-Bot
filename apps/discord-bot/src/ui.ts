import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import type { Group } from "./groups.js";
import type { Item } from "./api.js";
import type { Quest } from "@dofus/game-data";
export const embed = (title: string) =>
  new EmbedBuilder()
    .setColor(0xd9b96e)
    .setTitle(title.slice(0, 256))
    .setFooter({ text: "DOFUS Companion · externe Spielhilfe" });
export function itemEmbed(item: Item) {
  const value = embed(item.name)
    .addFields(
      { name: "Level", value: String(item.level), inline: true },
      { name: "Typ", value: String(item.type), inline: true },
    )
    .setDescription(
      (
        item.description || "Keine Beschreibung in den gelieferten Daten."
      ).slice(0, 3000),
    );
  if (item.effects?.length)
    value.addFields({
      name: "Effekte",
      value: item.effects.join("\n").slice(0, 1024),
    });
  if (item.imageUrl && /^https:\/\//.test(item.imageUrl))
    value.setThumbnail(item.imageUrl);
  return value;
}
export function itemMenu(items: Item[]) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("item-select")
      .setPlaceholder("Gegenstand auswählen")
      .addOptions(
        items
          .slice(0, 25)
          .map((x) => ({
            label: x.name.slice(0, 100),
            description: `Level ${x.level} · ${x.type}`.slice(0, 100),
            value: `${x.category}:${x.id}`,
          })),
      ),
  );
}
export function questMessage(quest: Quest, page = 0) {
  const last = Math.max(0, quest.steps.length - 1),
    index = Math.max(0, Math.min(last, Math.trunc(page))),
    step = quest.steps[index];
  const content = step
    ? `**${step.name || `Schritt ${index + 1}`}**\n${step.description}\n\n${step.objectives.map((o) => `${o.description || `Ziel #${o.id}`}${o.coordinates ? ` [${o.coordinates.x},${o.coordinates.y}]` : ""}`).join("\n")}`
    : "Keine bekannten Schritte im Datenbestand.";
  return {
    embeds: [
      embed(quest.name)
        .setDescription(content.slice(0, 4000))
        .setFooter({
          text: `${quest.source} · ${quest.version} · Schritt ${step ? index + 1 : 0}/${quest.steps.length}`,
        }),
    ],
    components:
      quest.steps.length > 1
        ? [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`quest:page:${quest.id}:${Math.max(0, index - 1)}`)
                .setLabel("Vorheriger Schritt")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(index === 0),
              new ButtonBuilder()
                .setCustomId(
                  `quest:page:${quest.id}:${Math.min(last, index + 1)}`,
                )
                .setLabel("Nächster Schritt")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(index === last),
            ),
          ]
        : [],
  };
}
export function groupMessage(group: Group) {
  const members = group.members.slice(0, group.capacity),
    wait = group.members.slice(group.capacity);
  return {
    embeds: [
      embed(group.title)
        .setDescription(
          `Start: <t:${Math.floor(group.startsAt / 1000)}:F>\nOrganisiert von <@${group.ownerId}>`,
        )
        .addFields(
          {
            name: `Teilnehmer ${members.length}/${group.capacity}`,
            value:
              members.map((x) => `<@${x}>`).join("\n") ||
              "Noch niemand angemeldet",
          },
          {
            name: `Warteliste (${wait.length})`,
            value:
              wait
                .map((x) => `<@${x}>`)
                .join("\n")
                .slice(0, 1024) || "Leer",
          },
        ),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`group:join:${group.id}`)
          .setLabel("Anmelden")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`group:leave:${group.id}`)
          .setLabel("Abmelden")
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
    allowedMentions: { parse: [] as [] },
  };
}
