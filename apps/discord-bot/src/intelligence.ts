import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type {
  DungeonSummary,
  DungeonMonster,
  DungeonEditorial,
  ProfessionQuest,
  WorldPosition,
  GatherableResource,
  WorldRoute,
} from "@dofus/core";
import { Backend } from "./api.js";
import { monsterAttachment } from "./artwork.js";
import { embed } from "./ui.js";

export const intelligenceCommands = [
  new SlashCommandBuilder()
    .setName("karte")
    .setDescription("Weltkarte, Fundregionen und echte Kartenwege")
    .addSubcommand((s) =>
      s.setName("oeffnen").setDescription("Interaktive Karte öffnen"),
    )
    .addSubcommand((s) =>
      s
        .setName("suchen")
        .setDescription("Karte, Gebiet oder Koordinaten suchen")
        .addStringOption((o) =>
          o
            .setName("name")
            .setDescription("Gebiet, Map-ID oder [x,y]")
            .setRequired(true)
            .setMaxLength(100),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("position")
        .setDescription("Karte und schematische PNG-Vorschau")
        .addIntegerOption((o) =>
          o
            .setName("id")
            .setDescription("Map-ID")
            .setMinValue(1)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("ressource")
        .setDescription("Ressourcen und bekannte Fundregionen")
        .addStringOption((o) =>
          o.setName("name").setDescription("Ressourcenname").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("route")
        .setDescription("Route über bekannte gerichtete Kartenübergänge")
        .addIntegerOption((o) =>
          o
            .setName("start")
            .setDescription("Start Map-ID")
            .setRequired(true)
            .setMinValue(1),
        )
        .addIntegerOption((o) =>
          o
            .setName("ziel")
            .setDescription("Ziel Map-ID")
            .setRequired(true)
            .setMinValue(1),
        ),
    ),
  new SlashCommandBuilder()
    .setName("farm")
    .setDescription("Sammelressourcen und eigene Farmrouten")
    .addSubcommand((s) =>
      s
        .setName("ressource")
        .setDescription("Ressourcen suchen")
        .addStringOption((o) =>
          o.setName("name").setDescription("Ressourcenname").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("fundorte")
        .setDescription("Belegte Ressourcenregionen suchen")
        .addStringOption((o) =>
          o.setName("name").setDescription("Ressourcenname").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("route")
        .setDescription("Eigene bestätigte Fundorte verbinden (privat)")
        .addIntegerOption((o) =>
          o
            .setName("start")
            .setDescription("Start Map-ID")
            .setRequired(true)
            .setMinValue(1),
        )
        .addIntegerOption((o) =>
          o
            .setName("ressource")
            .setDescription("Sammelressourcen-ID aus /farm ressource")
            .setRequired(true)
            .setMinValue(1),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("projekt")
        .setDescription("Persönlich gespeicherte Routen anzeigen"),
    ),
  new SlashCommandBuilder()
    .setName("beruf")
    .setDescription("Berufsquests und ihre belegten Anforderungen")
    .addSubcommand((s) =>
      s
        .setName("quest")
        .setDescription("Tägliche Sammelquests durchsuchen")
        .addStringOption((o) =>
          o
            .setName("name")
            .setDescription("Quest oder Beruf")
            .setRequired(true),
        ),
    ),
];
export function extendDungeonCommand(
  command: SlashCommandSubcommandsOnlyBuilder,
) {
  for (const name of [
    "suchen",
    "info",
    "boss",
    "monster",
    "mechanik",
    "strategie",
    "raeume",
    "erfolge",
    "drops",
    "vorbereiten",
    "gruppe",
  ] as const)
    command.addSubcommand((s) => {
      s.setName(name).setDescription(
        name === "suchen"
          ? "Versionierten Dungeon-Katalog durchsuchen"
          : `Dungeon ${name} aus der gemeinsamen Datenbank`,
      );
      if (name === "suchen")
        s.addStringOption((o) =>
          o
            .setName("name")
            .setDescription("Dungeon oder Boss")
            .setRequired(true),
        );
      else
        s.addIntegerOption((o) =>
          o
            .setName("id")
            .setDescription("Dungeon-ID aus /dungeon suchen")
            .setRequired(true)
            .setMinValue(1),
        );
      return s.addStringOption((o) =>
        o
          .setName("version")
          .setDescription("Spielversion")
          .addChoices(
            { name: "DOFUS 3.7.12.12", value: "3.7.12.12" },
            { name: "DOFUS 3.6.12.16", value: "3.6.12.16" },
          ),
      );
    });
  return command;
}
type DungeonDetail = DungeonSummary & {
  version: string;
  monsters: DungeonMonster[];
  editorial: DungeonEditorial;
};
export function dungeonMessage(d: DungeonDetail, tab = "info", page = 0) {
  const boss = d.monsters.filter((m) => d.bossIds.includes(m.id));
  const value = embed(d.name).setDescription(
    `**${d.bossNames.join(" · ") || "Bosszuordnung offen"}**\nStufe ${d.level} · ${d.region || "Region unbekannt"}\n${d.entrance ? `[${d.entrance.x},${d.entrance.y}] · Map-ID ${d.entrance.mapId}` : "Eingangsposition nicht aufgelöst"}`,
  );
  const artwork = monsterAttachment(
    d.illustrationMonsterId ?? boss[0]?.id ?? 0,
  );
  const lines: string[] = [];
  if (["info", "boss"].includes(tab))
    for (const m of boss) {
      const grade = m.grades[0];
      lines.push(
        `**${m.name}**${
          grade
            ? ` · Stufe ${grade.level} · ${grade.lifePoints} LP · ${grade.actionPoints} AP / ${grade.movementPoints} MP\n${Object.entries(
                grade.resistances,
              )
                .map(([key, n]) => `${key}: ${n}%`)
                .join(" · ")}`
            : " · Werte fehlen"
        }`,
      );
    }
  if (tab === "monster")
    for (const m of d.monsters)
      lines.push(
        `**${m.name}** · ${m.grades.length} Grade · ${m.spells.length} Zauber`,
      );
  if (tab === "mechanik")
    lines.push(
      ...(d.editorial.status === "verified" || d.editorial.mechanicsVerified
        ? d.editorial.mechanics
        : []),
      ...(!d.editorial.mechanics.length ||
      (d.editorial.status !== "verified" && !d.editorial.mechanicsVerified)
        ? [
            "Keine für diese Version verifizierten Mechaniktexte. Originaldaten und externe Quellen im Companion prüfen.",
          ]
        : []),
    );
  if (tab === "strategie")
    lines.push(
      ...(d.editorial.status === "verified" ? d.editorial.strategy : []),
      ...(!d.editorial.strategy.length || d.editorial.status !== "verified"
        ? [
            "Redaktionelle Prüfung ausstehend. Keine verifizierte Strategie für diesen Spielstand.",
          ]
        : []),
    );
  if (tab === "raeume")
    lines.push(
      ...d.editorial.rooms.map(
        (r) =>
          `Karte ${r.mapId} · ${r.type} · ${r.players} Spieler · ${r.monsters.map((m) => `${m.count} × ${d.monsters.find((v) => v.id === m.id)?.name ?? m.id}`).join(", ")}`,
      ),
      ...(!d.editorial.rooms.length
        ? [
            `${d.mapIds.length} Karten zugeordnet. Verlässliche Monsterbelegung je Raum und Gruppengröße fehlt.`,
          ]
        : []),
    );
  if (tab === "erfolge")
    lines.push(
      ...d.achievements.map(
        (a) => `**${a.name}** · ${a.points} Punkte\n${a.description}`,
      ),
    );
  if (tab === "drops")
    lines.push(
      ...boss.flatMap((m) =>
        m.drops.map(
          (drop) =>
            `**${drop.name}** · ${drop.rates.join(" / ")}%${drop.conditions ? ` · ${drop.conditions}` : ""}`,
        ),
      ),
    );
  const pages = Math.max(1, Math.ceil(lines.length / 6)),
    current = Math.max(0, Math.min(page, pages - 1));
  value.addFields({
    name: tab === "info" ? "Bosswerte · erster dokumentierter Grad" : tab,
    value:
      lines
        .slice(current * 6, current * 6 + 6)
        .join("\n\n")
        .slice(0, 1024) || "Keine Daten vorhanden.",
  });
  value.setFooter({
    text: `DOFUS ${d.version} · ${d.status} · ${current + 1}/${pages} · Quelle: dofus-sqlite`,
  });
  if (artwork) value.setThumbnail(artwork.url);
  else if (boss[0]?.image?.startsWith("https://"))
    value.setThumbnail(boss[0].image);
  const rows = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...["mechanik", "monster", "strategie", "raeume", "drops"].map((t) =>
        new ButtonBuilder()
          .setCustomId(`intel:${d.id}:${d.version}:${t}:0`)
          .setLabel(t[0].toUpperCase() + t.slice(1))
          .setStyle(ButtonStyle.Secondary),
      ),
    ),
  ];
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`intel-group:${d.id}:${d.version}`)
        .setLabel("Gruppe erstellen")
        .setStyle(ButtonStyle.Primary),
    ),
  );
  if (pages > 1)
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`intel:${d.id}:${d.version}:${tab}:${current - 1}`)
          .setLabel("Zurück")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(current === 0),
        new ButtonBuilder()
          .setCustomId(`intel:${d.id}:${d.version}:${tab}:${current + 1}`)
          .setLabel("Weiter")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(current >= pages - 1),
      ),
    );
  return {
    embeds: [value],
    files: artwork ? [artwork.file] : [],
    components: rows,
    allowedMentions: { parse: [] as never[] },
  };
}
export async function intelligenceButton(i: ButtonInteraction, api: Backend) {
  if (!i.customId.startsWith("intel:")) return false;
  const [, id, version, tab, page] = i.customId.split(":");
  if (
    !/^\d+$/.test(id) ||
    !["3.7.12.12", "3.6.12.16"].includes(version) ||
    ![
      "info",
      "boss",
      "mechanik",
      "monster",
      "strategie",
      "raeume",
      "erfolge",
      "drops",
    ].includes(tab) ||
    !/^-?\d{1,3}$/.test(page)
  )
    throw Error("Ungültige Dungeonansicht.");
  await i.deferUpdate();
  const result = await api.request<{ data: DungeonDetail }>(
    `/api/dungeons/${id}?version=${version}`,
  );
  await i.editReply(dungeonMessage(result.data, tab, Number(page)));
  return true;
}
export async function intelligenceCommand(
  i: ChatInputCommandInteraction,
  api: Backend,
) {
  const sub = i.options.getSubcommand(false);
  if (i.commandName === "dungeon" && sub !== "erstellen") {
    const version = i.options.getString("version") ?? "3.7.12.12";
    if (sub === "suchen") {
      const result = await api.request<{
        data: DungeonSummary[];
        total: number;
      }>(
        `/api/dungeons?q=${encodeURIComponent(i.options.getString("name", true))}&version=${version}&pageSize=20`,
      );
      await i.editReply({
        embeds: [
          embed(`${result.total} Dungeons gefunden`)
            .setDescription(
              result.data
                .map(
                  (d) =>
                    `**${d.name}** · Stufe ${d.level} · ID \`${d.id}\`\n${d.bossNames.join(" · ")}`,
                )
                .join("\n\n")
                .slice(0, 4000) || "Keine Treffer.",
            )
            .setFooter({ text: `DOFUS ${version} · dofus-sqlite` }),
        ],
      });
      return true;
    }
    const id = i.options.getInteger("id", true),
      result = await api.request<{ data: DungeonDetail }>(
        `/api/dungeons/${id}?version=${version}`,
      );
    if (sub === "vorbereiten") {
      await i.editReply({
        embeds: [
          embed(`Vorbereitung · ${result.data.name}`).setDescription(
            `Schlüssel: ${result.data.keys.map((k) => `${k.quantity} × ${k.name}`).join(", ") || "Keine verifizierte Schlüsselanforderung importiert"}\n\nIm Companion unter Dungeons & Bosse einen Charakter und Build auswählen. Bestände und Zugang müssen selbst bestätigt werden.\n\nGruppe: /dungeon erstellen`,
          ),
        ],
      });
      return true;
    }
    await i.editReply(dungeonMessage(result.data, sub ?? "info"));
    return true;
  }
  if (i.commandName === "beruf") {
    const result = await api.request<{ data: ProfessionQuest[] }>(
      "/api/profession-quests",
    );
    const q = i.options.getString("name", true).toLocaleLowerCase();
    const list = result.data.filter((r) =>
      `${r.name} ${r.nameFr} ${r.jobName}`.toLocaleLowerCase().includes(q),
    );
    await i.editReply({
      embeds: [
        embed("Berufs- und Sammelquests").setDescription(
          list
            .map(
              (r) =>
                `**${r.name}**\n${r.jobName} ${r.minJobLevel} · Charakter ${r.minCharacterLevel}\n${r.quantity} × ${r.itemName}\n${r.start ? `[${r.start.x},${r.start.y}] · ${r.npc}` : r.npc}\n[Originalguide](${r.guide})\n${r.warnings.join(" ")}`,
            )
            .join("\n\n")
            .slice(0, 4000) || "Keine passende Quest gefunden.",
        ),
      ],
    });
    return true;
  }
  if (!["karte", "farm"].includes(i.commandName)) return false;
  if (sub === "oeffnen") {
    const url = process.env.COMPANION_ACTIVITY_URL;
    await i.editReply({
      embeds: [
        embed("DOFUS Companion · Weltkarte").setDescription(
          url?.startsWith("https://")
            ? `[Interaktive Webkarte öffnen](${url})\n\nIn Discord: App-Launcher → Companion-Activity. Dafür muss die Activity im Developer Portal aktiviert sein.`
            : "Die interaktive Karte ist im Companion verfügbar. Eine Discord Activity benötigt noch HTTPS-Hosting und die Developer-Portal-Aktivierung.",
        ),
      ],
    });
    return true;
  }
  if (["ressource", "fundorte"].includes(sub ?? "")) {
    const result = await api.request<{
      data: GatherableResource[];
      version: string;
    }>(
      `/api/world/resources?q=${encodeURIComponent(i.options.getString("name", true))}`,
    );
    await i.editReply({
      embeds: [
        embed("Bekannte Sammelressourcen")
          .setDescription(
            result.data
              .slice(0, 12)
              .map(
                (r) =>
                  `**${r.name}** · ID \`${r.id}\`\n${r.jobName} ${r.level} · ${r.regions.map((a) => a.name).join(", ") || "Keine Region zugeordnet"}`,
              )
              .join("\n\n")
              .slice(0, 3900) || "Keine Treffer.",
          )
          .setFooter({
            text: `DOFUS ${result.version} · Regionen belegen keine aktuellen Spawns`,
          }),
      ],
    });
    return true;
  }
  if (sub === "projekt") {
    const result = await api.request<{
      data: { name: string; route: WorldRoute }[];
    }>("/api/world/personal/routes");
    await i.editReply({
      embeds: [
        embed("Deine Farmprojekte").setDescription(
          result.data
            .slice(0, 20)
            .map((r) => `**${r.name}** · ${r.route.steps} Kartenwechsel`)
            .join("\n") || "Noch keine Routen gespeichert.",
        ),
      ],
    });
    return true;
  }
  if (sub === "route") {
    const farm = i.commandName === "farm";
    const result = await api.request<{ data: WorldRoute; warning?: string }>(
      farm ? "/api/world/farm-route" : "/api/world/route",
      {
        startMapId: i.options.getInteger("start", true),
        ...(farm
          ? { resourceIds: [i.options.getInteger("ressource", true)] }
          : { targetMapIds: [i.options.getInteger("ziel", true)] }),
      },
    );
    await i.editReply({
      embeds: [
        embed(
          farm ? "Eigene Farmroute" : "Bekannte Kartenroute",
        ).setDescription(
          `${result.data.steps} Kartenwechsel\n${result.data.mapIds
            .map((id) => `\`${id}\``)
            .join(" → ")
            .slice(
              0,
              2500,
            )}\n\n${result.warning ?? result.data.warning}\n${result.data.complete ? "" : `Nicht erreichbar: ${result.data.unreachableMapIds.join(", ")}`}`,
        ),
      ],
    });
    return true;
  }
  if (sub === "position") {
    const result = await api.request<{ data: WorldPosition; version: string }>(
      `/api/world/maps/${i.options.getInteger("id", true)}`,
    );
    const m = result.data;
    const preview = await api.binary(`/api/world/preview.png?mapIds=${m.id}`);
    await i.editReply({
      embeds: [
        embed(`[${m.x},${m.y}] · ${m.subAreaName}`)
          .setDescription(
            `Map-ID ${m.id} · Welt ${m.worldId}\n${m.areaName}\nSchematische Kartenposition aus dem lokalen Datenstand.`,
          )
          .setImage("attachment://karte.png")
          .setFooter({ text: `DOFUS ${result.version} · dofus-sqlite` }),
      ],
      files: [{ attachment: preview, name: "karte.png" }],
    });
    return true;
  }
  const result = await api.request<{ data: WorldPosition[]; total: number }>(
    `/api/world/maps?q=${encodeURIComponent(i.options.getString("name", true))}&limit=20`,
  );
  await i.editReply({
    embeds: [
      embed(`${result.total} Karten gefunden`).setDescription(
        result.data
          .map(
            (m) =>
              `**${m.subAreaName}** · [${m.x},${m.y}]\nMap-ID \`${m.id}\` · Welt ${m.worldId}`,
          )
          .join("\n\n")
          .slice(0, 4000) || "Keine Treffer.",
      ),
    ],
  });
  return true;
}
