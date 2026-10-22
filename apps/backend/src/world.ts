import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  planMapTour,
  estimateFarmValue,
  type WorldDataset,
  type WorldMarker,
} from "@dofus/core";
import type { PersonalStore } from "./store.js";

const id = z.coerce.number().int().nonnegative();
const normalize = (value: string) =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const routeInput = z.object({
  startMapId: id,
  targetMapIds: z.array(id).max(60),
  roundTrip: z.boolean().default(false),
  excludedMapIds: z.array(id).max(500).default([]),
});
export class WorldStore {
  readonly dataset: WorldDataset;
  readonly spatial = new DatabaseSync(":memory:");
  readonly maps;
  constructor(
    readonly personal: PersonalStore,
    path?: string,
  ) {
    const paths = [
      path,
      process.env.COMPANION_WORLD_DATA,
      join(dirname(fileURLToPath(import.meta.url)), "world-data.json"),
      resolve("packages/game-data/assets/world-data.json"),
      resolve("../../packages/game-data/assets/world-data.json"),
    ].filter((p): p is string => !!p);
    const file = paths.find((p) => existsSync(p));
    this.dataset = file
      ? JSON.parse(readFileSync(file, "utf8"))
      : {
          schemaVersion: 1,
          version: "unknown",
          importedAt: "",
          source: "",
          sourceSha256: "",
          mapsSha256: null,
          worlds: [],
          maps: [],
          resources: [],
          transitions: [],
          interactions: [],
          report: {},
        };
    if (this.dataset.schemaVersion !== 1)
      throw Error("Unbekanntes Weltkartenformat.");
    this.maps = new Map(this.dataset.maps.map((m) => [m.id, m]));
    // Node's bundled Windows SQLite has no RTree extension. Coordinate B-trees
    // keep viewport queries indexed without requiring native third-party modules.
    this.spatial.exec(
      "CREATE TABLE positions(id INTEGER PRIMARY KEY,minX REAL,maxX REAL,minY REAL,maxY REAL); CREATE INDEX positions_xy ON positions(minX,minY); CREATE INDEX positions_yx ON positions(minY,minX); BEGIN;",
    );
    const insert = this.spatial.prepare(
      "INSERT INTO positions VALUES(?,?,?,?,?)",
    );
    for (const map of this.dataset.maps)
      insert.run(map.id, map.x, map.x, map.y, map.y);
    this.spatial.exec("COMMIT");
    personal.db
      .exec(`CREATE TABLE IF NOT EXISTS world_markers(id TEXT PRIMARY KEY,map_id INTEGER NOT NULL,version TEXT NOT NULL,content TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS world_saved_routes(id TEXT PRIMARY KEY,version TEXT NOT NULL,content TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS world_marker_map ON world_markers(map_id,version);`);
  }
  markers(): WorldMarker[] {
    return (
      this.personal.db
        .prepare(
          "SELECT content FROM world_markers WHERE version=? ORDER BY updated_at DESC",
        )
        .all(this.dataset.version) as { content: string }[]
    ).map((r) => JSON.parse(r.content));
  }
  validateMaps(ids: number[]) {
    for (const mapId of ids)
      if (!this.maps.has(mapId))
        throw Object.assign(
          Error(`Karte ${mapId} ist im Datenstand nicht vorhanden.`),
          { statusCode: 400 },
        );
  }
  route(input: z.infer<typeof routeInput>) {
    this.validateMaps([input.startMapId, ...input.targetMapIds]);
    return planMapTour(
      this.dataset.transitions,
      input.startMapId,
      input.targetMapIds,
      input.roundTrip,
      input.excludedMapIds,
    );
  }
  close() {
    this.spatial.close();
  }
}

