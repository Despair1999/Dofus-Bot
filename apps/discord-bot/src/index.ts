import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { Backend, type Character, type Item, type Progress } from "./api.js";
import { Groups } from "./groups.js";
import {
  embed,
  itemEmbed,
  itemMenu,
  groupMessage,
  questMessage,
} from "./ui.js";
import { materials, profit } from "@dofus/core";
import type { Quest } from "@dofus/game-data";
import { canAccess } from "./permissions.js";
import { intelligenceButton, intelligenceCommand } from "./intelligence.js";
import { dungeonGroupModal } from "./dungeon-group.js";
import {
  buildEmbed,
  buildAttachment,
  classAttachment,
  dispatchBuildShare,
  type BuildSummary,
} from "./builder.js";
import type { Build } from "@dofus/core";
const token = process.env.DISCORD_TOKEN,
  ownerId = process.env.DISCORD_OWNER_ID,
  apiToken = process.env.COMPANION_TOKEN;
if (!token || !ownerId || !apiToken)
  throw Error(
    "DISCORD_TOKEN, DISCORD_OWNER_ID und COMPANION_TOKEN müssen gesetzt sein.",
  );
const api = new Backend(
  process.env.BACKEND_URL || "http://127.0.0.1:4310",
  apiToken,
);
const dbPath = process.env.DISCORD_DB_PATH || "../../data/discord.sqlite";
mkdirSync(dirname(dbPath), { recursive: true });
const groups = new Groups(dbPath);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const characters = async () =>
  (await api.request<{ data: Character[] }>("/api/characters")).data;
