import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifiedDownload } from "../src/download.js";

test("interrupted catalog download resumes, hashes bytes, and reuses verified cache", async () => {
  const bytes = Buffer.from("a real transfer fixture repeated ".repeat(100));
  const digest = "sha256:" + createHash("sha256").update(bytes).digest("hex");
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    const start = Number(req.headers.range?.match(/bytes=(\d+)-/)?.[1] ?? 0);
    if (requests === 1) assert.equal(start, 123);
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${bytes.length - 1}/${bytes.length}`,
    });
    res.end(bytes.subarray(start));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const folder = mkdtempSync(join(tmpdir(), "companion-download-"));
  try {
    const port = (server.address() as { port: number }).port;
    const target = join(folder, "fixture.sqlite");
    writeFileSync(target + ".part", bytes.subarray(0, 123));
    const url = `http://127.0.0.1:${port}/catalog`;
    await verifiedDownload(url, target, bytes.length, digest);
    assert.deepEqual(readFileSync(target), bytes);
    await verifiedDownload(url, target, bytes.length, digest);
    assert.equal(requests, 1);
    writeFileSync(target + ".part", bytes.subarray(0, 123));
    await assert.rejects(
      verifiedDownload(
        url,
        join(folder, "bad"),
        bytes.length,
        "sha256:" + "0".repeat(64),
      ),
    );
  } finally {
    server.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
