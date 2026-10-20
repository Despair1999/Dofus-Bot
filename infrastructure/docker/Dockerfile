FROM node:22-bookworm-slim
RUN npm install -g pnpm@11.25.0
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/backend ./apps/backend
COPY apps/discord-bot ./apps/discord-bot
RUN pnpm install --frozen-lockfile --filter @dofus/backend... --filter @dofus/discord-bot...
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4310
ENV DATA_DIR=/app/data
ENV DISCORD_DB_PATH=/app/data/discord.sqlite
EXPOSE 4310
CMD ["pnpm", "--filter", "@dofus/backend", "start"]