export function registerWorld(
  app: FastifyInstance,
  personal: PersonalStore,
  store = new WorldStore(personal),
) {
  const dataset = store.dataset;
  app.addHook("onClose", async () => store.close());
  app.get("/api/world/status", () => ({
    data: {
      ...dataset.report,
      version: dataset.version,
      importedAt: dataset.importedAt,
      source: dataset.source,
      sourceSha256: dataset.sourceSha256,
      mapsSha256: dataset.mapsSha256,
      schematicBackground: true,
      realtimeSpawns: false,
    },
  }));
  app.get("/api/world/worlds", () => ({
    data: dataset.worlds,
    version: dataset.version,
  }));
  app.get("/api/world/maps", (request) => {
    const q = z
      .object({
        worldId: id.optional(),
        areaId: id.optional(),
        subAreaId: id.optional(),
        ids: z
          .string()
          .max(32000)
          .transform((value) => z.array(id).max(2000).parse(value.split(",")))
          .optional(),
        q: z.string().max(150).default(""),
        minX: z.coerce.number().finite().default(-10000),
        maxX: z.coerce.number().finite().default(10000),
        minY: z.coerce.number().finite().default(-10000),
        maxY: z.coerce.number().finite().default(10000),
        limit: z.coerce.number().int().min(1).max(5000).default(1000),
      })
      .parse(request.query);
    const candidates = q.ids
      ? [...new Set(q.ids)]
          .filter((mapId) => store.maps.has(mapId))
          .map((mapId) => ({ id: mapId }))
      : (store.spatial
          .prepare(
            "SELECT id FROM positions WHERE minX>=? AND maxX<=? AND minY>=? AND maxY<=?",
          )
          .all(q.minX, q.maxX, q.minY, q.maxY) as { id: number }[]);
    const term = normalize(q.q);
    const coords = q.q.match(/^\[?\s*(-?\d+)\s*[,;]\s*(-?\d+)\s*\]?$/);
    const data = candidates
      .map((row) => store.maps.get(row.id)!)
      .filter(
        (m) =>
          (q.worldId === undefined || m.worldId === q.worldId) &&
          (q.areaId === undefined || m.areaId === q.areaId) &&
          (q.subAreaId === undefined || m.subAreaId === q.subAreaId) &&
          m.x >= q.minX &&
          m.x <= q.maxX &&
          m.y >= q.minY &&
          m.y <= q.maxY &&
          (!term ||
            (coords
              ? m.x === Number(coords[1]) && m.y === Number(coords[2])
              : normalize(
                  `${m.id} ${m.name} ${m.subAreaName} ${m.areaName}`,
                ).includes(term))),
      );
    return {
      data: data.slice(0, q.limit),
      total: data.length,
      version: dataset.version,
    };
  });
  app.get("/api/world/maps/:id", (request, reply) => {
    const mapId = id.parse((request.params as { id: string }).id);
    const map = store.maps.get(mapId);
    if (!map)
      return reply
        .code(404)
        .send({ error: "Karte im Datenstand nicht vorhanden." });
    return {
      data: map,
      interactions: dataset.interactions.filter((i) => i.mapId === mapId),
      transitions: dataset.transitions.filter((e) => e.from === mapId),
      version: dataset.version,
    };
  });
  app.get("/api/world/resources", (request) => {
    const q = z
      .object({
        q: z.string().max(150).default(""),
        jobId: id.optional(),
        maxLevel: z.coerce.number().int().min(0).max(200).optional(),
      })
      .parse(request.query);
    const term = normalize(q.q);
    const data = dataset.resources.filter(
      (r) =>
        (q.jobId === undefined || r.jobId === q.jobId) &&
        (q.maxLevel === undefined || r.level <= q.maxLevel) &&
        normalize(`${r.name} ${r.nameFr} ${r.nameEn} ${r.jobName}`).includes(
          term,
        ),
    );
    return { data, total: data.length, version: dataset.version };
  });
  app.get("/api/world/resources/:id", (request, reply) => {
    const resource = dataset.resources.find(
      (r) => r.id === id.parse((request.params as { id: string }).id),
    );
    if (!resource)
      return reply.code(404).send({ error: "Sammelressource nicht gefunden." });
    const regions = new Set(resource.regions.map((r) => r.id));
    return {
      data: resource,
      candidateMaps: dataset.maps.filter((m) => regions.has(m.subAreaId)),
      locationPrecision: "region-only",
      warning:
        "Untergebietsangabe ist kein bestätigtes Vorkommen auf jeder Karte.",
      version: dataset.version,
    };
  });
  app.post("/api/world/route", (request) => ({
    data: store.route(routeInput.parse(request.body)),
    version: dataset.version,
  }));
  app.get("/api/world/personal/markers", () => ({
    data: store.markers(),
    version: dataset.version,
  }));
  app.post("/api/world/personal/markers", (request) => {
    const input = z
      .object({
        mapId: id,
        name: z.string().trim().min(1).max(100),
        kind: z.enum(["waypoint", "resource", "observation"]),
        resourceId: id.optional(),
        note: z.string().max(1000).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      })
      .parse(request.body);
    store.validateMaps([input.mapId]);
    if (
      input.resourceId !== undefined &&
      !dataset.resources.some((r) => r.id === input.resourceId)
    )
      throw Object.assign(Error("Unbekannte Sammelressource."), {
        statusCode: 400,
      });
    if (input.kind !== "waypoint" && input.resourceId === undefined)
      throw Object.assign(Error("Beobachtung benötigt eine Sammelressource."), {
        statusCode: 400,
      });
    const marker = {
      ...input,
      id: randomUUID(),
      observedAt: new Date().toISOString(),
    };
    personal.db
      .prepare("INSERT INTO world_markers VALUES(?,?,?,?,?)")
      .run(
        marker.id,
        marker.mapId,
        dataset.version,
        JSON.stringify(marker),
        marker.observedAt,
      );
    return { data: marker };
  });
  app.delete("/api/world/personal/markers/:id", (request) => {
    const markerId = z.uuid().parse((request.params as { id: string }).id);
    personal.db.prepare("DELETE FROM world_markers WHERE id=?").run(markerId);
    return { data: { deleted: true } };
  });
  app.post("/api/world/farm-route", (request) => {
    const input = routeInput
      .omit({ targetMapIds: true })
      .extend({
        resourceIds: z.array(id).min(1).max(20),
        questId: id.optional(),
        areaIds: z.array(id).max(100).optional(),
        maxStops: z.number().int().min(1).max(60).default(30),
      })
      .parse(request.body);
    const resourceIds = new Set(input.resourceIds);
    // Quest restrictions are enforced here, independently of client-supplied filters.
    // Piocher's current item/quest IDs are corroborated by the 3.7 source;
    // Amakna-only gathering is documented by the linked profession guide.
    if (input.questId !== undefined && input.questId !== 945)
      throw Object.assign(Error("Für diese Berufsquest sind die gültigen Sammelgebiete noch nicht ausreichend geprüft."), {statusCode:400});
    if (input.questId === 945 && (input.resourceIds.length !== 1 || !dataset.resources.some(r=>resourceIds.has(r.id)&&r.itemId===442)))
      throw Object.assign(Error("Diese Quest verlangt Bronzevorkommen; andere Ressourcen sind dafür ungültig."), {statusCode:400});
    const areas = input.areaIds && new Set(input.areaIds);
    const nodes = store
      .markers()
      .filter(
        (m) =>
          m.kind !== "waypoint" &&
          m.resourceId !== undefined &&
          resourceIds.has(m.resourceId) &&
          (input.questId !== 945 || store.maps.get(m.mapId)?.areaId === 0) &&
          (!areas || areas.has(store.maps.get(m.mapId)!.areaId)),
      );
    const targetMapIds = [...new Set(nodes.map((m) => m.mapId))].slice(
      0,
      input.maxStops,
    );
    const route = store.route({ ...input, targetMapIds });
    return {
      data: route,
      observations: nodes,
      nodeCount: nodes.length,
      locationPrecision: "personal-observation",
      warning: targetMapIds.length
        ? "Persönliche Beobachtungen sind keine Echtzeit-Spawns."
        : "Keine eigenen bestätigten Fundorte. Untergebiete allein erlauben keine genaue Farmroute.",
      version: dataset.version,
    };
  });
  app.get("/api/world/personal/routes", () => ({
    data: (
      personal.db
        .prepare(
          "SELECT content FROM world_saved_routes ORDER BY updated_at DESC",
        )
        .all() as { content: string }[]
    ).map((r) => JSON.parse(r.content)),
  }));
  app.post("/api/world/personal/routes", (request) => {
    const input = routeInput
      .extend({ name: z.string().trim().min(1).max(100) })
      .parse(request.body);
    const saved = {
      id: randomUUID(),
      name: input.name,
      input,
      route: store.route(input),
      version: dataset.version,
      updatedAt: new Date().toISOString(),
    };
    personal.db
      .prepare("INSERT INTO world_saved_routes VALUES(?,?,?,?)")
      .run(saved.id, dataset.version, JSON.stringify(saved), saved.updatedAt);
    return { data: saved };
  });
  app.delete("/api/world/personal/routes/:id", (request) => {
    personal.db
      .prepare("DELETE FROM world_saved_routes WHERE id=?")
      .run(z.uuid().parse((request.params as { id: string }).id));
    return { data: { deleted: true } };
  });
  app.post("/api/world/farm-estimate", (request) => ({
    data: estimateFarmValue(
      z
        .object({
          nodeCount: z.number().nonnegative().max(100000),
          yieldPerNode: z.number().nonnegative().max(100000),
          availableFraction: z.number().min(0).max(1),
          gatherSeconds: z.number().nonnegative().max(86400),
          transitionSeconds: z.number().nonnegative().max(86400),
          transitions: z.number().int().nonnegative().max(100000),
          unitPrice: z.number().nonnegative().max(1e12).nullable(),
        })
        .parse(request.body),
    ),
  }));
  return store;
}

