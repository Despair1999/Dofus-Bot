import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AttachmentBuilder } from "discord.js";

const root = resolve(
  process.env.COMPANION_PUBLIC_ASSETS ??
    resolve(dirname(fileURLToPath(import.meta.url)), "../../desktop/public"),
);
let monsters: Record<string, string> | undefined;
export function monsterAttachment(id: number) {
  try {
    monsters ??= JSON.parse(
      readFileSync(resolve(root, "game-assets/manifest.json"), "utf8"),
    ).monsters;
    const url = monsters?.[String(id)];
    if (!url || !/^\/game-assets\/monsters\/\d+\.webp$/.test(url)) return;
    const path = resolve(root, "." + url);
    if (!existsSync(path)) return;
    const name = `monster-${id}.webp`;
    return {
      file: new AttachmentBuilder(path, { name }),
      url: `attachment://${name}`,
    };
  } catch {
    return;
  }
}