client.once(Events.ClientReady, (c) =>
  console.log(`Companion angemeldet: ${c.user.tag}`),
);
let sharing = false;
const shareTimer = setInterval(() => {
  if (!client.isReady() || sharing) return;
  sharing = true;
  void dispatchBuildShare(client, api, ownerId)
    .catch((e) =>
      console.error(
        "Build-Zustellung fehlgeschlagen:",
        e instanceof Error ? e.message : "Unbekannter Fehler",
      ),
    )
    .finally(() => {
      sharing = false;
    });
}, 15000);
shareTimer.unref();
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (
      (i.isButton() && i.customId.startsWith("intel-group:")) ||
      (i.isChatInputCommand() &&
        i.commandName === "dungeon" &&
        i.options.getSubcommand(false) === "gruppe")
    ) {
      if (
        !i.guildId ||
        !i.memberPermissions?.has(PermissionFlagsBits.ManageEvents)
      )
        throw Error(
          "Für eine Dungeongruppe im Server benötigst du „Events verwalten“.",
        );
      const button = i.isButton() ? i.customId.split(":") : null;
      const id = button
        ? Number(button[1])
        : i.isChatInputCommand()
          ? i.options.getInteger("id", true)
          : 0;
      const version = button
        ? button[2]
        : i.isChatInputCommand()
          ? (i.options.getString("version") ?? "3.7.12.12")
          : "";
      await i.showModal(dungeonGroupModal(id, version));
      return;
    }
    if (i.isModalSubmit() && i.customId.startsWith("intel-group:")) {
      if (
        !i.guildId ||
        !i.channelId ||
        !i.channel?.isTextBased() ||
        !("send" in i.channel) ||
        !i.memberPermissions?.has(PermissionFlagsBits.ManageEvents)
      )
        throw Error(
          "Keine Berechtigung für eine Gruppe in diesem Serverkanal.",
        );
      const [, id, version] = i.customId.split(":");
      dungeonGroupModal(Number(id), version);
      const date = i.fields.getTextInputValue("start"),
        capacity = Number(i.fields.getTextInputValue("capacity"));
      if (
        !/(Z|[+-]\d{2}:\d{2})$/.test(date) ||
        !Number.isInteger(capacity) ||
        capacity < 1 ||
        capacity > 8
      )
        throw Error("Startzeit mit Zeitzone und Spielerzahl 1–8 angeben.");
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const dungeon = (
        await api.request<{ data: { name: string } }>(
          `/api/dungeons/${id}?version=${version}`,
        )
      ).data;
      const group = groups.create({
        guildId: i.guildId,
        channelId: i.channelId,
        ownerId: i.user.id,
        title: `${dungeon.name} · ${version}`.slice(0, 100),
        capacity,
        startsAt: Date.parse(date),
      });
      const posted = await i.channel.send(groupMessage(group));
      groups.attach(group.id, posted.id);
      await i.editReply(`Gruppe erstellt: ${posted.url}`);
      return;
    }
    if (i.isButton() && (await intelligenceButton(i, api))) return;
    if (i.isAutocomplete()) {
      if (i.user.id !== ownerId) {
        await i.respond([]);
        return;
      }
      const query = String(i.options.getFocused()).toLowerCase();
      if (
        i.commandName === "builder" &&
        i.options.getFocused(true).name !== "charakter"
      ) {
        const all = (
          await api.request<{ data: Build[] }>("/api/builder/builds")
        ).data;
        await i.respond(
          all
            .filter((b) => b.name.toLowerCase().includes(query))
            .slice(0, 25)
            .map((b) => ({
              name: `${b.name} · ${b.gameVersion}`.slice(0, 100),
              value: b.id,
            })),
        );
        return;
      }
      await i.respond(
        (await characters())
          .filter((c) => c.name.toLowerCase().includes(query))
          .slice(0, 25)
          .map((c) => ({ name: `${c.name} · ${c.server}`, value: c.id })),
      );
      return;
    }
    if (i.isButton() && i.customId.startsWith("quest:page:")) {
      const [, , id, page] = i.customId.split(":");
      if (!/^\d+$/.test(id) || !/^\d+$/.test(page))
        throw Error("Ungültige Questseite.");
      await i.deferUpdate();
      const result = await api.request<{ data: Quest }>(`/api/quests/${id}`);
      await i.editReply(questMessage(result.data, Number(page)));
      return;
    }
    if (i.isButton() && i.customId.startsWith("group:")) {
      if (!i.guildId) throw Error("Nur auf einem Discord-Server verfügbar.");
      const [, action, id] = i.customId.split(":");
      const current = groups.get(id);
      if (
        !current ||
        current.messageId !== i.message.id ||
        current.channelId !== i.channelId
      )
        throw Error("Gruppennachricht nicht gültig.");
      const group =
        action === "join"
          ? groups.join(id, i.guildId, i.user.id)
          : action === "leave"
            ? groups.leave(id, i.guildId, i.user.id)
            : undefined;
      if (!group) throw Error("Unbekannte Gruppenaktion.");
      await i.update(groupMessage(group));
      return;
    }
    if (i.isStringSelectMenu() && i.customId === "item-select") {
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const [category, id] = i.values[0].split(":");
      if (
        ![
          "equipment",
          "resources",
          "consumables",
          "quest",
          "cosmetics",
        ].includes(category) ||
        !/^\d+$/.test(id)
      )
        throw Error("Ungültige Itemauswahl.");
      const result = await api.request<{ data: Item }>(
        `/api/items/${id}?category=${category}`,
      );
      await i.editReply({
        embeds: [itemEmbed(result.data)],
        content: recipe(result.data),
      });
      return;
    }
    if (i.isModalSubmit() && i.customId === "character-create") {
      if (i.user.id !== ownerId)
        throw Error(
          "Private Daten sind nur für das konfigurierte Companion-Konto verfügbar.",
        );
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const level = Number(i.fields.getTextInputValue("level"));
      if (!Number.isInteger(level) || level < 1 || level > 200)
        throw Error("Level muss eine ganze Zahl zwischen 1 und 200 sein.");
      const result = await api.request<{ data: Character }>("/api/characters", {
        name: i.fields.getTextInputValue("name"),
        server: i.fields.getTextInputValue("server"),
        className: i.fields.getTextInputValue("className"),
        level,
      });
      await i.editReply({
        embeds: [
          embed("Charakter registriert").setDescription(
            `${result.data.name} · ${result.data.server}\nID: ${result.data.id}`,
          ),
        ],
      });
      return;
    }
    if (!i.isChatInputCommand()) return;
    if (
      !canAccess(
        i.commandName,
        i.options.getSubcommand(false) ?? undefined,
        i.user.id,
        ownerId,
      )
    )
      throw Error(
        "Private Daten sind nur für das konfigurierte Companion-Konto verfügbar.",
      );
    if (
      i.commandName === "charakter" &&
      i.options.getSubcommand() === "registrieren"
    ) {
      const modal = new ModalBuilder()
        .setCustomId("character-create")
        .setTitle("Charakter registrieren");
      for (const [id, label] of [
        ["name", "Charaktername"],
        ["server", "Server"],
        ["className", "Klasse"],
        ["level", "Level (1–200)"],
      ])
        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId(id)
              .setLabel(label)
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(id === "level" ? 3 : 100),
          ),
        );
      await i.showModal(modal);
      return;
    }
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (await intelligenceCommand(i, api)) return;
    if (i.commandName === "hilfe") {
      await i.editReply({
        embeds: [
          embed("Dein DOFUS Companion").setDescription(
            "/charakter – private Profile und Fortschritt\n/item – Suche, Werte und Rezepte\n/quest schritt – bestätigten Fortschritt synchronisieren\n/almanax – echte Spieldaten\n/dungeon erstellen – Gruppen mit Warteliste\n/status – Verbindung prüfen\n\nPrivate Charakterfunktionen sind auf das konfigurierte Companion-Konto beschränkt.",
          ),
        ],
      });
      return;
    }
    if (i.commandName === "status") {
      await api.request("/health");
      await i.editReply("Backend erreichbar.");
      return;
    }
    if (i.commandName === "builder") {
      const sub = i.options.getSubcommand();
      const all = (await api.request<{ data: Build[] }>("/api/builder/builds"))
        .data;
      if (sub === "profil" || sub === "sets") {
        const characterId =
          sub === "sets" ? i.options.getString("charakter", true) : null;
        const list = all.filter(
          (b) => !characterId || b.characterId === characterId,
        );
        await i.editReply({
          embeds: [
            embed("Deine Companion-Sets").setDescription(
              list
                .map(
                  (b) =>
                    `**${b.name}** · ${b.gameVersion}${b.active ? " · aktiv" : ""}\n\`${b.id}\``,
                )
                .join("\n\n")
                .slice(0, 4000) || "Noch keine Sets gespeichert.",
            ),
          ],
        });
        return;
      }
      const id = i.options.getString("build", true);
      const summary = (
        await api.request<{ data: BuildSummary }>(
          `/api/builder/builds/${encodeURIComponent(id)}/summary`,
        )
      ).data;
      if (sub === "vergleichen") {
        const other = (
          await api.request<{ data: BuildSummary }>(
            `/api/builder/builds/${encodeURIComponent(i.options.getString("anderer", true))}/summary`,
          )
        ).data;
        if (summary.build.gameVersion !== other.build.gameVersion)
          throw Error(
            "Verschiedene Datenversionen können nicht stillschweigend verglichen werden.",
          );
        const portraits = [
          ...new Set([summary.build.classId, other.build.classId]),
        ].flatMap((id) => {
          const image = classAttachment(id);
          return image ? [image] : [];
        });
        await i.editReply({
          embeds: [buildEmbed(summary), buildEmbed(other)],
          files: portraits,
        });
        return;
      }
      await i.editReply({
        embeds: [buildEmbed(summary)],
        files: [
          ...(sub === "teilen" ? [buildAttachment(summary.build)] : []),
          ...[classAttachment(summary.build.classId)].flatMap((image) =>
            image ? [image] : [],
          ),
        ],
      });
      return;
    }
    if (i.commandName === "charakter") {
      if (i.options.getSubcommand() === "profil") {
        const list = await characters();
        await i.editReply({
          embeds: [
            embed("Deine Charaktere").setDescription(
              list
                .map(
                  (c) =>
                    `**${c.name}** · ${c.className} ${c.level} · ${c.server}\n\`${c.id}\``,
                )
                .join("\n\n")
                .slice(0, 4000) || "Noch kein Charakter registriert.",
            ),
          ],
        });
      } else {
        const id = i.options.getString("charakter", true);
        const list = await api.request<{ data: Progress[] }>(
          `/api/characters/${encodeURIComponent(id)}/progress`,
        );
        await i.editReply({
          embeds: [
            embed("Questfortschritt").setDescription(
              list.data
                .map(
                  (p) =>
                    `Quest ${p.questId} · Schritt ${p.step} · ${p.status} (v${p.version})`,
                )
                .join("\n")
                .slice(0, 4000) || "Noch kein Questfortschritt gespeichert.",
            ),
          ],
        });
      }
      return;
    }
    if (i.commandName === "quest") {
      if (i.options.getSubcommand() === "suchen") {
        const result = await api.request<{ data: Quest[] }>(
          `/api/quests?q=${encodeURIComponent(i.options.getString("name", true))}`,
        );
        await i.editReply({
          embeds: [
            embed("Questsuche").setDescription(
              result.data
                .map((q) => `**${q.name}** · Level ${q.level} · ID ${q.id}`)
                .join("\n")
                .slice(0, 4000) ||
                "Keine Quests gefunden. Spieldaten müssen zuerst im Desktop importiert werden.",
            ),
          ],
        });
        return;
      }
      if (i.options.getSubcommand() === "info") {
        const result = await api.request<{ data: Quest }>(
            `/api/quests/${i.options.getInteger("id", true)}`,
          ),
          q = result.data;
        await i.editReply(questMessage(q));
        return;
      }
      const characterId = i.options.getString("charakter", true),
        questId = i.options.getInteger("id", true);
      const list = await api.request<{ data: Progress[] }>(
        `/api/characters/${encodeURIComponent(characterId)}/progress`,
      );
      const current = list.data.find((x) => x.questId === questId);
      await api.progress(characterId, {
        questId,
        step: i.options.getInteger("schritt", true),
        status: i.options.getString("status", true),
        expectedVersion: current?.version ?? 0,
        mutationId: randomUUID(),
      });
      await i.editReply(
        "Bestätigter Questfortschritt im gemeinsamen Backend gespeichert.",
      );
      return;
    }
    if (i.commandName === "craft") {
      if (i.options.getSubcommand() === "gewinn") {
        const result = profit(
          i.options.getNumber("kosten", true),
          i.options.getNumber("erloes", true),
          i.options.getNumber("gebuehr") ?? 2,
        );
        await i.editReply({
          embeds: [
            embed("Gewinn aus deinen Angaben").setDescription(
              `Kosten: ${result.cost} Kamas\nVerkauf: ${result.sale} Kamas\nGebühren: ${result.fees} Kamas\nGewinn: ${result.profit} Kamas\nMarge: ${result.marginPercent.toFixed(2)} %\n\nEigene Eingaben; keine aktuellen Marktpreise.`,
            ),
          ],
        });
        return;
      }
      const result = await api.request<{ data: Item }>(
        `/api/items/${i.options.getInteger("id", true)}?category=${i.options.getString("kategorie", true)}`,
      );
      if (!result.data.recipe?.length)
        throw Error("Kein Rezept in den gelieferten Daten.");
      const required = materials([
        {
          recipe: result.data.recipe,
          quantity: i.options.getInteger("menge", true),
        },
      ]);
      await i.editReply({
        embeds: [
          embed(`Materialbedarf · ${result.data.name}`).setDescription(
            required
              .map((x) => `${x.required} × Item #${x.itemId}`)
              .join("\n")
              .slice(0, 4000),
          ),
        ],
      });
      return;
    }
    if (i.commandName === "item") {
      if (i.options.getSubcommand() === "suchen") {
        const result = await api.request<{
          data: Item[];
          cached?: boolean;
          stale?: boolean;
        }>(
          `/api/items?q=${encodeURIComponent(i.options.getString("name", true))}&lang=de`,
        );
        await i.editReply({
          content: result.data.length
            ? `${result.data.length} Treffer${result.stale ? " · veralteter Cache" : ""}`
            : "Keine Gegenstände gefunden.",
          components: result.data.length ? [itemMenu(result.data)] : [],
        });
      } else {
        const result = await api.request<{ data: Item }>(
          `/api/items/${i.options.getInteger("id", true)}?category=${i.options.getString("kategorie", true)}`,
        );
        await i.editReply({
          embeds: [itemEmbed(result.data)],
          content: recipe(result.data),
        });
      }
      return;
    }
    if (i.commandName === "almanax") {
      const date =
        i.options.getString("datum") ||
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Berlin",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))
        throw Error("Datum muss YYYY-MM-DD entsprechen.");
      const result = await api.request<{ data: unknown }>(
        `/api/almanax?date=${date}`,
      );
      await i.editReply({
        embeds: [
          embed(`Almanax · ${date}`)
            .setDescription(
              "Originaldaten von Dofusdude; fehlende Felder werden nicht ergänzt.",
            )
            .addFields({
              name: "Daten",
              value: JSON.stringify(result.data, null, 2).slice(0, 1000),
            }),
        ],
      });
      return;
    }
    if (i.commandName === "dungeon") {
      if (!i.guildId || !i.channel?.isTextBased() || !("send" in i.channel))
        throw Error("In einem beschreibbaren Serverkanal verwenden.");
      if (!i.memberPermissions?.has(PermissionFlagsBits.ManageEvents))
        throw Error("Zum Erstellen benötigst du „Events verwalten“.");
      const date = i.options.getString("start", true);
      if (!/(Z|[+-]\d{2}:\d{2})$/.test(date))
        throw Error("Die Startzeit benötigt eine Zeitzone (Z oder +01:00).");
      const group = groups.create({
        guildId: i.guildId,
        channelId: i.channelId,
        ownerId: i.user.id,
        title: i.options.getString("titel", true),
        capacity: i.options.getInteger("plaetze", true),
        startsAt: Date.parse(date),
      });
      const message = await i.channel.send(groupMessage(group));
      groups.attach(group.id, message.id);
      await i.editReply(`Gruppe erstellt: ${message.url}`);
      return;
    }
  } catch (error) {
    console.error(
      "Discord-Interaktion fehlgeschlagen",
      error instanceof Error ? error.message : "Unbekannter Fehler",
    );
    if (i.isAutocomplete()) {
      if (!i.responded) await i.respond([]).catch(() => {});
      return;
    }
    if (!i.isRepliable()) return;
    const content =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    if (i.deferred || i.replied)
      await i
        .editReply({ content, embeds: [], components: [] })
        .catch(() => {});
    else
      await i.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});
