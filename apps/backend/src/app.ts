import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { timingSafeEqual } from "node:crypto";
import { z, ZodError } from "zod";
import { characterInput, progressInput } from "@dofus/core";
import { GameDataStore } from "@dofus/game-data";
import { PersonalStore, ConflictError } from "./store.js";
import { BuilderStore, registerBuilder, parseEffects } from "./builder.js";
import { registerWorld } from "./world.js";
import { registerDungeons } from "./dungeons.js";
import { registerTranslator } from "./translator.js";
import { registerActivity } from "./activity.js";
import { registerMapPreview } from "./map-preview.js";
import appPackage from "../package.json" with { type: "json" };
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
  await app.register(rateLimit, {
    max: (request) =>
      ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.ip)
        ? 1200
        : 120,
    timeWindow: "1 minute",
  });
  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS") return;
    const url = request.url.split("?")[0] ?? "";
    if (url.startsWith("/api/activity/")) return; // Activity validates its own scoped Discord sessions.
    const privateRoute =
      url.startsWith("/api/world/personal") ||
      (url === "/api/world/gathering" &&
        (!!(request.query as { characterId?: string }).characterId ||
          (request.query as { includePersonal?: string }).includePersonal ===
            "true")) ||
      url.startsWith("/api/dungeon-personal") ||
      url.startsWith("/api/profession-personal") ||
      url.startsWith("/api/translator") ||
      url.startsWith("/api/characters") ||
      url.startsWith("/api/account") ||
      url.startsWith("/api/builder/builds") ||
      url.startsWith("/api/builder/targets") ||
      url.startsWith("/api/builder/shares") ||
      request.method !== "GET" ||
      (url === "/api/quests" &&
        !!(request.query as { characterId?: string }).characterId);
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
      return reply.code(400).send({
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
      return reply.code(status).send({
        error: error instanceof Error ? error.message : "Ungültige Anfrage",
      });
    app.log.error(error);
    return reply
      .code(500)
      .send({ error: "Interner Fehler. Details im Backend-Protokoll." });
  });
  app.get("/health", () => ({ status: "ok", version: appPackage.version }));
  app.get("/api/status", () => ({
    data: {
      version: appPackage.version,
      mode: "local-single-owner",
      database: "sqlite",
      sources: [api.status()],
      gameData: game.status(),
    },
  }));
  const pageFields = {
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(30),
  };
  const builderStore = new BuilderStore(personal, game);
  registerBuilder(app, builderStore);
  const world = registerWorld(app, personal);
  registerMapPreview(app, world);
  const dungeonStore = registerDungeons(app, personal);
  await registerTranslator(app);
  registerActivity(app, personal, options.token, options.fetcher);
  app.get("/api/items", async (request) => {
    const filters = querySchema
      .extend({
        ...pageFields,
        category: categorySchema.removeDefault().optional(),
        mainGroup: z.enum(["equipment", "resources"]).optional(),
        typeId: z.coerce.number().int().positive().optional(),
        minLevel: z.coerce.number().int().min(0).max(200).optional(),
        maxLevel: z.coerce.number().int().min(0).max(200).optional(),
        effects: z.string().max(6000).optional(),
        effectMode: z.enum(["and", "or"]).default("and"),
        sort: z
          .enum(["name", "level", "level-asc", "level-desc"])
          .default("name"),
      })
      .parse(request.query);
    if (game.status().itemCount > 0) {
      const effectFilters = parseEffects(filters.effects);
      if (
        effectFilters.length &&
        !String(game.status().version).endsWith("3.7.12.12")
      )
        throw Object.assign(
          Error(
            "Effektindex und Gegenstandskatalog haben unterschiedliche Datenversionen. Builder-Daten aktualisieren oder Effektfilter entfernen.",
          ),
          { statusCode: 409 },
        );
      return game.searchItems({ ...filters, effectFilters });
    }
    if (filters.q.length < 2)
      return {
        data: [],
        total: 0,
        page: filters.page,
        pageSize: filters.pageSize,
        source: "Katalog noch nicht importiert",
      };
    const result = await api.search(filters.q, filters.lang, filters.category);
    return {
      ...result,
      total: result.data.length,
      page: 1,
      pageSize: 30,
      limited: true,
    };
  });
  app.get("/api/items/:id", async (request, reply) => {
    const id = idSchema.parse((request.params as { id: string }).id);
    const local = game.getItem(id);
    const query = z
      .object({
        category: categorySchema.optional(),
        lang: languageSchema,
        version: z.enum(["3.6.12.16", "3.7.12.12"]).optional(),
      })
      .parse(request.query);
    if (
      query.version &&
      query.version !== local?.version?.replace(/^v6\.0_/, "")
    ) {
      const item = builderStore.dataset.versions[query.version]?.items.find(
        (i) => i.id === id,
      );
      if (!item)
        return reply.code(404).send({
          error: "Gegenstand ist in diesem Datenstand nicht enthalten.",
        });
      return {
        data: {
          ...item,
          category: "equipment",
          description:
            "Historischer Ausrüstungsdatensatz. Rezeptdaten sind für diesen Stand nicht enthalten.",
          effects: item.effects.map((e) => e.label),
          numericEffects: item.effects,
          recipe: [],
          source: "dofus-sqlite",
          version: query.version,
        },
        version: query.version,
      };
    }
    if (local) {
      const version = local.version?.replace(/^v6\.0_/, ""),
        dataset = version ? builderStore.dataset.versions[version] : undefined;
      const numericEffects =
        dataset?.items.find((i) => i.id === id)?.effects ??
        dataset?.catalogEffects?.find((i) => i.itemId === id)?.effects;
      return {
        data: {
          ...local,
          ...(numericEffects ? { numericEffects } : {}),
          crafting:
            dungeonStore.dataset.versions[version ?? ""]?.craftingRecipes
              ?.filter((r) => r.itemId === id)
              .map((r) => ({
                ...r,
                jobName:
                  dungeonStore.dataset.versions[version!].professions.find(
                    (j) => j.id === r.jobId,
                  )?.name ?? "Beruf",
              })) ?? [],
        },
        source: local.source,
        version: local.version,
      };
    }
    if (query.category) return api.itemDetail(id, query.category, query.lang);
    return reply.code(404).send({
      error:
        "Gegenstand noch nicht im lokalen Katalog. Bitte Spieldaten importieren.",
    });
  });
  app.get("/api/item-types", () => ({ data: game.itemTypes() }));
  app.get("/api/classes", () => ({ data: game.classes() }));
  app.get("/api/quest-categories", () => ({ data: game.questCategories() }));
  app.post("/api/recognize", (request) => {
    const body = z
      .object({
        text: z.string().min(1).max(15000),
        kind: z.enum(["items", "quests"]),
      })
      .parse(request.body);
    return { data: game.recognize(body.text, body.kind) };
  });
  app.get("/api/almanax", (request) => {
    const { date, lang } = z
      .object({
        date: z.iso.date().default(
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
    const filters = querySchema
      .extend({
        ...pageFields,
        categoryId: z.string().max(100).optional(),
        minLevel: z.coerce.number().int().min(0).max(200).optional(),
        maxLevel: z.coerce.number().int().min(0).max(200).optional(),
        characterId: z.uuid().optional(),
        status: z.enum(["open", "active", "paused", "completed"]).optional(),
      })
      .parse(request.query);
    const progress = filters.characterId
      ? personal.progress(filters.characterId)
      : [];
    const ids =
      filters.characterId && filters.status && filters.status !== "open"
        ? progress
            .filter((p) => p.status === filters.status)
            .map((p) => p.questId)
        : undefined;
    const excludeIds =
      filters.status === "open"
        ? progress.filter((p) => p.status === "completed").map((p) => p.questId)
        : undefined;
    return {
      ...game.searchQuestPage({ ...filters, ids, excludeIds }),
      source: game.status().source,
      version: game.status().version,
    };
  });
  app.get("/api/quests/:id", (request, reply) => {
    const quest = game.getQuest(
      idSchema.parse((request.params as { id: string }).id),
    );
    return quest
      ? { data: quest }
      : reply.code(404).send({
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
    return reply.code(202).send({
      data: { message: "Import gestartet. Status unter /api/data/status." },
    });
  });
  app.get("/api/catalog/status", () => ({
    data: { ...game.status(), import: importState },
  }));
  app.post("/api/catalog/update", async (_request, reply) => {
    if (importState.running)
      return reply.code(409).send({ error: "Spieldatenimport läuft bereits." });
    importState = { running: true, lastResult: null, error: null };
    void game
      .updateLatest()
      .then((lastResult) => {
        personal.migrateClasses(game.classes());
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
      .send({ data: { message: "Vollständiger Katalogimport gestartet." } });
  });
  function characterData(raw: unknown) {
    const input = characterInput.parse(raw);
    if (input.omegaLevel && input.level !== 200)
      throw Object.assign(
        Error("Omega-Level ist erst ab Charakterstufe 200 verfügbar."),
        { statusCode: 400 },
      );
    const classes = game.classes();
    if (input.classId != null) {
      const selected = classes.find((c) => c.id === input.classId);
      if (!selected)
        throw Object.assign(
          new Error("Unbekannte Klassen-ID. Katalog zuerst importieren."),
          { statusCode: 400 },
        );
      return { ...input, className: selected.nameDe };
    }
    const normalized = (v: string) =>
      v.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
    const found = classes.filter((c) =>
      c.aliases.some(
        (a: string) => normalized(a) === normalized(input.className),
      ),
    );
    return { ...input, classId: found.length === 1 ? found[0].id : null };
  }
  app.get("/api/characters", () => {
    personal.migrateClasses(game.classes());
    return { data: personal.characters() };
  });
  app.post("/api/characters", (request, reply) =>
    reply.code(201).send({
      data: personal.createCharacter(characterData(request.body)),
    }),
  );
  app.put("/api/characters/:id", (request, reply) => {
    const id = z.uuid().parse((request.params as { id: string }).id);
    if (!personal.characters().some((c) => c.id === id))
      return reply.code(404).send({ error: "Charakter nicht gefunden." });
    const body = characterInput
      .safeExtend({ expectedVersion: z.number().int().positive() })
      .parse(request.body);
    return {
      data: personal.updateCharacter(
        id,
        characterData(body),
        body.expectedVersion,
      ),
    };
  });
  app.delete("/api/characters/:id", (request, reply) => {
    const id = z.uuid().parse((request.params as { id: string }).id);
    const count = Number(
      (
        personal.db
          .prepare(
            "SELECT count(*) n FROM builder_projects WHERE character_id=?",
          )
          .get(id) as { n: number }
      ).n,
    );
    const handling = z
      .object({ builds: z.enum(["keep", "delete"]).optional() })
      .parse(request.query);
    if (count && !handling.builds)
      return reply.code(409).send({
        error:
          "Charakter besitzt gespeicherte Builds. builds=keep zum Behalten oder builds=delete zum Löschen wählen.",
      });
    if (handling.builds === "delete")
      personal.db
        .prepare("DELETE FROM builder_projects WHERE character_id=?")
        .run(id);
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
    personal.db.exec(
      "DELETE FROM builder_shares; DELETE FROM builder_projects; DELETE FROM builder_target_profiles;",
    );
    for (const character of personal.characters())
      personal.deleteCharacter(character.id);
    return reply.code(204).send();
  });
  return app;
}
