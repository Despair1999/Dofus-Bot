import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

async function valid(path: string, size: number, digest: string) {
  if (!existsSync(path) || statSync(path).size !== size) return false;
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return `sha256:${hash.digest("hex")}` === digest;
}
/** Content-addressed cache; interrupted transfers resume, every completed file is hashed. */
export async function verifiedDownload(
  url: string,
  target: string,
  size: number,
  digest: string,
  progress: (percent: number) => void = () => {},
) {
  mkdirSync(dirname(target), { recursive: true });
  if (await valid(target, size, digest)) return target;
  const partial = target + ".part";
  let offset = existsSync(partial) ? statSync(partial).size : 0;
  if (offset >= size) {
    rmSync(partial, { force: true });
    offset = 0;
  }
  const response = await fetch(url, {
    headers: offset ? { Range: `bytes=${offset}-` } : {},
    signal: AbortSignal.timeout(600000),
  });
  if (!response.ok || !response.body)
    throw new Error(`Download fehlgeschlagen: ${response.status}`);
  if (response.status === 206) {
    const range = response.headers.get("content-range");
    if (!range?.startsWith(`bytes ${offset}-`) || !range.endsWith(`/${size}`))
      throw new Error("Ungültiger Fortsetzungsbereich");
  } else offset = 0; // Server ignores Range: safely replace the incomplete file.
  let received = offset;
  const guard = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (received > size)
        return callback(new Error("Download größer als angekündigt"));
      progress(Math.floor((received / size) * 65));
      callback(null, chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(response.body as any),
    guard,
    createWriteStream(partial, { flags: offset ? "a" : "w" }),
  );
  if (!(await valid(partial, size, digest))) {
    rmSync(partial, { force: true });
    throw new Error("Download-Prüfsumme oder Dateigröße stimmt nicht");
  }
  renameSync(partial, target);
  return target;
}
