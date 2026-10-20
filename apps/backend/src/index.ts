import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { GameDataStore } from "@dofus/game-data";
import { PersonalStore } from "./store.js";
import { createApp } from "./app.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = resolve(process.env.DATA_DIR ?? resolve(root, ".data"));
mkdirSync(dataDir, { recursive: true });
const tokenPath = resolve(dataDir, "backend-token");
let token = process.env.COMPANION_TOKEN;
if (!token) {
  token = existsSync(tokenPath)
    ? readFileSync(tokenPath, "utf8").trim()
    : randomBytes(32).toString("hex");
  if (!existsSync(tokenPath)) writeFileSync(tokenPath, token, { mode: 0o600 });
}
if (token.length < 32)
  throw new Error("COMPANION_TOKEN muss mindestens 32 Zeichen lang sein.");
// Native shell reads the actual service token, including an explicitly configured token.
if (!existsSync(tokenPath) || readFileSync(tokenPath, "utf8").trim() !== token)
  writeFileSync(tokenPath, token, { mode: 0o600 });
const personal = new PersonalStore(resolve(dataDir, "personal.sqlite"));
const game = new GameDataStore(resolve(dataDir, "game-data.sqlite"));
const app = await createApp({ personal, game, token, logger: true });
const port = Number(process.env.PORT ?? 4310);
const host = process.env.HOST ?? "127.0.0.1";
if (!["127.0.0.1", "0.0.0.0", "::1"].includes(host))
  throw new Error("HOST muss 127.0.0.1, ::1 oder explizit 0.0.0.0 sein.");
await app.listen({ host, port });
app.log.info(
  { tokenFile: tokenPath },
  "Lokaler Verbindungsschlüssel bereit. Nicht veröffentlichen.",
);
async function shutdown() {
  await app.close();
  personal.close();
  game.close();
  process.exit(0);
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
