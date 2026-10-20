import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { timingSafeEqual } from "node:crypto";
import { z, ZodError } from "zod";
import { characterInput, progressInput } from "@dofus/core";
import { GameDataStore } from "@dofus/game-data";
import { PersonalStore, ConflictError } from "./store.js";
import {
  Dofusdude,
  UpstreamError,
  languageSchema,
  categorySchema,
} from "./dofusdude.js";

export interface AppOptions {
  personal: PersonalStore;
  game: GameDataStore;
  token: string;
  fetcher?: typeof fetch;
  logger?: boolean;
}
const idSchema = z.coerce.number().int().positive();
const querySchema = z.object({
  q: z.string().trim().max(150).default(""),
  lang: languageSchema,
});
const allowedOrigins = new Set([
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "http://tauri.localhost",
  "https://tauri.localhost",
  "tauri://localhost",
]);

export async function createApp(options: AppOptions) {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 256 * 1024,
  });
  const { personal, game } = options;
  const api = new Dofusdude(personal, options.fetcher);
  let importState: {
    running: boolean;
    lastResult: unknown;
    error: string | null;
  } = { running: false, lastResult: null, error: null };
  await app.register(cors, {
    origin: (origin, callback) =>
      callback(null, !origin || allowedOrigins.has(origin)),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS") return;
    const url = request.url.split("?")[0] ?? "";
    const privateRoute =
      url.startsWith("/api/characters") ||
      url.startsWith("/api/account") ||
      request.method !== "GET";
    if (!privateRoute) return;
    const supplied =
      request.headers.authorization?.replace(/^Bearer /, "") ?? "";
    const actual = Buffer.from(options.token),
      provided = Buffer.from(supplied);
    if (
      actual.length < 32 ||
      actual.length !== provided.length ||
      !timingSafeEqual(actual, provided)
    )
      return reply
        .code(401)
        .send({ error: "Verbindungsschlüssel fehlt oder ist ungültig." });
    // Browser origins never grant authorization; bearer secret remains mandatory.
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError)
      return reply
        .code(400)
        .send({
          error: "Ungültige Eingabe",
          details: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
    if (error instanceof ConflictError)
      return reply
        .code(409)
        .send({ error: error.message, current: error.current });
    if (error instanceof UpstreamError)
      return reply.code(error.statusCode).send({ error: error.message });
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status < 500)
      return reply
        .code(status)
        .send({
          error: error instanceof Error ? error.message : "Ungültige Anfrage",
        });
    app.log.error(error);
    return reply
      .code(500)
      .send({ error: "Interner Fehler. Details im Backend-Protokoll." });
  });
  app.get("/health", () => ({ status: "ok", version: "0.1.0" }));
  app.get("/api/status", () => ({
    data: {
      version: "0.1.0",
      mode: "local-single-owner",
      database: "sqlite",
      sources: [api.status()],
      gameData: game.status(),
    },
  }));
  app.get("/api/items", async (request) => {
    const { q, lang, category } = querySchema
      .extend({
        category: z
          .enum(["equipment", "resources", "consumables", "quest", "cosmetics"])
          .optional(),
      })
      .parse(request.query);
    if (q.length < 2)
      return { data: [], source: "dofusdude", cached: false, stale: false };
    return api.search(q, lang, category);
  });
  app.get("/api/items/:id", async (request) => {
    const id = idSchema.parse((request.params as { id: string }).id);
    const { category, lang } = z
      .object({ category: categorySchema, lang: languageSchema })
      .parse(request.query);
    return api.itemDetail(id, category, lang);
  });
  app.get("/api/almanax", (request) => {
    const { date, lang } = z
      .object({
        date: z.iso
          .date()
          .default(
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "Europe/Paris",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date()),
          ),
        lang: languageSchema,
      })
      .parse(request.query);
    return api.almanax(date, lang);
  });
  app.get("/api/game/version", () => api.version());
  app.get("/api/quests", (request) => {
    const { q, lang } = querySchema.parse(request.query);
    return { data: game.searchQuests(q, lang), ...game.status() };
  });
  app.get("/api/quests/:id", (request, reply) => {
    const quest = game.getQuest(
      idSchema.parse((request.params as { id: string }).id),
    );
    return quest
      ? { data: quest }
      : reply
          .code(404)
          .send({
            error:
              "Quest nicht im lokalen Datenbestand. Spieldaten zuerst importieren.",
          });
  });
  app.get("/api/data/status", () => ({
    data: { ...game.status(), import: importState },
  }));
  app.post("/api/data/update", async (_request, reply) => {
    if (importState.running)
      return reply.code(409).send({ error: "Spieldatenimport läuft bereits." });
    importState = { running: true, lastResult: null, error: null };
    void game
      .updateLatest()
      .then((lastResult) => {
        importState = { running: false, lastResult, error: null };
      })
      .catch((error) => {
        importState = {
          running: false,
          lastResult: null,
          error:
            error instanceof Error ? error.message : "Import fehlgeschlagen",
        };
        app.log.error(error);
      });
    return reply
      .code(202)
      .send({
        data: { message: "Import gestartet. Status unter /api/data/status." },
      });
  });
  app.get("/api/characters", () => ({ data: personal.characters() }));
  app.post("/api/characters", (request, reply) =>
    reply
      .code(201)
      .send({
        data: personal.createCharacter(characterInput.parse(request.body)),
      }),
  );
  app.put("/api/characters/:id", (request, reply) => {
    const id = z.uuid().parse((request.params as { id: string }).id);
    if (!personal.characters().some((c) => c.id === id))
      return reply.code(404).send({ error: "Charakter nicht gefunden." });
    const body = characterInput
      .extend({ expectedVersion: z.number().int().positive() })
      .parse(request.body);
    return { data: personal.updateCharacter(id, body, body.expectedVersion) };
  });
  app.delete("/api/characters/:id", (request, reply) => {
    const id = z.uuid().parse((request.params as { id: string }).id);
    personal.deleteCharacter(id);
    return reply.code(204).send();
  });
  app.get("/api/characters/:id/progress", (request, reply) => {
    const id = z.uuid().parse((request.params as { id: string }).id);
    if (!personal.characters().some((c) => c.id === id))
      return reply.code(404).send({ error: "Charakter nicht gefunden." });
    return { data: personal.progress(id) };
  });
  app.put("/api/characters/:id/progress", (request, reply) => {
    const id = z.uuid().parse((request.params as { id: string }).id);
    if (!personal.characters().some((c) => c.id === id))
      return reply.code(404).send({ error: "Charakter nicht gefunden." });
    const body = progressInput.parse(request.body);
    const quest = game.getQuest(body.questId);
    if (!quest)
      return reply
        .code(404)
        .send({ error: "Quest nicht im importierten Spieldatenbestand." });
    if (body.step > quest.steps.length)
      return reply
        .code(400)
        .send({ error: "Questschritt außerhalb des bekannten Bereichs." });
    return { data: personal.saveProgress(id, body) };
  });
  app.get("/api/account/export", () => ({ data: personal.export() }));
  app.delete("/api/account", (_request, reply) => {
    for (const character of personal.characters())
      personal.deleteCharacter(character.id);
    return reply.code(204).send();
  });
  return app;
}