function recipe(item: Item) {
  return item.recipe?.length
    ? `**Rezept**\n${item.recipe.map((x) => `${x.quantity} × Item #${x.itemId}`).join("\n")}`.slice(
        0,
        1900,
      )
    : "Kein Rezept in den gelieferten Daten.";
}
let reminding = false;
const timer = setInterval(async () => {
  if (reminding) return;
  reminding = true;
  try {
    for (const group of groups.due()) {
      try {
        const channel = await client.channels.fetch(group.channelId);
        if (!channel?.isTextBased() || !("send" in channel)) continue;
        await channel.send({
          content: `Erinnerung: **${group.title.replace(/[@*_~`]/g, "")}** beginnt <t:${Math.floor(group.startsAt / 1000)}:R>. ${group.members
            .slice(0, group.capacity)
            .map((id) => `<@${id}>`)
            .join(" ")}`,
          allowedMentions: {
            users: group.members.slice(0, group.capacity),
            parse: [],
          },
        });
        groups.markReminded(group.id);
      } catch {
        console.error("Gruppenerinnerung nicht zugestellt:", group.id);
      }
    }
  } finally {
    reminding = false;
  }
}, 60000);
const stop = () => {
  clearInterval(timer);
  client.destroy();
  groups.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await client.login(token);
