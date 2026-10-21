import test from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import Fastify from "fastify";
import { ZodError } from "zod";
import { mapPreview, registerMapPreview } from "../src/map-preview.js";
import { PersonalStore } from "../src/store.js";
import { WorldStore } from "../src/world.js";

// PNG decoder/validator checks framing, CRCs, dimensions and decoded pixels.
function decode(png: Buffer) {
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const table = Array.from({ length: 256 }, (_, value) => {
    for (let i = 0; i < 8; i++)
      value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    return value >>> 0;
  });
  let offset = 8,
    width = 0,
    height = 0;
  const blocks: Buffer[] = [];
  const names: string[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + length);
    assert.ok(offset + 12 + length <= png.length);
    let sum = 0xffffffff;
    for (const byte of png.subarray(offset + 4, offset + 8 + length))
      sum = (sum >>> 8) ^ table[(sum ^ byte) & 255];
    assert.equal(
      (sum ^ 0xffffffff) >>> 0,
      png.readUInt32BE(offset + 8 + length),
      type + " CRC",
    );
    names.push(type);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8);
      assert.equal(data[9], 2);
    }
    if (type === "IDAT") blocks.push(data);
    offset += length + 12;
  }
  assert.equal(names[0], "IHDR");
  assert.equal(names.at(-1), "IEND");
  assert.equal(offset, png.length);
  const pixels = inflateSync(Buffer.concat(blocks));
  assert.equal(pixels.length, height * (width * 3 + 1));
  for (let y = 0; y < height; y++) assert.equal(pixels[y * (width * 3 + 1)], 0);
  return {
    width,
    height,
    color: (x: number, y: number) => [
      ...pixels.subarray(
        y * (width * 3 + 1) + 1 + x * 3,
        y * (width * 3 + 1) + 1 + x * 3 + 3,
      ),
    ],
  };
}
test("PNG preview decodes with valid CRCs, start/target colors and only explicit route lines", () => {
  const points = [
    { x: 0, y: 0, start: true },
    { x: 3, y: 0, target: true },
  ];
  const image = decode(mapPreview(points, [[0, 1]], 200, 120));
  assert.equal(image.width, 200);
  assert.equal(image.height, 120);
  assert.deepEqual(image.color(75, 60), [160, 208, 112]);
  assert.deepEqual(image.color(125, 60), [235, 162, 102]);
  assert.deepEqual(image.color(100, 60), [217, 193, 115]);
  const unconnected = decode(mapPreview(points, [], 200, 120));
  assert.deepEqual(unconnected.color(100, 60), [19, 36, 28]);
  assert.throws(() => mapPreview([], []));
  assert.throws(() => mapPreview(points, [], 1001, 100));
  assert.throws(() => mapPreview(points, [], 0, 100));
  assert.throws(() => mapPreview(points, [], 12.5, 100));
  assert.throws(() => mapPreview([{ x: Infinity, y: 0 }], []));
});
test("Public preview endpoint bounds requests and ignores private personal marker state", async () => {
  const personal = new PersonalStore(":memory:"),
    store = new WorldStore(personal),
    app = Fastify();
  app.setErrorHandler((e, _req, reply) =>
    reply
      .code(
        e instanceof ZodError
          ? 400
          : ((e as { statusCode?: number }).statusCode ?? 500),
      )
      .send({ error: e instanceof Error ? e.message : String(e) }),
  );
  registerMapPreview(app, store);
  try {
    const map = store.dataset.maps.find((m) => m.worldId === 1)!;
    const before = await app.inject({
      url: `/api/world/preview.png?mapIds=${map.id}`,
    });
    assert.equal(before.statusCode, 200);
    assert.match(before.headers["content-type"]!, /^image\/png/);
    decode(before.rawPayload);
    personal.db
      .prepare("INSERT INTO world_markers VALUES(?,?,?,?,?)")
      .run(
        "private",
        map.id,
        store.dataset.version,
        JSON.stringify({ name: "TOP_SECRET_PERSONAL_MARKER", mapId: map.id }),
        new Date().toISOString(),
      );
    const after = await app.inject({
      url: `/api/world/preview.png?mapIds=${map.id}`,
    });
    assert.deepEqual(after.rawPayload, before.rawPayload);
    assert.equal(after.rawPayload.includes(Buffer.from("TOP_SECRET")), false);
    assert.equal(
      (await app.inject({ url: "/api/world/preview.png?mapIds=999999999999" }))
        .statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({
          url: `/api/world/preview.png?mapIds=${Array(61).fill(map.id).join(",")}`,
        })
      ).statusCode,
      400,
    );
    const other = store.dataset.maps.find((m) => m.worldId !== map.worldId)!;
    assert.equal(
      (
        await app.inject({
          url: `/api/world/preview.png?mapIds=${map.id},${other.id}`,
        })
      ).statusCode,
      400,
    );
  } finally {
    await app.close();
    store.close();
    personal.close();
  }
});
