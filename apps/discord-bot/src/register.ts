import { REST, Routes } from "discord.js";
import { commands } from "./commands.js";
import { entryPointCommands } from "./registration.js";
const token = process.env.DISCORD_TOKEN,
  clientId = process.env.DISCORD_CLIENT_ID,
  guildId = process.env.DISCORD_GUILD_ID;
if (!token || !clientId)
  throw Error("DISCORD_TOKEN und DISCORD_CLIENT_ID fehlen.");
const rest = new REST({ version: "10" }).setToken(token);
const entryPoints = guildId
  ? []
  : entryPointCommands(
      (await rest.get(Routes.applicationCommands(clientId))) as Parameters<
        typeof entryPointCommands
      >[0],
    );
await rest.put(
  guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId),
  { body: [...commands, ...entryPoints] },
);
console.log(
  `${commands.length} Companion-Commands registriert (${guildId ? "Testserver" : "global"}).`,
);
