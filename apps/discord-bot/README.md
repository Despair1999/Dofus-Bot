# Discord Companion

Node.js 22.13+; discord.js 14.27.0 (stable npm release checked 2026-10-20). Uses only the Guilds gateway intent. No message-content or member privileged intent required.

1. Create an application and bot in the Discord developer portal; invite with `bot` and `applications.commands` scopes. Grant Send Messages, Embed Links, Read Message History. Organizers need Manage Events.
2. Set `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, optional `DISCORD_GUILD_ID` for test commands, `DISCORD_OWNER_ID`, `COMPANION_TOKEN`, and `BACKEND_URL` (default http://127.0.0.1:4310). Copy root `.env.example` to `.env` first.
3. `pnpm --filter @dofus/discord-bot register` registers commands; `pnpm --filter @dofus/discord-bot dev` starts the bot using root `.env`. Production `start` reads environment directly.

Private character/profile/quest commands are restricted to the explicitly configured owner. The local backend currently has one principal; multi-user Discord account linking/OAuth is not implemented. Never share this backend token with other Discord users. Public item/almanax queries contain game data only. HTTPS is mandatory for remote backend URLs.

Implemented: private character registration modal, profile listing, character autocomplete, progress read/update with optimistic version and mutation UUID; public quest search and known steps; item search select menu and detail/rezept embed; shared recipe quantity/profit calculators; Almanax raw verified source response; persistent dungeon signups, FIFO waiting list, cross-guild/message checks, fifteen-minute reminders, private error responses. Group creation requires Manage Events. Start timestamps require an explicit ISO timezone. Buttons survive process restart because IDs resolve against SQLite, without transient collectors.

Dungeon data is currently a separate bot SQLite database, not visible in desktop. Reminders use a 60-second scheduler with persisted delivery acknowledgement. A crash after sending but before acknowledgement can repeat one reminder. Full guild management, multi-user account linking, builds, market commands and scheduled Almanax notifications are not implemented. Use a continuously running host for always-on availability; a bot on a powered-off PC is offline.

`pnpm --filter @dofus/discord-bot test` validates actual store persistence, waiting list promotion, authorization boundaries, reminders, command serialization, embed limits, backend URL transport and real local HTTP requests with error responses. Live login, registration and Discord interaction tests require a real token and server and have not been run.

References: https://discord.js.org/docs/packages/discord.js/14.27.0 ; https://discord.com/developers/docs/interactions/application-commands
