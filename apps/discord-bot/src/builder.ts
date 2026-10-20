import {
  AttachmentBuilder,
  EmbedBuilder,
  escapeMarkdown,
  type Client,
} from "discord.js";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  statDefinitions,
  type Build,
  type BuilderItem,
  type Character,
  type calculateBuild,
} from "@dofus/core";
import type { Backend } from "./api.js";
export interface BuildSummary {
  build: Build;
  calculation: ReturnType<typeof calculateBuild>;
  equipment: (BuilderItem & { slot: string })[];
  character: Character | null;
}
export function buildEmbed(summary: BuildSummary) {
  const { build, calculation, character, equipment } = summary;
  const portrait = classAttachment(build.classId);
  return new EmbedBuilder()
    .setThumbnail(portrait ? `attachment://class-${build.classId}.webp` : null)
    .setColor(0xb9df82)
    .setTitle(escapeMarkdown(build.name).slice(0, 256))
    .setDescription(
      `${character ? escapeMarkdown(character.name) : "Unabhängiger Build"} · Klasse ${build.classId} · Stufe ${build.level}\nGeplante Companion-Ausrüstung · DOFUS ${build.gameVersion}`,
    )
    .addFields(
      {
        name: "Gesamtwerte",
        value:
          `${calculation.total[12] ?? 0} AP · ${calculation.total[8] ?? 0} MP · ${calculation.hp} LP\n${[45, 13, 22, 36, 29].map((id) => `${statDefinitions.find((s) => s[0] === id)?.[1]}: ${calculation.total[id] ?? 0}`).join(" · ")}`.slice(
            0,
            1024,
          ),
      },
      {
        name: "Ausrüstung",
        value:
          equipment
            .map((i) => `${i.slot}: ${escapeMarkdown(i.name ?? "Unbekannt")}`)
            .join("\n")
            .slice(0, 1024) || "Keine Ausrüstung",
      },
      {
        name: "Prüfung",
        value: calculation.valid
          ? "Ausgewertete Regeln erfüllt."
          : [...calculation.warnings, ...calculation.unknown]
              .join("\n")
              .slice(0, 1024) || "Unvollständige Daten",
      },
    )
    .setFooter({
      text: `Build ${build.id} · Revision ${build.revision} · /builder teilen liefert die vollständige Importdatei`,
    });
}
export function classAttachment(id: number) {
  if (!Number.isInteger(id) || id < 1 || id > 20) return null;
  const path = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../desktop/public/classes",
    id + ".webp",
  );
  return existsSync(path)
    ? new AttachmentBuilder(path, { name: `class-${id}.webp` })
    : null;
}
export function buildAttachment(build: Build) {
  return new AttachmentBuilder(
    Buffer.from(
      JSON.stringify(
        { format: "dofus-companion-build", schema: 1, build },
        null,
        2,
      ),
      "utf8",
    ),
    { name: `build-${build.id}.dofus-build.json` },
  );
}
export async function dispatchBuildShare(
  client: Client,
  api: Backend,
  ownerId: string,
) {
  const { data } = await api.request<{
    data: (BuildSummary & { id: string }) | null;
  }>("/api/builder/shares/claim", {});
  if (!data) return false;
  try {
    const owner = await client.users.fetch(ownerId);
    await owner.send({
      embeds: [buildEmbed(data)],
      files: [
        buildAttachment(data.build),
        ...[classAttachment(data.build.classId)].filter(
          (a): a is AttachmentBuilder => a !== null,
        ),
      ],
      allowedMentions: { parse: [] },
      nonce: createHash("sha256").update(data.id).digest("hex").slice(0, 24),
      enforceNonce: true,
    });
    await api.request("/api/builder/shares/" + data.id + "/ack", {
      delivered: true,
    });
    return true;
  } catch (e) {
    await api.request("/api/builder/shares/" + data.id + "/ack", {
      delivered: false,
      error:
        e instanceof Error
          ? e.message.slice(0, 500)
          : "Discord-Zustellung fehlgeschlagen",
    });
    throw e;
  }
}
