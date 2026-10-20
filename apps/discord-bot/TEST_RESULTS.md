# Discord validation · 2026-10-20

Windows, Node.js v22.15.0, pnpm 11.25.0, discord.js 14.27.0.

- `pnpm --filter @dofus/discord-bot typecheck`: exit 0.
- `pnpm --filter @dofus/discord-bot test`: exit 0, 9 tests passed, 0 failed, 0 skipped.
- Actual SQLite temporary file: persistence through reopen, duplicate signup, FIFO promotion, cross-guild rejection, message ID storage.
- Validation: bad capacity/title/past start rejected.
- Reminder window and persisted acknowledgement tested.
- Slash command serialization and names validated without Discord transport.
- Real discord.js embed/select builders tested against text limits.
- Persistent quest step pagination clamps bounds and exposes known steps through buttons.
- Personal data owner gate rejects unrelated users; public quest lookups allowed.
- Real loopback HTTP server: bearer header, JSON POST body, successful response, HTTP 503 and optimistic-write 409 handled.

No bot token was supplied. Login, command publication, Discord message rendering, real server permissions and end-to-end buttons/reminders have **not** been tested against Discord.

CI workflows, Docker build/start, native Windows installer and update signing were prepared; this report does not claim successful execution of those external jobs. Docker CLI is not available in the current shell. Release update signing needs repository configuration described in `infrastructure/RELEASES.md`.
