import { randomBytes, pbkdf2Sync } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function prepareAccess({
  password,
  reuseLive = false,
  fetcher = fetch,
}) {
  if (reuseLive) {
    if (password)
      throw Error("Reuse and password rotation must not be combined.");
    // Already-public verifier, not a password or Firebase credential. Pin its origin.
    const r = await fetcher(
      "https://dofus-companion.web.app/access-config.json",
      {
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!r.ok)
      throw Error(
        "Existing preview verifier unavailable; refusing to replace it.",
      );
    const body = await r.text();
    if (body.length > 2048) throw Error("Oversized preview verifier.");
    const x = JSON.parse(body);
    if (
      !x ||
      x.version !== 1 ||
      x.scheme !== "pbkdf2-sha256" ||
      !Number.isInteger(x.iterations) ||
      x.iterations < 200000 ||
      x.iterations > 1000000 ||
      typeof x.salt !== "string" ||
      !/^[a-f0-9]{32}$/.test(x.salt) ||
      typeof x.verifier !== "string" ||
      !/^[a-f0-9]{64}$/.test(x.verifier)
    )
      throw Error(
        "Invalid live preview verifier; refusing to publish an unlocked build.",
      );
    return {
      version: 1,
      scheme: x.scheme,
      iterations: x.iterations,
      salt: x.salt,
      verifier: x.verifier,
    };
  }
  if (!password || password.length < 12)
    throw Error(
      "WEBSITE_PASSWORD fehlt oder ist kürzer als 12 Zeichen. Ohne Passwort wird kein Build erstellt.",
    );
  const iterations = 310000,
    salt = randomBytes(16);
  return {
    version: 1,
    scheme: "pbkdf2-sha256",
    iterations,
    salt: salt.toString("hex"),
    verifier: pbkdf2Sync(password, salt, iterations, 32, "sha256").toString(
      "hex",
    ),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const payload = await prepareAccess({
    password: process.env.WEBSITE_PASSWORD,
    reuseLive: process.argv.includes("--reuse-live"),
  });
  await mkdir(resolve("public"), { recursive: true });
  await writeFile(
    resolve("public/access-config.json"),
    JSON.stringify(payload),
  );
  console.log(
    "Preview verifier prepared (password is not embedded or changed on reuse).",
  );
}
