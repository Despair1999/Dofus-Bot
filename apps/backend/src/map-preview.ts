import { deflateSync } from "node:zlib";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { WorldStore } from "./world.js";

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const label = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([size, label, data, crc]);
}
/** Small dependency-free rasterizer: bounded image, explicit graph lines only. */
export function mapPreview(
  points: { x: number; y: number; start?: boolean; target?: boolean }[],
  edges: [number, number][],
  width = 720,
  height = 440,
) {
  if (
    !points.length ||
    points.length > 3000 ||
    points.some(
      (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y),
    ) ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    width > 1000 ||
    height < 1 ||
    height > 1000
  )
    throw Error("Ungültiger Bildumfang");
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = 19;
    pixels[i + 1] = 36;
    pixels[i + 2] = 28;
  }
  const minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x)),
    minY = Math.min(...points.map((p) => p.y)),
    maxY = Math.max(...points.map((p) => p.y));
  const scale = Math.min(
    (width - 70) / Math.max(3, maxX - minX),
    (height - 70) / Math.max(3, maxY - minY),
  );
  const project = (p: { x: number; y: number }) => [
    Math.round((p.x - (minX + maxX) / 2) * scale + width / 2),
    Math.round((p.y - (minY + maxY) / 2) * scale + height / 2),
  ];
  const dot = (x: number, y: number, color: number[], radius = 1) => {
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        const px = x + dx,
          py = y + dy;
        if (
          px >= 0 &&
          py >= 0 &&
          px < width &&
          py < height &&
          dx * dx + dy * dy <= radius * radius + 1
        ) {
          const pos = (py * width + px) * 3;
          pixels[pos] = color[0];
          pixels[pos + 1] = color[1];
          pixels[pos + 2] = color[2];
        }
      }
  };
  for (let x = 0; x < width; x += 32)
    for (let y = 0; y < height; y++) dot(x, y, [32, 53, 39], 0);
  for (let y = 0; y < height; y += 32)
    for (let x = 0; x < width; x++) dot(x, y, [32, 53, 39], 0);
  for (const p of points) {
    const [x, y] = project(p);
    dot(x, y, [86, 119, 78], 2);
  }
  for (const [from, to] of edges) {
    if (!points[from] || !points[to]) continue;
    const [x1, y1] = project(points[from]),
      [x2, y2] = project(points[to]);
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let i = 0; i <= steps; i++)
      dot(
        Math.round(x1 + ((x2 - x1) * i) / Math.max(1, steps)),
        Math.round(y1 + ((y2 - y1) * i) / Math.max(1, steps)),
        [217, 193, 115],
        1,
      );
  }
  for (const p of points) {
    if (!p.start && !p.target) continue;
    const [x, y] = project(p);
    dot(x, y, [16, 30, 23], 10);
    dot(x, y, p.start ? [160, 208, 112] : [235, 162, 102], 6);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const scanlines = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++)
    pixels.copy(
      scanlines,
      y * (width * 3 + 1) + 1,
      y * width * 3,
      (y + 1) * width * 3,
    );
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
export function registerMapPreview(app: FastifyInstance, store: WorldStore) {
  const cache = new Map<string, Buffer>();
  app.get("/api/world/preview.png", (request, reply) => {
    const q = z
      .object({ mapIds: z.string().min(1).max(1200) })
      .parse(request.query);
    const ids = z
      .array(z.number().int().nonnegative())
      .min(1)
      .max(60)
      .parse(q.mapIds.split(",").map(Number));
    store.validateMaps(ids);
    const chosen = ids.map((id) => store.maps.get(id)!);
    if (new Set(chosen.map((m) => m.worldId)).size !== 1)
      return reply.code(400).send({
        error: "Verschiedene Weltkarten benötigen getrennte Vorschauen.",
      });
    const key = ids.join(",");
    let png = cache.get(key);
    if (!png) {
      const points = chosen.map((m, i) => ({
        x: m.x,
        y: m.y,
        start: i === 0,
        target: i === ids.length - 1,
      }));
      const edges: [number, number][] = [];
      for (let i = 1; i < ids.length; i++)
        if (
          store.dataset.transitions.some(
            (e) => e.from === ids[i - 1] && e.to === ids[i],
          )
        )
          edges.push([i - 1, i]);
      png = mapPreview(points, edges);
      if (cache.size >= 80) cache.delete(cache.keys().next().value!);
      cache.set(key, png);
    }
    return reply
      .header("Cache-Control", "public, max-age=3600")
      .type("image/png")
      .send(png);
  });
}
